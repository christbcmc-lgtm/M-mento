// api/auth.js — Noyau d'accès côté serveur (guide v2, section 3.1).
// Actions (paramètre a=) : activer | session | acces | code | lien-perdu | deconnexion.
// La réinitialisation du code (code-reset) est désormais PUBLIQUE : voir api/public.js.
// Tout le contrôle d'accès est ici. Les réponses d'erreur sont neutres : jamais
// d'indication permettant de deviner si un email existe.
const crypto = require('crypto');
const { readBody, send, validEmail, validCle, clean } = require('./_lib/http');
const secret = require('./_lib/secret');
const token = require('./_lib/token');
const sess = require('./_lib/session');
const lim = require('./_lib/limites');
const em = require('./_lib/emails');

// Fabrique de base de données (injectable pour les tests node --test).
let _dbFactory = () => require('./_lib/firebase').db();
function __setDbFactory(fn) { _dbFactory = fn; }

const DOUZE_H = 12 * 3600 * 1000;

function siteUrl() { return (process.env.SITE_URL || '').replace(/\/$/, ''); }
function lienPersonnel(membreId, dureeJours, tokenVersion) {
  return siteUrl() + '/espace?t=' + token.signPersonnel(membreId, dureeJours, tokenVersion || 0);
}

async function handler(req, res) {
  const db = _dbFactory();
  const url = new URL(req.url, 'http://x');
  const a = url.searchParams.get('a') || '';
  try {
    switch (a) {
      case 'activer':     return await activer(db, req, res);
      case 'session':     return await session(db, req, res, url);
      case 'acces':       return await acces(db, req, res);
      case 'code':        return await code(db, req, res);
      case 'lien-perdu':  return await lienPerdu(db, req, res);
      case 'deconnexion': return await deconnexion(db, req, res);
      default:            return send(res, 404, { ok: false, erreur: 'Action inconnue.' });
    }
  } catch (e) {
    return send(res, e.status || 500, { ok: false, erreur: e.message || 'Erreur interne.' });
  }
}

// --- activer : nom + email + clé -> active le compte, renvoie le lien personnel ---
async function activer(db, req, res) {
  if (req.method !== 'POST') return send(res, 405, { ok: false, erreur: 'Méthode non autorisée.' });
  sess.exigerEntete(req);
  const b = await readBody(req);
  const nom = clean(b.nom, 120);
  const email = em.normaliser(b.email);
  const cle = clean(b.cle, 40).toUpperCase();
  if (!nom || !validEmail(email) || !validCle(cle)) {
    return send(res, 400, { ok: false, erreur: 'Nom, email ou clé incorrect.' });
  }
  // Anti-force brute sur la clé, par IP.
  await lim.limiter(db, 'activer:' + lim.hacheIp(lim.ipClient(req)), 10, 3600);
  const neutre = { ok: false, erreur: 'Nom, email ou clé incorrect.' };
  const membreId = await em.refDepuisEmail(db, email);
  if (!membreId) return send(res, 400, neutre);
  const m = await sess.chargerMembre(db, membreId);
  if (!m || m.statut !== 'cle_emise') return send(res, 400, neutre);
  if (!m.cleHash || !secret.compare(cle, m.cleHash)) return send(res, 400, neutre);
  const now = Date.now();
  const duree = m.dureeJours || 180;
  const maj = { statut: 'actif', activeLe: now, majLe: now };
  if (!m.expireLe) maj.expireLe = now + duree * 86400000;
  await db.collection('membres').doc(membreId).update(maj);
  const lien = lienPersonnel(membreId, duree, m.tokenVersion || 0);
  // L'email de confirmation est branché en phase 3 ; ici on renvoie le lien.
  return send(res, 200, { ok: true, lien });
}

