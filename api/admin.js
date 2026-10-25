// POST /api/admin — actions reservees a l'administrateur.
// Securite : jeton Firebase (Authorization: Bearer <idToken>) dont l'email == ADMIN_EMAIL.
const { db, auth } = require('./_lib/firebase');
const { sendMail, wrap } = require('./_lib/mail');
const { hash, nouvelleCle, nouveauCode } = require('./_lib/secret');
const { signInviteEssai } = require('./_lib/token');
const { readBody, send, methodGuard, validEmail, clean } = require('./_lib/http');

async function estAdmin(req) {
  const h = req.headers['authorization'] || '';
  const m = h.match(/^Bearer\s+(.+)$/i);
  if (!m) return null;
  const dec = await auth().verifyIdToken(m[1]).catch(() => null);
  if (!dec) return null;
  const attendu = (process.env.ADMIN_EMAIL || '').toLowerCase();
  if (!attendu || (dec.email || '').toLowerCase() !== attendu) return null;
  return dec;
}

module.exports = async (req, res) => {
  if (!methodGuard(req, res, ['POST'])) return;
  try {
    if (!(await estAdmin(req))) return send(res, 403, { ok: false, erreur: 'Reserve a l\'administrateur.' });
    const base = db();
    const b = await readBody(req);
    const action = clean(b.action, 40);
    const site = (process.env.SITE_URL || '').replace(/\/$/, '');
    const now = new Date();

    if (action === 'list_demandes') {
      const s = await base.collection('demandes').orderBy('creeLe', 'desc').limit(100).get();
      return send(res, 200, { ok: true, demandes: s.docs.map((d) => Object.assign({ id: d.id }, d.data())) });
    }

    if (action === 'list_messages') {
      const s = await base.collection('messages').orderBy('majLe', 'desc').limit(100).get();
      return send(res, 200, { ok: true, fils: s.docs.map((d) => Object.assign({ id: d.id }, d.data())) });
    }

    if (action === 'approuver') {
      // Cree/active un membre, genere la cle d'activation et l'envoie par email.
      const email = clean(b.email, 160).toLowerCase();
      if (!validEmail(email)) return send(res, 400, { ok: false, erreur: 'Email invalide.' });
      const nom = clean(b.nom, 80), prenom = clean(b.prenom, 80), numero = clean(b.numero, 30);
      const matieres = Array.isArray(b.matieres) ? b.matieres.map((x) => clean(x, 60)).filter(Boolean) : [];
      const avecCode = b.avecCode === true;
      const cle = nouvelleCle();
      const abo = {};
      const codesClairs = {};
      for (const mt of matieres) {
        let codeHash = null;
        if (avecCode) { const c = nouveauCode(); codesClairs[mt] = c; codeHash = hash(c); }
        abo[mt] = { abonne: true, codeHash };
      }
      const existant = await base.collection('membres').where('email', '==', email).limit(1).get();
      const data = { nom, prenom, email, numero, statut: 'cle_emise', cleHash: hash(cle), matieres: abo, compteurAcces: 0, majLe: now };
      let id;
      if (existant.empty) { const r = await base.collection('membres').add(Object.assign({ creeLe: now }, data)); id = r.id; }
      else { id = existant.docs[0].id; await existant.docs[0].ref.set(data, { merge: true }); }
      if (b.demandeId) await base.collection('demandes').doc(clean(b.demandeId, 60)).set({ statut: 'traitee', traiteLe: now }, { merge: true }).catch(() => {});
      let codesHtml = '';
      for (const k of Object.keys(codesClairs)) codesHtml += '<br>• ' + k + ' : <b>' + codesClairs[k] + '</b>';
      await sendMail(email, 'Votre cle d\'activation — Memento',
        wrap('Acces accorde', 'Bonjour ' + (prenom || '') + ',<br>Votre acces est pret. ' +
          'A votre PREMIERE connexion, saisissez votre nom, votre email et la cle ci-dessous :' +
          '<div style="font-size:20px;font-weight:800;letter-spacing:2px;margin:12px 0">' + cle + '</div>' +
          (codesHtml ? 'Codes par matiere :' + codesHtml : ''),
          { url: site + '/', texte: 'Aller sur Memento' })).catch(() => {});
      return send(res, 200, { ok: true, membreId: id });
    }

    if (action === 'repondre') {
      const id = clean(b.messageId, 60);
      const texte = clean(b.texte, 4000);
      const pieces = Array.isArray(b.pieces) ? b.pieces.slice(0, 10).map((x) => ({ nom: clean(x.nom, 120), url: clean(x.url, 1000) })) : [];
      const ref = base.collection('messages').doc(id);
      const doc = await ref.get();
      if (!doc.exists) return send(res, 404, { ok: false, erreur: 'Fil introuvable.' });
      const items = (doc.data().items || []).concat({ de: 'admin', texte, pieces, le: now });
      await ref.update({ items, majLe: now });
      const email = doc.data().email;
      if (email) await sendMail(email, 'Reponse de l\'administrateur — Memento',
        wrap('Nouveau message', 'Vous avez une reponse dans votre espace Memento.',
          { url: site + '/', texte: 'Ouvrir Memento' })).catch(() => {});
      return send(res, 200, { ok: true });
    }

    if (action === 'inviter_essai') {
      const email = clean(b.email, 160).toLowerCase();
      if (!validEmail(email)) return send(res, 400, { ok: false, erreur: 'Email invalide.' });
      const invitation = signInviteEssai(7);
      const lien = site + '/essai.html?i=' + encodeURIComponent(invitation);
      await sendMail(email, 'Essai gratuit — Memento',
        wrap('Essai gratuit', 'Vous pouvez tester Memento (apercu limite dans le temps, lecture seule).',
          { url: lien, texte: 'Demarrer l\'essai' })).catch(() => {});
      return send(res, 200, { ok: true });
    }

    return send(res, 400, { ok: false, erreur: 'Action inconnue.' });
  } catch (e) {
    return send(res, 500, { ok: false, erreur: 'Erreur serveur.' });
  }
};
