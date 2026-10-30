# Mémento — Contrat d'API (H0)

> Rédigé **à partir du code réel** (`api/*.js` et `api/_lib/*.js`), pas de la
> vision. Source de vérité : le code au moment du lot H0. Toute évolution
> ultérieure (H1→H4) devra mettre ce document à jour.
>
> Conventions communes à toutes les réponses :
> - Réponse JSON `{ ok: true, … }` en cas de succès, `{ ok: false, erreur: '…' }` en cas d'échec.
> - Les messages d'erreur sont **neutres** : ils ne révèlent jamais l'existence d'un compte ou d'un email.
> - Les mutations (POST qui écrit) exigent l'en-tête **`X-Requested-With: mh`** (sinon `403`).
> - L'authentification membre repose sur le **cookie de session `mh_s`** (HttpOnly, Secure, SameSite=Strict), jamais sur l'URL après la première poignée de main.
> - Le contrôle d'accès est **toujours côté serveur**. `firestore.rules` reste deny-all.

## Codes d'erreur employés

| Code | Sens dans ce projet |
|------|---------------------|
| `400` | Entrée invalide (champ manquant / mal formé, décision inconnue). |
| `401` | Session requise ou invalide (cookie absent, jeton périmé, `tokenVersion` différente). |
| `403` | Interdit : en-tête `X-Requested-With` manquant, matière non incluse, code non déverrouillé, accès suspendu/non activé/expiré, plafond d'appareils atteint, action réservée à l'admin. |
| `404` | Action inconnue, matière/évaluation/fil introuvable. |
| `405` | Méthode HTTP non autorisée. |
| `409` | Conflit : un essai existe déjà pour cette adresse. |
| `410` | Lien/jeton expiré, déjà utilisé, ou ressource (demande/essai) introuvable ; essai terminé. |
| `429` | Trop de tentatives (anti-force brute, fenêtre glissante). |
| `500` | Erreur interne (contenu illisible, exception non prévue). |
| `502` | L'email d'activation n'a pas pu être envoyé ; aucune écriture effectuée. |

## Légende des colonnes « Contrôle »

- **session** : exige le cookie de session membre `mh_s` (via `session.authentifier`).
- **code** : exige en plus un appareil **déverrouillé** par le code (12 h).
- **admin** : exige un jeton Firebase `Authorization: Bearer <idToken>` dont l'email == `ADMIN_EMAIL`.
- **en-tête** : exige `X-Requested-With: mh` (mutation).
- **jeton** : autorisé par un jeton signé passé en paramètre (ex. `?t=`, `?d=`, `?i=`).
- **—** : aucune authentification (page publique).

---

## 1. `auth` — `/api/auth?a=…`

Noyau d'accès. `switch` sur `a`. Toute action inconnue → `404`.

