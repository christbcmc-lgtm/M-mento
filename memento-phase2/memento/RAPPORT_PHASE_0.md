# RAPPORT_PHASE_0 — Assainir et préparer

> Phase **sans code applicatif**. Ce sont les configurations à faire **de votre côté**,
> AVANT de tester quoi que ce soit. Faites-les, cochez chaque case, puis lancez le
> déploiement de la Phase 1.

---

## 1. Jetons GitHub (à faire d'abord — sécurité)
- [ ] Aller sur https://github.com/settings/tokens et **révoquer TOUT jeton** déjà créé
      ou partagé (tout `github_pat_...` que vous m'avez déjà montré est à considérer
      comme compromis).
- [ ] Pour la suite : **vous poussez vous-même** depuis votre machine (`git push`).
      Je ne pousse pas et je ne garde aucun jeton.

## 2. Clé de service Firebase (à régénérer)
- [ ] Console Firebase → Paramètres du projet → **Comptes de service** → générer une
      nouvelle clé privée. **Supprimer l'ancienne** (celle qui a pu fuiter).
- [ ] Dans **Vercel → Project → Settings → Environment Variables**, renseigner :
      - `FIREBASE_PROJECT_ID`
      - `FIREBASE_CLIENT_EMAIL`
      - `FIREBASE_PRIVATE_KEY`  (coller la clé entière, retours à la ligne compris)
- [ ] Redeployer après ajout.

## 3. Variables Vercel (doivent toutes exister)
Cocher quand présentes, puis recopier la liste des NOMS dans le tableau d'acceptation
plus bas (jamais les valeurs) :
- [ ] `FIREBASE_PROJECT_ID`
- [ ] `FIREBASE_CLIENT_EMAIL`
- [ ] `FIREBASE_PRIVATE_KEY`
- [ ] `TOKEN_SECRET`  (32 caractères aléatoires minimum)
- [ ] `SITE_URL`  (l'URL publique du site, ex. https://memento.vercel.app)
- [ ] `ADMIN_EMAIL`  (l'email qui reçoit les notifications de demandes)
- [ ] `MAIL_USER`  (le Gmail dédié)
- [ ] `MAIL_APP_PASSWORD`  (mot de passe d'application Gmail, voir §7)
- [ ] `MAIL_FROM_NAME`  (ex. « Mémento »)
- [ ] **Retirer** `RESEND_API_KEY` (on reste sur Gmail + nodemailer, décision D13).

> Astuce pour `TOKEN_SECRET` : `openssl rand -base64 48`

## 4. Constat d'exposition actuelle (A2)
Sur le site **actuellement déployé** (avant Phase 1), ouvrir dans le navigateur :
- [ ] `/DECISIONS.md`  → noter si téléchargeable : ____
- [ ] `/firestore.rules`  → noter si téléchargeable : ____
- [ ] `/assets/cours-thermo.js`  → noter si le cours est lisible : ____

(C'est le défaut majeur confirmé : le cours est un fichier public. La Phase 1 cache
les .md, la Phase 4 protège réellement les cours.)

## 5. État des données Firestore
Dans la console Firestore, compter les documents :
- [ ] `membres` : ____
- [ ] `demandes` : ____
- [ ] `messages` : ____
- [ ] `essais` : ____

> Si `membres` n'est **pas vide**, dites-le moi : il faudra prévoir une migration
> (les comptes existants ne correspondent pas encore au nouveau modèle).
> **Confirmez** qu'aucun membre réel payant n'est en production (sinon on adapte).

## 6. Règles Firestore (deny-all)
- [ ] Publier le fichier `firestore.rules` (il est déjà en deny-all dans le dépôt).
- [ ] Vérifier dans la console qu'une lecture depuis le navigateur est **refusée**.

## 7. Email (Gmail dédié + nodemailer)
- [ ] Créer un **compte Gmail dédié** (ex. memento.acces@gmail.com).
- [ ] Activer la **validation en deux étapes**.
- [ ] Créer un **mot de passe d'application** → c'est lui qui va dans
      `MAIL_APP_PASSWORD`.
- [ ] Test d'envoi vers une adresse tierce : le message doit **arriver** (vérifiable
      pour de vrai à partir de la Phase 3 ; pour l'instant on prépare juste le compte).

## 8. Compte administrateur
- [ ] Firebase Authentication → créer l'utilisateur **email + mot de passe fort**,
      email vérifié. (Aucun identifiant admin ne se saisit ni ne se transmet dans le
      chat — c'est vous qui le créez, moi je ne le vois jamais.)

## 9. Dépôt privé
- [ ] Passer le dépôt GitHub en **privé**, provoquer un déploiement.
- [ ] S'il échoue, **noter le message exact** et me l'envoyer (plan B prévu).

---

## Acceptation Phase 0 (à me renvoyer)
- [ ] Tableau des **noms** de variables Vercel présentes (sans les valeurs) :
      `____________________________________________`
- [ ] Email de test reçu par un tiers : oui / non
- [ ] Connexion admin possible côté Firebase : oui / non
- [ ] Constat d'exposition écrit (§4) : fait / à faire

Quand c'est fait → **STOP**, et on passe au test de la Phase 1.
