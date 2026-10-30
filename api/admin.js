// POST /api/admin — actions reservees a l'administrateur.
// Securite : jeton Firebase (Authorization: Bearer <idToken>) dont l'email == ADMIN_EMAIL.
const { db, auth } = require('./_lib/firebase');
const { sendMail, wrap } = require('./_lib/mail');
const { hash, nouvelleCle, nouveauCode } = require('./_lib/secret');
const { readBody, send, methodGuard, validEmail, clean } = require('./_lib/http');
const essaisLib = require('./_lib/essais');
const inscLib = require('./_lib/inscription');
const msgLib = require('./_lib/messagerie');
const maintLib = require('./_lib/maintenance');

// K1 (D12) : garde admin PURE et testable. L'accès admin exige un jeton dont
// l'email est VÉRIFIÉ (email_verified === true) ET égal à ADMIN_EMAIL.
// Un simple « email == ADMIN_EMAIL » ne suffit pas : sans email_verified, un
// compte non vérifié usurpant l'adresse admin pourrait passer.
function adminAutorise(dec, attendu) {
  if (!dec) return false;
  if (!attendu) return false;
  if (dec.email_verified !== true) return false;
  if ((dec.email || '').toLowerCase() !== attendu) return false;
  return true;
}

async function estAdmin(req) {
  const h = req.headers['authorization'] || '';
  const m = h.match(/^Bearer\s+(.+)$/i);
  if (!m) return null;
  const dec = await auth().verifyIdToken(m[1]).catch(() => null);
  const attendu = (process.env.ADMIN_EMAIL || '').toLowerCase();
  return adminAutorise(dec, attendu) ? dec : null;
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
      const s = await base.collection('matieres').orderBy('ordre').get();
      return send(res, 200, { ok: true, matieres: s.docs.map((d) => ({ id: d.id, nom: (d.data().nom || d.id), ordre: d.data().ordre || 0 })) });
    }

    if (action === 'stats') {
      // Tableau de bord : compteurs synthetiques pour l'administrateur.
      // Messagerie : les non-lus viennent du compteur global (D22, pas de balayage).
      const [dem, mem, cpt] = await Promise.all([
        base.collection('demandes').get(),
        base.collection('membres').get(),
        base.collection('compteurs').doc('global').get()
      ]);
      let demEnAttente = 0;
      dem.forEach((d) => { const st = d.data().statut; if (!st || st === 'nouvelle' || st === 'ouverte') demEnAttente++; });
      let memActifs = 0, filsAvecMsg = 0;
      mem.forEach((d) => { const x = d.data() || {}; if (x.statut === 'actif') memActifs++; if (x.msgNonLusAdmin || 0) filsAvecMsg++; });
      const msgNonLus = cpt.exists ? ((cpt.data() || {}).msgNonLus || 0) : 0;
      const alertesAbus = cpt.exists ? ((cpt.data() || {}).alertesAbus || 0) : 0;
      return send(res, 200, { ok: true, stats: {
        demandes: dem.size, demandesEnAttente: demEnAttente,
        membres: mem.size, membresActifs: memActifs,
        messages: filsAvecMsg, messagesOuverts: msgNonLus,
        alertesAbus: alertesAbus
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

    if (action === 'list_messages') {
      // H2 : fils en sous-collection membres/{id}/messages (un doc par message).
      return send(res, 200, { ok: true, fils: await msgLib.listerFilsAdmin(base) });
    }

    if (action === 'repondre') {
      // H2 : `messageId` désigne le fil = l'identifiant du membre.
      const membreId = clean(b.messageId, 60);
      const texte = clean(b.texte, msgLib.MAX_TEXTE);
      const pieces = Array.isArray(b.pieces) ? b.pieces : [];
      const r = await msgLib.repondreAdmin(base, membreId, texte, pieces, sendMail, site);
      return send(res, 200, r);
    }

    if (action === 'marquer_lu') {
      // Admin ouvre une conversation : remet le compteur de non-lus à 0.
      const r = await msgLib.marquerLuAdmin(base, clean(b.messageId || b.membreId, 60));
      return send(res, 200, r);
    }

    if (action === 'supprimer_fil') {
      // Seul l'admin peut effacer un fil (D17).
      const r = await msgLib.supprimerFil(base, clean(b.messageId || b.membreId, 60));
      return send(res, 200, r);
    }

    if (action === 'inviter_essai') {
      // K3 : voie d'essai unifiée. L'ancienne invitation par lien signé (sans
      // enregistrement essais/{hash}, sans unicité par email, sans filigrane)
      // est retirée : la SEULE voie d'octroi est `accorder_essai` (D10).
      return send(res, 410, { ok: false, erreur: 'Action retirée : utilisez « accorder un essai ».' });
    }

    // ---- Nouveau modèle (phase 3) : essais gratuits pilotés par l'admin ----
    if (action === 'accorder_essai') {
      const r = await essaisLib.accorderEssai(base, b, sendMail, site);
      return send(res, 200, r);
    }
    if (action === 'list_essais') {
      return send(res, 200, { ok: true, essais: await essaisLib.listEssais(base) });
    }
    if (action === 'supprimer_essai') {
      return send(res, 200, await essaisLib.supprimerEssai(base, clean(b.hash, 80)));
    }
    // Approbation nouveau modèle (membre à clé unique + code 8 car.).
    if (action === 'approuver_nm') {
      const r = await inscLib.approuverDemande(base, b, sendMail, site);
      return send(res, 200, { ok: true, membreId: r.membreId });
    }
    // Révoque les anciens liens/cookies d'un membre (incrément tokenVersion + nouvel email).
    if (action === 'regenerer_lien') {
      const r = await inscLib.regenererLien(base, b, sendMail, site);
      return send(res, 200, r);
    }
    // Ferme tous les appareils enregistrés d'un membre (D5 : l'admin peut vider la liste).
    if (action === 'vider_appareils') {
      const r = await inscLib.viderAppareilsMembre(base, b);
      return send(res, 200, r);
    }
    // K2 : cycle de vie d'un membre (fiche admin : prolonger/suspendre/reactiver/supprimer).
    if (action === 'prolonger') {
      const r = await inscLib.prolongerMembre(base, b);
      return send(res, 200, r);
    }
    if (action === 'suspendre') {
      const r = await inscLib.suspendreMembre(base, b);
      return send(res, 200, r);
    }
    if (action === 'reactiver') {
      const r = await inscLib.reactiverMembre(base, b);
      return send(res, 200, r);
    }
    if (action === 'supprimer_membre') {
      const r = await inscLib.supprimerMembre(base, b);
      return send(res, 200, r);
    }

    // K8 (D21/D22) : maintenance admin — journal d'audit, stockage, purge ciblée.
    if (action === 'list_journal') {
      return send(res, 200, { ok: true, journal: await maintLib.listerJournal(base, b.max) });
    }
    if (action === 'stockage') {
      return send(res, 200, { ok: true, stockage: await maintLib.rapportStockage(base) });
    }
    if (action === 'purger') {
      const r = await maintLib.purger(base, clean(b.cible, 40));
      return send(res, 200, r);
    }

    return send(res, 400, { ok: false, erreur: 'Action inconnue.' });
  } catch (e) {
    // Honore un status porte par l'erreur (erreur(status,msg) des libs) ; sinon 500.
    const status = (e && e.status) || 500;
    const erreur = status === 500 ? 'Erreur serveur.' : (e.message || 'Erreur.');
    return send(res, status, { ok: false, erreur });
  }
};

// Export auxiliaire pour tests unitaires (K1) : la garde admin pure.
// N'affecte pas le handler HTTP exporté par défaut ci-dessus.
module.exports.adminAutorise = adminAutorise;
