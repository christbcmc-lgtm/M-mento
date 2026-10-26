# Mémento — Rapport de l'étape 2 (back-end + espaces connectés)

## Ce qui a été réalisé

L'étape 2 ajoute toute la logique d'accès contrôlé par-dessus le socle statique de l'étape 1. **Aucune notion de prix, de vente ou de paiement** : le vocabulaire reste « demande / activation / accès ».

### API (fonctions serveur, dossier `api/`)

- `demande.js` — enregistre une demande d'accès et notifie l'administrateur par email.
- `activer.js` — première connexion : vérifie **nom + email + clé**, active le membre, génère son **lien personnel** et l'envoie par email (clé utilisable une seule fois).
- `acces.js` — valide le lien personnel, renvoie l'état de l'espace (matières incluses / estompées) et incrémente un **compteur anti-fuite** ; au-delà d'un seuil (~5), un **code par matière** est exigé.
- `code-matiere.js` — vérifie le code d'une matière, ou le **réinitialise** (le membre prouve son numéro, un nouveau code est envoyé par email).
- `message.js` — messagerie côté membre (lecture du fil + envoi à l'administrateur).
- `admin.js` — actions réservées à l'administrateur (jeton Firebase ; email == `ADMIN_EMAIL`) : lister les demandes, lister la messagerie, **accorder/activer** un accès, **répondre** (avec pièces jointes), **inviter à un essai**.
- `essai.js` — délivre un jeton d'essai gratuit **strict** (lecture seule, durées courtes par zone).
- Bibliothèque `api/_lib/` : `firebase.js` (init Admin via variables d'environnement), `mail.js` (Resend + gabarit), `token.js` (liens signés), `secret.js` (hachage clés/codes), `http.js` (lecture corps, validations, réponses).

### Pages connectées (front)

- `index.html` + `access.js` — la première connexion appelle **vraiment** `/api/activer` ; message de confirmation « lien personnel envoyé par email ».
- `demande.html` + `demande.js` — le formulaire envoie **vraiment** la demande à `/api/demande`.
- `espace.html` + `espace.js` — **espace membre** : grille des matières (incluses cliquables / estompées non incluses), **modale de code** (validation + réinitialisation par numéro), **messagerie** avec l'administrateur.
- `matiere.html` + `matiere.js` — page matière (contrôle l'accès ; contenu détaillé des cours prévu à l'étape 3).
- `admin.html` + `admin-client.js` — **console d'administration** : connexion **Firebase Auth** (compat CDN), demandes, messagerie (réponse + pièces), octroi d'accès (matières + code optionnel), invitation d'essai.
- `essai.html` + `essai.js` — **essai gratuit strict** : aperçu en **lecture seule** avec **minuteries par zone** (Cours ~5 min, Évaluation/Révision ~1 min 30, Exercices ~2 min) et minuterie globale ; chaque zone se **verrouille** (floutage) à l'expiration.
- `assets/espace.css` — styles communs à l'espace, l'essai et l'admin.

## Sécurité

- **Aucun secret dans le code** : tout passe par les variables d'environnement Vercel.
- `firestore.rules` en **deny-all** : la base n'est accessible **que** par le serveur.
- Liens personnels et jetons d'essai **signés** (`TOKEN_SECRET`).
- Clés d'activation et codes de matière **hachés** en base (jamais stockés en clair).
- Administration protégée par **Firebase Auth** + contrôle que l'email == `ADMIN_EMAIL`.
- HTML **sans gestionnaire d'événement en ligne** ; texte dynamique **échappé** avant insertion.
- ⚠️ **La clé serveur partagée dans le chat doit être régénérée** (voir GUIDE, Partie 2, étape A).

## Vérifications effectuées

- `node --check` **OK sur l'ensemble des fichiers `.js`** (API + front).
- Cohérence des appels front/back vérifiée (champs des corps JSON, routes, formats de clé/code).

## À faire de ton côté (voir GUIDE, Partie 2)

A. Régénérer la clé serveur (urgent). · B. Créer ton compte admin dans Firebase Auth. · C. Déclarer les matières (`thermo`, `probas-stats`, `info`). · D. Publier `firestore.rules`. · E. Vérifier les variables Vercel. · F. Domaine autorisé. · G. Essai de bout en bout.

## Suite

**Étape 3** : intégration des 3 PDF (Thermodynamique, Probabilités/Statistiques, Informatique) sous forme de cours à deux couches (synthèse + détail), rendu mathématique (KaTeX), schémas, évaluations, révisions et exercices corrigés.

*Le déploiement (push) sera fait dès qu'un nouveau jeton GitHub me sera fourni — un push sur `main` déclenche automatiquement un redéploiement Vercel.*
