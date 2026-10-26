// Service de contenu PROTÉGÉ (phase 4). Le cours n'est plus un fichier public :
// il n'est servi qu'APRÈS contrôle d'accès côté serveur (session + abonnement).
// Fonctions pures : la base de données est injectée (authentification via cookie mh_s).
const fs = require('fs');
const path = require('path');
const sess = require('./session');

function erreur(status, message) { const e = new Error(message); e.status = status; return e; }
function contenuDir() { return path.join(__dirname, '..', '..', 'contenu'); }

// Catalogue : id -> titre (liste blanche des matières connues).
function catalogue() {
  try {
    const j = JSON.parse(fs.readFileSync(path.join(contenuDir(), 'catalogue.json'), 'utf8'));
    const map = {};
    (j.matieres || []).forEach((m) => { map[m.id] = m.titre || m.id; });
    return map;
  } catch (e) { return {}; }
}

// Lecture d'un cours depuis le disque (jamais exposé au public).
function lireCours(matiere) {
  const id = String(matiere || '').replace(/[^a-z0-9_-]/gi, ''); // anti path-traversal
  if (!id) throw erreur(404, 'Matière inconnue.');
  const f = path.join(contenuDir(), id, 'cours.json');
  if (!fs.existsSync(f)) throw erreur(404, 'Contenu indisponible.');
  try { return JSON.parse(fs.readFileSync(f, 'utf8')); }
  catch (e) { throw erreur(500, 'Contenu illisible.'); }
}

// Matières auxquelles le membre authentifié est abonné (avec titre + dispo contenu).
async function profilMatieres(db, req) {
  const { membre } = await sess.authentifier(db, req);
  const cat = catalogue();
  const abo = Array.isArray(membre.matieres) ? membre.matieres : [];
  const matieres = abo.filter((id) => cat[id]).map((id) => ({
    id, titre: cat[id],
    disponible: fs.existsSync(path.join(contenuDir(), id, 'cours.json'))
  }));
  return { prenom: membre.prenom || '', matieres };
}

// Cœur phase 4 : sert le cours d'une matière UNIQUEMENT si le membre y est abonné.
// 401 sans session valide · 404 matière hors catalogue · 403 matière non incluse.
async function servirCours(db, req, matiere) {
  const { membre, deviceId } = await sess.authentifier(db, req); // 401/403 si session/compte invalide
  const cat = catalogue();
  const id = String(matiere || '').replace(/[^a-z0-9_-]/gi, '');
  if (!id || !cat[id]) throw erreur(404, 'Matière inconnue.');
  const abo = Array.isArray(membre.matieres) ? membre.matieres : [];
  if (abo.indexOf(id) < 0) throw erreur(403, 'Cette matière n\'est pas incluse dans votre accès.');
  await sess.exigerDeverrouillage(db, membre.id, deviceId); // 403 « Code requis » si non déverrouillé
  const cours = lireCours(id);
  return { matiere: { id, titre: cat[id] }, cours };
}

module.exports = { catalogue, lireCours, profilMatieres, servirCours, erreur };
