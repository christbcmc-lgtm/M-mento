# GUIDE-EXECUTION.md — extraits normatifs du « Guide d'exécution strict (v2) »

> Source de vérité : le PDF du propriétaire « Mémento — Guide d'exécution strict
> (v2) » (daté du 25/10/2026), fourni le 2026-10-28. Ce fichier n'invente rien :
> il recopie les sections normatives dont dépend l'exécution K4/K6/K10/K14, pour
> servir d'ancre de reprise (règle 0.2 levée). En cas de doute, le PDF prime.
> Tag de fiabilité : **extrait vérifié** (recopié du PDF lu via view_text_file).

## Règles du jeu (section 0)
1. Une phase à la fois ; STOP + rapport en fin de phase.
2. Preuve obligatoire : commande/test + résultat réel. « Non vérifié » permis ;
   « ça devrait marcher » interdit.
3. jsdom ne remplace pas un navigateur : les points « doigt » = gestes à faire
   par le propriétaire sur son téléphone.
4. Aucun secret dans le dépôt / rapports / commits / chat. Variables Vercel seules.
5. Ne rien casser : lister les références avant de supprimer/déplacer.
6. Décision non prévue -> DECISIONS.md. Blocage -> « BLOQUÉ » + erreur exacte + essais.
7. Contrôle d'accès TOUJOURS côté serveur. Aucun cours/bonne réponse/code en
   statique ni dans le DOM avant autorisation.
8. Français partout ; mobile d'abord (360 px) ; boutons petits, jamais pleine largeur.
10. Dépendances serveur : firebase-admin, jsonwebtoken, nodemailer (si D13). Rien
    d'autre. Navigateur : KaTeX épinglé jsDelivr ou public/vendor/.

## Décisions tranchées (section 2) — rappel des plus structurantes
- **D4** lien `?t=` = clé d'échange : envoyée une fois à `auth?a=session`, cookie
  de session (HttpOnly, Secure, SameSite=Strict) en retour, puis `history.replaceState`
  efface le jeton de l'URL. Les autres API lisent le cookie, jamais l'URL.
