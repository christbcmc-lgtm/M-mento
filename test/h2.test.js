'use strict';
// H2 — Messagerie : sous-collection membres/{id}/messages (un doc par message),
// suppression du repli jeton personnel ?t=, pièces jointes https uniquement,
// compteur de non-lus admin. Chaque bloc : échoue AVANT, passe APRÈS.
process.env.TOKEN_SECRET = 'test-secret-0123456789abcdef-xyz';
process.env.SITE_URL = 'https://memento.test';
process.env.ADMIN_EMAIL = 'admin@memento.test';

const test = require('node:test');
const assert = require('node:assert');
const { makeDb } = require('./fake-db');

const sess = require('../api/_lib/session');
const token = require('../api/_lib/token');
const msg = require('../api/_lib/messagerie');
const msgHandler = require('../api/message');

function makeRes() {
  return {
    statusCode: 0, headers: {}, bodyRaw: '',
    setHeader(k, v) { this.headers[k.toLowerCase()] = v; },
    end(s) { this.bodyRaw = s || ''; },
    get body() { try { return JSON.parse(this.bodyRaw); } catch (e) { return {}; } }
  };
}
function makeReq(opts) {
  const o = opts || {};
  const h = Object.assign({ 'user-agent': 'test' }, o.headers || {});
  if (o.cookie) h.cookie = o.cookie;
  const r = { method: o.method || 'GET', url: o.url || '/api/message', headers: h };
  if (o.body !== undefined) {
    const data = JSON.stringify(o.body);
    let lu = false;
    r.on = (ev, cb) => { if (ev === 'data' && !lu) { lu = true; cb(Buffer.from(data)); } if (ev === 'end') cb(); };
  }
  return r;
}
function mut(extra) { return Object.assign({ 'x-requested-with': 'mh', 'content-type': 'application/json' }, extra || {}); }
function makeMailer() {
  const envoyes = [];
  const fn = async (to, subject, html) => { envoyes.push({ to, subject, html }); };
  fn.envoyes = envoyes;
  return fn;
}
async function baseMembre() {
  const db = makeDb();
  const exp = Date.now() + 1e8;
  await db.collection('membres').doc('M1').set({
    prenom: 'Léa', nom: 'D', email: 'lea@exemple.fr', statut: 'actif',
    tokenVersion: 0, expireLe: exp, maxAppareils: 1, matieres: ['thermo']
  });
  return { db, exp };
}
function cookie(exp) { return 'mh_s=' + sess.signerSession('M1', 'd1', 0, exp); }

// ===================== H2a : validation des pièces jointes (https only) =====================
test('H2a : validerPieces ne garde que les URL https (rejette javascript:, http:, data:)', () => {
  const p = msg.validerPieces([
    { nom: 'ok', url: 'https://exemple.fr/a.pdf' },
    { nom: 'xss', url: 'javascript:alert(1)' },
    { nom: 'clair', url: 'http://exemple.fr/b.pdf' },
    { nom: 'data', url: 'data:text/html,<b>x</b>' },
    { url: 'https://exemple.fr/c.png' }
  ]);
  assert.strictEqual(p.length, 2, 'seules les 2 URL https doivent passer');
  assert.deepStrictEqual(p.map((x) => x.url), ['https://exemple.fr/a.pdf', 'https://exemple.fr/c.png']);
  assert.strictEqual(p[1].nom, 'pièce', 'nom par défaut si absent');
});

// ===================== H2b : un message = un document (pas de réécriture globale) =====================
test('H2b : chaque message membre crée UN document dans membres/{id}/messages', async () => {
  const { db } = await baseMembre();
  const membre = { id: 'M1', email: 'lea@exemple.fr' };
  await msg.envoyerMembre(db, membre, 'premier', []);
  await msg.envoyerMembre(db, membre, 'second', []);
  const col = await db.collection('membres').doc('M1').collection('messages').get();
  assert.strictEqual(col.size, 2, 'deux documents distincts, aucun écrasement');
  const items = await msg.listerFil(db, 'M1');
  assert.deepStrictEqual(items.map((x) => x.texte), ['premier', 'second']);
  assert.ok(items.every((x) => x.de === 'membre'));
});

// ===================== H2c : compteur de non-lus admin =====================
test('H2c : chaque message membre incrémente msgNonLusAdmin + compteurs/global.msgNonLus', async () => {
  const { db } = await baseMembre();
  const membre = { id: 'M1', email: 'lea@exemple.fr' };
  await msg.envoyerMembre(db, membre, 'a', []);
  await msg.envoyerMembre(db, membre, 'b', []);
  const m = (await db.collection('membres').doc('M1').get()).data();
  assert.strictEqual(m.msgNonLusAdmin, 2);
  const g = (await db.collection('compteurs').doc('global').get()).data();
  assert.strictEqual(g.msgNonLus, 2);
  // L'admin ouvre la conversation : remise à zéro.
  await msg.marquerLuAdmin(db, 'M1');
  assert.strictEqual((await db.collection('membres').doc('M1').get()).data().msgNonLusAdmin, 0);
  assert.strictEqual((await db.collection('compteurs').doc('global').get()).data().msgNonLus, 0);
});

