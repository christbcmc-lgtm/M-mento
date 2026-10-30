# Mémento — Spécifications restantes (annexe de l'exécutant)

*Rédigée le 30 octobre 2026 après audit du lot K17. Elle contient **tout ce qui manquait** à l'exécutant (« §2 Q-D1 à Q-D4, §4.5, §5 phase 5, §6, §9.B ») et la liste des corrections à faire. Elle complète `docs/GUIDE-EXECUTION.md` (le guide prime en cas de conflit, sauf les décisions du propriétaire reprises ici).*

## 0. Règles d'exécution (autonomie encadrée)

1. Tu enchaînes les éléments sans attendre de feu vert, dans l'ordre de la section 3.
2. **Feu rouge = arrêt.** La suite complète de tests doit rester verte. Rapporte la sortie **exacte** de `node --test` (`# tests`, `# pass`, `# fail`). **Base de comparaison : 154 tests** à l'état K1ter. Un total plus bas que 154 signifie que tu pars d'une mauvaise base ou que des tests ne tournent pas : arrête-toi et dis-le.
3. Un test qui échoue avant, passe après, par élément. Pour l'interface : test jsdom qui **exécute** le code.
4. Un `RAPPORT_<id>.md` par élément et `PROGRESS.md` mis à jour (fait, en cours, prochain, bloqué).
5. **Livraison : toujours une archive ZIP complète du dépôt** (`memento-<id>.zip`). Jamais de fichiers isolés, jamais de doublons (`admin_htmlé.html`), jamais de fichier vide, noms exacts (`acces.html`, `decision.html`).
6. Aucun push GitHub, aucun jeton conservé, aucun secret dans un fichier. `firestore.rules` reste deny-all. Pas de dépendance serveur au-delà de `firebase-admin`, `jsonwebtoken`, `nodemailer` ; jsdom en devDependency de test seulement.
7. Ne rien inventer en contenu pédagogique ; ne rien affirmer sans test ; dire clairement ce qui n'est pas vérifiable sans navigateur.

## 1. Constats de l'audit (30 octobre) — à corriger

