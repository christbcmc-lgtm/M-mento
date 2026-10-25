// GET /api/acces?t=JETON — verifie le lien personnel et renvoie l'etat de l'espace.
// Incremente un compteur anti-fuite : au-dela du seuil, un code par matiere est exige.
const { db, admin } = require('./_lib/firebase');
const { verify } = require('./_lib/token');
const { send, methodGuard } = require('./_lib/http');

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
    if (m.statut !== 'actif') return send(res, 403, { ok: false, erreur: 'Acces non actif.', refaire: true });

    const compteur = (m.compteurAcces || 0) + 1;
    await ref.update({ compteurAcces: admin.firestore.FieldValue.increment(1), dernierAcces: new Date() });

    // Catalogue complet des matieres : abonnees = cliquables, autres = estompees.
    const cat = await base.collection('matieres').orderBy('ordre').get();
    const abo = m.matieres || {};
    const matieres = cat.docs.map((d) => {
      const x = d.data();
      const info = abo[d.id] || null;
      return {
        id: d.id, nom: x.nom, ordre: x.ordre || 0,
        abonne: !!(info && info.abonne),
        besoinCode: !!(info && info.abonne && info.codeHash && compteur > SEUIL)
      };
    });
    return send(res, 200, {
      ok: true,
      membre: { prenom: m.prenom || '', nom: m.nom || '' },
      seuilAtteint: compteur > SEUIL,
      matieres
    });
  } catch (e) {
    return send(res, 500, { ok: false, erreur: 'Erreur serveur.' });
  }
};
