// Catalogue canonique des matières — SOURCE DE VÉRITÉ.
// Garantit que les matières s'affichent TOUJOURS (côté membre et côté admin),
// même si la collection Firestore « matieres » est vide. Les documents Firestore
// ne servent qu'à AJOUTER d'éventuelles matières supplémentaires ou à attacher
// des ressources (PDF/livres) à une matière existante.
const CATALOGUE = [
  { id: 'thermo', nom: 'Thermodynamique', ordre: 1 },
  { id: 'proba', nom: 'Probabilité et statistique', ordre: 2 },
  { id: 'info', nom: 'Informatique', ordre: 3, bientot: true }
];

// Fusionne le catalogue canonique avec les documents Firestore.
// - une entrée canonique est toujours présente ;
// - un document Firestore de même id peut compléter (nom, ordre, ressources) ;
// - un document Firestore d'id inconnu ajoute une matière supplémentaire.
function fusionner(docsFirestore) {
  const parId = {};
  CATALOGUE.forEach((m) => { parId[m.id] = Object.assign({}, m); });
  (docsFirestore || []).forEach((d) => {
    const x = d.data ? d.data() : (d.data || d);
    const id = d.id || x.id;
    if (!id) return;
    const base = parId[id] || { id: id, nom: id, ordre: 999 };
    parId[id] = Object.assign(base, {
      nom: x.nom || base.nom,
      ordre: (typeof x.ordre === 'number' ? x.ordre : base.ordre),
      ressources: Array.isArray(x.ressources) ? x.ressources : (base.ressources || []),
      bientot: x.bientot != null ? !!x.bientot : base.bientot
    });
  });
  return Object.keys(parId)
    .map((k) => parId[k])
    .sort((a, b) => (a.ordre || 0) - (b.ordre || 0));
}

module.exports = { CATALOGUE, fusionner };