| Réf | Constat | Gravité |
|---|---|---|
| X1 | Fiche d'activation : « Aucune matière déclarée dans le catalogue ». `list_matieres` (api/admin.js) lit la collection Firestore `matieres` (vide) au lieu de `contenu/catalogue.json` (thermo, proba, info). L'admin ne peut **pas choisir** les matières ; le serveur retombe seulement sur celles demandées par le membre. | **Haute** |
| X2 | Le bandeau d'erreur de la console (K1ter) ne disparaît jamais après un succès, et la console n'est pas rechargée après « J'ai vérifié mon email ». À corriger si K1quater n'est pas fait. | Moyenne |
| X3 | Pages publiques (`index`, `acces`, `demande`, `essai`, `decision`) : sélecteur de thème visible et thème du visiteur appliqué. La règle du propriétaire (D16) : **les pages publiques gardent la palette fixe « bleu nuit »**. Le badge « ✔ 8 thèmes d'affichage » de l'accueil est donc à retirer. | Haute |
| X4 | Accueil : « Essayer gratuitement » mène à `essai.html` sans invitation, donc à une page d'erreur (défaut A8 du guide, toujours ouvert). | Haute |
| X5 | `acces.html` : pas de lien « Lien perdu ? » ; l'écran de succès dit que le lien est envoyé par email mais ne l'affiche pas en texte copiable (guide 4.1, écran C). | Haute |
| X6 | Fiche d'activation de la console : « Numéro (facultatif) » alors que le numéro est obligatoire (D7) ; case « Générer automatiquement un code **par matière** » alors que la décision D6 est **un seul code par membre** ; « Quota d'heures (0 = illimité) » laisse croire que le quota est appliqué (il ne l'est pas, D20). | Haute |
| X7 | La section « Inviter à un essai gratuit » de `admin.html` est un reste de l'ancien circuit. La console n'appelle plus `inviter_essai` (retirée, 410) : vérifier que le bouton passe bien par `accorder_essai`, sinon le remplacer par le circuit demande d'essai → accord. | Moyenne |
| X8 | `decision.html` n'affiche pas les **matières demandées** (maquette du guide 4.2). | Faible |
| X9 | Registre de langue incohérent : « Tes cours » / « Tu obtiens » sur l'accueil et `acces.html`, « Votre » ailleurs. Vouvoiement partout. | Faible |
| X10 | `demande.html` : placeholder du numéro au format français (06 12 34 56 78) alors que les membres sont au Bénin ; champ non signalé comme obligatoire. | Faible |
| X11 | Test K17 : ne scanne que HTML et CSS (pas `assets/*.js`) ; les paires de contraste de **texte** ne couvrent pas `--accent` sur `--fond`, `--surface`, `--masque`, ni `--erreur`, `--succes`, `--texte-doux` sur `--masque`. Calcul fait : **sépia, `--accent` sur `--masque` = 4,32:1 (< 4,5)**, utilisé par `.eyebrow` et `a.fref`. Le motif `#[0-9a-f]{3,8}` peut aussi matcher des entités numériques (`&#8217;`). | Moyenne |
| X12 | `matiere.html` et `cours-reader.js` : toujours l'ancienne page (pastille « Étape n / N », aucun menu, aucune recherche, aucun PDF, aucune bulle de notes). Voir section 2. | Haute |

## 2. Spécifications que l'exécutant disait ne pas avoir

### 2.1 Q-D1 à Q-D5 (pastille, flèches, « Revenir »)

- **Q-D1.** Supprimer la pastille « Étape n / N » : libellé, barre de progression, deux gros boutons ronds (`public/assets/cours-reader.js`, vers les lignes 110 à 125, et `.nav-etapes`, `.ne-*` de `base.css`). **Aucun compteur d'étapes nulle part.**
- **Q-D2.** Remplacer par deux **flèches discrètes** ‹ › (retour, avance) : icône de 20 px, trait de 2 px, couleur du texte atténuée (opacité 0,45 ; 0,9 au survol et au focus), **sans fond, sans bordure, sans libellé**, centrées en bas à 14 px du bord (plus la zone de sécurité du téléphone), zone tactile de 44 px, opacité 0,2 quand il n'y a rien à faire, raccourcis `Alt+←` et `Alt+→`.
- **Q-D3.** Ces flèches font revenir et avancer dans l'**historique de lecture** (`history.pushState` à chaque saut), comme Contrôle Z. Elles ne changent **pas** de chapitre (le menu latéral et le titre de chapitre s'en chargent).
- **Q-D4.** Bouton discret « Revenir (n) » après chaque saut par lien interne (renvoi de formule, « Retour au cours ») : compteur de positions mémorisées, clic = position précédente en défilement doux, `Alt+←` équivalent.
- **Q-D5.** Le thème reste celui du membre, choisi dans « Mon espace ». Ne pas copier les trois pastilles de couleur de l'en-tête d'Academia Hub.

### 2.2 Moteur de chapitres (« flèche », guide 4.5)

1. Seul le chapitre actif est déplié ; les autres n'affichent que leur titre (bandeau).
2. En descendant, on atteint le titre du chapitre suivant : **le passage est bloqué**, il faut toucher le titre pour l'ouvrir. En l'ouvrant, le chapitre précédent se referme (son titre reste).
3. En remontant, quand le haut du chapitre actif atteint le bandeau du chapitre précédent, **ce chapitre s'ouvre automatiquement**, l'actif se referme, et la lecture reprend à la **fin** du chapitre précédent.
4. `IntersectionObserver` sur des sentinelles ; direction du défilement mesurée sur deux positions ; verrou de 200 ms pendant la transition ; recalcul explicite de `scrollTop` après dépliage ; aucune boucle de réouverture.
5. Même mécanique pour la liste d'exercices et pour les rubriques d'évaluation.

### 2.3 Format du contenu (guide §6)

JSON pur, un fichier par chapitre : `contenu/<matière>/cours/chN.json` = `{ id, numero, titre, sections:[{ id, titre, blocs:[…] }] }`.

Blocs : `p` (`md`), `h` (`md`), `liste` (`ordonnee`, `items[]`), `formule` (`id` F1…, `tex`, `legende`), `tableau` (`entetes[]`, `lignes[][]`), `image` (`src`, `alt`, `legende`), `encadre` (`style`, `blocs[]`), `detail` (`titre`, `blocs[]`, masqué par défaut), `code` (`langage`, `texte`, `commente`).

Styles d'encadré (7) : `definition` (violet), `retenir` (vert), `attention` (rouge), `note` (bleu), `examen` (orange), `complement` (sarcelle), `verifier` (gris) ; fond teinté semi-transparent, bord gauche de 5 px, couleurs via variables de thème.

