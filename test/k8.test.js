// K8 (D21/D22) : maintenance admin — journal d'audit, rapport de stockage,
// purge ciblée. Tests purs sur la base en mémoire (aucun réseau, aucun firebase).
const test = require('node:test');
const assert = require('node:assert');
const { makeDb } = require('./fake-db');
const maint = require('../api/_lib/maintenance');

function seedJournal(db, entrees) {
  return Promise.all(entrees.map((e, i) =>
    db.collection('journal').doc('j' + i).set(e)));
}

test('K8a listerJournal : du plus récent au plus ancien, borné par max', async () => {
  const db = makeDb();
  await seedJournal(db, [
    { qui: 'admin', action: 'approbation', le: 100 },
    { qui: 'admin', action: 'rejet', le: 300 },
    { qui: 'membre', action: 'code-reset', le: 200 }
  ]);
  const tout = await maint.listerJournal(db, 100);
  assert.deepStrictEqual(tout.map((r) => r.le), [300, 200, 100], 'tri décroissant par le');
  assert.strictEqual(tout[0].type, 'info', 'type par défaut');
  const borne = await maint.listerJournal(db, 2);
  assert.strictEqual(borne.length, 2, 'borné à max=2');
  assert.deepStrictEqual(borne.map((r) => r.le), [300, 200]);
});

test('K8b rapportStockage : compteurs bornés par collection', async () => {
  const db = makeDb();
  await db.collection('demandes').doc('d1').set({ statut: 'nouvelle' });
  await db.collection('demandes').doc('d2').set({ statut: 'rejetee' });
  await db.collection('demandes').doc('d3').set({ statut: 'rejetee' });
  await db.collection('membres').doc('m1').set({ statut: 'actif' });
  await db.collection('essais').doc('e1').set({ abonne: true });
  await db.collection('journal').doc('j1').set({ action: 'x', le: 1 });
  const s = await maint.rapportStockage(db);
  assert.strictEqual(s.demandes, 3);
  assert.strictEqual(s.demandesRejetees, 2);
  assert.strictEqual(s.membres, 1);
  assert.strictEqual(s.essais, 1);
  assert.strictEqual(s.journal, 1);
});

test('K8c purger journal : vide le journal et laisse sa propre trace', async () => {
  const db = makeDb();
  await seedJournal(db, [
    { qui: 'admin', action: 'approbation', le: 1 },
    { qui: 'admin', action: 'rejet', le: 2 }
  ]);
  const r = await maint.purger(db, 'journal');
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.supprime, 2, 'les 2 anciennes entrées supprimées');
  const reste = await maint.listerJournal(db, 100);
  assert.strictEqual(reste.length, 1, 'il reste la trace de la purge');
  assert.strictEqual(reste[0].action, 'purge');
  assert.strictEqual(reste[0].cible, 'journal');
});

test('K8d purger demandes_rejetees : n’efface que les rejetées', async () => {
  const db = makeDb();
  await db.collection('demandes').doc('d1').set({ statut: 'nouvelle' });
  await db.collection('demandes').doc('d2').set({ statut: 'rejetee' });
  await db.collection('demandes').doc('d3').set({ statut: 'rejetee' });
  const r = await maint.purger(db, 'demandes_rejetees');
  assert.strictEqual(r.supprime, 2);
  const dem = await db.collection('demandes').get();
  assert.strictEqual(dem.size, 1, 'la demande nouvelle est conservée');
  dem.forEach((d) => assert.strictEqual(d.data().statut, 'nouvelle'));
  const jr = await maint.listerJournal(db, 100);
  assert.strictEqual(jr.length, 1, 'purge journalisée');
  assert.strictEqual(jr[0].cible, 'demandes_rejetees');
});

test('K8e purger cible inconnue : 400, aucune suppression', async () => {
  const db = makeDb();
  await db.collection('membres').doc('m1').set({ statut: 'actif' });
  await assert.rejects(() => maint.purger(db, 'membres'), (e) => e.status === 400);
  const mem = await db.collection('membres').get();
  assert.strictEqual(mem.size, 1, 'rien supprimé sur cible refusée');
});
