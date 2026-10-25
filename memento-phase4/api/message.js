// Messagerie cote membre.
// GET  /api/message?t=JETON            -> renvoie le fil du membre.
// POST /api/message { t, texte }        -> le membre ecrit a l'administrateur.
const { db } = require('./_lib/firebase');
const { verify } = require('./_lib/token');
const { readBody, send, clean } = require('./_lib/http');

async function filDe(base, email) {
  const snap = await base.collection('messages').where('email', '==', email).limit(1).get();
  return snap.empty ? null : snap.docs[0];
}

module.exports = async (req, res) => {
  try {
    const base = db();
    let token = '';
    if (req.method === 'GET') { token = new URL(req.url, 'http://x').searchParams.get('t') || ''; }
    let body = {};
    if (req.method === 'POST') { body = await readBody(req); token = clean(body.t, 2000); }
    const p = verify(token);
    if (!p || p.t !== 'perso') return send(res, 401, { ok: false, erreur: 'Session invalide.' });

    const mdoc = await base.collection('membres').doc(p.m).get();
    if (!mdoc.exists) return send(res, 404, { ok: false, erreur: 'Compte introuvable.' });
    const email = (mdoc.data().email || '').toLowerCase();

    if (req.method === 'GET') {
      const fil = await filDe(base, email);
      const items = fil ? (fil.data().items || []) : [];
      return send(res, 200, { ok: true, items });
    }
    if (req.method === 'POST') {
      const texte = clean(body.texte, 2000);
      if (!texte) return send(res, 400, { ok: false, erreur: 'Message vide.' });
      const now = new Date();
      const item = { de: 'membre', texte, pieces: [], le: now };
      let fil = await filDe(base, email);
      if (!fil) {
        await base.collection('messages').add({ email, nom: (mdoc.data().prenom || '') + ' ' + (mdoc.data().nom || ''), statut: 'ouvert', items: [item], creeLe: now, majLe: now });
      } else {
        const items = (fil.data().items || []).concat(item);
        await fil.ref.update({ items, majLe: now, statut: 'ouvert' });
      }
      return send(res, 200, { ok: true });
    }
    return send(res, 405, { ok: false, erreur: 'Methode non autorisee.' });
  } catch (e) {
    return send(res, 500, { ok: false, erreur: 'Erreur serveur.' });
  }
};
