// Messagerie côté membre (H2 : MODÈLE COOKIE STRICT, sous-collection).
// L'authentification se fait UNIQUEMENT via le cookie de session mh_s (D4) :
// le repli par jeton personnel (?t= / body.t) est supprimé — aucune API ne lit
// plus l'URL après la première poignée de main.
//   GET  /api/message            -> renvoie le fil du membre (un doc par message).
//   POST /api/message { texte, pieces[]? }  -> le membre écrit à l'administrateur
//                                              (en-tête X-Requested-With: mh).
const sess = require('./_lib/session');
const msg = require('./_lib/messagerie');
const { readBody, send, clean } = require('./_lib/http');

let _dbFactory = () => require('./_lib/firebase').db();
function __setDbFactory(fn) { _dbFactory = fn; }

async function handler(req, res) {
  try {
    const base = _dbFactory();
    let body = {};
    if (req.method === 'POST') body = await readBody(req);

    // Cookie de session uniquement : plus aucun repli par jeton d'URL.
    let membre = null;
    try { const r = await sess.authentifier(base, req); membre = r.membre; } catch (e) { membre = null; }
    if (!membre) return send(res, 401, { ok: false, erreur: 'Session invalide.' });

    if (req.method === 'GET') {
      const items = await msg.listerFil(base, membre.id);
      return send(res, 200, { ok: true, items });
    }
    if (req.method === 'POST') {
      sess.exigerEntete(req); // X-Requested-With: mh exigé pour toute mutation
      const texte = clean(body.texte, msg.MAX_TEXTE);
      if (!texte) return send(res, 400, { ok: false, erreur: 'Message vide.' });
      const r = await msg.envoyerMembre(base, membre, texte, body.pieces);
      return send(res, 200, r);
    }
    return send(res, 405, { ok: false, erreur: 'M\u00e9thode non autoris\u00e9e.' });
  } catch (e) {
    return send(res, e.status || 500, { ok: false, erreur: e.message || 'Erreur serveur.' });
  }
}

module.exports = handler;
module.exports.__setDbFactory = __setDbFactory;
