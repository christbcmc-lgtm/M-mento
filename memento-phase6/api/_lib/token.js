// Jetons signes (liens personnels + essai gratuit). Secret : process.env.TOKEN_SECRET.
const jwt = require('jsonwebtoken');

function secret() {
  const s = process.env.TOKEN_SECRET;
  if (!s || s.length < 16) throw new Error('TOKEN_SECRET manquant ou trop court.');
  return s;
}

// Lien personnel d'un membre (longue duree ; l'acces reel est recontrole cote serveur).
function signPersonnel(membreId, dureeJours) {
  return jwt.sign({ t: 'perso', m: membreId }, secret(), { expiresIn: (dureeJours || 180) + 'd' });
}

// Jeton d'essai gratuit : courte duree globale + limites par zone gerees a part.
function signEssai(essaiId, minutes) {
  return jwt.sign({ t: 'essai', e: essaiId }, secret(), { expiresIn: (minutes || 15) + 'm' });
}

// Invitation d'essai gratuit emise par l'administrateur (a usage unique, courte duree).
function signInviteEssai(jours) {
  return jwt.sign({ t: 'invite_essai' }, secret(), { expiresIn: (jours || 7) + 'd' });
}

// Jeton de decision (lien emaille a l'admin). Usage unique garanti par le statut de la demande.
function signDecision(demandeId, jours) {
  return jwt.sign({ t: 'decision', id: demandeId }, secret(), { expiresIn: (jours || 14) + 'd' });
}
// Lien d'invitation d'essai (porte le hash de l'email + la duree en minutes).
function signEssaiLien(hash, minutes) {
  return jwt.sign({ t: 'essai_lien', h: hash, min: minutes || 5 }, secret(), { expiresIn: '7d' });
}
// Cookie d'essai mh_e (duree = reste de l'essai, en secondes).
function signEssaiCookie(hash, secondes) {
  return jwt.sign({ t: 'essai_c', h: hash }, secret(), { expiresIn: Math.max(1, Math.floor(secondes)) });
}

function verify(token) {
  try { return jwt.verify(token, secret()); }
  catch (e) { return null; }
}

module.exports = { signPersonnel, signEssai, signInviteEssai, signDecision, signEssaiLien, signEssaiCookie, verify };
