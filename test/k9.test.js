// K9 (§9.C) : réponse aux abus. 10 refus d'authentification en 5 min depuis une
// même adresse → 429 avec MESSAGE EXACT + entrée journal de type `alerte` +
// compteur tableau de bord. Tests purs (base en mémoire, dépendances injectées).
const test = require('node:test');
const assert = require('node:assert');
const { makeDb } = require('./fake-db');
const lim = require('../api/_lib/limites');

const MSG_EXACT = 'Activité inhabituelle détectée. Cette adresse est temporairement bloquée et l\'administrateur en est informé.';
const IP = '203.0.113.9';

function deps() {
  return {
    journal: async (d, qui, action, cible, type) => {
      await d.collection('journal').doc('j_' + Math.random().toString(36).slice(2))
        .set({ qui, action, cible, type, le: Date.now() });
    },
    incr: async (d, champ, n) => {
      const ref = d.collection('compteurs').doc('global');
      const s = await ref.get(); const x = s.exists ? (s.data() || {}) : {};
      x[champ] = (x[champ] || 0) + n; await ref.set(x);
    }
  };
}
async function alertes(db) {
  const snap = await db.collection('journal').get();
  const out = []; snap.forEach((d) => { if ((d.data() || {}).type === 'alerte') out.push(d.data()); });
  return out;
}

test('K9 : le message exact et le seuil sont figés', () => {
  assert.strictEqual(lim.MSG_ABUS, MSG_EXACT, 'message 429 EXACT (§9.C)');
  assert.strictEqual(lim.MAX_REFUS_AUTH, 10, 'seuil 10 refus');
  assert.strictEqual(lim.FENETRE_ABUS_SEC, 300, 'fenêtre 5 min');
});

test('K9a : sous le seuil (9 refus), aucun blocage ni alerte', async () => {
  const db = makeDb(); const dp = deps();
  for (let i = 0; i < 9; i++) {
    const r = await lim.signalerRefusAuth(db, IP, dp);
    assert.strictEqual(r.bloque, false);
    assert.strictEqual(r.n, i + 1);
  }
  await lim.gardeAbus(db, IP); // ne jette pas
  assert.strictEqual((await alertes(db)).length, 0, 'pas encore d’alerte');
});

test('K9b : au 10e refus, 429 (MSG EXACT) + 1 alerte journal + compteur', async () => {
  const db = makeDb(); const dp = deps();
  for (let i = 0; i < 9; i++) await lim.signalerRefusAuth(db, IP, dp);
  await assert.rejects(() => lim.signalerRefusAuth(db, IP, dp),
    (e) => e.status === 429 && e.message === MSG_EXACT);
  const al = await alertes(db);
  assert.strictEqual(al.length, 1, 'exactement une entrée de type alerte');
  assert.strictEqual(al[0].action, 'abus_detecte');
  const cpt = await db.collection('compteurs').doc('global').get();
  assert.strictEqual((cpt.data() || {}).alertesAbus, 1, 'compteur tableau de bord = 1');
});

test('K9c : gardeAbus bloque ensuite sans rien incrémenter', async () => {
  const db = makeDb(); const dp = deps();
  for (let i = 0; i < 9; i++) await lim.signalerRefusAuth(db, IP, dp);
  await assert.rejects(() => lim.signalerRefusAuth(db, IP, dp), (e) => e.status === 429);
  const avant = (await db.collection('abus').doc(lim.hacheIp(IP)).get()).data().n;
  await assert.rejects(() => lim.gardeAbus(db, IP),
    (e) => e.status === 429 && e.message === MSG_EXACT);
  const apres = (await db.collection('abus').doc(lim.hacheIp(IP)).get()).data().n;
  assert.strictEqual(apres, avant, 'gardeAbus n’incrémente pas');
});

test('K9d : fenêtre écoulée → remise à zéro, plus de blocage', async () => {
  const db = makeDb(); const dp = deps();
  await db.collection('abus').doc(lim.hacheIp(IP))
    .set({ n: 10, debut: Date.now() - 301 * 1000, alerteEmise: true });
  const r = await lim.signalerRefusAuth(db, IP, dp);
  assert.strictEqual(r.n, 1, 'compteur remis à 1 après la fenêtre');
  assert.strictEqual(r.bloque, false);
});

test('K9e : l’alerte n’est écrite qu’une fois par blocage', async () => {
  const db = makeDb(); const dp = deps();
  for (let i = 0; i < 9; i++) await lim.signalerRefusAuth(db, IP, dp);
  await assert.rejects(() => lim.signalerRefusAuth(db, IP, dp), (e) => e.status === 429); // 10e
  await assert.rejects(() => lim.signalerRefusAuth(db, IP, dp), (e) => e.status === 429); // 11e
  assert.strictEqual((await alertes(db)).length, 1, 'une seule alerte malgré les refus suivants');
});
