// Hachage des cles / codes (scrypt) + generateurs aleatoires. Rien n'est stocke en clair.
const crypto = require('crypto');

function hash(valeur) {
  const sel = crypto.randomBytes(16);
  const dk = crypto.scryptSync(String(valeur), sel, 32);
  return 's1$' + sel.toString('hex') + '$' + dk.toString('hex');
}

function compare(valeur, stocke) {
  try {
    const [v, selHex, dkHex] = String(stocke).split('$');
    if (v !== 's1') return false;
    const sel = Buffer.from(selHex, 'hex');
    const dk = Buffer.from(dkHex, 'hex');
    const test = crypto.scryptSync(String(valeur), sel, 32);
    return dk.length === test.length && crypto.timingSafeEqual(dk, test);
  } catch (e) { return false; }
}

const ALPH = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sans 0/O/1/I
function bloc(n) {
  let s = '';
  const b = crypto.randomBytes(n);
  for (let i = 0; i < n; i++) s += ALPH[b[i] % ALPH.length];
  return s;
}
// Cle d'activation : XXXXX-XXXXX-XXXXX-XXXXX
function nouvelleCle() { return [bloc(5), bloc(5), bloc(5), bloc(5)].join('-'); }
// Code par matiere : 6 caracteres
function nouveauCode() { return bloc(6); }

module.exports = { hash, compare, nouvelleCle, nouveauCode };
