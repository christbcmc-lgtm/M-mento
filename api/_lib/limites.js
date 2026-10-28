// Limitation de débit (anti-force brute) en transaction Firestore.
// Le compteur est TOUJOURS incrémenté puis la limite est vérifiée APRÈS la
// transaction : ainsi une tentative refusée reste comptée (sinon le blocage ne
// tiendrait jamais). Les erreurs portent un .status HTTP.
const crypto = require('crypto');

function erreur(status, message) { const e = new Error(message); e.status = status; return e; }

// IP du client : première valeur de x-forwarded-for, hachée avec TOKEN_SECRET.
function ipClient(req) {
  const h = (req.headers && (req.headers['x-forwarded-for'] || req.headers['X-Forwarded-For'])) || '';
  return String(h).split(',')[0].trim() || '0.0.0.0';
}
function hacheIp(ip) {
  const s = process.env.TOKEN_SECRET || 'dev-secret-insecure';
  return crypto.createHmac('sha256', s).update(String(ip || '')).digest('hex').slice(0, 32);
}

// limiter(db, cle, max, fenetreSec) -> { n, restant }  (jette 429 si dépassé)
async function limiter(db, cle, max, fenetreSec) {
  const ref = db.collection('limites').doc(String(cle));
  const now = Date.now();
  const n = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    let count = 0, debut = now;
    if (snap.exists) {
      const d = snap.data() || {};
      debut = d.debut || now;
      count = d.n || 0;
      if (now - debut >= fenetreSec * 1000) { debut = now; count = 0; } // fenêtre écoulée : remise à zéro
    }
    count += 1;
    tx.set(ref, { n: count, debut });
    return count;
  });
  if (n > max) throw erreur(429, 'Trop de tentatives. Réessayez plus tard.');
  return { n, restant: Math.max(0, max - n) };
}

module.exports = { limiter, ipClient, hacheIp, erreur };