Balisage inline : `**gras**`, `__souligné__`, `*italique*`, `$formule$`, `[[F3]]` (renvoi de formule), `[[c:ch2#2.1|texte]]` (lien interne). **Aucun caractère `_`, `^`, `$` ni barre oblique inverse visible dans le texte affiché** : tout indice ou exposant passe par `$…$` (défaut connu : `T_c−T_f` dans `contenu/thermo/cours.json`).

Résumé : `resume/chN.json`, mêmes identifiants de sections. Exercices : `exercices/chN.json` = liste de `{ id, titre, enonce[], correction[] }` ; **la correction n'est jamais envoyée avec la liste**, seulement par `contenu?a=correction`. `space.json` par matière : `{ id, nom, onglets[], chapitres[{id, titre, sous[]}] }`.

Actions serveur à créer (mêmes contrôles : session, abonnement, code déverrouillé, expiration, 60 requêtes par minute et par membre) : `plan` (titres seulement), `chapitre` (un seul), `correction`, `media` (flux, MIME correct, `Cache-Control: private`, SVG avec CSP `sandbox`), `pdf`, `recherche` (accents et casse ignorés, tous les mots présents, 80 résultats au plus, **jamais de correction ni de bonne réponse dans l'index**), `notes` (GET/PUT, 20 000 caractères au plus), `theme` (GET/PUT, 8 valeurs). Supprimer ensuite l'action `cours` et ses usages.

### 2.4 Évaluation (guide phase 5, K6)

- Banque `contenu/<matière>/questions.json` : `{ id, type:'qcm'|'vf'|'analyse'|'completer', chapitre, section, source:'cours'|'exercice'|'les-deux', difficulte, enonce, options:[{id,texte}], reponses:[…], explication, ref }`. Convertir les 10 questions existantes ; le quota de 160 par matière viendra du lot contenu.
- `eval?a=start` : filtres (matière, chapitres, portée, types, nombre), tirage `crypto.randomInt`, aucune question répétée, enregistrement `evals/{id}`, **envoi sans aucune clé de réponse**.
- `eval?a=submit` : refuse un `evalId` d'un autre membre ou expiré. Barème : vrai/faux 1 ou 0 ; QCM à réponses multiples : (bonnes cochées − mauvaises cochées) ÷ nombre de bonnes, plancher 0 ; analyse : auto-notation 0, ½ ou 1. **Note = 20 × points obtenus ÷ points possibles, arrondie au demi-point.**
- Enregistrement dans `resultats`, mise à jour transactionnelle de `stats/{matière}` (aucun balayage), liste des questions ratées. `historique` et `ratees` pour « Mes résultats » et « Réviser mes erreurs ». Portées : `cours` = source `cours` ou `les-deux` ; `exercices` = source `exercice` ou `les-deux` ; `tout`.
- Remplace les anciennes actions `liste`, `quiz`, `resultats` d'`api/evaluation.js`.

### 2.5 Essais d'intrusion (guide 9.B, K10) — à automatiser dans `test/intrusion.test.js`

1. Chaque action de `auth`, `contenu`, `evaluation`, `message`, `admin` sans cookie ni jeton : refusée.
2. Cookie d'un membre sur une matière non souscrite : 403.
3. Soumission d'évaluation avec le `evalId` d'un autre membre : 403.
4. Rejeu d'un jeton de décision déjà utilisé : refusé.
5. Force brute du code : 429 puis blocage.
6. Requête de modification sans `X-Requested-With` : refusée.
7. Lecture de Firestore depuis le navigateur : refusée (règles deny-all).
8. `/api/_lib/*`, `/contenu/*`, `/firestore.rules`, `/package.json`, `/DECISIONS.md` : 404.
9. Balises HTML dans nom, prénom, message : affichées comme texte.
10. URL de pièce jointe `javascript:` ou non https : refusée.
11. Demande avec un email déjà pris, y compris `+suffixe`, points Gmail et `googlemail.com` : refusée.

(La réponse aux abus 9.C est déjà faite : K9.)

### 2.6 Qualité de la page matière (modèle : Optique d'Academia Hub)

- **En-tête fixe** 60 px (56 sur mobile) : logo et nom, `⌂ Mon espace`, onglets selon `space.json` (actif en couleur d'accent), recherche (820 px au plus, 24 px d'arrondi, raccourci `/`), filtre, bouton `PDF` (rond flottant de 54 px sur mobile).
- **Menu latéral** 330 px collant (tiroir de 86 % de l'écran, 320 px au plus, sous 900 px) : chapitres repliables, sections avec trait vertical, numéro de page du PDF en petit à droite, **position courante en couleur d'accent** (`IntersectionObserver`, marge haute −70 px) ; **un toucher en dehors le ferme**. Un seul chapitre déplié à la fois.
- **Contenu** : corps 16 px / 1,6, colonne de 980 px au plus, marge basse de 160 px (les boutons flottants ne masquent jamais le texte), `h1` 28 px avec filet d'accent de 3 px, `h2` 21 px, `scroll-margin-top: 76px`, tableaux défilants à lignes alternées, figures sur **carte à fond blanc** quel que soit le thème.
- **Formules** : bloc centré 1,22 em, fond teinté, pastille du numéro (F40) à droite.
- **Applications (exercices)** : bandeau « APPLICATIONS DU CHAPITRE n », pastille de référence, lien « ↩ Retour au cours : section x.y », énoncé en encadré `examen`, **correction masquée chargée au clic**, composée de blocs « étape » (un bloc **Idée** d'abord, puis (a), (b)… avec colonne d'équations : mot de liaison en italique, lignes suivantes commençant par `=`). Tableau récapitulatif : N°, Sujet, Chapitre, Accès (boutons « Correction détaillée » et « PDF p.N »).
- **Recherche** : accents et casse ignorés ; résultats surlignés avec fil d'Ariane et extrait de 230 caractères ; clic = ouvre le bon chapitre, centre l'élément et le fait clignoter 2,4 s.
- **Visionneuse PDF** : pdf.js (jsDelivr, version épinglée), page par page ; **ni téléchargement ni ouverture dans un nouvel onglet** ; CSP : ajouter `worker-src blob:`.
- **Bulle de notes** : rond de 54 px (icône carnet), déplaçable, position mémorisée ; panneau (60 % de la hauteur au plus) avec ↶ ↷ (annuler, rétablir), Effacer, ✕ ; sauvegarde automatique après 3 s ; bulle « ＋ Noter » à la sélection d'un texte. Pas de bulle dans « Mon espace ».
- À ne pas copier d'Optique : fichier unique de 16 Mo, `onclick`, couleurs en dur, notes dans `localStorage`, recherche sur tout le DOM, pastilles de thème de l'en-tête.

## 3. Ordre d'exécution

1. **K19 (X1, bloquant)** : `list_matieres` doit lire `contenu/catalogue.json` (via la fonction de catalogue partagée), renvoyer `{ id, nom: titre, ordre, bientot }` ; ajouter `bientot: true` à `info` dans le catalogue ; les matières « bientôt » sont visibles mais non cochables. Tests : la liste n'est jamais vide quand Firestore est vide ; jsdom : les cases apparaissent, se cochent, la sélection part dans `approuver_nm` ; sans aucune case cochée, message visible (au moins une matière).
2. **K20 (X2, K1quater)** si non fait : masquer le bandeau d'erreur après un chargement réussi et au début de chaque « Rafraîchir » ; après « J'ai vérifié mon email » réussi : `cacherBandeau()` puis `demarrerConsole(user)` ; tests jsdom.
3. **K21 (X6, X7)** : fiche d'activation : numéro **obligatoire** (formaté), suppression de la case « code par matière » (un seul code toujours généré), libellé honnête du quota (« non appliqué pour l'instant »), vérifier la section d'essai (X7).
4. **K22 (X3, X4, X5, X9, X10, X8)** : pages publiques en palette fixe bleu nuit sans sélecteur de thème ; « Essayer gratuitement » → `demande.html?type=essai` (radio présélectionnée) ; `acces.html` : « Lien perdu ? » et écran de succès avec lien en lecture seule, `[Copier]`, `[Ouvrir mon espace]`, phrase sur les favoris ; vouvoiement partout ; placeholder du numéro international (+229) et mention « obligatoire » ; `decision.html` affiche les matières demandées.
5. **K23 (X11)** : renforcer `k17.test.js` (scanner `assets/*.js` hors `vendor`, paires de contraste de texte complètes, correction du sépia `--accent` sur `--masque` ≥ 4,5, motif sans faux positifs d'entités).
6. **K11** (section 2.1), **K10** (2.5), **K4** puis **K5** (2.3), **K6** (2.4), puis **K12 à K16, K18** selon `docs/GUIDE-EXECUTION.md` et la section 2.6.
7. À la fin : `RAPPORT_FINAL.md` (état réel, tableau critère → test → résultat, gestes 📱 pour le propriétaire, écarts connus, corrections ordonnées) et `memento-FINAL.zip`.