// ===================== H2d : réponse admin + notification + fil ordonné =====================
test('H2d : repondreAdmin ajoute un message de:admin, notifie le membre, n\'incrémente pas les non-lus', async () => {
  const { db } = await baseMembre();
  const membre = { id: 'M1', email: 'lea@exemple.fr' };
  await msg.envoyerMembre(db, membre, 'bonjour', []);
  const mailer = makeMailer();
  const r = await msg.repondreAdmin(db, 'M1', 'bonjour à vous', [{ nom: 'doc', url: 'https://x.fr/d.pdf' }], mailer, 'https://memento.test');
  assert.strictEqual(r.ok, true);
  const items = await msg.listerFil(db, 'M1');
  assert.strictEqual(items.length, 2);
  assert.strictEqual(items[1].de, 'admin');
  assert.strictEqual(items[1].pieces.length, 1);
  // La notification part au membre, sans adresse admin visible.
  assert.strictEqual(mailer.envoyes.length, 1);
  assert.strictEqual(mailer.envoyes[0].to, 'lea@exemple.fr');
  assert.ok(!mailer.envoyes[0].html.includes('admin@memento.test'), 'l\'adresse admin ne doit jamais apparaître');
  // La réponse admin ne change pas le compteur de non-lus admin (toujours 1 du membre).
  assert.strictEqual((await db.collection('membres').doc('M1').get()).data().msgNonLusAdmin, 1);
});

test('H2d\' : repondreAdmin sur un membre inconnu -> 404', async () => {
  const { db } = await baseMembre();
  let status = 0;
  try { await msg.repondreAdmin(db, 'ZZZ', 'x', [], makeMailer(), ''); } catch (e) { status = e.status; }
  assert.strictEqual(status, 404);
});

// ===================== H2e : liste admin + suppression de fil =====================
test('H2e : listerFilsAdmin expose le fil (id=membreId) ; supprimerFil efface tout', async () => {
  const { db } = await baseMembre();
  const membre = { id: 'M1', email: 'lea@exemple.fr' };
  await msg.envoyerMembre(db, membre, 'un', []);
  const fils = await msg.listerFilsAdmin(db);
  assert.strictEqual(fils.length, 1);
  assert.strictEqual(fils[0].id, 'M1');
  assert.strictEqual(fils[0].email, 'lea@exemple.fr');
  assert.strictEqual(fils[0].items.length, 1);
  assert.strictEqual(fils[0].nonLus, 1);
  // Suppression (admin seul) : fil vidé + non-lus remis à 0.
  await msg.supprimerFil(db, 'M1');
  assert.strictEqual((await msg.listerFil(db, 'M1')).length, 0);
  assert.strictEqual((await db.collection('membres').doc('M1').get()).data().msgNonLusAdmin, 0);
  assert.strictEqual((await db.collection('compteurs').doc('global').get()).data().msgNonLus, 0);
});

// ===================== H2f : le handler membre n'accepte QUE le cookie =====================
test('H2f : GET /api/message?t=<jeton perso> sans cookie -> 401 (repli supprimé)', async () => {
  const { db } = await baseMembre();
  msgHandler.__setDbFactory(() => db);
  const t = token.signPersonnel('M1', 180);
  const res = makeRes();
  await msgHandler(makeReq({ url: '/api/message?t=' + encodeURIComponent(t) }), res);
  assert.strictEqual(res.statusCode, 401);
});

test('H2f\' : POST au cookie puis GET : le fil du membre apparaît via la sous-collection', async () => {
  const { db, exp } = await baseMembre();
  msgHandler.__setDbFactory(() => db);
  const rp = makeRes();
  await msgHandler(makeReq({ method: 'POST', url: '/api/message', cookie: cookie(exp), headers: mut(), body: { texte: 'Bonjour admin', pieces: [{ nom: 'x', url: 'javascript:alert(1)' }] } }), rp);
  assert.strictEqual(rp.statusCode, 200);
  const rg = makeRes();
  await msgHandler(makeReq({ url: '/api/message', cookie: cookie(exp) }), rg);
  assert.strictEqual(rg.statusCode, 200);
  assert.strictEqual(rg.body.items.length, 1);
  assert.strictEqual(rg.body.items[0].texte, 'Bonjour admin');
  assert.strictEqual(rg.body.items[0].pieces.length, 0, 'la pièce javascript: doit avoir été rejetée');
});
