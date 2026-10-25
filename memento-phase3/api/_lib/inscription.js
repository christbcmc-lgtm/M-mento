// Circuit d'entrée (phase 3) : demande, décision (GET/refus), approbation.
// Fonctions pures testables : la base de données et l'expéditeur d'emails (mailer)
// sont INJECTÉS. Le mailer est async (to, subject, html).
const fs = require('fs');
const path = require('path');
const { validEmail } = require('./http');
const em = require('./emails');
const secret = require('./secret');
const token = require('./token');
const mail = require('./mail');

const erreur = em.erreur;
function esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function adminEmail() { return process.env.ADMIN_EMAIL || ''; }
function contenuDir() { return path.join(__dirname, '..', '..', 'contenu'); }
function catalogueIds() {
  try {
    const j = JSON.parse(fs.readFileSync(path.join(contenuDir(), 'catalogue.json'), 'utf8'));
    return (j.matieres || []).map((m) => m.id);
  } catch (e) { return []; }
}
async function incr(db, champ, n) {
  const ref = db.collection('compteurs').doc('global');
  await db.runTransaction(async (tx) => {
    const s = await tx.get(ref);
    const d = s.exists ? (s.data() || {}) : {};
    const v = (d[champ] || 0) + n;
    d[champ] = v < 0 ? 0 : v;
    tx.set(ref, d);
  });
}
async function journal(db, qui, action, cible) {
  await db.collection('journal').doc().set({ qui, action, cible: cible || null, le: Date.now() });
}

// --- public?a=demande ---
async function creerDemande(db, data, mailer, siteUrl) {
  const type = data.type === 'essai' ? 'essai' : 'abonnement';
  const nom = String(data.nom || '').trim().slice(0, 80);
  const prenom = String(data.prenom || '').trim().slice(0, 80);
  const email = em.normaliser(data.email);
  const message = String(data.message || '').slice(0, 1000);
  const ids = catalogueIds();
  const matieres = Array.isArray(data.matieres)
    ? data.matieres.map(String).filter((x) => ids.includes(x)) : [];
  if (!nom || !prenom) throw erreur(400, 'Nom et prénom requis.');
  if (!validEmail(email)) throw erreur(400, 'Email invalide.');
  // Verrou AVANT toute notification : un email déjà pris est refusé sans prévenir l'admin.
  await em.verrouiller(db, email, 'demande', null);
  const ref = db.collection('demandes').doc();
  const now = Date.now();
  await ref.set({ type, nom, prenom, email, matieres, message, statut: 'nouvelle', creeLe: now });
  await db.collection('emails').doc(em.hacheEmail(email)).update({ ref: ref.id }).catch(() => {});
  await incr(db, 'demandesNouvelles', 1);
  const lien = (siteUrl || '') + '/decision?d=' + token.signDecision(ref.id);
  await mailer(adminEmail(), 'Nouvelle demande d\'accès — Mémento',
    mail.wrap('Nouvelle demande',
      '<b>' + esc(prenom + ' ' + nom) + '</b> (' + esc(email) + ')<br>Type : ' + type +
      '<br>Matières : ' + (esc(matieres.join(', ')) || '—') + '<br>Message : ' + (esc(message) || '—'),
      { url: lien, texte: 'Ouvrir la décision' }));
  return { id: ref.id };
}

// --- public?a=decision (GET) ---
async function decisionGet(db, tok) {
  const p = token.verify(tok);
  if (!p || p.t !== 'decision' || !p.id) throw erreur(410, 'Lien invalide ou expiré.');
  const snap = await db.collection('demandes').doc(p.id).get();
  if (!snap.exists) throw erreur(410, 'Demande introuvable.');
  const d = snap.data();
  if (d.statut !== 'nouvelle') throw erreur(410, 'Cette demande a déjà été traitée.');
  return { id: p.id, type: d.type, nom: d.nom, prenom: d.prenom, email: d.email, matieres: d.matieres || [], message: d.message || '' };
}

