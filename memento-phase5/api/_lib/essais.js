// Essais gratuits (phase 3). Fonctions pures testables : db + mailer injectés.
// Un email = un essai (essais/{hashEmail}). Le compteur de temps repose sur
// utiliseLe stocké côté serveur : une actualisation ne le remet jamais à zéro.
const fs = require('fs');
const path = require('path');
const { validEmail } = require('./http');
const em = require('./emails');
const token = require('./token');
const mail = require('./mail');

const erreur = em.erreur;
function contenuDir() { return path.join(__dirname, '..', '..', 'contenu'); }
function lireExtrait() {
  try { return JSON.parse(fs.readFileSync(path.join(contenuDir(), '_essai', 'extrait.json'), 'utf8')); }
  catch (e) { return { titre: 'Aperçu', blocs: [] }; }
}

// --- admin?a=accorder-essai ---
async function accorderEssai(db, data, mailer, siteUrl) {
  const email = em.normaliser(data.email);
  if (!validEmail(email)) throw erreur(400, 'Email invalide.');
  const h = em.hacheEmail(email);
  const snap = await db.collection('essais').doc(h).get();
  if (snap.exists) throw erreur(409, 'Un essai existe déjà pour cette adresse.');
  let min = parseInt(data.dureeMin, 10);
  if (!(min >= 2 && min <= 5)) min = 5;
  const now = Date.now();
  await db.collection('essais').doc(h).set({
    nom: String(data.nom || '').slice(0, 80), prenom: String(data.prenom || '').slice(0, 80),
    email, dureeMin: min, creeLe: now, utiliseLe: 0
  });
  const lien = (siteUrl || '') + '/essai?i=' + token.signEssaiLien(h, min);
  await mailer(email, 'Votre essai gratuit — Mémento',
    mail.wrap('Essai gratuit',
      'Vous pouvez tester Mémento : aperçu limité dans le temps (' + min + ' min), en lecture seule, sans téléchargement.',
      { url: lien, texte: 'Démarrer l\'essai' }));
  return { ok: true, hash: h };
}

// --- public?a=essai (première ouverture pose le cookie mh_e) ---
async function ouvrirEssai(db, tok) {
  const p = token.verify(tok);
  if (!p || p.t !== 'essai_lien' || !p.h) throw erreur(410, 'Lien d\'essai invalide.');
  const ref = db.collection('essais').doc(p.h);
  const snap = await ref.get();
  if (!snap.exists) throw erreur(410, 'Essai introuvable.');
  const e = snap.data();
  const min = e.dureeMin || p.min || 5;
  const now = Date.now();
  let utiliseLe = e.utiliseLe || 0;
  if (!utiliseLe) { utiliseLe = now; await ref.update({ utiliseLe }); } // première ouverture
  const finMs = utiliseLe + min * 60000;
  if (now >= finMs) throw erreur(410, 'Essai terminé.');
  const restantSec = Math.ceil((finMs - now) / 1000);
  return { hash: p.h, restantSec, cookie: token.signEssaiCookie(p.h, restantSec) };
}

// --- public?a=essai-contenu (via cookie mh_e) ---
async function essaiContenu(db, cookieTok) {
  const p = token.verify(cookieTok);
  if (!p || p.t !== 'essai_c' || !p.h) throw erreur(401, 'Essai requis.');
  const snap = await db.collection('essais').doc(p.h).get();
  if (!snap.exists) throw erreur(410, 'Essai introuvable.');
  const e = snap.data();
  const min = e.dureeMin || 5;
  const now = Date.now();
  if (!e.utiliseLe || now >= e.utiliseLe + min * 60000) throw erreur(410, 'Essai terminé.');
  return { extrait: lireExtrait(), filigrane: e.email, lectureSeule: true };
}

async function listEssais(db) {
  const s = await db.collection('essais').get();
  const out = [];
  s.forEach((d) => {
    const x = d.data() || {};
    out.push({ hash: d.id, nom: x.nom || '', prenom: x.prenom || '', email: x.email || '', dureeMin: x.dureeMin || 0, utilise: !!x.utiliseLe });
  });
  return out;
}
async function supprimerEssai(db, hash) {
  await db.collection('essais').doc(String(hash || '')).delete();
  return { ok: true };
}

module.exports = { accorderEssai, ouvrirEssai, essaiContenu, listEssais, supprimerEssai };
