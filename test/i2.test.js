'use strict';
// I2 — Normalisation d'email : unifier gmail.com et googlemail.com (même boîte chez
// Google). D9 : « un email = un compte » ; recette B.11 : « email déjà pris, y compris
// variantes +suffixe et points Gmail : refusée ». AVANT I2, `normaliser` retirait bien
// les points pour les deux domaines mais NE LES UNIFIAIT PAS : `x@googlemail.com` et
// `x@gmail.com` produisaient deux verrous distincts → doublon possible pour la MÊME
// boîte. I2 canonise `googlemail.com` → `gmail.com`.
// Chaque bloc : un test qui ÉCHOUE AVANT la correction, PASSE APRÈS.
process.env.TOKEN_SECRET = 'test-secret-0123456789abcdef-xyz';

const test = require('node:test');
const assert = require('node:assert');
const { makeDb } = require('./fake-db');
const em = require('../api/_lib/emails');

// ===================== I2a : googlemail.com canonisé vers gmail.com =====================
test('I2a : googlemail.com est canonisé en gmail.com', () => {
  assert.strictEqual(em.normaliser('Jean.Dupont@googlemail.com'), 'jeandupont@gmail.com');
  assert.strictEqual(em.normaliser('jeandupont@gmail.com'), 'jeandupont@gmail.com');
});

// ===================== I2b : +suffixe + points combinés =====================
test('I2b : +suffixe et points retirés, domaine unifié', () => {
  assert.strictEqual(em.normaliser('j.e.a.n+promo@GOOGLEMAIL.com'), 'jean@gmail.com');
  assert.strictEqual(em.normaliser('jean+autre@gmail.com'), 'jean@gmail.com');
});

// ===================== I2c : même empreinte pour toutes les variantes Gmail =====================
test('I2c : hacheEmail identique pour les variantes gmail/googlemail', () => {
  const ref = em.hacheEmail('jeandupont@gmail.com');
  assert.strictEqual(em.hacheEmail('jean.dupont@gmail.com'), ref);
  assert.strictEqual(em.hacheEmail('jean.dupont@googlemail.com'), ref);
  assert.strictEqual(em.hacheEmail('jeandupont+x@googlemail.com'), ref);
});

// ===================== I2d : le verrou d'unicité refuse la variante googlemail =====================
test('I2d : un verrou posé sur gmail refuse la variante googlemail (409)', async () => {
  const db = makeDb();
  await em.verrouiller(db, 'jeandupont@gmail.com', 'membre', 'M1');
  let status = 0;
  try { await em.verrouiller(db, 'jean.dupont@googlemail.com', 'demande', null); }
  catch (e) { status = e.status; }
  assert.strictEqual(status, 409, 'la variante googlemail doit être reconnue comme déjà prise');
});

// ===================== I2e : les autres domaines ne sont PAS réécrits =====================
test('I2e : les domaines non-Gmail gardent points et domaine', () => {
  // Les points de la partie locale ne sont retirés QUE pour Gmail.
  assert.strictEqual(em.normaliser('jean.dupont@exemple.com'), 'jean.dupont@exemple.com');
  // Un domaine proche mais distinct n'est pas unifié avec gmail.
  assert.strictEqual(em.normaliser('jean@gmail.fr'), 'jean@gmail.fr');
  // +suffixe reste retiré partout (comportement D9 existant).
  assert.strictEqual(em.normaliser('jean+promo@exemple.com'), 'jean@exemple.com');
});