// --- public?a=decision (POST refuser) ---
async function decisionRefus(db, tok, motif, mailer) {
  const p = token.verify(tok);
  if (!p || p.t !== 'decision' || !p.id) throw erreur(410, 'Lien invalide ou expiré.');
  const ref = db.collection('demandes').doc(p.id);
  const snap = await ref.get();
  if (!snap.exists) throw erreur(410, 'Demande introuvable.');
  const d = snap.data();
  if (d.statut !== 'nouvelle') throw erreur(410, 'Cette demande a déjà été traitée.');
  const m = String(motif || '').slice(0, 2000);
  await ref.update({ statut: 'rejetee', motif: m, traiteLe: Date.now() });
  await em.liberer(db, d.email);
  await incr(db, 'demandesNouvelles', -1);
  await journal(db, 'admin', 'rejet', p.id);
  await mailer(d.email, 'Suite à votre demande — Mémento',
    mail.wrap('Demande non retenue',
      'Bonjour,<br>Votre demande d\'accès à Mémento n\'a pas pu être acceptée pour le moment.' +
      (m ? '<br><br><b>Motif :</b> ' + esc(m) : '')));
  return { ok: true };
}

// --- admin?a=approuver ---
async function approuverDemande(db, params, mailer, siteUrl) {
  const ref = db.collection('demandes').doc(String(params.demandeId || ''));
  const snap = await ref.get();
  if (!snap.exists) throw erreur(410, 'Demande introuvable.');
  const d = snap.data();
  if (d.statut !== 'nouvelle') throw erreur(410, 'Cette demande a déjà été traitée.');
  const ids = catalogueIds();
  let matieres = Array.isArray(params.matieres) ? params.matieres.map(String).filter((x) => ids.includes(x)) : [];
  if (!matieres.length) matieres = (d.matieres || []).filter((x) => ids.includes(x));
  const dureeJours = Math.max(1, parseInt(params.dureeJours, 10) || 30);
  const maxAppareils = params.maxAppareils === 2 ? 2 : 1;
  const quotaHeures = Math.max(0, parseInt(params.quotaHeures, 10) || 0);
  const cle = secret.nouvelleCle();
  const code = secret.nouveauCode();
  const now = Date.now();
  const membreRef = db.collection('membres').doc();
  await membreRef.set({
    prenom: d.prenom, nom: d.nom, email: d.email, numero: '', statut: 'cle_emise',
    cleHash: secret.hash(cle), codeHash: secret.hash(code), matieres, dureeJours,
    maxAppareils, quotaHeures, tokenVersion: 0, theme: 'clair', creeLe: now, majLe: now
  });
  await db.collection('emails').doc(em.hacheEmail(d.email)).set({ type: 'membre', ref: membreRef.id, creeLe: now });
  await ref.update({ statut: 'traitee', traiteLe: now, membreId: membreRef.id });
  await incr(db, 'demandesNouvelles', -1);
  await journal(db, 'admin', 'approbation', membreRef.id);
  await mailer(d.email, 'Votre accès Mémento',
    mail.wrap('Accès accordé',
      'Bonjour ' + esc(d.prenom || '') + ',<br>Votre accès est prêt. À votre <b>première connexion</b>, ' +
      'saisissez votre nom, votre email et la clé ci-dessous :' +
      '<div style="font-size:20px;font-weight:800;letter-spacing:2px;margin:12px 0">' + cle + '</div>' +
      'Code de déverrouillage (à garder) : <b>' + code + '</b><br>Matières : ' + (esc(matieres.join(', ')) || '—') +
      '<br>Durée : ' + dureeJours + ' jours · Appareils : ' + maxAppareils,
      { url: (siteUrl || '') + '/', texte: 'Aller sur Mémento' }));
  return { membreId: membreRef.id };
}

module.exports = { creerDemande, decisionGet, decisionRefus, approuverDemande, catalogueIds, esc };
