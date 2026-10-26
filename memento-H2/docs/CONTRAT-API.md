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
| `code` | POST | session · en-tête · anti-force brute 5 / 15 min | corps `{ code }` | `{ deverrouilleJusqua }` (12 h) | `400`? non, `403` code incorrect / en-tête, `405`, `429` |
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
| `stats` | — | `{ stats:{demandes,demandesEnAttente,membres,membresActifs,messages,messagesOuverts} }` | Compteurs du tableau de bord. |
| `list_membres` | — | `{ membres:[…] }` (max 200) | Tri par `majLe` desc. |
| `list_demandes` | — | `{ demandes:[…] }` (max 100) | Tri par `creeLe` desc. |
| `rejeter` | `{ demandeId, email, motif? }` | `{ ok:true }` | Marque `rejetee` + email de refus au demandeur. |
| `list_messages` | — | `{ fils:[{id,nom,email,items[],nonLus,majLe}] }` | Fils en sous-collection `membres/{id}/messages` ; `id` = identifiant du membre ; tri par dernier message. |
| `repondre` | `{ messageId, texte, pieces[]? }` | `{ ok:true }` | `messageId` = identifiant du **membre** (le fil). Ajoute un message `de:'admin'` + email de notification (sans adresse admin, best-effort). Pièces https uniquement. |
| `marquer_lu` | `{ messageId }` (= membreId) | `{ ok:true, nonLus:0 }` | Remet `msgNonLusAdmin` à 0 et décrémente `compteurs/global.msgNonLus`. |
| `supprimer_fil` | `{ messageId }` (= membreId) | `{ ok:true }` | Efface tout le fil du membre (seul l'admin peut effacer, D17). |
| `inviter_essai` | `{ email }` | `{ ok:true }` | Envoie un lien d'essai signé (7 j). `400` email invalide. |
| `accorder_essai` | `{ … }` | résultat `essaisLib.accorderEssai` | Essai piloté par l'admin. |
| `list_essais` | — | `{ essais:[…] }` | — |
| `supprimer_essai` | `{ hash }` | résultat `essaisLib.supprimerEssai` | Autorise un nouvel essai. |
| `approuver_nm` | `{ demandeId, matieres[], dureeJours, maxAppareils, quotaHeures }` | `{ membreId }` | Approbation nouveau modèle : clé + code 8 car. générés serveur, **email avant écritures** (`502` si l'envoi échoue, rien créé). |
| `regenerer_lien` | `{ membreId }` | `{ ok:true }` | Révoque les accès d'un membre : incrémente `tokenVersion` (anciens liens `?t=` **et** cookies `mh_s` invalidés). **Nouveau lien envoyé par email avant l'écriture** (`502` si l'envoi échoue, version inchangée) ; `404`/`410` si membre introuvable. |

Toutes les erreurs non prévues de `admin` renvoient `500` `{ ok:false, erreur:'Erreur serveur.' }`.

---

## Rappels transverses

- **Normalisation d'email** (verrou d'unicité `emails/{sha256(email normalisé)}`) : minuscules, retrait du `+suffixe`, points retirés pour `gmail.com`/`googlemail.com`.
- **Anti-force brute** (`limites/{clé}`, fenêtre glissante) : `activer` 10/h/IP, `code` 5 / 15 min, `demande` 3/h/IP, `code-reset` 3/h/IP + 3/h/email, `lien-perdu` 5/h/IP. Dépassement → `429`.
- **Catalogue** : identifiants de matières figés (ex. `thermo`). Seules les entrées du catalogue sont acceptées/exposées.
- **Aucun secret** (clé, code, jeton) n'est jamais écrit dans le dépôt, les rapports, ni renvoyé dans un contenu statique ou le DOM avant autorisation serveur.