| `a=` | Méthode | Contrôle | Entrées | Sortie `ok:true` | Erreurs |
|------|---------|----------|---------|------------------|---------|
| `activer` | POST | en-tête · anti-force brute 10/h par IP | corps `{ nom, email, cle }` | `{ lien }` (lien personnel `/espace?t=…`) | `400` nom/email/clé incorrect (neutre), `403` en-tête, `405`, `429` |
| `session` | GET | jeton `?t=` (jeton personnel) | query `t` | `{ ok:true }` + `Set-Cookie: mh_s` | `401` lien invalide **ou version périmée** (`v` ≠ `tokenVersion`), `403` suspendu/non activé/expiré |
| `acces` | GET | session | cookie `mh_s` | `{ profil:{prenom,nom,matieres[],theme,expireLe,maxAppareils}, deverrouille, deverrouilleJusqua }` | `401` session, `403` statut |
| `code` | POST | session · en-tête · anti-force brute 5 / 15 min · **K9 §9.C garde abus par IP** | corps `{ code }` | `{ deverrouilleJusqua }` (12 h) | `400`? non, `403` code incorrect / en-tête, `405`, `429` (anti-force brute **ou** abus §9.C : message EXACT « Activité inhabituelle détectée. Cette adresse est temporairement bloquée et l'administrateur en est informé. ») |
| `lien-perdu` | POST | en-tête · anti-force brute 5/h par IP | corps `{ email }` | `{ message }` **toujours neutre** | `403` en-tête, `405` |
| `deconnexion` | POST/GET | — | — | `{ ok:true }` + cookie effacé | — |

Notes :
- `activer` : nécessite un membre au statut `cle_emise` avec la bonne `cleHash`. Passe le statut à `actif`, fixe `expireLe = now + dureeJours`.
- `session` : réutilise l'appareil si un cookie valide du même membre existe, sinon crée un `deviceId` ; applique le plafond `maxAppareils` (`403` « Appareil non autorisé » au-delà).
- **Révocation des liens (H1)** : le jeton personnel `?t=` porte la `tokenVersion` du membre (`v`). `session` refuse (`401`) tout lien dont `v` ≠ `tokenVersion` courante. Le cookie `mh_s` porte aussi `v` et est recontrôlé à chaque requête. L'action admin `regenerer_lien` incrémente `tokenVersion`, ce qui périme d'un coup **tous** les anciens liens et cookies.

## 2. `public` — `/api/public?a=…`

Circuit d'entrée public. Aucune action n'exige de session membre. Action inconnue → `404`.

| `a=` | Méthode | Contrôle | Entrées | Sortie `ok:true` | Erreurs |
|------|---------|----------|---------|------------------|---------|
| `demande` | POST | en-tête · anti-force brute 3/h par IP · champ piège `site_web` | corps `{ type, nom, prenom, email, matieres[], message }` | `{ id }` | `400` champs/email, `403` en-tête, `405`, `429` ; `200` silencieux si piège rempli |
| `decision` | GET | jeton `?d=` | query `d` | `{ demande:{…} }` | `410` jeton invalide/expiré/traité |
| `decision` | POST | jeton `?d=` · en-tête | corps `{ decision:'refuser', motif? }` | `{ ok:true }` (refus + email au demandeur) | `403` `approuver` (réservé admin, F4bis), `400` décision autre que `refuser`, `405` |
| `essai` | GET | jeton `?i=` (invitation) | query `i` | `{ restantSec }` + `Set-Cookie: mh_e` | `410` lien d'essai invalide/terminé |
| `essai-contenu` | GET | cookie d'essai `mh_e` | cookie `mh_e` | `{ extrait, filigrane, lectureSeule:true }` | `401` essai requis, `410` essai terminé |
| `code-reset` | POST | en-tête · anti-force brute 3/h par IP **et** 3/h par email | corps `{ email, numero }` | `{ message }` **toujours neutre** | `403` en-tête, `405`, `429` |
| `matieres` | GET | — | — | `{ matieres:[{id,titre}] }` (liste blanche du catalogue) | — |

## 3. `contenu` — `/api/contenu?a=…`

Contenu protégé. GET uniquement (`405` sinon). `a` par défaut = `cours`. Action inconnue → `404`.

| `a=` | Méthode | Contrôle | Entrées | Sortie `ok:true` | Erreurs |
|------|---------|----------|---------|------------------|---------|
| `profil` | GET | session | cookie `mh_s` | `{ prenom, matieres }` | `401` session |
| `cours` | GET | session · abonnement · code | query `m` (ou `matiere`) | `{ matiere, cours }` | `401` session, `403` matière non incluse / « Code requis », `404` matière inconnue, `405`, `500` contenu illisible |

> Note d'évolution (H3/H4) : l'action `cours` sera remplacée par `plan` / `chapitre` / `correction` / `media`. Ce contrat sera mis à jour à ce moment-là.

## 4. `evaluation` — `/api/evaluation?a=…`

Évaluations protégées. Les **bonnes réponses ne sont jamais envoyées** avant la remise. `a` par défaut = `liste`. Action inconnue → `404`.

| `a=` | Méthode | Contrôle | Entrées | Sortie `ok:true` | Erreurs |
|------|---------|----------|---------|------------------|---------|
| `liste` | GET | session · abonnement · code | query `m` | `{ matiere:{id,titre}, evaluations }` | `401`, `403`, `404`, `405` |
| `quiz` | GET | session · abonnement · code | query `m`, `q` | `{ matiere:{id,titre}, quiz }` (sans réponses) | `401`, `403`, `404` évaluation introuvable |
| `resultats` | GET | session | cookie `mh_s`, query `m?` | `{ resultats:[…] }` | `401`, `403` |
| `soumettre` | POST | session · abonnement · code · en-tête | corps `{ m, q, reponses }` | `{ resultat, archive }` (note /20 calculée serveur) | `401`, `403` en-tête / accès, `404` quiz inconnu, `405` |

## 5. `message` — `/api/message`

Messagerie du membre. **Pas de paramètre `a=`** : routage par méthode HTTP.
Authentification **par cookie `mh_s` UNIQUEMENT** (H2 : le repli par jeton personnel
`?t=` / `body.t` a été supprimé — D4, aucune API ne lit l'URL après la poignée de main).
Le fil est une **sous-collection `membres/{id}/messages/{auto}`** (un document par
message : `{ de, texte, pieces[], le }`). Les pièces jointes sont des liens **https
uniquement** (les autres schémas sont écartés).

| Méthode | Contrôle | Entrées | Sortie `ok:true` | Erreurs |
|---------|----------|---------|------------------|---------|
| GET | session (cookie `mh_s`) | cookie `mh_s` | `{ items:[{id,de,texte,pieces[],le}] }` (fil trié du plus ancien au plus récent) | `401` session invalide |
| POST | session · en-tête | corps `{ texte, pieces[]? }` | `{ ok:true }` (ajoute un message `de:'membre'`, incrémente les non-lus admin) | `400` message vide, `401`, `403` en-tête, `405` |

> Compteur de non-lus : chaque message du membre incrémente `membres/{id}.msgNonLusAdmin`
> et `compteurs/global.msgNonLus` (cloche admin, D22). L'admin les remet à zéro via
> `marquer_lu`. Pièces jointes refusées si l'URL n'est pas en `https://`.

## 6. `admin` — `/api/admin` (POST)

Actions administrateur. **POST uniquement** (`405` sinon). Exige un jeton Firebase `Authorization: Bearer <idToken>` dont l'email == `ADMIN_EMAIL` (sinon `403`). L'action est dans le corps : `{ action, … }`. Action inconnue → `400`.

| `action` | Entrées | Sortie `ok:true` | Notes |
|----------|---------|------------------|-------|
| `list_matieres` | — | `{ matieres:[{id,nom,ordre}] }` | Liste du catalogue admin. |
| `stats` | — | `{ stats:{demandes,demandesEnAttente,membres,membresActifs,messages,messagesOuverts,alertesAbus} }` | Compteurs du tableau de bord. **K9** : `alertesAbus` = nombre d'alertes d'abus (§9.C) via `compteurs/global.alertesAbus`. |
| `list_membres` | — | `{ membres:[…] }` (max 200) | Tri par `majLe` desc. |
| `list_demandes` | — | `{ demandes:[…] }` (max 100) | Tri par `creeLe` desc. |
| `rejeter` | `{ demandeId, email, motif? }` | `{ ok:true }` | Marque `rejetee` + email de refus au demandeur. |
| `list_messages` | — | `{ fils:[{id,nom,email,items[],nonLus,majLe}] }` | Fils en sous-collection `membres/{id}/messages` ; `id` = identifiant du membre ; tri par dernier message. |
| `repondre` | `{ messageId, texte?, pieces[]? }` | `{ ok:true }` | `messageId` = identifiant du **membre** (le fil). Ajoute un message `de:'admin'` + email de notification (sans adresse admin, best-effort). **K7** : `texte` OU au moins une ressource (`pieces`) suffit — l'admin peut envoyer une **ressource PDF seule** ; `400 'Message ou ressource requis.'` si les deux sont vides. Pièces : liens **https** uniquement (javascript:/http:/data: rejetés), 10 max, `nom` borné à 120, `url` à 1000. |
| `marquer_lu` | `{ messageId }` (= membreId) | `{ ok:true, nonLus:0 }` | Remet `msgNonLusAdmin` à 0 et décrémente `compteurs/global.msgNonLus`. |
| `supprimer_fil` | `{ messageId }` (= membreId) | `{ ok:true }` | Efface tout le fil du membre (seul l'admin peut effacer, D17). |
| `inviter_essai` | `{ email }` | — | **K3 : RETIRÉE.** Ancienne « invitation » (lien `?i=` signé, sans enregistrement `essais/{hash}` ni unicité par email). Renvoie désormais `410 { ok:false, erreur:'Action retirée…' }`. Voie d'essai unique = `accorder_essai`. |
| `accorder_essai` | `{ email, nom?, prenom?, dureeMin? }` | résultat `essaisLib.accorderEssai` (`{ ok:true, hash, lien? }`) | **Voie d'essai unique** pilotée par l'admin : crée `essais/{hash}`, `409` si un essai existe déjà pour l'email, lien envoyé par email. |
| `list_essais` | — | `{ essais:[…] }` | — |
| `supprimer_essai` | `{ hash }` | résultat `essaisLib.supprimerEssai` | Autorise un nouvel essai. |
| `approuver_nm` | `{ demandeId, matieres[], dureeJours, maxAppareils, quotaHeures }` | `{ membreId }` | Approbation nouveau modèle : clé + code 8 car. générés serveur, **email avant écritures** (`502` si l'envoi échoue, rien créé). || `regenerer_lien` | `{ membreId, viderAppareils? }` | `{ ok:true, appareilsSupprimes }` | Révoque les accès d'un membre : incrémente `tokenVersion` (anciens liens `?t=` **et** cookies `mh_s` invalidés). **Nouveau lien envoyé par email avant l'écriture** (`502` si l'envoi échoue, version inchangée, appareils conservés) ; `404`/`410` si membre introuvable. **I1** : vide aussi tous les appareils enregistrés par défaut ; `viderAppareils:false` conserve la liste. |
| `vider_appareils` | `{ membreId }` | `{ ok:true, appareilsSupprimes }` | **I1** : ferme tous les appareils enregistrés du membre (efface la sous-collection `membres/{id}/appareils`) ; le membre devra rouvrir une session dans la limite de `maxAppareils` (D5). Journalisé (`vider_appareils`). `400` membre requis, `404` membre introuvable. |

Toutes les erreurs non prévues de `admin` renvoient `500` `{ ok:false, erreur:'Erreur serveur.' }`.

**K2 — cycle de vie du membre** (`api/_lib/inscription.js`, câblé dans `admin.js` ; le `catch` honore `e.status`) :

| `action` | Entrées | Sortie `ok:true` | Notes |
|----------|---------|------------------|-------|
| `prolonger` | `{ membreId, jours }` | `{ ok:true, expireLe }` | `prolongerMembre` : repousse `expireLe` ; repasse `expire`→`actif` si pertinent. `404` membre introuvable. |
| `suspendre` | `{ membreId }` | `{ ok:true, statut:'suspendu', tokenVersion }` | `suspendreMembre` : statut → `suspendu` **et** `tokenVersion++` (coupe toutes les sessions ouvertes). Réversible. `404` introuvable. |
| `reactiver` | `{ membreId }` | `{ ok:true, statut:'actif' }` | `reactiverMembre` : statut → `actif`. N'invente pas de date : si l'accès était échu, prolonger est requis en plus. `404` introuvable. |
| `supprimer_membre` | `{ membreId }` | `{ ok:true }` | `supprimerMembre` : efface le membre **en cascade** (sous-collections `appareils`, `messages`, `resultats`, `evals`/notes) **et libère le verrou d'unicité email** `emails/{hash}` (D21). `404` introuvable. |

**K8 — maintenance admin** (`api/_lib/maintenance.js`, câblé dans `admin.js` ; le `catch` honore `e.status`) :

| `action` | Entrées | Sortie `ok:true` | Notes |
|----------|---------|------------------|-------|
| `list_journal` | `{ max? }` | `{ journal:[{id,qui,action,cible,type,le}] }` | Journal d'audit du plus récent au plus ancien. `max` borné 1–500 (défaut 100). Lecture seule. |
| `stockage` | — | `{ stockage:{demandes,demandesRejetees,membres,essais,journal} }` | Rapport de stockage (page de maintenance occasionnelle). Comptage borné toléré hors tableau de bord (D22). Lecture seule. |
| `purger` | `{ cible }` | `{ ok:true, cible, supprime }` | Purge **ciblée et explicite** ; `cible` ∈ liste blanche `{'journal','demandes_rejetees'}` (données **transitoires** uniquement). `400 'Cible de purge inconnue.'` sinon — aucune suppression. Jamais de purge implicite de membres/essais/messages/résultats. Chaque purge est journalisée (`action:'purge'`, la trace survit même à une purge du journal). |

---

## Rappels transverses

- **Normalisation d'email** (verrou d'unicité `emails/{sha256(email normalisé)}`) : minuscules, retrait du `+suffixe`, points retirés pour `gmail.com`/`googlemail.com`, et (I2) **`googlemail.com` canonisé en `gmail.com`** (même boîte Google → un seul verrou).
- **Anti-force brute** (`limites/{clé}`, fenêtre glissante) : `activer` 10/h/IP, `code` 5 / 15 min, `demande` 3/h/IP, `code-reset` 3/h/IP + 3/h/email, `lien-perdu` 5/h/IP. Dépassement → `429`.
- **Catalogue** : identifiants de matières figés (ex. `thermo`). Seules les entrées du catalogue sont acceptées/exposées.
- **Aucun secret** (clé, code, jeton) n'est jamais écrit dans le dépôt, les rapports, ni renvoyé dans un contenu statique ou le DOM avant autorisation serveur.
