'use strict';
// Correction F3 : suppression des fonctions API legacy et branchement du front
// sur le couple unifié { auth, public } (6 fonctions au total). Le front ne doit
// plus appeler d'endpoint legacy ni l'ancienne action authentifiée code-reset.
// Ce test échoue AVANT la correction, passe APRÈS.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const racine = path.join(__dirname, '..');
const apiDir = path.join(racine, 'api');
const assetsDir = path.join(racine, 'public', 'assets');

function lireFrontJs() {
  let txt = '';
  for (const f of fs.readdirSync(assetsDir)) {
    if (f.endsWith('.js')) txt += '\n' + fs.readFileSync(path.join(assetsDir, f), 'utf8');
  }
  // inclut aussi les pages HTML (certains appels y figurent)
  const pubDir = path.join(racine, 'public');
  for (const f of fs.readdirSync(pubDir)) {
    if (f.endsWith('.html')) txt += '\n' + fs.readFileSync(path.join(pubDir, f), 'utf8');
  }
  return txt;
}

// ===== 1. l'API expose EXACTEMENT 6 fonctions =====
test('F3 : api/ contient exactement les 6 fonctions unifiées', () => {
  const fns = fs.readdirSync(apiDir).filter((f) => f.endsWith('.js')).sort();
  assert.deepStrictEqual(fns,
    ['admin.js', 'auth.js', 'contenu.js', 'evaluation.js', 'message.js', 'public.js']);
});

// ===== 2. plus aucun fichier API legacy =====
test('F3 : aucun fichier API legacy ne subsiste', () => {
  for (const f of ['acces.js', 'activer.js', 'code-matiere.js', 'demande.js', 'essai.js']) {
    assert.ok(!fs.existsSync(path.join(apiDir, f)), 'legacy présent : ' + f);
  }
});

// ===== 3. le front n'appelle plus d'endpoint legacy de premier niveau =====
test('F3 : le front n\'appelle aucun endpoint legacy', () => {
  const txt = lireFrontJs();
  for (const dead of ['/api/acces', '/api/activer', '/api/code-matiere', '/api/demande"', '/api/demande\'', '/api/essai"', '/api/essai\'']) {
    assert.ok(!txt.includes(dead), 'référence legacy trouvée : ' + dead);
  }
  // tout appel /api/<fn> doit viser l'une des 6 fonctions
  const m = txt.match(/\/api\/[a-z-]+/g) || [];
  const autorises = new Set(['/api/admin', '/api/auth', '/api/contenu', '/api/evaluation', '/api/message', '/api/public']);
  for (const u of m) assert.ok(autorises.has(u), 'endpoint hors périmètre : ' + u);
});

// ===== 4. l'ancienne action AUTHENTIFIÉE code-reset n'est plus appelée par le front =====
test('F3 : le front n\'appelle plus /api/auth?a=code-reset (supprimée en F2)', () => {
  const txt = lireFrontJs();
  assert.ok(!/\/api\/auth\?a=code-reset/.test(txt), 'appel à l\'ancien code-reset authentifié');
});

// ===== 5. le front branche la réinitialisation sur la nouvelle action PUBLIQUE =====
test('F3 : le front appelle /api/public?a=code-reset (nouvelle voie publique)', () => {
  const txt = lireFrontJs();
  assert.ok(/\/api\/public\?a=code-reset/.test(txt), 'la voie publique code-reset n\'est pas branchée');
});
