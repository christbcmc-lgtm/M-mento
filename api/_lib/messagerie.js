// Messagerie — un fil par membre en SOUS-COLLECTION membres/{id}/messages/{auto}
// (un document par message), conformément à D17 et au modèle 3.3. Corrige A10 :
// on n'-écrase plus un tableau items[] relu puis réécrit en entier (plus de perte
// de message, sûr en concurrence). Les pièces jointes sont des liens HTTPS
// uniquement (recette B.10). Compteur de non-lus côté admin : membre.msgNonLusAdmin
// + compteurs/global.msgNonLus (cloche). Fonctions pures : la base est injectée.
const em = require('./emails');
const mail = require('./mail');

const erreur = em.erreur;
const MAX_TEXTE = 2000;

// Pièces jointes : on ne garde que des URL https:// (rejette javascript:, http:,
// data:, etc.), 10 au maximum, nom et url bornés.
function validerPieces(pieces) {
  if (!Array.isArray(pieces)) return [];
  const out = [];
  for (const x of pieces.slice(0, 10)) {
    const url = String((x && x.url) || '').trim().slice(0, 1000);
    if (!/^https:\/\//i.test(url)) continue;
    const nom = String((x && x.nom) || '').trim().slice(0, 120) || 'pi\u00e8ce';
    out.push({ nom, url });
  }
  return out;
}

// Incrémente un compteur global de façon atomique (jamais négatif).
async function incrGlobal(db, champ, n) {
  const ref = db.collection('compteurs').doc('global');
  await db.runTransaction(async (tx) => {
    const s = await tx.get(ref);
    const d = s.exists ? (s.data() || {}) : {};
    const v = (d[champ] || 0) + n;
    d[champ] = v < 0 ? 0 : v;
    tx.set(ref, d, { merge: true });
  });
}

// Incrémente le compteur de non-lus admin d'un membre (jamais négatif).
async function incrMembreNonLus(db, membreId, n) {
  const ref = db.collection('membres').doc(membreId);
  await db.runTransaction(async (tx) => {
    const s = await tx.get(ref);
    if (!s.exists) return;
    const d = s.data() || {};
    const v = (d.msgNonLusAdmin || 0) + n;
    tx.update(ref, { msgNonLusAdmin: v < 0 ? 0 : v });
  });
}

// Écrit un message (un document) dans le fil du membre.
async function ecrireMessage(db, membreId, de, texte, pieces) {
  const now = Date.now();
  const item = { de, texte, pieces: pieces || [], le: now };
  await db.collection('membres').doc(membreId).collection('messages').doc().set(item);
  return item;
}

// Liste le fil d'un membre, trié du plus ancien au plus récent.
async function listerFil(db, membreId) {
  const snap = await db.collection('membres').doc(membreId).collection('messages').get();
  const arr = [];
  snap.forEach((d) => {
    const x = d.data() || {};
    arr.push({ id: d.id, de: x.de, texte: x.texte, pieces: x.pieces || [], le: x.le || 0 });
  });
  arr.sort((a, b) => a.le - b.le);
  return arr;
}

// Le membre écrit à l'administrateur. Incrémente les non-lus (membre + global).
async function envoyerMembre(db, membre, texte, pieces) {
  const t = String(texte || '').trim().slice(0, MAX_TEXTE);
  if (!t) throw erreur(400, 'Message vide.');
  const p = validerPieces(pieces);
  await ecrireMessage(db, membre.id, 'membre', t, p);
  await incrMembreNonLus(db, membre.id, 1);
  await incrGlobal(db, 'msgNonLus', 1);
  return { ok: true };
}

// L'administrateur répond à un membre. Notifie le membre par email (sobre, sans
// l'adresse de l'admin) en meilleur effort ; l'échec d'envoi n'annule pas la réponse.
async function repondreAdmin(db, membreId, texte, pieces, mailer, siteUrl) {
  const ref = db.collection('membres').doc(membreId);
  const s = await ref.get();
  if (!s.exists) throw erreur(404, 'Membre introuvable.');
  const t = String(texte || '').trim().slice(0, MAX_TEXTE);
  if (!t) throw erreur(400, 'R\u00e9ponse vide.');
  const p = validerPieces(pieces);
  await ecrireMessage(db, membreId, 'admin', t, p);
  const email = (s.data() || {}).email || '';
  if (email && typeof mailer === 'function') {
    try {
      await mailer(email, 'R\u00e9ponse de l\'administrateur \u2014 M\u00e9mento',
        mail.wrap('Nouveau message', 'Vous avez une r\u00e9ponse dans votre espace M\u00e9mento.',
          { url: (siteUrl || '') + '/', texte: 'Ouvrir M\u00e9mento' }));
    } catch (e) { /* notification best-effort */ }
  }
  return { ok: true };
}

// Admin : marque le fil d'un membre comme lu (remet le compteur à 0).
async function marquerLuAdmin(db, membreId) {
  const ref = db.collection('membres').doc(membreId);
  const s = await ref.get();
  if (!s.exists) throw erreur(404, 'Membre introuvable.');
  const k = (s.data() || {}).msgNonLusAdmin || 0;
  if (k > 0) { await ref.update({ msgNonLusAdmin: 0 }); await incrGlobal(db, 'msgNonLus', -k); }
  return { ok: true, nonLus: 0 };
}

// Admin : liste des fils (colonne à la WhatsApp), triés par dernier message.
async function listerFilsAdmin(db) {
  const membres = await db.collection('membres').get();
  const fils = [];
  for (const d of membres.docs) {
    const m = d.data() || {};
    const items = await listerFil(db, d.id);
    if (!items.length && !(m.msgNonLusAdmin || 0)) continue;
    const dernier = items.length ? items[items.length - 1] : null;
    fils.push({
      id: d.id,
      nom: ((m.prenom || '') + ' ' + (m.nom || '')).trim(),
      email: m.email || '',
      items,
      nonLus: m.msgNonLusAdmin || 0,
      majLe: dernier ? dernier.le : (m.majLe || 0)
    });
  }
  fils.sort((a, b) => b.majLe - a.majLe);
  return fils;
}

// Admin : efface tout un fil (seul l'admin peut effacer — D17) et remet les non-lus à 0.
async function supprimerFil(db, membreId) {
  const ref = db.collection('membres').doc(membreId);
  const col = ref.collection('messages');
  const snap = await col.get();
  for (const d of snap.docs) { await col.doc(d.id).delete(); }
  const s = await ref.get();
  const k = s.exists ? ((s.data() || {}).msgNonLusAdmin || 0) : 0;
  if (k > 0) { await ref.update({ msgNonLusAdmin: 0 }); await incrGlobal(db, 'msgNonLus', -k); }
  return { ok: true };
}

module.exports = {
  validerPieces, listerFil, envoyerMembre, repondreAdmin,
  marquerLuAdmin, listerFilsAdmin, supprimerFil, MAX_TEXTE
};
