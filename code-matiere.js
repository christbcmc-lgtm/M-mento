// POST /api/code-matiere — verifie le code d'une matiere, ou le reinitialise.
// { t, matiere, code }            -> verification
// { t, matiere, reset:true, numero } -> reinitialisation (le membre prouve son numero),
//                                       un nouveau code est envoye par email.
const { db } = require('./_lib/firebase');
const { sendMail, wrap } = require('./_lib/mail');
const { compare, hash, nouveauCode } = require('./_lib/secret');
const { verify } = require('./_lib/token');
const { readBody, send, methodGuard, clean } = require('./_lib/http');

module.exports = async (req, res) => {
  if (!methodGuard(req, res, ['POST'])) return;
  try {
    const b = await readBody(req);
    const p = verify(clean(b.t, 2000));
    if (!p || p.t !== 'perso') return send(res, 401, { ok: false, erreur: 'Session invalide.' });
    const matiere = clean(b.matiere, 60);
    const ref = db().collection('membres').doc(p.m);
    const doc = await ref.get();
    if (!doc.exists) return send(res, 404, { ok: false, erreur: 'Compte introuvable.' });
    const m = doc.data();
    const info = (m.matieres || {})[matiere];
    if (!info || !info.abonne) return send(res, 403, { ok: false, erreur: 'Matiere non accessible.' });

    if (b.reset === true) {
      const numero = clean(b.numero, 30).replace(/\s/g, '');
      if (!m.numero || numero !== String(m.numero).replace(/\s/g, '')) {
        return send(res, 401, { ok: false, erreur: 'Numero non reconnu.' });
      }
      const code = nouveauCode();
      const champ = 'matieres.' + matiere + '.codeHash';
      await ref.update({ [champ]: hash(code) });
      if (m.email) {
        await sendMail(m.email, 'Nouveau code de matiere — Memento',
          wrap('Code reinitialise', 'Votre nouveau code pour la matiere <b>' + matiere +
            '</b> est : <div style="font-size:22px;font-weight:800;letter-spacing:3px;margin:10px 0">' +
            code + '</div>')).catch(() => {});
      }
      return send(res, 200, { ok: true, reinitialise: true });
    }

    const code = clean(b.code, 20).toUpperCase();
    if (!info.codeHash) return send(res, 200, { ok: true, valide: true }); // pas (encore) de code exige
    if (!compare(code, info.codeHash)) return send(res, 401, { ok: false, erreur: 'Code incorrect.' });
    return send(res, 200, { ok: true, valide: true });
  } catch (e) {
    return send(res, 500, { ok: false, erreur: 'Erreur serveur.' });
  }
};
