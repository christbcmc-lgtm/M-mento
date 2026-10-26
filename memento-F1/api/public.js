// api/public.js — circuit d'entrée public (guide v2, section 3.1 / phase 3).
// Actions (a=) : demande | decision | essai | essai-contenu. Aucune n'exige de
// session membre ; la décision est protégée par un jeton emaillé à l'admin.
const { readBody, send } = require('./_lib/http');
const sess = require('./_lib/session');
const lim = require('./_lib/limites');
const insc = require('./_lib/inscription');
const essais = require('./_lib/essais');

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
      const d = await insc.decisionGet(db, tok); // valide le jeton + statut « nouvelle »
      const r = await insc.approuverDemande(db, {
        demandeId: d.id, matieres: b.matieres, dureeJours: b.dureeJours,
        maxAppareils: b.maxAppareils, quotaHeures: b.quotaHeures
      }, _mailer, siteUrl());
      return send(res, 200, { ok: true, membreId: r.membreId });
    }
    await insc.decisionRefus(db, tok, b.motif, _mailer);
    return send(res, 200, { ok: true });
  }
  return send(res, 405, { ok: false, erreur: 'Méthode non autorisée.' });
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