- **D5** maxAppareils = 1 ou 2 (choisi par l'admin). Au-delà : refus. L'admin peut
  vider la liste. Plus de seuil « ~5 accès ».
- **D6** un seul code par membre, 8 caractères, haché (scrypt). Déverrouillage 12 h.
- **D9** un email = un compte : verrou `emails/{sha256(email normalisé)}` en
  transaction dès la demande. Normalisation : minuscules, retrait `+suffixe`,
  Gmail retrait des points. Supprimer un membre libère le verrou.
- **D12** connexion admin = Firebase Auth email+mdp ; l'API vérifie le jeton,
  `email == ADMIN_EMAIL` ET `email_verified`. Chaque action admin -> `journal`.
- **D15** schéma membre : `matieres` = tableau d'ids ; `codeHash` au niveau membre.
- **D16** thèmes : choisi dans « Mon espace », par membre, appliqué aux pages
  membre ; pages publiques gardent le bleu nuit.
- **D19** évaluation : >= 160 questions/matière (QCM multi, vrai/faux, analyse) ;
  tirage et correction côté serveur ; note sur 20.
- **D20** durée d'accès en jours ; expiration court à partir de l'activation ;
  `quotaHeures` (vide = illimité) réalisé seulement en phase 10 si confirmé.
- **D21** supprimer un membre efface tout (profil, appareils, notes, messages,
  résultats) et libère l'email. Page « Stockage » admin pour purger.
- **D22** quotas Spark : stats agrégées dans `stats/*` (jamais de balayage),
  messagerie sondée 45 s (panneau ouvert), cloche admin 60 s.

## 4.5 Page matière — moteur de chapitres (comportement « flèche »)  [K14]
1. Seul le chapitre actif est déplié ; les autres n'affichent que leur titre (bandeau).
2. En descendant, au titre du chapitre suivant : passage bloqué, il faut toucher le
   titre pour l'ouvrir ; en l'ouvrant, le chapitre précédent se referme (titre reste).
3. En remontant, quand le haut du chapitre actif atteint le bandeau du précédent,
   ce chapitre s'ouvre automatiquement, l'actif se referme, lecture reprise à la fin
   du précédent.
4. Implémentation : IntersectionObserver sur sentinelles, direction mesurée sur deux
   positions, verrou pendant la transition (200 ms), recalcul explicite de scrollTop
   après dépliage. Aucune boucle de réouverture.
5. Même mécanique pour la liste d'exercices et les rubriques d'évaluation.
Bulle de notes : pastille ronde 44 px déplaçable, position mémorisée, jamais hors
écran ; panneau (<= 60 % hauteur) avec zone de texte, [↶][↷], [Effacer], [✕] ;
sauvegarde auto après 3 s d'inactivité ; texte <= 20 000 caractères (D18).

## 4.6 Évaluation (evaluation.html)  [K15]
Config (sans défilement) : matière, chapitres (cases), portée (Cours seul /
Exercices seul / Cours et exercices), types (QCM, Vrai/faux, Analyse), nombre
(10, 20, 30), [Commencer]. Passage : une question par écran, barre de progression.
QCM = cases à cocher (1..n bonnes). Vrai/faux = deux boutons. Analyse = zone de
texte puis [Voir la correction] puis auto-notation (0, ½, 1). Fin : note /20,
appréciation, détail, « Réviser mes erreurs ». Les questions ne contiennent jamais
la réponse avant soumission.

## Section 5 — Phase 5 Évaluation : barème (source serveur)  [K6]
- `eval?a=start` : filtres (matière, chapitres, portée, types, nombre) ; tirage
  aléatoire avec `crypto.randomInt`, aucune question répétée ; `evals/{id}` enregistré ;
  envoi SANS champ de réponse.
- `eval?a=submit` : refuse un `evalId` d'un autre membre ou expiré ; correction.
  **Barème** : vrai/faux 1 ou 0 ; QCM multi = (bonnes cochées − mauvaises cochées)
  ÷ nombre de bonnes, **plancher 0** ; analyse : auto-notation 0, ½ ou 1.
  **Note = 20 × points obtenus ÷ points possibles, arrondie au demi-point.**
- Enregistrement dans `resultats`, maj transactionnelle de `stats/{matière}` (jamais
  de balayage), liste des questions ratées. `historique` et `ratees` pour Mon espace.
Acceptation : start sans aucune clé de réponse ; deux tirages diffèrent ; evalId
d'un autre membre -> 403 ; tests 20/20, 0/20, cas partiels ; stats sans lecture massive.

## Section 6 — Format du contenu (JSON pur, un par chapitre)  [K4]
`contenu/<mat>/cours/chN.json` : `{ id, numero, titre, sections:[{ id, titre, blocs:[...] }] }`
Blocs autorisés (vocabulaire fermé) :
- `p` { md } ; `h` { md } ; `liste` { ordonnee, items[] }
- `formule` { id (F1..), tex, legende }
- `tableau` { entetes[], lignes[][] }
- `image` { src (sous contenu/.../media), alt, legende }
- `encadre` { style: definition|retenir|attention|verifier, blocs[] }
- `detail` { titre, blocs[] }  (masqué par défaut, bouton « Voir l'explication »)
- `code` { langage, texte, commente }
Balisage inline (analyseur maison, **jamais de HTML**) : `**gras**`, `__souligné__`,
`*italique*`, `$formule$`, `[[F3]]` (renvoi formule), `[[c:ch2#2.1|texte]]` (lien interne).
Résumé : même format dans `resume/chN.json`, mêmes ids de sections.
Exercices : `exercices/chN.json` = liste `{ id, titre, enonce[], correction[] }` ; la
correction n'est JAMAIS envoyée avec la liste, seulement via `contenu?a=correction`.
`space.json` : `{ id, nom, onglets[], chapitres:[{ id, titre, sous[] }] }`.
Phase 4 : texte des cours « rigoureusement identique » à l'ancien JS -> test
d'égalité de texte (K18).

## Section 8 — Schéma d'une question  [K6/K15]
`{ id:'th-0001', type:'qcm'|'vf'|'analyse'|'completer', chapitre:'ch3', section:'3.2',`
`  source:'cours'|'exercice'|'les-deux', difficulte:1, enonce:'...',`
`  options:[{id:'A', texte:'...'}], reponses:['A','C'], explication:'...', ref:'ch3#3.2' }`
Quota : >= 160/matière ; >= 8/chapitre. Répartition indic. 45 % QCM (>= 1/3 multi),
25 % vf, 20 % analyse, 10 % completer (completer = révision, pas éval notée).
Portées : cours = source cours|les-deux ; exercices = source exercice|les-deux.
Outil de contrôle : `outils/verifier-banque.js` (hors public/) : ids uniques, réponses
incluses dans options, quotas, doublons, références valides.

## Section 9.B — Essais d'intrusion (curl, résultats consignés)  [K10]
1. Chaque action auth/contenu/eval/message/admin sans cookie ni jeton : refusée.
2. Cookie d'un membre sur une matière non souscrite : 403.
3. Soumission d'une évaluation avec l'evalId d'un autre membre : 403.
4. Rejeu d'un jeton de décision déjà utilisé : refusé.
5. Force brute du code : 429 puis blocage.
6. Requête de modification sans l'en-tête `X-Requested-With: mh` : refusée.
7. Lecture de Firestore depuis le navigateur : refusée (rules deny-all).
8. `/api/_lib/*`, `/contenu/*`, `/firestore.rules`, `/package.json`, `/DECISIONS.md` : 404.
9. Balises HTML dans nom/prénom/message : affichées comme texte.
10. URL de pièce jointe `javascript:` ou non https : refusée.
11. Demande avec email déjà pris, variantes +suffixe et points Gmail : refusée.

## Section 9.C — Réponse aux abus  [K9]
À partir de 10 refus d'authentification en 5 min depuis une même adresse (ou appels
répétés de contenu sans session) : réponse 429 avec le message exact « Activité
inhabituelle détectée. Cette adresse est temporairement bloquée et l'administrateur
en est informé. », entrée `journal` de type alerte, compteur visible au tableau de
bord. Aucune contre-mesure offensive.

## Messages d'erreur standard (11.4)
- Email déjà utilisé : « Cette adresse est déjà utilisée. »
- Appareil en trop : « Appareil non autorisé. Écrivez à l'administrateur depuis un
  appareil déjà enregistré. »
- Accès expiré : « Votre accès a expiré. Contactez l'administrateur. »
- Code faux : « Code incorrect. » ; Trop d'essais : « Trop de tentatives. Réessayez plus tard. »
- Essai terminé : « Votre essai est terminé. Vous pouvez demander un accès complet. »
- Lien de décision invalide : « Ce lien n'est plus valide. »
- Matière non incluse : « Cette matière n'est pas incluse dans votre accès. »

## Références visuelles (K12/K13/K14)
Les captures de référence (page Optique d'Academia Hub, écran thermo Mémento,
pastille d'étapes) sont fournies par le propriétaire sous forme d'images uploadées.
Elles servent de cible de finition : la **structure** est spécifiée ici (4.x), la
**parité pixel** n'est pas affirmable sans rendu navigateur réel (règle 3/0.2).
