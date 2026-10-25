# Mémento — Décisions d'architecture (prises sans te solliciter)

Conformément à ta consigne (« tu évalues les risques et tu décides »), voici les choix que je prends pour la suite. Tu peux les contester, sinon j'avance ainsi.

## Accès & sécurité
- **Aucun lien vers GitHub** nulle part sur le site public. Le code reste privé ; le site n'y renvoie jamais.
- **Aucun secret côté navigateur.** La vérification des clés, liens personnels et codes par matière se fait **côté serveur** (fonctions Vercel) avec la clé Firebase et des **jetons signés**.
- **Lien personnel** généré à la 1re connexion (nom + email + clé) ; un 2e email contient le lien dédié. Seuil anti-fuite (~5 accès) → code exigé. Lien expiré → page « refaire une demande ».
- **Code / mot de passe par matière**, réinitialisable par l'utilisateur via son numéro.

## Essai gratuit (volontairement STRICT)
- But unique : **laisser visualiser/tester le site**, pas consommer le contenu. Durées courtes, en lecture seule, **sans code**, **sans téléchargement**.
- Limites par zone appliquées côté serveur (jeton d'essai à expiration courte + minuteur par zone) :
  - **Cours : ~5 min** · **Évaluation / Révision / Exercices : ~1–2 min** chacune.
- Objectif : empêcher que l'essai gratuit devienne un moyen de piratage.

## Messagerie administrateur ↔ membre
- Chaque membre a un **fil de discussion privé** avec l'administrateur.
- Le membre envoie un message ; **l'administrateur le reçoit** et peut **répondre**, **joindre des PDF / livres**, envoyer des réponses et ressources.
- **L'adresse de l'administrateur n'apparaît jamais** côté membre : tout passe par la messagerie interne. Toute suggestion/contact se fait via ce canal.
- Panneau d'administration protégé (page admin réservée) pour gérer demandes, abonnements, messages et envois.

## Technique
- **Firebase** : Authentication (email + lien email) + **Firestore** (membres, matières, abonnements, demandes, messages, essais).
- **Vercel** : hébergement du site statique + **fonctions serverless** (validation d'accès, génération des liens, codes par matière, messagerie, essai gratuit).
- **Emails** : service **Resend** (une seule clé API, offre gratuite suffisante).
- **Contenu des cours** : 2 couches (développé exhaustif + version assimilable), schémas en images, formules en KaTeX, réponses longues masquées / courtes floutées.

## Phase 3 — Circuit d'entrée (décisions)
- **Ne pas casser l'ancien `admin.js`** (modèle `matieres` objet, auth Firebase ID token). La nouvelle logique vit dans des **fonctions pures injectables** sous `api/_lib/` (`inscription.js`, `essais.js`) où **la base de données et l'expéditeur d'emails sont injectés** → testables hors ligne, sans réseau. Les actions nouveau-modèle sont **ajoutées** à `admin.js` (`approuver_nm`, `accorder_essai`, `list_essais`, `supprimer_essai`), les anciennes restent intactes.
- **Verrou email posé AVANT toute notification** : une adresse déjà utilisée renvoie une erreur **neutre (409)** sans prévenir l'admin ni révéler l'existence d'un compte.
- **Décision par jeton emaillé** (`/api/public?a=decision`) : la possession du lien signé envoyé à l'admin suffit pour approuver/refuser — pas besoin d'ouvrir la console. Usage unique garanti par le statut `nouvelle` de la demande (sinon 410).
- **Emails = Gmail + nodemailer** (décision D13), épinglé `nodemailer@6.9.15`. Resend abandonné. `mail.sendMail` reste surchargeable (require paresseux) pour les tests.
- **Essai gratuit anti-piratage** : 2–5 min, **compteur serveur** (`utiliseLe`), une actualisation **ne prolonge jamais** l'essai ; contenu = `contenu/_essai/extrait.json` servi avec **filigrane (email)** et `lectureSeule`. Un email = un essai (`essais/{hashEmail}`), doublon → 409.
- **Champ-piège (honeypot)** `site_web` sur la demande : s'il est rempli → `200 ok` sans rien enregistrer. Limite **3 demandes/h/IP** (IP hachée).

## Phase 4
- **Cours servis côté serveur uniquement** (`api/contenu.js`) : l'ancien fichier public `assets/cours-thermo.js` était une faille (téléchargeable sans auth). Contenu migré en `contenu/thermo/cours.json` (4 chap / 40 formules), servi derrière le cookie de session `mh_s` — `401`/`403`/`404`/`200`, erreurs **neutres**, validation **anti-traversal** du nom de matière. `vercel.json: includeFiles contenu/**`.
- **Accueil découpé en 2 pages** (demande explicite de l'utilisateur) : `index.html` = présentation courte (hero + CTA + cartes, **sans** formulaire ni `access.js`) ; `acces.html` = toute la logique d'accès (onglets, formulaire première connexion, overlay) + `access.js`. Raison : accueil trop long sur mobile 360px, et `access.js` plantait quand chargé sur une page sans ses éléments (`$('t-con')` sans null-check).
