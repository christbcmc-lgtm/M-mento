// POST /api/admin — actions reservees a l'administrateur.
// Securite : jeton Firebase (Authorization: Bearer <idToken>) dont l'email == ADMIN_EMAIL.
const { db, auth } = require('./_lib/firebase');
const { sendMail, wrap } = require('./_lib/mail');
const { hash, nouvelleCle, nouveauCode } = require('./_lib/secret');
const { signInviteEssai } = require('./_lib/token');
const { readBody, send, methodGuard, validEmail, clean } = require('./_lib/http');
const { fusionner } = require('./_lib/catalogue');

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

    if (action === 'list_matieres') {
      const s = await base.collection('matieres').get().catch(() => ({ docs: [] }));
      const cat = fusionner(s.docs || []);
      return send(res, 200, { ok: true, matieres: cat.map((m) => ({ id: m.id, nom: m.nom, ordre: m.ordre || 0, bientot: !!m.bientot, ressources: m.ressources || [] })) });
    }

    if (action === 'stats') {
      // Tableau de bord : compteurs synthetiques pour l'administrateur.
      const [dem, mem, msg] = await Promise.all([
        base.collection('demandes').get(),
        base.collection('membres').get(),
        base.collection('messages').get()
      ]);
      let demEnAttente = 0;
      dem.forEach((d) => { const st = d.data().statut; if (!st || st === 'nouvelle' || st === 'ouverte') demEnAttente++; });
      let memActifs = 0;
      mem.forEach((d) => { if (d.data().statut === 'actif') memActifs++; });
      let msgOuverts = 0;
      msg.forEach((d) => { if (d.data().statut === 'ouvert') msgOuverts++; });
      return send(res, 200, { ok: true, stats: {
        demandes: dem.size, demandesEnAttente: demEnAttente,
        membres: mem.size, membresActifs: memActifs,
        messages: msg.size, messagesOuverts: msgOuverts
      } });
    }

    if (action === 'list_membres') {
      const s = await base.collection('membres').orderBy('majLe', 'desc').limit(200).get();
      return send(res, 200, { ok: true, membres: s.docs.map((d) => {
        const x = d.data();
        const abo = x.matieres || {};
        return {
          id: d.id, prenom: x.prenom || '', nom: x.nom || '', email: x.email || '',
          statut: x.statut || '', numero: x.numero || '',
          compteurAcces: x.compteurAcces || 0, majLe: x.majLe || null,
          expireLe: x.expireLe || null,
          matieres: Object.keys(abo).filter((k) => abo[k] && abo[k].abonne)
        };
      }) });
    }

    if (action === 'list_demandes') {
      const s = await base.collection('demandes').orderBy('creeLe', 'desc').limit(100).get();
      return send(res, 200, { ok: true, demandes: s.docs.map((d) => Object.assign({ id: d.id }, d.data())) });
    }

    if (action === 'rejeter') {
      // Refus d'une demande : marque la demande et previent le demandeur par email.
      const id = clean(b.demandeId, 60);
      const email = clean(b.email, 160).toLowerCase();
      const motif = clean(b.motif, 2000);
      if (id) await base.collection('demandes').doc(id).set({ statut: 'rejetee', rejeteLe: now, motif }, { merge: true }).catch(() => {});
      if (validEmail(email)) {
        await sendMail(email, 'Suite a votre demande — Memento',
          wrap('Demande non retenue',
            'Bonjour,<br>Votre demande d\'acces a Memento n\'a pas pu etre acceptee pour le moment.' +
            (motif ? '<br><br><b>Motif :</b> ' + motif : '') +
            '<br><br>Vous pouvez renouveler votre demande ou nous ecrire si vous pensez qu\'il s\'agit d\'une erreur.',
            { url: site + '/', texte: 'Revenir sur Memento' })).catch(() => {});
      }
      return send(res, 200, { ok: true });
    }

    if (action === 'reconsiderer') {
      // Rouvre une demande rejetee (en cas d'erreur de l'admin) : repasse en attente.
      const id = clean(b.demandeId, 60);
      if (!id) return send(res, 400, { ok: false, erreur: 'Demande inconnue.' });
      await base.collection('demandes').doc(id).set({ statut: 'nouvelle', rejeteLe: null, motif: null }, { merge: true }).catch(() => {});
      return send(res, 200, { ok: true });
    }

    if (action === 'resilier') {
      // Suspend REELLEMENT un membre actif : son lien personnel cesse de fonctionner.
      const id = clean(b.membreId, 60);
      if (!id) return send(res, 400, { ok: false, erreur: 'Membre inconnu.' });
      await base.collection('membres').doc(id).set({ statut: 'suspendu', suspenduLe: now, majLe: now }, { merge: true });
      const snap = await base.collection('membres').doc(id).get();
      const email = snap.exists ? snap.data().email : null;
      if (email) await sendMail(email, 'Acces suspendu — Memento',
        wrap('Acces suspendu', 'Bonjour,<br>Votre acces a Memento a ete suspendu par l\'administrateur. ' +
          'Pour toute question, repondez a ce message ou ecrivez via votre espace.',
          { url: site + '/', texte: 'Revenir sur Memento' })).catch(() => {});
      return send(res, 200, { ok: true });
    }

    if (action === 'reactiver') {
      // Reactive un membre precedemment suspendu (sans nouvelle cle).
      const id = clean(b.membreId, 60);
      if (!id) return send(res, 400, { ok: false, erreur: 'Membre inconnu.' });
      await base.collection('membres').doc(id).set({ statut: 'actif', suspenduLe: null, majLe: now }, { merge: true });
      return send(res, 200, { ok: true });
    }

    if (action === 'maj_ressources') {
      // Attache a une matiere une liste de ressources (PDF/livres) par nom + lien.
      const mid = clean(b.matiere, 60);
      if (!mid) return send(res, 400, { ok: false, erreur: 'Matiere inconnue.' });
      const ressources = Array.isArray(b.ressources)
        ? b.ressources.slice(0, 50).map((x) => ({ nom: clean(x.nom, 160), url: clean(x.url, 1000) })).filter((x) => x.nom && x.url)
        : [];
      await base.collection('matieres').doc(mid).set({ ressources, majLe: now }, { merge: true });
      return send(res, 200, { ok: true, ressources });
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
      // Echeance d'acces (facultative) : duree en jours -> date d'expiration.
      const dureeJours = Number(b.dureeJours) || 0;
      const expireLe = dureeJours > 0 ? new Date(now.getTime() + dureeJours * 86400000) : null;
      const cle = nouvelleCle();
      const abo = {};
      const codesClairs = {};
      for (const mt of matieres) {
        let codeHash = null;
        if (avecCode) { const c = nouveauCode(); codesClairs[mt] = c; codeHash = hash(c); }
        abo[mt] = { abonne: true, codeHash };
      }
      const existant = await base.collection('membres').where('email', '==', email).limit(1).get();
      const data = { nom, prenom, email, numero, statut: 'cle_emise', cleHash: hash(cle), matieres: abo, compteurAcces: 0, expireLe, majLe: now };
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
