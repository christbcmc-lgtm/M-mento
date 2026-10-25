// Évaluations PROTÉGÉES (phase 5) — quiz notés /20, corrigés CÔTÉ SERVEUR.
// Principe de sécurité identique à la phase 4 : les bonnes réponses ne quittent
// JAMAIS le serveur tant que l'élève n'a pas rendu sa copie. Le client reçoit les
// questions SANS les réponses ; la correction et la note /20 sont calculées ici,
// puis le résultat est archivé (suivi des résultats) sous membres/{id}/resultats.
const fs = require('fs');
const path = require('path');
const sess = require('./session');
const { catalogue } = require('./contenu');

function erreur(status, message) { const e = new Error(message); e.status = status; return e; }
function contenuDir() { return path.join(__dirname, '..', '..', 'contenu'); }
function sain(id) { return String(id || '').replace(/[^a-z0-9_-]/gi, ''); } // anti path-traversal

// Lecture du fichier d'évaluations d'une matière (jamais exposé tel quel au public).
function lireFichier(matiere) {
  const id = sain(matiere);
  if (!id) throw erreur(404, 'Matière inconnue.');
  const f = path.join(contenuDir(), id, 'quiz.json');
  if (!fs.existsSync(f)) throw erreur(404, 'Évaluations indisponibles.');
  try { return JSON.parse(fs.readFileSync(f, 'utf8')); }
  catch (e) { throw erreur(500, 'Évaluations illisibles.'); }
}

function trouverQuiz(matiere, quizId) {
  const data = lireFichier(matiere);
  const qid = sain(quizId);
  const quiz = (data.evaluations || []).filter((e) => e.id === qid)[0];
  if (!quiz) throw erreur(404, 'Évaluation introuvable.');
  return quiz;
}

// Vérifie session + abonnement à la matière (401/403/404), comme pour le cours.
async function verifierAcces(db, req, matiere) {
  const { membre } = await sess.authentifier(db, req); // 401/403 si session/compte invalide
  const cat = catalogue();
  const id = sain(matiere);
  if (!id || !cat[id]) throw erreur(404, 'Matière inconnue.');
  const abo = Array.isArray(membre.matieres) ? membre.matieres : [];
  if (abo.indexOf(id) < 0) throw erreur(403, 'Cette matière n\'est pas incluse dans votre accès.');
  return { membre, id, titre: cat[id] };
}

// Liste des évaluations d'une matière SANS aucune réponse (juste les métadonnées).
function listeQuiz(matiere) {
  const data = lireFichier(matiere);
  return (data.evaluations || []).map((e) => ({
    id: e.id, titre: e.titre, chapitre: e.chapitre || '',
    nbQuestions: (e.questions || []).length, bareme: 20
  }));
}

// Questions prêtes à passer : énoncé + options, mais JAMAIS la bonne réponse.
function quizPourPassage(matiere, quizId) {
  const quiz = trouverQuiz(matiere, quizId);
  return {
    id: quiz.id, titre: quiz.titre, chapitre: quiz.chapitre || '', bareme: 20,
    questions: (quiz.questions || []).map((q) => ({
      id: q.id, enonce: q.enonce, options: (q.options || []).slice()
    }))
  };
}

function arrondiDemi(x) { return Math.round(x * 2) / 2; }

// Correction CÔTÉ SERVEUR : compare aux bonnes réponses, calcule la note /20.
// `reponses` = { questionId: indexChoisi }. Renvoie la note + le détail (avec
// l'index correct et l'explication, révélés UNIQUEMENT après remise de la copie).
function corriger(matiere, quizId, reponses) {
  const quiz = trouverQuiz(matiere, quizId);
  const rep = (reponses && typeof reponses === 'object') ? reponses : {};
  const questions = quiz.questions || [];
  const total = questions.length || 0;
  let bonnes = 0;
  const details = questions.map((q) => {
    const choisiBrut = rep[q.id];
    const choisi = Number.isInteger(choisiBrut) ? choisiBrut : (parseInt(choisiBrut, 10));
    const aRepondu = Number.isInteger(choisi) && choisi >= 0 && choisi < (q.options || []).length;
    const correct = aRepondu && choisi === q.bonne;
    if (correct) bonnes++;
    return { id: q.id, bonne: q.bonne, choisi: aRepondu ? choisi : null, correct, explication: q.explication || '' };
  });
  const note = total ? arrondiDemi((bonnes / total) * 20) : 0;
  return { quizId: quiz.id, titre: quiz.titre, note, sur: 20, bonnes, total, details };
}

// Archive le résultat (suivi) sous membres/{id}/resultats/{auto}.
async function enregistrerResultat(db, membreId, matiere, resultat) {
  const col = db.collection('membres').doc(membreId).collection('resultats');
  const ref = col.doc(); // id auto
  const now = Date.now();
  await ref.set({
    matiere: sain(matiere), quizId: resultat.quizId, titre: resultat.titre || '',
    note: resultat.note, sur: resultat.sur, bonnes: resultat.bonnes, total: resultat.total, le: now
  });
  return { id: ref.id, le: now };
}

// Historique des résultats du membre (plus récent d'abord), filtrable par matière.
async function listeResultats(db, membreId, matiere) {
  const snap = await db.collection('membres').doc(membreId).collection('resultats').get();
  const filtreM = matiere ? sain(matiere) : null;
  const out = [];
  snap.forEach((d) => {
    const x = d.data() || {};
    if (filtreM && x.matiere !== filtreM) return;
    out.push({ id: d.id, matiere: x.matiere, quizId: x.quizId, titre: x.titre,
      note: x.note, sur: x.sur, bonnes: x.bonnes, total: x.total, le: x.le });
  });
  out.sort((a, b) => (b.le || 0) - (a.le || 0));
  return out;
}

module.exports = {
  erreur, verifierAcces, listeQuiz, quizPourPassage, corriger,
  enregistrerResultat, listeResultats, lireFichier, trouverQuiz
};
