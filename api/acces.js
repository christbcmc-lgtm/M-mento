// GET /api/acces?t=JETON — verifie le lien personnel et renvoie l'etat de l'espace.
// Incremente un compteur anti-fuite : au-dela du seuil, un code par matiere est exige.
const { db, admin } = require('./_lib/firebase');
const { verify } = require('./_lib/token');
const { send, methodGuard } = require('./_lib/http');
const { fusionner } = require('./_lib/catalogue');

const SEUIL = 5;

module.exports = async (req, res) => {
  if (!methodGuard(req, res, ['GET'])) return;
  try {
    const url = new URL(req.url, 'http://x');
    const t = url.searchParams.get('t') || '';
    const p = verify(t);
    if (!p || p.t !== 'perso') return send(res, 401, { ok: false, erreur: 'Lien invalide ou expire.', refaire: true });

    const base = db();
    const ref = base.collection('membres').doc(p.m);
    const doc = await ref.get();
    if (!doc.exists) return send(res, 404, { ok: false, erreur: 'Compte introuvable.', refaire: true });
    const m = doc.data();
    if (m.statut === 'suspendu' || m.statut === 'resilie') return send(res, 403, { ok: false, erreur: 'Acces suspendu. Contactez l\'administrateur.', refaire: false });
    if (m.statut !== 'actif') return send(res, 403, { ok: false, erreur: 'Acces non actif.', refaire: true });
    // Echeance d'acces (expiration reelle) : si depassee, l'acces est refuse.
    const exp = m.expireLe ? new Date(m.expireLe._seconds ? m.expireLe._seconds * 1000 : m.expireLe) : null;
    if (exp && !isNaN(exp) && exp.getTime() < Date.now()) {
      return send(res, 403, { ok: false, erreur: 'Votre acces est arrive a echeance.', expire: true, refaire: false });
    }

    const compteur = (m.compteurAcces || 0) + 1;
    await ref.update({ compteurAcces: admin.firestore.FieldValue.increment(1), dernierAcces: new Date() });

    // Catalogue complet (canonique + Firestore) : abonnees = cliquables, autres = estompees.
    const snap = await base.collection('matieres').get().catch(() => ({ docs: [] }));
    const cat = fusionner(snap.docs || []);
    const abo = m.matieres || {};
    const matieres = cat.map((x) => {
      const info = abo[x.id] || null;
      const abonne = !!(info && info.abonne);
      return {
        id: x.id, nom: x.nom, ordre: x.ordre || 0,
        bientot: !!x.bientot,
        abonne: abonne,
        besoinCode: !!(abonne && info.codeHash && compteur > SEUIL),
        // Ressources (PDF/livres) attachees a la matiere, visibles si abonne.
        ressources: abonne ? (Array.isArray(x.ressources) ? x.ressources : []) : []
      };
    });
    const exp2 = m.expireLe ? new Date(m.expireLe._seconds ? m.expireLe._seconds * 1000 : m.expireLe) : null;
    return send(res, 200, {
      ok: true,
      membre: { prenom: m.prenom || '', nom: m.nom || '', expireLe: exp2 && !isNaN(exp2) ? exp2.toISOString() : null },
      seuilAtteint: compteur > SEUIL,
      matieres
    });
  } catch (e) {
    return send(res, 500, { ok: false, erreur: 'Erreur serveur.' });
  }
};
