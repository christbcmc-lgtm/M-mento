// Envoi d'emails via l'API REST de Resend (aucune dependance npm, fetch natif Node 18+).
const FROM = process.env.MAIL_FROM || 'Memento <onboarding@resend.dev>';

async function sendMail(to, subject, html) {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error('RESEND_API_KEY manquante.');
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM, to: [to], subject, html })
  });
  if (!r.ok) {
    const t = await r.text().catch(() => '');
    throw new Error('Echec envoi email (' + r.status + '): ' + t.slice(0, 200));
  }
  return r.json().catch(() => ({}));
}

// Gabarit HTML simple et sobre, sans script ni handler en ligne.
function wrap(titre, corps, bouton) {
  const btn = bouton
    ? '<p style="margin:26px 0"><a href="' + bouton.url + '" style="background:#2b5fd9;color:#fff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:700;display:inline-block">' + bouton.texte + '</a></p>'
    : '';
  return '<div style="font-family:system-ui,Segoe UI,Roboto,sans-serif;max-width:520px;margin:auto;color:#1b1f24">' +
    '<h2 style="color:#2b5fd9">Memento</h2>' +
    '<h3>' + titre + '</h3>' +
    '<div style="line-height:1.6;color:#333">' + corps + '</div>' + btn +
    '<hr style="border:none;border-top:1px solid #eee;margin:24px 0">' +
    '<p style="font-size:12px;color:#888">Message automatique — Memento, espace d\'acces aux cours.</p></div>';
}

module.exports = { sendMail, wrap };
