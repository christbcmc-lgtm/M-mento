# RAPPORT_H0 — Contrat d'API (`docs/CONTRAT-API.md`)

## (a) Ce qui est fait

- Lecture intégrale du Guide d'exécution strict v2 (sections 0, 2, 3, 5, 6, 11
  notamment) avant démarrage. Aucun renumérotage.
- Création de **`docs/CONTRAT-API.md`** rédigé **à partir du code réel**
  (`api/*.js` + `api/_lib/*.js`), pas de la vision. Pour chaque fonction et
  chaque action `a=` : méthode HTTP, contrôle d'accès exigé (session / code /
  admin / en-tête `X-Requested-With` / jeton), entrées, sortie, codes d'erreur.
- Couverture des 6 fonctions et de toutes leurs actions réelles :
  - `auth` : `activer`, `session`, `acces`, `code`, `lien-perdu`, `deconnexion`.
  - `public` : `demande`, `decision`, `essai`, `essai-contenu`, `code-reset`, `matieres`.
  - `contenu` : `profil`, `cours`.
  - `evaluation` : `liste`, `quiz`, `resultats`, `soumettre`.
  - `message` : routes GET / POST (pas de `a=`).
  - `admin` : `list_matieres`, `stats`, `list_membres`, `list_demandes`, `rejeter`,
    `list_messages`, `repondre`, `inviter_essai`, `accorder_essai`, `list_essais`,
    `supprimer_essai`, `approuver_nm`.
- Tableau des codes d'erreur réellement employés (`400/401/403/404/405/409/410/429/500/502`)
  et rappels transverses (normalisation d'email, anti-force brute, catalogue, secrets).
- Notes d'évolution signalées là où H2 (messagerie) et H3/H4 (contenu par chapitre
  + media) modifieront le contrat, pour que la mise à jour soit ciblée.

## (b) Preuves

Test dédié `test/h0.test.js` — un test qui échoue AVANT, passe APRÈS :

- AVANT (doc absente) : `# pass 0 # fail 4`
  ```
  not ok 1 - H0 : docs/CONTRAT-API.md existe
  not ok 2 - H0 : chaque action du code source est effectivement gérée (garde-fou)
  not ok 3 - H0 : le contrat documente chaque fonction et chaque action
  not ok 4 - H0 : le contrat indique les contrôles (session / code / admin) et les codes d'erreur
  ```
  (le test 2 échouait d'abord à cause d'un état de regex ; corrigé, il sert
  désormais de garde-fou qui relit le code source pour vérifier que la liste
  d'actions documentée correspond bien aux actions réellement gérées.)

- APRÈS : `# pass 4 # fail 0`
  ```
  ok 1 - H0 : docs/CONTRAT-API.md existe
  ok 2 - H0 : chaque action du code source est effectivement gérée (garde-fou)
  ok 3 - H0 : le contrat documente chaque fonction et chaque action
  ok 4 - H0 : le contrat indique les contrôles (session / code / admin) et les codes d'erreur
  ```

Suite complète (chaque fichier `node test/<f>` ) :
```
f1 5/0  f2 6/0  f2plus 6/0  f3 5/0  g 12/0  h0 4/0
phase2 5/0  phase3 7/0  phase4 6/0  phase5 11/0  phase6 9/0  phase7 9/0
```
Tous verts, 0 échec.

## (c) Ce qui reste

- H1 → H4 (dans l'ordre, un élément à la fois, STOP après chacun).
- Le contrat devra être mis à jour quand H2 (messagerie en sous-collection) et
  H3/H4 (contenu par chapitre + `a=plan/chapitre/correction/media`) modifieront
  les signatures.

## (d) Risques

- Document purement descriptif : aucun risque de régression (ni code applicatif
  ni apparence touchés). Seul ajout côté code = `test/h0.test.js` (test only).
- Le garde-fou de `h0.test.js` relèvera toute dérive future entre le code et la
  liste d'actions, mais ne vérifie pas la justesse des descriptions en prose.

## (e) Gestes à faire par le propriétaire

- Aucun geste téléphone requis pour H0 (document + test unitaire).
- Relire `docs/CONTRAT-API.md` et confirmer qu'il reflète bien l'API attendue
  avant que je démarre H1.

---

**Aucun push GitHub.** Lot H0 terminé — **STOP**, j'attends ton feu vert pour H1.
