# RAPPORT_PHASE_5 — Évaluations notées /20 (corrigées côté serveur) + suivi des résultats

## Objectif de la phase
Même logique de sécurité que la Phase 4 : tout ce qui doit rester caché reste
**côté serveur**. Ici, le piège classique serait de mettre les quiz **et leurs
bonnes réponses** dans un fichier JavaScript : n'importe quel élève pourrait
lire les réponses avant de composer. On ferme cette faille :

- les **questions** sont envoyées **sans les bonnes réponses** ;
- la **correction et la note /20** sont calculées **sur le serveur** ;
- la bonne réponse + l'explication ne sont révélées **qu'après** la remise de la copie ;
- chaque copie rendue est **archivée** (suivi des résultats).

---

## 1. Données (côté serveur)
- **`contenu/thermo/quiz.json`** — 2 évaluations de Thermodynamique
  (« Notions fondamentales & 1er principe », « Deuxième principe & entropie »),
  5 questions QCM chacune, avec `bonne` (index correct) + `explication`.
  Ce fichier **n'est jamais servi tel quel** au navigateur.

## 2. Module serveur `api/_lib/evaluation.js`
- `verifierAcces(db, req, matiere)` — session valide (cookie `mh_s`) **et**
  abonnement à la matière (401 / 403 / 404), **anti-traversal** sur le nom de matière.
- `listeQuiz(matiere)` — métadonnées (titre, chapitre, nb de questions, barème 20),
  **sans aucune réponse**.
- `quizPourPassage(matiere, quizId)` — énoncés + options, **sans `bonne` ni `explication`**.
- `corriger(matiere, quizId, reponses)` — correction serveur : note = `bonnes/total × 20`
  (arrondie au demi-point), renvoie le détail par question (index correct + explication).
- `enregistrerResultat(...)` / `listeResultats(...)` — archive sous
  `membres/{id}/resultats/{auto}` et relit l'historique (plus récent d'abord).

## 3. API `api/evaluation.js` (`/api/evaluation`)
- `GET ?a=liste&m=<matiere>` — liste des évaluations (sans réponses) ;
- `GET ?a=quiz&m=<matiere>&q=<id>` — questions à passer (sans réponses) ;
- `GET ?a=resultats[&m=<matiere>]` — historique des copies du membre ;
- `POST ?a=soumettre { m, q, reponses }` — **mutation** : exige l'en-tête
  `X-Requested-With: mh`, corrige, note /20, archive, renvoie la correction.
- Réponses : `401` sans session, `403` abonnement/en-tête manquant, `404`
  matière/quiz inconnu, `200` OK. **Erreurs neutres**, `Cache-Control: no-store`.

## 4. Interface (branchement léger sur la page matière)
- `public/matiere.html` — nouveau bloc **Évaluations** (+ bouton « Mes résultats »).
- `public/assets/evaluation.js` — liste les quiz, fait passer le quiz (boutons radio),
  envoie la copie, affiche **note /20 + correction + explications**, et l'historique.
  Tout le texte est inséré via `textContent` (**aucun HTML injecté**, conforme CSP `script-src 'self'`).
- `public/assets/espace.css` — styles du bloc évaluation (cartes, score, correction,
  historique), compatibles avec tous les thèmes.
> L'interface complète de l'espace reste prévue pour les phases 6-7 ; ce branchement
> est volontairement sobre mais fonctionnel.

## 5. Déploiement
- `vercel.json` : les fonctions `api/*.js` embarquent déjà `contenu/**` → `quiz.json`
  est disponible en production. Aucune nouvelle variable d'environnement.

---

## Preuve (tests automatisés)
`test/phase5.test.js` — **11 cas** :
1. le quiz existe côté `contenu/` et **pas** en fichier public ;
2. `401` — liste sans session (rien n'est servi) ;
3. `403` — matière non incluse ;
4. `404` — matière inconnue / tentative de traversal ;
5. liste `200` **sans** champ `bonne` ni `explication` (vérifié sur le JSON brut) ;
6. quiz `200` — questions **sans** bonne réponse ni explication ;
7. `403` — soumission sans l'en-tête `X-Requested-With` ;
8. soumission parfaite → **20/20** + résultat **archivé** ;
9. soumission 3/5 → **12/20** (calcul serveur) ;
10. `404` — soumission d'un quiz inexistant ;
11. `resultats` → historique trié (plus récent d'abord).

```
$ npm test
# tests 5        (fichiers : phase1? phase2..phase5)
# pass 5
# fail 0
```

## Conformité au guide v2
- Contrôle d'accès **toujours côté serveur** ; bonnes réponses jamais exposées avant remise.
- **Erreurs neutres**, `no-store`, en-tête exigé pour les mutations.
- Aucun secret dans le code ni en chat.
- Mobile-first conservé (bloc évaluation responsive).
- **Non poussé sur GitHub** (conformément à la consigne).

## STOP
Fin de la Phase 5. En attente du feu vert pour la phase suivante (interface complète, phases 6-7).
