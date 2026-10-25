// Messagerie côté membre (phase 6 : modèle COOKIE).
// L'authentification se fait via le cookie de session mh_s (contrôle serveur),
// avec repli temporaire sur le jeton personnel (?t= / body.t) pour la transition.
//   GET  /api/message            -> renvoie le fil du membre.
//   POST /api/message { texte }  -> le membre écrit à l'administrateur (en-tête X-Requested-With: mh).
const { verify } = require('./_lib/token');
const sess = require('./_lib/session');
const { readBody, send, clean } = require('./_lib/http');

let _dbFactory = () => require('./_lib/firebase').db();
function __setDbFactory(fn) { _dbFactory = fn; }

// Identifie le membre : cookie de session d'abord, jeton personnel ensuite (repli).
async function identifier(base, req, body) {
  try { const { membre } = await sess.authentifier(base, req); if (membre) return membre; } catch (e) { /* pas de cookie valide */ }
  let tk = '';
  if (req.method === 'GET') tk = new URL(req.url, 'http://x').searchParams.get('t') || '';
  else tk = clean((body || {}).t, 2000);
  const p = verify(tk);
  if (p && p.t === 'perso' && p.m) {
    const d = await base.collection('membres').doc(p.m).get();
    if (d.exists) return Object.assign({ id: p.m }, d.data());
  }
  return null;
}

// Retrouve le fil du membre par email (scan + filtre : compatible fake-db et Firestore).
async function filDe(base, email) {
  const snap = await base.collection('messages').get();
  let id = null, data = null;
  snap.forEach((d) => { if (!id && ((d.data() || {}).email || '') === email) { id = d.id; data = d.data(); } });
  return id ? { id, data } : null;
}

async function handler(req, res) {
  try {
    const base = _dbFactory();
    let body = {};
    if (req.method === 'POST') body = await readBody(req);
    const membre = await identifier(base, req, body);
    if (!membre) return send(res, 401, { ok: false, erreur: 'Session invalide.' });
    const email = (membre.email || '').toLowerCase();

    if (req.method === 'GET') {
      const fil = await filDe(base, email);
      return send(res, 200, { ok: true, items: fil ? (fil.data.items || []) : [] });
    }
    if (req.method === 'POST') {
      sess.exigerEntete(req); // X-Requested-With: mh exigé pour toute mutation
      const texte = clean(body.texte, 2000);
      if (!texte) return send(res, 400, { ok: false, erreur: 'Message vide.' });
      const now = Date.now();
      const item = { de: 'membre', texte, pieces: [], le: now };
      const fil = await filDe(base, email);
      if (!fil) {
        await base.collection('messages').doc().set({
          email, nom: ((membre.prenom || '') + ' ' + (membre.nom || '')).trim(),
          statut: 'ouvert', items: [item], creeLe: now, majLe: now
        });
      } else {
        const items = (fil.data.items || []).concat(item);
        await base.collection('messages').doc(fil.id).update({ items, majLe: now, statut: 'ouvert' });
      }
      return send(res, 200, { ok: true });
    }
    return send(res, 405, { ok: false, erreur: 'Méthode non autorisée.' });
  } catch (e) {
    return send(res, e.status || 500, { ok: false, erreur: e.message || 'Erreur serveur.' });
  }
}

module.exports = handler;
module.exports.__setDbFactory = __setDbFactory;
