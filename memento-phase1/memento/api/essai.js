// POST /api/essai — delivre un jeton d'essai gratuit STRICT (juste pour visualiser le site).
// Lecture seule, sans code, sans telechargement. Limites de temps par zone (cote serveur).
// GET /api/essai?t=JETON -> renvoie les limites restantes (le client applique les minuteries).
const { db } = require('./_lib/firebase');
const { signEssai, verify } = require('./_lib/token');
const { readBody, send, clean } = require('./_lib/http');

// Durees volontairement courtes (secondes) : empeche l'essai de servir au piratage.
const LIMITES = { cours: 300, evaluation: 90, revision: 90, exercices: 120 };
const DUREE_GLOBALE_MIN = 15;

module.exports = async (req, res) => {
  try {
    if (req.method === 'POST') {
      const b = await readBody(req);
      // Un essai est autorise par l'admin : on exige un jeton d'invitation d'essai.
      const inv = clean(b.invitation, 2000);
      const pi = verify(inv);
      if (!pi || pi.t !== 'invite_essai') {
        return send(res, 403, { ok: false, erreur: 'Essai non autorise.' });
      }
      const doc = await db().collection('essais').add({ creeLe: new Date(), origine: 'invitation' });
      const token = signEssai(doc.id, DUREE_GLOBALE_MIN);
      return send(res, 200, { ok: true, token, limites: LIMITES, dureeGlobaleMin: DUREE_GLOBALE_MIN });
    }
    if (req.method === 'GET') {
      const url = new URL(req.url, 'http://x');
      const p = verify(url.searchParams.get('t') || '');
      if (!p || p.t !== 'essai') return send(res, 401, { ok: false, erreur: 'Essai expire.' });
      return send(res, 200, { ok: true, limites: LIMITES, lectureSeule: true });
    }
    return send(res, 405, { ok: false, erreur: 'Methode non autorisee.' });
  } catch (e) {
    return send(res, 500, { ok: false, erreur: 'Erreur serveur.' });
  }
};
