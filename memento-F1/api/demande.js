// POST /api/demande — enregistre une demande d'acces et notifie l'administrateur.
const { db } = require('./_lib/firebase');
const { sendMail, wrap } = require('./_lib/mail');
const { readBody, send, methodGuard, validEmail, clean } = require('./_lib/http');

module.exports = async (req, res) => {
  if (!methodGuard(req, res, ['POST'])) return;
  try {
    const b = await readBody(req);
    const nom = clean(b.nom, 80), prenom = clean(b.prenom, 80);
    const email = clean(b.email, 160).toLowerCase();
    const matieres = clean(b.matieres, 300), message = clean(b.message, 1000);
    if (!nom || !prenom) return send(res, 400, { ok: false, erreur: 'Nom et prenom requis.' });
    if (!validEmail(email)) return send(res, 400, { ok: false, erreur: 'Email invalide.' });

    const base = db();
    const now = new Date();
    const dem = await base.collection('demandes').add({
      nom, prenom, email, matieres, message, statut: 'nouvelle', creeLe: now
    });
    // Fil de messages administrateur <-> demandeur, rattache a l'email.
    await base.collection('messages').add({
      email, nom: prenom + ' ' + nom, demandeRef: dem.id, statut: 'ouvert',
      items: [{ de: 'membre', texte: message || 'Nouvelle demande d\'acces.', pieces: [], le: now }],
      creeLe: now, majLe: now
    });
    // Notification a l'admin (adresse jamais exposee au client).
    const admin = process.env.ADMIN_EMAIL;
    if (admin) {
      await sendMail(admin, 'Nouvelle demande d\'acces — Memento',
        wrap('Nouvelle demande', '<b>' + prenom + ' ' + nom + '</b> (' + email + ')<br>' +
          'Matieres : ' + (matieres || '—') + '<br>Message : ' + (message || '—'))).catch(() => {});
    }
    return send(res, 200, { ok: true });
  } catch (e) {
    return send(res, 500, { ok: false, erreur: 'Erreur serveur.' });
  }
};
