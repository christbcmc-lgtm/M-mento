// api/evaluation.js — évaluations protégées (phase 5). Aucune évaluation n'est
// servie sans contrôle d'accès côté serveur (cookie de session mh_s + abonnement).
// Les BONNES RÉPONSES ne sont jamais envoyées avant la remise de la copie :
// la correction et la note /20 sont calculées ici, puis le résultat est archivé.
//
//   GET  ?a=liste&m=<matiere>            → liste des évaluations (sans réponses)
//   GET  ?a=quiz&m=<matiere>&q=<quizId>  → questions à passer (sans réponses)
//   GET  ?a=resultats[&m=<matiere>]      → historique des résultats du membre
//   POST ?a=soumettre  { m, q, reponses }→ corrige, note /20, archive, renvoie le détail
const { send, readBody } = require('./_lib/http');
const sess = require('./_lib/session');
const evalLib = require('./_lib/evaluation');

let _dbFactory = () => require('./_lib/firebase').db();
function __setDbFactory(fn) { _dbFactory = fn; }

async function handler(req, res) {
  const db = _dbFactory();
  const url = new URL(req.url, 'http://x');
  const a = url.searchParams.get('a') || 'liste';
  const mat = url.searchParams.get('m') || url.searchParams.get('matiere') || '';
  try {
    if (req.method === 'GET') {
      if (a === 'liste') {
        const acc = await evalLib.verifierAcces(db, req, mat);
        return send(res, 200, { ok: true, matiere: { id: acc.id, titre: acc.titre }, evaluations: evalLib.listeQuiz(acc.id) });
      }
      if (a === 'quiz') {
        const acc = await evalLib.verifierAcces(db, req, mat);
        const quiz = evalLib.quizPourPassage(acc.id, url.searchParams.get('q') || '');
        return send(res, 200, { ok: true, matiere: { id: acc.id, titre: acc.titre }, quiz });
      }
      if (a === 'resultats') {
        const { membre } = await sess.authentifier(db, req); // 401/403
        const liste = await evalLib.listeResultats(db, membre.id, mat || null);
        return send(res, 200, { ok: true, resultats: liste });
      }
      return send(res, 404, { ok: false, erreur: 'Action inconnue.' });
    }

    if (req.method === 'POST') {
      if (a !== 'soumettre') return send(res, 404, { ok: false, erreur: 'Action inconnue.' });
      sess.exigerEntete(req); // X-Requested-With: mh exigé pour toute mutation
      const acc = await evalLib.verifierAcces(db, req, mat); // 401/403/404
      const body = await readBody(req);
      const quizId = (body && body.q) || url.searchParams.get('q') || '';
      const resultat = evalLib.corriger(acc.id, quizId, body && body.reponses); // 404 si quiz inconnu
      const archive = await evalLib.enregistrerResultat(db, acc.membre.id, acc.id, resultat);
      return send(res, 200, { ok: true, resultat, archive });
    }

    return send(res, 405, { ok: false, erreur: 'Méthode non autorisée.' });
  } catch (e) {
    return send(res, e.status || 500, { ok: false, erreur: e.message || 'Erreur interne.' });
  }
}

module.exports = handler;
module.exports.__setDbFactory = __setDbFactory;
