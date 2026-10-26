// Unicité d'email : un email = un compte. Verrou dans la collection emails/{hash}.
// Aucune adresse n'est stockée en clair comme identifiant de document (on hache).
const crypto = require('crypto');

function erreur(status, message) { const e = new Error(message); e.status = status; return e; }

// Normalisation d'email (guide D9) : minuscules, retrait du +suffixe de la partie
// locale, et pour gmail.com/googlemail.com retrait des points. Un même email
// normalisé produit donc le même verrou partout (demande, essai, membre).
function normaliser(email) {
  let e = String(email || '').trim().toLowerCase();
  const at = e.lastIndexOf('@');
  if (at <= 0) return e;
  let local = e.slice(0, at);
  const domaine = e.slice(at + 1);
  const plus = local.indexOf('+');
  if (plus >= 0) local = local.slice(0, plus);
  if (domaine === 'gmail.com' || domaine === 'googlemail.com') local = local.replace(/\./g, '');
  return local + '@' + domaine;
}
function hacheEmail(email) {
  return crypto.createHash('sha256').update(normaliser(email)).digest('hex');
}

// Pose le verrou ; échec (409) si l'email est déjà pris.
async function verrouiller(db, email, type, ref) {
  const id = hacheEmail(email);
  const docRef = db.collection('emails').doc(id);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(docRef);
    if (snap.exists) throw erreur(409, 'Cette adresse est déjà utilisée.');
    tx.set(docRef, { type: type || 'membre', ref: ref || null, creeLe: Date.now() });
  });
  return id;
}

// Libère le verrou (suppression de membre, rejet de demande…).
async function liberer(db, email) {
  await db.collection('emails').doc(hacheEmail(email)).delete();
}

// Retrouve la référence (membreId) associée à un email, ou null.
async function refDepuisEmail(db, email) {
  const snap = await db.collection('emails').doc(hacheEmail(email)).get();
  return snap.exists ? (snap.data() || {}).ref || null : null;
}

module.exports = { normaliser, hacheEmail, verrouiller, liberer, refDepuisEmail, erreur };
