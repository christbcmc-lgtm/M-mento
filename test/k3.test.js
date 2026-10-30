'use strict';
// K3 — Voie d'essai UNIQUE. L'ancienne « invitation » admin
// (action `inviter_essai` -> `token.signInviteEssai` -> lien `?i=` SANS
// enregistrement `essais/{hash}`, sans unicité par email, sans filigrane) est
// RETIRÉE : la seule voie d'octroi est `accorder_essai`.
//   AVANT : signInviteEssai existe, admin.js la câble, le front appelle
//           `inviter_essai`   -> K3a/K3b/K3c échouent.
//   APRÈS : jeton retiré, branche admin -> 410, front -> `accorder_essai`
//           -> tous passent. Les cas de comportement (K3d–K3f) prouvent que la
//           voie unique couvre tout le besoin (octroi, unicité, re-octroi,
//           rejet des anciens jetons, actualisation sans remise à zéro).
process.env.TOKEN_SECRET = 'test-secret-0123456789abcdef-xyz';
process.env.SITE_URL = 'https://memento.test';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const { makeDb } = require('./fake-db');

const token = require('../api/_lib/token');
const em = require('../api/_lib/emails');
const essais = require('../api/_lib/essais');

const racine = path.join(__dirname, '..');
const srcAdmin = fs.readFileSync(path.join(racine, 'api', 'admin.js'), 'utf8');
const srcToken = fs.readFileSync(path.join(racine, 'api', '_lib', 'token.js'), 'utf8');
const srcClient = fs.readFileSync(path.join(racine, 'public', 'assets', 'admin-client.js'), 'utf8');

function mailer() { const envoyes = []; const f = async (to, s, h) => { envoyes.push({ to, s, h }); }; f.envoyes = envoyes; return f; }

// ---- K3a : le jeton d'invitation a disparu (plus de double voie de jeton) ----
test('K3a : token.signInviteEssai retiré + plus de mint t:\'invite_essai\'', () => {
  assert.strictEqual(typeof token.signInviteEssai, 'undefined',
    'signInviteEssai ne doit plus être exportée');
  assert.ok(!srcToken.includes("t: 'invite_essai'"),
    'token.js ne doit plus signer de jeton t:\'invite_essai\'');
});

// ---- K3b : admin.js ne câble plus l'ancienne voie (branche -> 410) ----
test('K3b : admin.js inviter_essai -> 410, sans signInviteEssai ni lien ?i=', () => {
  assert.ok(!srcAdmin.includes('signInviteEssai'),
    'admin.js ne doit plus importer/appeler signInviteEssai');
  assert.ok(!srcAdmin.includes('?i='),
    'admin.js ne doit plus fabriquer de lien d\'invitation ?i=');
  const i = srcAdmin.indexOf("action === 'inviter_essai'");
  assert.ok(i >= 0, 'la branche inviter_essai doit encore exister (pierre tombale)');
  const suite = srcAdmin.indexOf("if (action ===", i + 10);
  const bloc = srcAdmin.slice(i, suite >= 0 ? suite : i + 500);
  assert.match(bloc, /send\(res, 410/, 'inviter_essai doit répondre 410 (action retirée)');
});

// ---- K3c : le front admin appelle la voie unique ----
test('K3c : admin-client appelle accorder_essai (plus inviter_essai)', () => {
  assert.ok(srcClient.includes("appel('accorder_essai'"),
    'le bouton d\'essai doit appeler accorder_essai');
  assert.ok(!srcClient.includes("appel('inviter_essai'"),
    'le front ne doit plus appeler inviter_essai');
});

// ---- K3d : octroi + unicité (409) + re-octroi après suppression ----
test('K3d : accorder_essai = octroi unique ; doublon 409 ; re-octroi après suppression', async () => {
  const db = makeDb();
  const mail = mailer();
  const a = await essais.accorderEssai(db, { email: 'Z@x.com', dureeMin: 3 }, mail, 'https://memento.test');
  assert.ok(a.ok && a.hash);
  const h = em.hacheEmail('z@x.com');
  assert.strictEqual(a.hash, h);
  assert.strictEqual((await db.collection('essais').doc(h).get()).exists, true);
  assert.match(mail.envoyes[0].h, /\/essai\?i=/);
  // 2e octroi, même adresse -> 409 (un email = un essai)
  await assert.rejects(() => essais.accorderEssai(db, { email: 'z@x.com' }, mail, ''), (e) => e.status === 409);
  // après suppression de l'essai, l'adresse peut à nouveau en recevoir un
  await essais.supprimerEssai(db, h);
  assert.strictEqual((await db.collection('essais').doc(h).get()).exists, false);
  const a2 = await essais.accorderEssai(db, { email: 'z@x.com' }, mail, '');
  assert.ok(a2.ok && a2.hash === h);
});

// ---- K3e : un ancien jeton d'invitation est refusé par la voie unique ----
test('K3e : ouvrirEssai refuse un jeton t:\'invite_essai\' (seul essai_lien est accepté)', async () => {
  const db = makeDb();
  // jeton forgé à l'identique de l'ancienne invitation (même secret)
  const ancien = jwt.sign({ t: 'invite_essai' }, process.env.TOKEN_SECRET, { expiresIn: '7d' });
  await assert.rejects(() => essais.ouvrirEssai(db, ancien), (e) => e.status === 410);
  // un vrai lien essai_lien sans enregistrement -> 410 également (pas d'essai fantôme)
  const sansEnr = token.signEssaiLien('hash-inconnu', 3);
  await assert.rejects(() => essais.ouvrirEssai(db, sansEnr), (e) => e.status === 410);
});

// ---- K3f : actualiser ne remet jamais le chrono à zéro ----
test('K3f : ouvrir deux fois ne prolonge pas l\'essai (utiliseLe figé)', async () => {
  const db = makeDb();
  const mail = mailer();
  await essais.accorderEssai(db, { email: 'f@x.com', dureeMin: 4 }, mail, '');
  const h = em.hacheEmail('f@x.com');
  const lien = token.signEssaiLien(h, 4);
  const o1 = await essais.ouvrirEssai(db, lien);
  const t1 = (await db.collection('essais').doc(h).get()).data().utiliseLe;
  assert.ok(t1 > 0 && o1.restantSec > 0);
  const o2 = await essais.ouvrirEssai(db, lien);
  const t2 = (await db.collection('essais').doc(h).get()).data().utiliseLe;
  assert.strictEqual(t1, t2, 'utiliseLe ne doit pas bouger (pas de reset du chrono)');
  assert.ok(o2.restantSec <= o1.restantSec, 'le temps restant ne remonte jamais');
});
