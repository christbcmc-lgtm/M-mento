# Mémento — Guide de configuration (étape par étape)

Ce guide est écrit pour toi : il décrit **uniquement les manipulations à faire de ton côté** dans les consoles de Firebase, Google et Vercel. Moi, je m'occupe de tout le code.

> Les consoles sont parfois en anglais. À chaque étape je donne **le libellé français ET anglais** et **où cliquer** (menu de gauche, en haut à droite, etc.). Si ta console est en anglais et que tu veux la passer en français : clique sur ton **avatar en haut à droite** → **réglages / settings** → langue → Français (ce n'est pas obligatoire, le guide marche dans les deux langues).

---

## 0. Vue d'ensemble (à lire une fois)

Le site Mémento fonctionne avec **3 briques** :

1. **GitHub** — il contient le code. ✅ *Déjà fait : j'ai poussé le code dans ton dépôt `M-mento`.*
2. **Firebase** — c'est la base de données + la gestion des accès (membres, abonnements par matière, messages, demandes, essais gratuits).
3. **Vercel** — c'est l'hébergement : il publie le site sur Internet à partir du code GitHub.

Ce que **tu** fais : créer le projet Firebase, activer 2 services, récupérer quelques « clés », les coller dans Vercel. C'est tout. Tu n'écris **aucun code**.

Ce que **je** fais : tout le reste (pages, logique d'accès, liens personnels, codes par matière, messagerie administrateur, essai gratuit limité).

**Important :** à la fin de chaque section, je liste **les valeurs à me recopier** (je t'indiquerai où les coller). Ne me renvoie **jamais** de mot de passe de ta boîte mail ni ton jeton GitHub.

---

## 1. Créer le projet Firebase (NOUVEAU projet dédié)

1. Va sur **https://console.firebase.google.com** (connecte-toi avec ton compte Google).
2. Clique sur **« Ajouter un projet »** / **“Add project”** (grande carte avec un **+**, au centre/à gauche).
3. **Nom du projet** / *Project name* : tape `memento` (ou `memento-site`). Clique **Continuer** / *Continue*.
4. Écran **Google Analytics** : tu peux **désactiver** l'interrupteur (« Activer Google Analytics » / *Enable Google Analytics*) — on n'en a pas besoin. Clique **Continuer** puis **Créer le projet** / *Create project*.
5. Attends ~30 s, puis **Continuer**. Tu arrives sur le **tableau de bord** du projet.

### 1.1 Ajouter une « application Web »

6. Sur la page d'accueil du projet, sous le titre, tu vois des icônes rondes pour ajouter une app : **iOS / Android / Web**. Clique sur l'icône **Web** : elle ressemble à des chevrons **`</>`**.
7. **Surnom de l'application** / *App nickname* : tape `memento-web`.
8. **NE COCHE PAS** « Firebase Hosting » (on héberge sur Vercel). Clique **Enregistrer l'application** / *Register app*.
9. Firebase affiche un bloc de code qui commence par `const firebaseConfig = { ... }`. **C'est la « config Web ».** Elle contient : `apiKey`, `authDomain`, `projectId`, `storageBucket`, `messagingSenderId`, `appId`.
   - Ces valeurs **ne sont pas secrètes** (elles sont faites pour être dans le navigateur). Tu peux me les recopier **telles quelles**.
   - Si tu as fermé cette fenêtre : menu de gauche → icône **roue dentée ⚙** en haut → **Paramètres du projet** / *Project settings* → onglet **Général** / *General* → descends jusqu'à **« Vos applications »** / *Your apps* → bloc **SDK de configuration** → choisis **Config**.

> 📌 **À me recopier (bloc 1) :** les 6 lignes du `firebaseConfig` (apiKey, authDomain, projectId, storageBucket, messagingSenderId, appId).

---

## 2. Activer l'authentification (Authentication)

1. Menu de **gauche** → section **Création** / *Build* → clique **Authentication**.
2. Clique le bouton **« Commencer »** / *Get started*.
3. Onglet **« Sign-in method »** / **Méthode de connexion** (en haut). Dans la liste des fournisseurs :
   - Clique **« E-mail/Mot de passe »** / *Email/Password*.
   - Active le **1er interrupteur** (« Activer » / *Enable*).
   - Active **aussi** le 2e : **« Lien e-mail (connexion sans mot de passe) »** / *Email link (passwordless sign-in)*. C'est ce qui permet d'envoyer le **lien d'activation** par email.
   - Clique **Enregistrer** / *Save*.
4. Onglet **« Settings » / Paramètres** → sous-onglet **« Authorized domains » / Domaines autorisés** : tu verras déjà `localhost` et `...firebaseapp.com`. **Quand Vercel t'aura donné l'adresse du site** (étape 5), tu reviendras ici cliquer **« Add domain » / Ajouter un domaine** et coller l'adresse Vercel (ex. `memento.vercel.app`). *(Je te le rappellerai.)*

> 📌 **À me recopier (bloc 2) :** rien pour l'instant — juste me confirmer « Authentication activé (email + lien email) ✅ ».

---

## 3. Créer la base de données (Firestore)

1. Menu de **gauche** → **Création** / *Build* → **Firestore Database**.
2. Clique **« Créer une base de données »** / *Create database*.
3. **Mode** : choisis **« Démarrer en mode production »** / *Start in production mode* (plus sûr ; je fournirai les règles d'accès). Clique **Suivant** / *Next*.
4. **Emplacement** / *Location* : choisis **`eur3 (europe-west)`** ou **`europe-west1`** (proche, et adapté). Clique **Activer** / *Enable*. Attends ~1 min.
5. Tu n'as **rien d'autre à faire ici** : je créerai les collections (membres, matières, abonnements, demandes, messages, essais) et j'installerai les **règles de sécurité** par le code.

> 📌 **À me recopier (bloc 3) :** l'**emplacement** que tu as choisi (ex. `europe-west1`) + me confirmer « Firestore créé ✅ ».

---

## 4. Créer la « clé serveur » (compte de service) — SECRET

Cette clé permet au serveur (côté Vercel) de vérifier les accès en toute sécurité. **Elle est secrète** : elle ne va **jamais** dans le code ni sur GitHub — uniquement dans Vercel (étape 5).

1. Menu de **gauche** → **roue dentée ⚙** (en haut, à côté de « Vue d'ensemble du projet ») → **Paramètres du projet** / *Project settings*.
2. Onglet **« Comptes de service »** / *Service accounts* (en haut).
3. Clique **« Générer une nouvelle clé privée »** / *Generate new private key* → confirme **« Générer la clé »** / *Generate key*.
4. Ton navigateur **télécharge un fichier `.json`** (ex. `memento-xxxx.json`). **Garde-le précieusement**, ne le mets nulle part en ligne.
5. Ce fichier contient notamment : `project_id`, `client_email`, et `private_key` (un long texte entre `-----BEGIN PRIVATE KEY-----` et `-----END PRIVATE KEY-----`).

> 📌 **À me recopier (bloc 4) :** **NE me colle PAS tout le fichier dans le chat.** Tu colleras ces 3 valeurs **directement dans Vercel** à l'étape 5 (je te dis exactement où). Tu peux juste me confirmer « clé privée téléchargée ✅ ».

---

## 5. Publier le site sur Vercel

1. Va sur **https://vercel.com** → **« Sign Up » / S'inscrire** (ou **Log in**). Choisis **« Continue with GitHub »** et autorise Vercel à accéder à ton compte GitHub.
2. Sur le tableau de bord Vercel, clique **« Add New… »** (en haut à droite) → **« Project »**.
3. Dans **« Import Git Repository »**, trouve **`M-mento`** dans la liste → clique **« Import »**.
   - Si tu ne le vois pas : clique **« Adjust GitHub App Permissions »** / **« Configure »** et autorise l'accès au dépôt `M-mento`.
4. Écran **« Configure Project »** :
   - **Framework Preset** : laisse **“Other”** (c'est un site statique). Ne touche pas aux champs *Build/Output* (vides = OK).
   - Déplie **« Environment Variables » / Variables d'environnement** : c'est **ici** que tu colles les valeurs secrètes. Pour chaque ligne, tape le **Name** (à gauche) et la **Value** (à droite), puis **Add** :

| Name (exactement) | Value (d'où elle vient) |
|---|---|
| `FIREBASE_PROJECT_ID` | le `project_id` du fichier `.json` (étape 4) |
| `FIREBASE_CLIENT_EMAIL` | le `client_email` du fichier `.json` |
| `FIREBASE_PRIVATE_KEY` | le `private_key` du fichier `.json` (copie **tout**, du `-----BEGIN` au `END-----`) |
| `ADMIN_EMAIL` | **ton** adresse email d'administrateur (ne sera jamais affichée sur le site) |
| `TOKEN_SECRET` | invente une longue phrase aléatoire (30+ caractères) ou demande-moi d'en générer une |
| `RESEND_API_KEY` | la clé d'envoi d'emails (étape 6) |
| `SITE_URL` | laisse vide pour l'instant ; tu la rempliras avec l'adresse Vercel après le 1er déploiement |

   - *Astuce `FIREBASE_PRIVATE_KEY`* : dans le `.json` la clé contient des `\n`. **Colle-la telle quelle** (avec les `\n`), mon code s'en occupe.
5. Clique **« Deploy »**. Attends 1–2 min. Vercel te donne une adresse du type **`https://m-mento.vercel.app`**.
6. **Reviens sur Firebase** (étape 2.4) → Authentication → Settings → **Authorized domains** → **Add domain** → colle `m-mento.vercel.app`.
7. **Reviens sur Vercel** → ton projet → **Settings** → **Environment Variables** → renseigne `SITE_URL` = `https://m-mento.vercel.app` → puis onglet **Deployments** → **…** → **Redeploy**.

> 📌 **À me recopier (bloc 5) :** l'**adresse Vercel** du site (ex. `https://m-mento.vercel.app`).

---

## 6. Envoi des emails (liens d'activation, liens personnels)

Le site doit envoyer des emails (lien d'activation, lien personnel, essai gratuit). J'ai choisi **Resend** : gratuit jusqu'à une large limite, une seule clé à coller, simple.

1. Va sur **https://resend.com** → **Sign up** (tu peux « Continue with GitHub »).
2. Menu de **gauche** → **« API Keys »** → **« Create API Key »** → nom `memento` → **Add**. **Copie la clé tout de suite** (elle commence par `re_...`, affichée une seule fois).
3. Colle-la dans Vercel comme variable **`RESEND_API_KEY`** (étape 5, tableau).
4. *Expéditeur* : au début Resend permet d'envoyer depuis `onboarding@resend.dev`. Pour un rendu pro avec ton propre nom de domaine, il faudra vérifier un domaine (menu **« Domains »**) — **optionnel**, on verra plus tard.

> 📌 **À me recopier (bloc 6) :** rien dans le chat (la clé va **dans Vercel**). Confirme juste « Resend configuré ✅ ».

---

## 7. Récapitulatif — ce que tu me renvoies

- **Bloc 1** : les 6 lignes du `firebaseConfig` (non secrètes) → **dans le chat**, OK.
- **Bloc 3** : l'emplacement Firestore choisi.
- **Bloc 5** : l'adresse Vercel du site.
- Les confirmations « ✅ » des étapes 2, 4, 6.
- **À NE PAS mettre dans le chat** : la clé privée `.json`, `TOKEN_SECRET`, `RESEND_API_KEY`, ton email admin → **uniquement dans Vercel**.

Dès que j'ai le **bloc 1**, je branche le code sur ton Firebase et je continue (liens personnels, codes par matière, messagerie, essai gratuit). Tu peux faire les étapes 1 à 6 tranquillement, dans l'ordre.

---

# Partie 2 — Mise en service du back-end (après le code de l'étape 2)

Le code de l'espace membre, de l'administration, de l'essai gratuit et de toutes les API est maintenant écrit. Voici **les quelques manipulations de ton côté** pour le mettre en service. Fais-les dans l'ordre.

## A. ⚠️ URGENT — Régénérer la clé serveur (sécurité)

La clé serveur (`.json`) a été **partagée dans le chat** : elle est donc **compromise** et doit être **remplacée**. C'est rapide :

1. Firebase → **roue dentée ⚙** → **Paramètres du projet** → onglet **Comptes de service** / *Service accounts*.
2. Clique **« Générer une nouvelle clé privée »** → **Générer la clé**. Un **nouveau** fichier `.json` se télécharge.
3. *(Recommandé)* Va sur **https://console.cloud.google.com** → même projet → **IAM et administration** → **Comptes de service** → ouvre le compte `firebase-adminsdk-…` → onglet **Clés** → **supprime l'ancienne clé** (celle partagée). Ça l'invalide définitivement.
4. Reporte les **3 valeurs du NOUVEAU fichier** dans Vercel (voir étape 5, tableau) : `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`. Si elles y étaient déjà, **remplace** les valeurs.

> 📌 Confirme simplement « nouvelle clé générée + ancienne supprimée ✅ ». Ne colle **jamais** le fichier dans le chat.

## B. Créer TON compte administrateur (Firebase Authentication)

La page d'administration (`/admin.html`) n'est accessible qu'au compte dont l'email est **exactement** celui de la variable `ADMIN_EMAIL`.

1. Firebase → menu de gauche → **Authentication** → onglet **« Users » / Utilisateurs**.
2. Clique **« Add user » / Ajouter un utilisateur**.
3. **Email** : saisis **la même adresse** que celle mise dans `ADMIN_EMAIL` (Vercel). **Mot de passe** : choisis un mot de passe solide (c'est ce mot de passe que tu taperas sur `/admin.html`).
4. Clique **Add user**. C'est fait : tu peux te connecter à l'administration avec cet email + ce mot de passe.

> 📌 Ne me communique **pas** ce mot de passe. Confirme « compte admin créé ✅ ».

## C. Déclarer les matières (base Firestore)

Les matières affichées dans l'espace membre viennent de la collection **`matieres`**. Crée-les une fois :

1. Firebase → **Firestore Database** → onglet **« Données » / Data**.
2. Clique **« Démarrer une collection » / Start collection** → **ID de la collection** : `matieres` → **Suivant**.
3. Crée un premier document — **ID du document** : `thermo` → ajoute 2 champs :
   - `nom` (type *string*) = `Thermodynamique`
   - `ordre` (type *number*) = `1`
   - **Enregistrer**.
4. Clique **« Ajouter un document »** et recommence :
   - ID `probas-stats` → `nom` = `Probabilités & Statistiques`, `ordre` = `2`
   - ID `info` → `nom` = `Informatique`, `ordre` = `3`

> Les **ID de documents** (`thermo`, `probas-stats`, `info`) sont ceux que la console d'administration réutilise quand tu accordes un accès. Tu pourras en ajouter d'autres plus tard de la même façon.
> 📌 Confirme « matières créées ✅ ».

## D. Installer les règles de sécurité Firestore

Le fichier `firestore.rules` (dans le code) **interdit tout accès direct** depuis le navigateur : seul le serveur (clé de l'étape A) peut lire/écrire. À appliquer une fois :

1. Firebase → **Firestore Database** → onglet **« Règles » / Rules**.
2. **Remplace** tout le contenu par celui du fichier `firestore.rules` du dépôt (copie-colle), puis clique **« Publier » / Publish**.

> 📌 Confirme « règles publiées ✅ ».

## E. Vérifier les variables Vercel

Assure-toi que **toutes** ces variables existent dans Vercel (Projet → **Settings** → **Environment Variables**) :

`FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` (nouvelle clé de l'étape A), `ADMIN_EMAIL` (= email du compte admin de l'étape B), `TOKEN_SECRET` (phrase longue aléatoire), `RESEND_API_KEY`, `SITE_URL` (= adresse exacte du site, ex. `https://mementohub-theta.vercel.app`).

> Après toute modification de variable, fais un **Redeploy** (Deployments → … → Redeploy) pour qu'elle soit prise en compte.

## F. Domaine autorisé (si pas déjà fait)

Firebase → **Authentication** → **Settings** → **Authorized domains** → **Add domain** → ajoute l'adresse exacte du site (sans `https://`), ex. `mementohub-theta.vercel.app`. C'est nécessaire pour que la connexion admin fonctionne.

## G. Essai en conditions réelles

Une fois A→F faits et le site redéployé :

1. Va sur `/admin.html`, connecte-toi avec ton compte admin.
2. Depuis la section **« Accorder / activer un accès »**, saisis un email de test, coche une ou deux matières, puis **envoie la clé**. Tu dois recevoir l'email (via Resend).
3. Ouvre l'email, va sur l'accueil, colle **nom + email + clé** : tu reçois alors un **lien personnel** menant à `/espace.html`.
4. Depuis l'espace, teste la **messagerie** ; côté admin, **réponds** (avec une pièce jointe par lien si tu veux).
5. Teste l'**invitation d'essai** : l'email reçu mène à `/essai.html` (aperçu minuté, lecture seule).

> 📌 Dis-moi si une étape coince (message d'erreur précis) et je corrige.

