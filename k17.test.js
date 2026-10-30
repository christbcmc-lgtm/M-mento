'use strict';
// K17 — passe de qualité : « 0 couleur en dur » + contraste WCAG AA.
// Règle (calculable, pas de jugement visuel) :
//  (A) Toutes les couleurs vivent dans assets/themes.css (variables de thème).
//      Aucun littéral hex/rgb(a) ailleurs : pages HTML, base.css, espace.css.
//  (B) Pour chaque thème, les paires lisibilité clés et les bandeaux
//      (danger / avert) atteignent le ratio de contraste AA (>= 4.5:1).
// Échoue-avant/passe-après : avant K17, les SVG et les bandeaux portaient des
// fallbacks en dur (#2b5fd9, #fff, #8a1f1f, rgba(0,0,0,.45)…) -> le scanner (A)
// trouvait des littéraux et échouait.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const PUB = path.join(__dirname, '..', 'public');
const ASSETS = path.join(PUB, 'assets');
const THEMES = path.join(ASSETS, 'themes.css');

// Détecteur de couleur littérale : #rgb/#rrggbb(aa) ou rgb()/rgba().
const RE_COULEUR = /#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)/g;

function fichiersAScanner() {
  const htmls = fs.readdirSync(PUB).filter((f) => f.endsWith('.html')).map((f) => path.join(PUB, f));
  const css = fs.readdirSync(ASSETS)
    .filter((f) => f.endsWith('.css') && f !== 'themes.css')
    .map((f) => path.join(ASSETS, f));
  return htmls.concat(css);
}

test('K17-A : aucune couleur en dur hors themes.css', () => {
  const coupables = [];
  for (const f of fichiersAScanner()) {
    const txt = fs.readFileSync(f, 'utf8');
    const m = txt.match(RE_COULEUR);
    if (m) coupables.push(path.basename(f) + ' -> ' + m.join(', '));
  }
  assert.deepStrictEqual(coupables, [],
    'Couleurs en dur détectées (doivent passer par une variable de thème) :\n' + coupables.join('\n'));
});

// --- Contraste WCAG ---------------------------------------------------------
function luminance(hex) {
  const h = hex.replace('#', '');
  const n = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  const f = (c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  const [r, g, b] = n.map(f);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function ratio(a, b) {
  const l1 = luminance(a);
  const l2 = luminance(b);
  const hi = Math.max(l1, l2);
  const lo = Math.min(l1, l2);
  return (hi + 0.05) / (lo + 0.05);
}

function themes() {
  const css = fs.readFileSync(THEMES, 'utf8');
  const blocs = {};
  const re = /(:root|\[data-theme="[^"]+"\])\s*\{([^}]*)\}/g;
  let m;
  while ((m = re.exec(css))) {
    const vars = {};
    const rv = /(--[a-z-]+)\s*:\s*(#[0-9a-fA-F]{6})/g;
    let v;
    while ((v = rv.exec(m[2]))) vars[v[1]] = v[2];
    blocs[m[1]] = Object.assign(blocs[m[1]] || {}, vars);
  }
  return blocs;
}

// Paires devant atteindre AA (>= 4.5). Les bandeaux (danger/avert) sont
// définis une seule fois dans :root et s'appliquent à tous les thèmes.
const PAIRES = [
  ['--texte', '--surface'],
  ['--texte', '--fond'],
  ['--texte-doux', '--surface'],
  ['--sur-accent', '--accent'],
  ['--masque-texte', '--masque'],
];

test('K17-B : chaque thème atteint le contraste AA (>= 4.5:1)', () => {
  const blocs = themes();
  const echecs = [];
  for (const [sel, vars] of Object.entries(blocs)) {
    for (const [a, b] of PAIRES) {
      if (vars[a] && vars[b]) {
        const r = ratio(vars[a], vars[b]);
        if (r < 4.5) echecs.push(`${sel} ${a}/${b} = ${r.toFixed(2)}`);
      }
    }
  }
  assert.deepStrictEqual(echecs, [], 'Paires sous AA :\n' + echecs.join('\n'));
});

test('K17-C : bandeaux danger/avert définis et contrastés (>= 4.5:1)', () => {
  // Les tokens de bandeau sont définis une seule fois dans le bloc de base
  // (sélecteur `:root,[data-theme="clair"]`) et hérités par tous les thèmes.
  const blocs = themes();
  const base = Object.values(blocs).find((v) => v['--danger']) || {};
  for (const [bg, fg] of [['--danger', '--sur-danger'], ['--avert', '--sur-avert']]) {
    assert.ok(base[bg] && base[fg], `tokens ${bg}/${fg} absents du bloc de base`);
    const r = ratio(base[bg], base[fg]);
    assert.ok(r >= 4.5, `${bg}/${fg} = ${r.toFixed(2)} < 4.5`);
  }
});
