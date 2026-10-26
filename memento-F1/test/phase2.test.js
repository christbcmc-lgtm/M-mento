'use strict';
// Tests du noyau d'accès (phase 2). Hors ligne, base de données factice.
process.env.TOKEN_SECRET = 'test-secret-0123456789abcdef-xyz';
process.env.SITE_URL = '';

const test = require('node:test');
const assert = require('node:assert');
const { makeDb } = require('./fake-db');

const lim = require('../api/_lib/limites');
const em = require('../api/_lib/emails');
const sess = require('../api/_lib/session');
const secret = require('../api/_lib/secret');
const authHandler = require('../api/auth');

// ---- utilitaires de requête/réponse factices ----
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
  const h = Object.assign({ 'x-requested-with': 'mh', 'user-agent': 'test' }, o.headers || {});
  if (o.cookie) h.cookie = o.cookie;
  return { method: o.method || 'GET', url: o.url || '/api/auth', headers: h, body: o.body || {} };
}
function cookieDepuis(res) {
  const sc = res.headers['set-cookie'] || '';
  const m = String(sc).match(/mh_s=([^;]+)/);
  return m ? 'mh_s=' + m[1] : '';
}

// ===================== limites =====================
test('limiter: le 6e essai (max=5) renvoie 429 et le compteur persiste', async () => {
  const db = makeDb();
  for (let i = 1; i <= 5; i++) {
    const r = await lim.limiter(db, 'k1', 5, 900);
    assert.strictEqual(r.n, i);
  }
  await assert.rejects(() => lim.limiter(db, 'k1', 5, 900), (e) => e.status === 429);
  // Même une 7e tentative reste bloquée pendant la fenêtre.
  await assert.rejects(() => lim.limiter(db, 'k1', 5, 900), (e) => e.status === 429);
});

// ===================== unicité email =====================
test('emails: double verrou -> 409 ; liberer -> réutilisable', async () => {
  const db = makeDb();
  await em.verrouiller(db, 'A@Exemple.com', 'membre', 'M1');
  await assert.rejects(() => em.verrouiller(db, 'a@exemple.com', 'membre', 'M2'), (e) => e.status === 409);
  assert.strictEqual(await em.refDepuisEmail(db, 'a@exemple.com'), 'M1');
  await em.liberer(db, 'a@exemple.com');
  await assert.doesNotReject(() => em.verrouiller(db, 'a@exemple.com', 'membre', 'M2'));
});

// ===================== plafond d'appareils =====================
test('appareils: plafond 1 refuse le 2e, plafond 2 refuse le 3e', async () => {
  const db = makeDb();
  await db.collection('membres').doc('M1').set({ maxAppareils: 1 });
  await sess.enregistrerAppareil(db, 'M1', 'd1', 'ua', 1);
  await assert.rejects(() => sess.enregistrerAppareil(db, 'M1', 'd2', 'ua', 1), (e) => e.status === 403);
  // le même appareil est accepté (rafraîchissement)
  await assert.doesNotReject(() => sess.enregistrerAppareil(db, 'M1', 'd1', 'ua', 1));

  const db2 = makeDb();
  await sess.enregistrerAppareil(db2, 'M2', 'a', 'ua', 2);
  await sess.enregistrerAppareil(db2, 'M2', 'b', 'ua', 2);
  await assert.rejects(() => sess.enregistrerAppareil(db2, 'M2', 'c', 'ua', 2), (e) => e.status === 403);
});

// ===================== authentifier =====================
test('authentifier: sans cookie 401 ; tokenVersion différent 401 ; expiré 403', async () => {
  const db = makeDb();
  const now = Date.now();
  await db.collection('membres').doc('M1').set({ statut: 'actif', tokenVersion: 1, expireLe: now + 1e7 });
  await assert.rejects(() => sess.authentifier(db, makeReq({})), (e) => e.status === 401);
  // cookie signé avec v=0 alors que le membre est en v=1
  const tokBad = sess.signerSession('M1', 'd1', 0, now + 1e7);
  await assert.rejects(() => sess.authentifier(db, makeReq({ cookie: 'mh_s=' + tokBad })), (e) => e.status === 401);
  // membre expiré
  await db.collection('membres').doc('M1').update({ expireLe: now - 1000 });
  const tokOk = sess.signerSession('M1', 'd1', 1, now - 1000);
  await assert.rejects(() => sess.authentifier(db, makeReq({ cookie: 'mh_s=' + tokOk })),
    (e) => e.status === 403 && /expiré/.test(e.message));
});

// ===================== parcours auth complet =====================
test('auth.js: activer -> session -> acces ; 2e appareil refusé ; 6 codes faux -> 429', async () => {
  const db = makeDb();
  authHandler.__setDbFactory(() => db);
  const CLE = 'AB2CD-EF3GH-JK4LM-NP5QR';
  const CODE = 'GOOD2345';
  await db.collection('membres').doc('M1').set({
    prenom: 'Léa', nom: 'Dupont', statut: 'cle_emise', dureeJours: 30,
    maxAppareils: 1, tokenVersion: 0, matieres: ['thermo'],
    cleHash: secret.hash(CLE), codeHash: secret.hash(CODE)
  });
  await em.verrouiller(db, 'lea@exemple.com', 'membre', 'M1');

  // activer
  let res = makeRes();
  await authHandler(makeReq({ method: 'POST', url: '/api/auth?a=activer', body: { nom: 'Dupont', email: 'lea@exemple.com', cle: CLE } }), res);
  assert.strictEqual(res.statusCode, 200);
  assert.ok(res.body.lien && res.body.lien.includes('?t='));
  const t = res.body.lien.split('?t=')[1];

  // session (1er navigateur) -> pose le cookie
  res = makeRes();
  await authHandler(makeReq({ url: '/api/auth?a=session&t=' + t }), res);
  assert.strictEqual(res.statusCode, 200);
  const cookie = cookieDepuis(res);
  assert.ok(cookie, 'un cookie mh_s doit être posé');

  // acces avec cookie -> profil
  res = makeRes();
  await authHandler(makeReq({ url: '/api/auth?a=acces', cookie }), res);
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.profil.nom, 'Dupont');
  assert.strictEqual(res.body.deverrouille, false);

  // acces sans cookie -> 401
  res = makeRes();
  await authHandler(makeReq({ url: '/api/auth?a=acces' }), res);
  assert.strictEqual(res.statusCode, 401);

  // 2e navigateur (pas de cookie) -> nouvel appareil -> refusé (plafond 1)
  res = makeRes();
  await authHandler(makeReq({ url: '/api/auth?a=session&t=' + t }), res);
  assert.strictEqual(res.statusCode, 403);
  assert.match(res.body.erreur, /Appareil non autorisé/);

  // code : 5 essais faux -> 403, 6e -> 429
  for (let i = 1; i <= 5; i++) {
    res = makeRes();
    await authHandler(makeReq({ method: 'POST', url: '/api/auth?a=code', cookie, body: { code: 'WRONG000' } }), res);
    assert.strictEqual(res.statusCode, 403);
  }
  res = makeRes();
  await authHandler(makeReq({ method: 'POST', url: '/api/auth?a=code', cookie, body: { code: CODE } }), res);
  assert.strictEqual(res.statusCode, 429, 'le bon code reste refusé pendant la fenêtre');
});
