// K8 (D21/D22) : outils de maintenance admin — journal d'audit, rapport de
// stockage et purge CIBLÉE. Fonctions PURES et testables : la base est INJECTÉE.
//
// Principe de moindre privilège : `purger` n'efface JAMAIS implicitement. Elle
// n'agit que sur une `cible` explicitement choisie par l'administrateur et
// restreinte à des données TRANSITOIRES (journal d'audit, demandes rejetées).
// Les membres, essais actifs, messages et résultats ne sont jamais purgés ici.
//
// Note D22 : le tableau de bord (`stats`) évite tout balayage. Le rapport de
// stockage, lui, est une page de MAINTENANCE occasionnelle, pas le tableau de
// bord sondé en continu ; un comptage borné y est donc toléré [hypothèse].
const em = require('./emails');
const { journal } = require('./inscription');
const erreur = em.erreur;

// Firestore réel sait trier/limiter ; la base de test en mémoire non. On tente
// orderBy/limit quand ils existent, sinon on retombe sur get()+tri+découpe.
async function lireCollection(col) {
  const snap = await col.get();
  const out = [];
  snap.forEach((d) => out.push(Object.assign({ id: d.id }, d.data() || {})));
  return out;
}

// Journal d'audit, du plus récent au plus ancien, borné à `max` entrées.
async function listerJournal(db, max) {
  const n = Math.max(1, Math.min(500, parseInt(max, 10) || 100));
  const col = db.collection('journal');
  const rows = await lireCollection(col);
  rows.sort((a, b) => (b.le || 0) - (a.le || 0));
  return rows.slice(0, n).map((r) => ({
    id: r.id, qui: r.qui || '', action: r.action || '',
    cible: r.cible || null, type: r.type || 'info', le: r.le || 0
  }));
}

// Rapport de stockage : compteurs bornés par collection (page maintenance).
async function rapportStockage(db) {
  const [dem, mem, ess, jrn] = await Promise.all([
    lireCollection(db.collection('demandes')),
    db.collection('membres').get(),
    db.collection('essais').get(),
    db.collection('journal').get()
  ]);
  let demRejetees = 0;
  for (const d of dem) { if (d.statut === 'rejetee') demRejetees++; }
  return {
    demandes: dem.length,
    demandesRejetees: demRejetees,
    membres: mem.size,
    essais: ess.size,
    journal: jrn.size
  };
}

// Cibles de purge autorisées (données transitoires uniquement).
const CIBLES_PURGE = ['journal', 'demandes_rejetees'];

// Purge CIBLÉE et explicite. 400 si la cible n'est pas dans la liste blanche.
// Journalise l'action APRÈS la suppression (pour qu'une purge du journal
// laisse quand même sa propre trace d'audit). Renvoie le nombre supprimé.
async function purger(db, cible) {
  if (!CIBLES_PURGE.includes(cible)) throw erreur(400, 'Cible de purge inconnue.');
  let supprime = 0;
  if (cible === 'journal') {
    const rows = await lireCollection(db.collection('journal'));
    for (const r of rows) { await db.collection('journal').doc(r.id).delete(); supprime++; }
  } else if (cible === 'demandes_rejetees') {
    const rows = await lireCollection(db.collection('demandes'));
    for (const r of rows) {
      if (r.statut === 'rejetee') { await db.collection('demandes').doc(r.id).delete(); supprime++; }
    }
  }
  await journal(db, 'admin', 'purge', cible);
  return { ok: true, cible, supprime };
}

module.exports = { listerJournal, rapportStockage, purger, CIBLES_PURGE };
