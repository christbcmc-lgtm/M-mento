// POST /api/activer — premiere connexion : verifie nom+email+cle, active le membre,
// genere le lien personnel et l'envoie par email.
const { db } = require('./_lib/firebase');
const { sendMail, wrap } = require('./_lib/mail');
const { compare } = require('./_lib/secret');
const { signPersonnel } = require('./_lib/token');
const { readBody, send, methodGuard, validEmail, validCle, clean } = require('./_lib/http');

module.exports = async (req, res) => {
  if (!methodGuard(req, res, ['POST'])) return;
  try {
    const b = await readBody(req);
    const nom = clean(b.nom, 80);
    const email = clean(b.email, 160).toLowerCase();
    const cle = clean(b.cle, 40).toUpperCase();
    if (!nom) return send(res, 400, { ok: false, erreur: 'Nom requis.' });
    if (!validEmail(email)) return send(res, 400, { ok: false, erreur: 'Email invalide.' });
    if (!validCle(cle)) return send(res, 400, { ok: false, erreur: 'Format de cle invalide.' });

    const base = db();
    const snap = await base.collection('membres').where('email', '==', email).limit(1).get();
    if (snap.empty) return send(res, 404, { ok: false, erreur: 'Aucun acces en attente pour cet email.' });
    const doc = snap.docs[0];
    const m = doc.data();
    // La cle n'est utilisable qu'une seule fois, a la premiere connexion.
    if (m.statut !== 'cle_emise' || !m.cleHash) {
      return send(res, 409, { ok: false, erreur: 'Cet acces est deja active. Utilisez votre lien personnel.' });
    }
    if (!compare(cle, m.cleHash)) return send(res, 401, { ok: false, erreur: 'Cle incorrecte.' });

    const now = new Date();
    await doc.ref.update({ statut: 'actif', cleHash: null, activeLe: now, compteurAcces: 0 });
    const token = signPersonnel(doc.id, 180);
    const site = (process.env.SITE_URL || '').replace(/\/$/, '');
    const lien = site + '/espace.html?t=' + encodeURIComponent(token);
    await sendMail(email, 'Votre lien personnel — Memento',
      wrap('Acces active', 'Bonjour ' + (m.prenom || '') + ',<br>Votre acces est active. ' +
        'Ouvrez votre espace avec le lien personnel ci-dessous et conservez-le precieusement.',
        { url: lien, texte: 'Ouvrir mon espace' })).catch(() => {});
    return send(res, 200, { ok: true, lien });
  } catch (e) {
    return send(res, 500, { ok: false, erreur: 'Erreur serveur.' });
  }
};
