// Envoi d'emails via Gmail + nodemailer (décision D13).
// Identifiants lus dans l'environnement Vercel : MAIL_USER (Gmail dédié),
// MAIL_APP_PASSWORD (mot de passe d'application), MAIL_FROM_NAME.
// nodemailer est chargé paresseusement pour que le module s'importe même sans la
// dépendance (utile aux tests, qui remplacent sendMail).
let _transport = null;
function transport() {
  if (_transport) return _transport;
  const nodemailer = require('nodemailer');
  const user = process.env.MAIL_USER;
  const pass = process.env.MAIL_APP_PASSWORD;
  if (!user || !pass) throw new Error('MAIL_USER / MAIL_APP_PASSWORD manquants.');
  _transport = nodemailer.createTransport({ service: 'gmail', auth: { user, pass } });
  return _transport;
}

async function sendMail(to, subject, html) {
  const user = process.env.MAIL_USER;
  const nom = process.env.MAIL_FROM_NAME || 'Mémento';
  const from = nom + ' <' + user + '>';
  return transport().sendMail({ from, to, subject, html });
}

// Gabarit HTML sobre, sans script ni gestionnaire en ligne.
function wrap(titre, corps, bouton) {
  const site = (process.env.SITE_URL || '').replace(/\/$/, '');
  const logo = site
    ? '<img src="' + site + '/assets/logo.png" width="44" height="44" alt="Mémento" style="border-radius:12px;display:inline-block;vertical-align:middle">'
    : '';
  const header = '<div style="margin:0 0 18px">' + logo +
    '<span style="color:#2b5fd9;font-size:22px;font-weight:800;vertical-align:middle;margin-left:10px">Mémento</span></div>';
  const btn = bouton
    ? '<p style="margin:26px 0"><a href="' + bouton.url + '" style="background:#2b5fd9;color:#fff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:700;display:inline-block">' + bouton.texte + '</a></p>'
    : '';
  return '<div style="font-family:system-ui,Segoe UI,Roboto,sans-serif;max-width:520px;margin:auto;color:#1b1f24">' +
    header + '<h3>' + titre + '</h3>' +
    '<div style="line-height:1.6;color:#333">' + corps + '</div>' + btn +
    '<hr style="border:none;border-top:1px solid #eee;margin:24px 0">' +
    '<p style="font-size:12px;color:#888">Message automatique — Mémento, espace d\'accès aux cours.</p></div>';
}

module.exports = { sendMail, wrap };