// --- session : échange le jeton personnel (?t=) contre un cookie de session ---
async function session(db, req, res, url) {
  const t = url.searchParams.get('t') || '';
  const p = token.verify(t);
  if (!p || p.t !== 'perso' || !p.m) return send(res, 401, { ok: false, erreur: 'Lien invalide.' });
  const m = await sess.chargerMembre(db, p.m);
  if (!m) return send(res, 401, { ok: false, erreur: 'Lien invalide.' });
  // Le lien est lié à la tokenVersion du membre : une régénération côté admin
  // incrémente cette version et périme d'un coup tous les anciens liens ?t=.
  if ((p.v || 0) !== (m.tokenVersion || 0)) return send(res, 401, { ok: false, erreur: 'Lien invalide.' });
  if (m.statut === 'suspendu') return send(res, 403, { ok: false, erreur: 'Accès suspendu.' });
  if (m.statut !== 'actif') return send(res, 403, { ok: false, erreur: 'Accès non activé.' });
  if (m.expireLe && Date.now() > m.expireLe) return send(res, 403, { ok: false, erreur: 'Accès expiré.' });
  // Réutilise l'appareil si un cookie valide du même membre existe déjà, sinon en crée un.
  let deviceId = null;
  const existant = sess.verifierSession(sess.lireCookie(req) || '');
  if (existant && existant.m === p.m && existant.d) deviceId = existant.d;
  if (!deviceId) deviceId = crypto.randomUUID();
  await sess.enregistrerAppareil(db, p.m, deviceId, req.headers && req.headers['user-agent'], m.maxAppareils || 1);
  res.setHeader('Set-Cookie', sess.cookieSession(sess.signerSession(p.m, deviceId, m.tokenVersion || 0, m.expireLe), m.expireLe));
  return send(res, 200, { ok: true });
}

// --- acces : profil + état de déverrouillage (lecture via cookie) ---
async function acces(db, req, res) {
  const { membre, deviceId } = await sess.authentifier(db, req);
  const app = await sess.etatAppareil(db, membre.id, deviceId);
  const deverrouille = !!(app && app.deverrouilleJusqua && app.deverrouilleJusqua > Date.now());
  return send(res, 200, {
    ok: true,
    profil: {
      prenom: membre.prenom || '', nom: membre.nom || '',
      matieres: Array.isArray(membre.matieres) ? membre.matieres : [],
      theme: membre.theme || 'clair',
      expireLe: membre.expireLe || null,
      maxAppareils: membre.maxAppareils || 1
    },
    deverrouille,
    deverrouilleJusqua: (app && app.deverrouilleJusqua) || 0
  });
}

// --- code : déverrouille l'appareil pour 12 h ---
async function code(db, req, res) {
  if (req.method !== 'POST') return send(res, 405, { ok: false, erreur: 'Méthode non autorisée.' });
  sess.exigerEntete(req);
  const { membre, deviceId } = await sess.authentifier(db, req);
  // 5 essais par fenêtre : le 6e déclenche 429 (et le bon code reste refusé jusqu'à la fin).
  await lim.limiter(db, 'code:' + membre.id, 5, 15 * 60);
  const b = await readBody(req);
  const saisi = clean(b.code, 16).toUpperCase();
  if (!membre.codeHash || !secret.compare(saisi, membre.codeHash)) {
    return send(res, 403, { ok: false, erreur: 'Code incorrect.' });
  }
  const jusqua = Date.now() + DOUZE_H;
  await db.collection('membres').doc(membre.id).collection('appareils').doc(deviceId).update({ deverrouilleJusqua: jusqua });
  return send(res, 200, { ok: true, deverrouilleJusqua: jusqua });
}

// --- lien-perdu : réponse neutre quel que soit le résultat (envoi email en phase 3) ---
async function lienPerdu(db, req, res) {
  if (req.method !== 'POST') return send(res, 405, { ok: false, erreur: 'Méthode non autorisée.' });
  sess.exigerEntete(req);
  const b = await readBody(req);
  const email = em.normaliser(b.email);
  if (validEmail(email)) {
    await lim.limiter(db, 'lienperdu:' + lim.hacheIp(lim.ipClient(req)), 5, 3600);
    // Si l'email correspond à un membre actif, l'email de rappel partira en phase 3.
  }
  return send(res, 200, { ok: true, message: 'Si un compte existe, un lien a été envoyé.' });
}

// --- deconnexion : efface le cookie ---
async function deconnexion(db, req, res) {
  res.setHeader('Set-Cookie', sess.cookieEffacer());
  return send(res, 200, { ok: true });
}

module.exports = handler;
module.exports.__setDbFactory = __setDbFactory;
