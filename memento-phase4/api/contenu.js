// api/contenu.js — contenu protégé (phase 4). Aucun cours n'est servi sans un
// contrôle d'accès côté serveur (cookie de session mh_s + abonnement à la matière).
// Actions (a=) : profil (matières du membre) | cours (contenu d'une matière).
const { send } = require('./_lib/http');
const contenu = require('./_lib/contenu');

let _dbFactory = () => require('./_lib/firebase').db();
function __setDbFactory(fn) { _dbFactory = fn; }

async function handler(req, res) {
  const db = _dbFactory();
  const url = new URL(req.url, 'http://x');
  const a = url.searchParams.get('a') || 'cours';
  try {
    if (req.method !== 'GET') return send(res, 405, { ok: false, erreur: 'Méthode non autorisée.' });
    if (a === 'profil') {
      const r = await contenu.profilMatieres(db, req);
      return send(res, 200, { ok: true, prenom: r.prenom, matieres: r.matieres });
    }
    if (a === 'cours') {
      const r = await contenu.servirCours(db, req, url.searchParams.get('m') || url.searchParams.get('matiere') || '');
      return send(res, 200, { ok: true, matiere: r.matiere, cours: r.cours });
    }
    return send(res, 404, { ok: false, erreur: 'Action inconnue.' });
  } catch (e) {
    return send(res, e.status || 500, { ok: false, erreur: e.message || 'Erreur interne.' });
  }
}

module.exports = handler;
module.exports.__setDbFactory = __setDbFactory;
