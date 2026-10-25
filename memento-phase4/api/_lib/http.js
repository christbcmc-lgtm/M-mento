// Petites aides HTTP communes aux fonctions /api.
async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  return await new Promise((resolve) => {
    let data = '';
    req.on('data', (c) => { data += c; if (data.length > 1e6) req.destroy(); });
    req.on('end', () => { try { resolve(data ? JSON.parse(data) : {}); } catch (e) { resolve({}); } });
    req.on('error', () => resolve({}));
  });
}

function send(res, code, obj) {
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(obj));
}

function methodGuard(req, res, methods) {
  if (!methods.includes(req.method)) { send(res, 405, { ok: false, erreur: 'Methode non autorisee.' }); return false; }
  return true;
}

// Validations de format cote serveur (on ne fait jamais confiance au client).
const reEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const reCle = /^[A-Z0-9]{5}-[A-Z0-9]{5}-[A-Z0-9]{5}-[A-Z0-9]{5}$/;
function validEmail(v) { return typeof v === 'string' && reEmail.test(v.trim()); }
function validCle(v) { return typeof v === 'string' && reCle.test(v.trim().toUpperCase()); }
function clean(v, max) { return (typeof v === 'string' ? v : '').trim().slice(0, max || 300); }

module.exports = { readBody, send, methodGuard, validEmail, validCle, clean };
