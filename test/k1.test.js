'use strict';
// K1 (D12) — estAdmin exige email_verified === true.
// La garde admin ne doit PAS se contenter de comparer l'email à ADMIN_EMAIL :
// le jeton Firebase doit aussi porter email_verified === true. On teste la
// fonction pure `adminAutorise(dec, attendu)` extraite d'api/admin.js.
// Chaque bloc : un test qui ÉCHOUE AVANT la correction, PASSE APRÈS.
process.env.TOKEN_SECRET = 'test-secret-0123456789abcdef-xyz';
process.env.ADMIN_EMAIL = 'admin@memento.test';

const test = require('node:test');
const assert = require('node:assert');
const { adminAutorise } = require('../api/admin');

const ATTENDU = 'admin@memento.test';

// Reproduction de l'ANCIENNE logique (email seul), pour prouver le trou fermé.
function ancienneGarde(dec, attendu) {
  if (!dec) return false;
  if (!attendu) return false;
  if ((dec.email || '').toLowerCase() !== attendu) return false;
  return true;
}

test('K1a : jeton admin NON vérifié (email_verified:false) refusé', () => {
  const dec = { email: ATTENDU, email_verified: false };
  assert.strictEqual(adminAutorise(dec, ATTENDU), false);
  // Preuve du trou : l'ancienne garde l'aurait accepté.
  assert.strictEqual(ancienneGarde(dec, ATTENDU), true);
});

test('K1b : email_verified absent => refusé', () => {
  assert.strictEqual(adminAutorise({ email: ATTENDU }, ATTENDU), false);
});

test('K1c : jeton admin vérifié et bon email => accepté', () => {
  assert.strictEqual(adminAutorise({ email: ATTENDU, email_verified: true }, ATTENDU), true);
});

test('K1d : email vérifié mais différent d\'ADMIN_EMAIL => refusé', () => {
  assert.strictEqual(adminAutorise({ email: 'autre@memento.test', email_verified: true }, ATTENDU), false);
});

test('K1e : casse de l\'email ignorée', () => {
  assert.strictEqual(adminAutorise({ email: 'Admin@Memento.Test', email_verified: true }, ATTENDU), true);
});

test('K1f : garde-fous (dec nul, attendu vide)', () => {
  assert.strictEqual(adminAutorise(null, ATTENDU), false);
  assert.strictEqual(adminAutorise({ email: ATTENDU, email_verified: true }, ''), false);
});
