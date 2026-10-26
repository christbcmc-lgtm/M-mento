// api/public.js — circuit d'entrée public (guide v2, section 3.1 / phase 3).
// Actions (a=) : demande | decision | essai | essai-contenu | code-reset | matieres.
// Aucune n'exige de session membre. La décision n'autorise QUE le refus par jeton :
// l'approbation passe par la console admin (F4bis). code-reset ne révèle jamais
// l'existence d'un compte ; matieres expose la liste blanche du catalogue.
const { readBody, send } = require('./_lib/http');
const sess = require('./_lib/session');
const lim = require('./_lib/limites');
const insc = require('./_lib/inscription');
const essais = require('./_lib/essais');
const em = require('./_lib/emails');

let _dbFactory = () => require('./_lib/firebase').db();
let _mailer = (...a) => require('./_lib/mail').sendMail(...a);
function __setDbFactory(fn) { _dbFactory = fn; }
function __setMailer(fn) { _mailer = fn; }

function siteUrl() { return (process.env.SITE_URL || '').replace(/\/$/, ''); }
function lireCookieEssai(req) {
  const raw = (req.headers && (req.headers.cookie || req.headers.Cookie)) || '';
  const m = String(raw).match(/(?:^|;\s*)mh_e=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}
function cookieEssai(tok, maxAgeSec) {
  return ['mh_e=' + tok, 'HttpOnly', 'Secure', 'SameSite=Strict', 'Path=/', 'Max-Age=' + Math.max(1, Math.floor(maxAgeSec))].join('; ');
}

async function handler(req, res) {
  const db = _dbFactory();
  const url = new URL(req.url, 'http://x');
  const a = url.searchParams.get('a') || '';
  try {
    if (a === 'demande') return await demande(db, req, res);
    if (a === 'decision') return await decision(db, req, res, url);
    if (a === 'essai') return await essai(db, req, res, url);
    if (a === 'essai-contenu') return await essaiContenu(db, req, res);
    if (a === 'code-reset') return await codeReset(db, req, res);
    if (a === 'matieres') return await matieres(db, req, res);
    return send(res, 404, { ok: false, erreur: 'Action inconnue.' });
  } catch (e) {
    return send(res, e.status || 500, { ok: false, erreur: e.message || 'Erreur interne.' });
  }
}

async function demande(db, req, res) {
  if (req.method !== 'POST') return send(res, 405, { ok: false, erreur: 'Méthode non autorisée.' });
  sess.exigerEntete(req);
  const b = await readBody(req);
  // Champ piège caché : si rempli, on répond 200 sans rien enregistrer (anti-robot).
  if (b.site_web) return send(res, 200, { ok: true });
  await lim.limiter(db, 'demande:' + lim.hacheIp(lim.ipClient(req)), 3, 3600);
  const r = await insc.creerDemande(db, b, _mailer, siteUrl());
  return send(res, 200, { ok: true, id: r.id });
}

async function decision(db, req, res, url) {
  if (req.method === 'GET') {
    const d = await insc.decisionGet(db, url.searchParams.get('d') || '');
    return send(res, 200, { ok: true, demande: d });
  }
  if (req.method === 'POST') {
    // La possession du jeton emaillé à l'admin autorise la décision (pas de console).
    sess.exigerEntete(req);
    const b = await readBody(req);
    const tok = url.searchParams.get('d') || b.d || '';
    if (b.decision === 'approuver') {
      // F4bis (écart D11) : la seule possession du jeton de décision ne suffit PLUS
      // pour approuver. L'approbation doit passer par la console admin
      // (admin?a=approuver_nm, authentification Firebase). Seul le refus reste par jeton.
      return send(res, 403, { ok: false, erreur: 'Approbation réservée à la console administrateur.' });
    }
    // G5 : seul 'refuser' est une décision valide ici ; tout autre verbe est rejeté
    // (400) au lieu d'être traité implicitement comme un refus.
    if (b.decision !== 'refuser') {
      return send(res, 400, { ok: false, erreur: 'Décision invalide.' });
    }
    await insc.decisionRefus(db, tok, b.motif, _mailer);
    return send(res, 200, { ok: true });
  }
  return send(res, 405, { ok: false, erreur: 'Méthode non autorisée.' });
}

// --- code-reset : réinitialisation publique du code (email + numéro) ---
async function codeReset(db, req, res) {
  if (req.method !== 'POST') return send(res, 405, { ok: false, erreur: 'Méthode non autorisée.' });
  sess.exigerEntete(req);
  const b = await readBody(req);
  // Limite stricte par IP : 3 tentatives par heure.
  await lim.limiter(db, 'code-reset:' + lim.hacheIp(lim.ipClient(req)), 3, 3600);
  // F2c : limite également par email (3 / heure), en plus de celle par IP.
  const emailNorm = em.normaliser(b.email);
  if (emailNorm) await lim.limiter(db, 'code-reset-mail:' + em.hacheEmail(emailNorm), 3, 3600);
  await insc.reinitCode(db, b, _mailer, siteUrl());
  // Réponse neutre, strictement identique que les informations correspondent ou non.
  return send(res, 200, { ok: true, message: 'Si les informations correspondent, un nouveau code a été envoyé.' });
}

// --- matieres : liste blanche publique du catalogue (pour le formulaire de demande) ---
async function matieres(db, req, res) {
  const ids = insc.catalogueIds();
  // On relit le catalogue pour exposer aussi un libellé lisible, sans divulguer
  // d'autres données. Seules les entrées du catalogue sont retournées.
  let liste = ids.map((id) => ({ id, titre: id }));
  try {
    const fs = require('fs'); const path = require('path');
    const j = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'contenu', 'catalogue.json'), 'utf8'));
    const m = {};
    (j.matieres || []).forEach((x) => { if (x && x.id) m[x.id] = x.titre || x.nom || x.id; });
    liste = ids.map((id) => ({ id, titre: m[id] || id }));
  } catch (e) { /* on garde la version minimale */ }
  return send(res, 200, { ok: true, matieres: liste });
}

async function essai(db, req, res, url) {
  const r = await essais.ouvrirEssai(db, url.searchParams.get('i') || '');
  res.setHeader('Set-Cookie', cookieEssai(r.cookie, r.restantSec));
  return send(res, 200, { ok: true, restantSec: r.restantSec });
}

async function essaiContenu(db, req, res) {
  const r = await essais.essaiContenu(db, lireCookieEssai(req) || '');
  return send(res, 200, { ok: true, extrait: r.extrait, filigrane: r.filigrane, lectureSeule: true });
}

module.exports = handler;
module.exports.__setDbFactory = __setDbFactory;
module.exports.__setMailer = __setMailer;
