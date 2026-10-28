// Sessions et appareils. Cookie mh_s = JWT { m, d, v } (membre, appareil, tokenVersion).
// HttpOnly; Secure; SameSite=Strict; Path=/. Le contrôle d'accès est TOUJOURS ici,
// jamais côté navigateur. Les mutations exigent l'en-tête X-Requested-With: mh.
const jwt = require('jsonwebtoken');

const COOKIE = 'mh_s';
const MAX_MS = 180 * 24 * 3600 * 1000; // plafond 180 jours

function erreur(status, message) { const e = new Error(message); e.status = status; return e; }
function secret() {
  const s = process.env.TOKEN_SECRET;
  if (!s || s.length < 16) throw new Error('TOKEN_SECRET manquant ou trop court.');
  return s;
}

// Durée du cookie = min(expireLe - maintenant, 180 j).
function dureeSec(expireLe) {
  const now = Date.now();
  if (expireLe && expireLe > now) return Math.floor(Math.min(expireLe - now, MAX_MS) / 1000);
  return Math.floor(MAX_MS / 1000);
}
function signerSession(membreId, deviceId, tokenVersion, expireLe) {
  return jwt.sign({ m: membreId, d: deviceId, v: tokenVersion || 0 }, secret(), { expiresIn: dureeSec(expireLe) });
}
function verifierSession(token) { try { return jwt.verify(token, secret()); } catch (e) { return null; } }

function cookieSession(token, expireLe) {
  return [COOKIE + '=' + token, 'HttpOnly', 'Secure', 'SameSite=Strict', 'Path=/', 'Max-Age=' + dureeSec(expireLe)].join('; ');
}
function cookieEffacer() {
  return COOKIE + '=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0';
}
function lireCookie(req) {
  const raw = (req.headers && (req.headers.cookie || req.headers.Cookie)) || '';
  const m = String(raw).match(/(?:^|;\s*)mh_s=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

// Toute requête qui modifie quelque chose doit porter X-Requested-With: mh.
function exigerEntete(req) {
  const h = (req.headers && (req.headers['x-requested-with'] || req.headers['X-Requested-With'])) || '';
  if (String(h) !== 'mh') throw erreur(403, 'Requête non autorisée.');
}

async function chargerMembre(db, membreId) {
  const snap = await db.collection('membres').doc(membreId).get();
  if (!snap.exists) return null;
  return Object.assign({ id: membreId }, snap.data());
}

// Enregistre / rafraîchit un appareil en respectant le plafond maxAppareils.
async function enregistrerAppareil(db, membreId, deviceId, ua, max) {
  const col = db.collection('membres').doc(membreId).collection('appareils');
  const snap = await col.get();
  let existe = false;
  snap.forEach((d) => { if (d.id === deviceId) existe = true; });
  const now = Date.now();
  const uaNet = String(ua || '').slice(0, 300);
  if (existe) { await col.doc(deviceId).update({ dernierLe: now, ua: uaNet }); return; }
  if (snap.size >= (max || 1)) throw erreur(403, 'Appareil non autorisé.');
  await col.doc(deviceId).set({ creeLe: now, dernierLe: now, ua: uaNet, deverrouilleJusqua: 0 });
}

// Vide TOUTE la sous-collection membres/{id}/appareils (D5 : l'admin peut vider
// la liste des appareils). Renvoie le nombre d'appareils supprimés. Idempotent :
// sur une liste vide, renvoie 0 sans erreur.
async function viderAppareils(db, membreId) {
  const col = db.collection('membres').doc(membreId).collection('appareils');
  const snap = await col.get();
  const ids = [];
  snap.forEach((d) => { ids.push(d.id); });
  for (const id of ids) { await col.doc(id).delete(); }
  return ids.length;
}

async function etatAppareil(db, membreId, deviceId) {
  const snap = await db.collection('membres').doc(membreId).collection('appareils').doc(deviceId).get();
  return snap.exists ? (snap.data() || {}) : null;
}

// Exige que le code ait été déverrouillé sur CET appareil (deverrouilleJusqua > maintenant).
// Sinon 403 « Code requis » : le cours et les évaluations ne sont pas servis.
async function exigerDeverrouillage(db, membreId, deviceId) {
  const app = await etatAppareil(db, membreId, deviceId);
  if (!app || !app.deverrouilleJusqua || app.deverrouilleJusqua <= Date.now()) {
    throw erreur(403, 'Code requis.');
  }
  return app.deverrouilleJusqua;
}

// Authentifie une requête à partir du cookie : recharge le membre et vérifie
// statut / expiration / tokenVersion à CHAQUE appel.
async function authentifier(db, req) {
  const tok = lireCookie(req);
  if (!tok) throw erreur(401, 'Session requise.');
  const p = verifierSession(tok);
  if (!p || !p.m) throw erreur(401, 'Session invalide.');
  const m = await chargerMembre(db, p.m);
  if (!m) throw erreur(401, 'Session invalide.');
  if ((m.tokenVersion || 0) !== (p.v || 0)) throw erreur(401, 'Session expirée.');
  if (m.statut === 'suspendu') throw erreur(403, 'Accès suspendu.');
  if (m.statut !== 'actif') throw erreur(403, 'Accès non activé.');
  if (m.expireLe && Date.now() > m.expireLe) throw erreur(403, 'Accès expiré.');
  return { membre: m, deviceId: p.d };
}

module.exports = {
  COOKIE, signerSession, verifierSession, cookieSession, cookieEffacer, lireCookie,
  exigerEntete, chargerMembre, enregistrerAppareil, viderAppareils, etatAppareil, exigerDeverrouillage, authentifier, erreur
};
