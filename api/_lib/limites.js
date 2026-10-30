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

// --- K9 (§9.C) : réponse aux abus -------------------------------------------
// Seuil : 10 refus d'authentification dans une fenêtre glissante de 5 min depuis
// une même adresse. Au dépassement : 429 avec le MESSAGE EXACT ci-dessous, une
// entrée `journal` de TYPE ALERTE (une seule par blocage) et un compteur
// `compteurs/global.alertesAbus` visible au tableau de bord. Aucune contre-mesure
// offensive. Compteur dans la collection `abus`, séparée de `limites`.
const MAX_REFUS_AUTH = 10;
const FENETRE_ABUS_SEC = 300;
const MSG_ABUS = 'Activité inhabituelle détectée. Cette adresse est temporairement bloquée et l\'administrateur en est informé.';

// À appeler AVANT de traiter une requête sensible : si l'adresse est déjà
// bloquée dans la fenêtre courante, jette 429 (MSG_ABUS). N'incrémente rien.
async function gardeAbus(db, ip) {
  const ref = db.collection('abus').doc(hacheIp(ip));
  const snap = await ref.get();
  if (!snap.exists) return;
  const d = snap.data() || {};
  const dansFenetre = (Date.now() - (d.debut || 0)) < FENETRE_ABUS_SEC * 1000;
  if (dansFenetre && (d.n || 0) >= MAX_REFUS_AUTH) throw erreur(429, MSG_ABUS);
}

// À appeler à CHAQUE refus d'authentification. Incrémente le compteur d'abus de
// l'adresse (fenêtre glissante). Au franchissement exact du seuil, écrit UNE
// entrée journal de type `alerte` et incrémente le compteur du tableau de bord.
// Renvoie { n, bloque }. Jette 429 (MSG_ABUS) une fois le seuil atteint.
async function signalerRefusAuth(db, ip, deps) {
  const d = deps || {};
  const journalFn = d.journal;      // injection pour testabilité (sinon require)
  const incrFn = d.incr;
  const ref = db.collection('abus').doc(hacheIp(ip));
  const now = Date.now();
  const r = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    let n = 0, debut = now, alerteEmise = false;
    if (snap.exists) {
      const x = snap.data() || {};
      debut = x.debut || now; n = x.n || 0; alerteEmise = !!x.alerteEmise;
      if (now - debut >= FENETRE_ABUS_SEC * 1000) { debut = now; n = 0; alerteEmise = false; }
    }
    n += 1;
    const franchit = n === MAX_REFUS_AUTH && !alerteEmise;
    if (franchit) alerteEmise = true;
    tx.set(ref, { n, debut, alerteEmise });
    return { n, franchit };
  });
  if (r.franchit) {
    const insc = (!journalFn || !incrFn) ? require('./inscription') : null;
    const jr = journalFn || (insc && insc.journal);
    const ic = incrFn || (insc && insc.incr);
    if (jr) await jr(db, 'systeme', 'abus_detecte', hacheIp(ip), 'alerte');
    if (ic) await ic(db, 'alertesAbus', 1);
  }
  const bloque = r.n >= MAX_REFUS_AUTH;
  if (bloque) throw erreur(429, MSG_ABUS);
  return { n: r.n, bloque };
}

module.exports = { limiter, ipClient, hacheIp, erreur,
  gardeAbus, signalerRefusAuth, MAX_REFUS_AUTH, FENETRE_ABUS_SEC, MSG_ABUS };