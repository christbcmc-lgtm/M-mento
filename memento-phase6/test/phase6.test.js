'use strict';
// Tests phase 6 : espace membre sur le MODÈLE COOKIE.
// On prouve que (a) le lien personnel s'échange contre un cookie de session,
// (b) le profil se lit via ce cookie, (c) la messagerie membre fonctionne au
// cookie en exigeant l'en-tête de mutation, avec un repli jeton personnel.
process.env.TOKEN_SECRET = 'test-secret-0123456789abcdef-xyz';
process.env.SITE_URL = '';

const test = require('node:test');
const assert = require('node:assert');
const { makeDb } = require('./fake-db');

const sess = require('../api/_lib/session');
const token = require('../api/_lib/token');
const authHandler = require('../api/auth');
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

async function baseMembre() {
  const db = makeDb();
  const exp = Date.now() + 1e8;
  await db.collection('membres').doc('M1').set({
    prenom: 'Léa', nom: 'D', email: 'lea@exemple.fr', statut: 'actif',
    tokenVersion: 0, expireLe: exp, maxAppareils: 1, matieres: ['thermo']
  });
  return { db, exp };
}
function cookieDepuis(res) {
  const sc = res.headers['set-cookie'] || '';
  const m = String(sc).match(/mh_s=([^;]+)/);
  return m ? ('mh_s=' + m[1]) : '';
}

// ============ 1) échange du lien personnel -> cookie de session ============
test('a=session échange le jeton personnel (?t=) contre un cookie mh_s', async () => {
  const { db } = await baseMembre();
  authHandler.__setDbFactory(() => db);
  const t = token.signPersonnel('M1', 180);
  const res = makeRes();
  await authHandler(makeReq({ url: '/api/auth?a=session&t=' + encodeURIComponent(t) }), res);
  assert.strictEqual(res.statusCode, 200);
  assert.ok(res.body.ok);
  const cookie = cookieDepuis(res);
  assert.ok(cookie.startsWith('mh_s='), 'un cookie de session doit être posé');
});

test('le cookie issu de a=session ouvre a=acces (profil + matières ids)', async () => {
  const { db } = await baseMembre();
  authHandler.__setDbFactory(() => db);
  const t = token.signPersonnel('M1', 180);
  const r1 = makeRes();
  await authHandler(makeReq({ url: '/api/auth?a=session&t=' + encodeURIComponent(t) }), r1);
  const cookie = cookieDepuis(r1);
  const r2 = makeRes();
  await authHandler(makeReq({ url: '/api/auth?a=acces', cookie }), r2);
  assert.strictEqual(r2.statusCode, 200);
  assert.strictEqual(r2.body.profil.prenom, 'Léa');
  assert.deepStrictEqual(r2.body.profil.matieres, ['thermo']);
  assert.strictEqual(r2.body.deverrouille, false);
});

// ============ 2) messagerie au cookie ============
test('GET /api/message sans cookie ni jeton -> 401', async () => {
  const { db } = await baseMembre();
  msgHandler.__setDbFactory(() => db);
  const res = makeRes();
  await msgHandler(makeReq({ url: '/api/message' }), res);
  assert.strictEqual(res.statusCode, 401);
});

test('GET /api/message au cookie -> fil vide au départ', async () => {
  const { db, exp } = await baseMembre();
  msgHandler.__setDbFactory(() => db);
  const cookie = 'mh_s=' + sess.signerSession('M1', 'd1', 0, exp);
  const res = makeRes();
  await msgHandler(makeReq({ url: '/api/message', cookie }), res);
  assert.strictEqual(res.statusCode, 200);
  assert.deepStrictEqual(res.body.items, []);
});

test('POST sans en-tête X-Requested-With -> 403 (mutation refusée)', async () => {
  const { db, exp } = await baseMembre();
  msgHandler.__setDbFactory(() => db);
  const cookie = 'mh_s=' + sess.signerSession('M1', 'd1', 0, exp);
  const res = makeRes();
  await msgHandler(makeReq({ method: 'POST', url: '/api/message', cookie, headers: { 'content-type': 'application/json' }, body: { texte: 'coucou' } }), res);
  assert.strictEqual(res.statusCode, 403);
});

test('POST puis GET au cookie : le message du membre apparaît', async () => {
  const { db, exp } = await baseMembre();
  msgHandler.__setDbFactory(() => db);
  const cookie = 'mh_s=' + sess.signerSession('M1', 'd1', 0, exp);
  const rp = makeRes();
  await msgHandler(makeReq({ method: 'POST', url: '/api/message', cookie, headers: mut(), body: { texte: 'Bonjour admin' } }), rp);
  assert.strictEqual(rp.statusCode, 200);
  assert.ok(rp.body.ok);
  const rg = makeRes();
  await msgHandler(makeReq({ url: '/api/message', cookie }), rg);
  assert.strictEqual(rg.statusCode, 200);
  assert.strictEqual(rg.body.items.length, 1);
  assert.strictEqual(rg.body.items[0].de, 'membre');
  assert.strictEqual(rg.body.items[0].texte, 'Bonjour admin');
});

test('POST message vide -> 400', async () => {
  const { db, exp } = await baseMembre();
  msgHandler.__setDbFactory(() => db);
  const cookie = 'mh_s=' + sess.signerSession('M1', 'd1', 0, exp);
  const res = makeRes();
  await msgHandler(makeReq({ method: 'POST', url: '/api/message', cookie, headers: mut(), body: { texte: '   ' } }), res);
  assert.strictEqual(res.statusCode, 400);
});

// ============ 3) repli jeton personnel (transition) ============
test('repli : GET /api/message?t=<jeton perso> fonctionne sans cookie', async () => {
  const { db } = await baseMembre();
  msgHandler.__setDbFactory(() => db);
  const t = token.signPersonnel('M1', 180);
  const res = makeRes();
  await msgHandler(makeReq({ url: '/api/message?t=' + encodeURIComponent(t) }), res);
  assert.strictEqual(res.statusCode, 200);
  assert.ok(res.body.ok);
  assert.ok(Array.isArray(res.body.items));
});

test('jeton invalide et pas de cookie -> 401', async () => {
  const { db } = await baseMembre();
  msgHandler.__setDbFactory(() => db);
  const res = makeRes();
  await msgHandler(makeReq({ url: '/api/message?t=nimportequoi' }), res);
  assert.strictEqual(res.statusCode, 401);
});
