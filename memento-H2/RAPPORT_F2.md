# RAPPORT F2 — Réinitialisation du code rendue PUBLIQUE (email + numéro)

> Correction du guide (aucune phase renumérotée). Un test qui **échoue avant**,
> **passe après**.

## Problème corrigé
La réinitialisation du code de déverrouillage (`auth?a=code-reset`) exigeait une
**session membre authentifiée** (`sess.authentifier`). Or un membre qui a perdu
son code ne peut souvent plus ouvrir de session, et surtout n'a aucun moyen de
déverrouiller un nouvel appareil. La réinitialisation devait être **publique**,
protégée par un **second facteur** (le numéro du membre), **sans jamais révéler**
l'existence d'un compte, et le nouveau code devait partir **uniquement** vers
l'adresse **enregistrée** du membre.

## Correctif
- **`api/_lib/inscription.js`** : nouvelle fonction `reinitCode(db, { email, numero }, mailer, siteUrl)`.
  - Recherche le membre par **hash d'email** (`em.refDepuisEmail`).
  - Réinitialise **seulement** si l'email correspond à un membre `actif` ou
    `cle_emise` **et** que le **numéro** fourni égale `membre.numero`
    (comparaison après suppression des espaces).
  - Génère un nouveau `codeHash` (`secret.nouveauCode` + `secret.hash`), journalise
    (`journal`), puis envoie le code **à `membre.email`** (l'adresse enregistrée),
    jamais à une adresse fournie librement.
  - **Ne lève aucune erreur** vers l'appelant : retourne toujours `{ ok: true }`.
- **`api/public.js`** : nouvelle action **`a=code-reset`** (POST).
  - `sess.exigerEntete` (en-tête anti-CSRF `X-Requested-With: mh` obligatoire).
  - Limite **3 tentatives / heure / IP** (`lim.limiter`).
  - Appelle `insc.reinitCode` puis renvoie une **réponse neutre et identique**
    dans tous les cas : `{ ok: true, message: "Si les informations correspondent, un nouveau code a été envoyé." }`.
- **`api/auth.js`** : l'ancienne action **authentifiée `code-reset` est supprimée**
  (case + fonction + commentaire d'en-tête). `auth?a=code-reset` renvoie désormais
  **404 « Action inconnue »**.

Règles respectées : contrôle côté serveur, **erreurs neutres** (aucune fuite
d'existence d'email/numéro), aucun secret en clair, en-tête `X-Requested-With`
exigé pour la mutation, nouveau code envoyé **à l'adresse enregistrée uniquement**.

## Preuve (test qui échoue avant / passe après)
`test/f2.test.js` — 6 cas :
1. email + numéro corrects → **200**, code **renouvelé**, email envoyé **à l'adresse enregistrée** (une fois) ;
2. numéro incorrect → **200 neutre**, **aucun** email, code **inchangé** ;
3. email inconnu → réponse **strictement identique** au cas numéro incorrect, **aucun** email ;
4. 4e tentative sur la même IP → **429** ;
5. mutation sans en-tête `X-Requested-With` → refusée ;
6. `auth?a=code-reset` → **404 « Action inconnue »** (ancienne version supprimée).

- **Avant** : `node --test test/f2.test.js` → 4 échecs (action publique absente,
  ancienne action authentifiée encore présente).
- **Après** : `node --test test/f2.test.js` → **pass** (6/6).

```
$ npm test
# 9 fichiers (f1, f2, phase2..phase7)
# pass
# fail 0
```

## À suivre (hors F2)
Le formulaire « code perdu » côté interface (saisie email + numéro, message
neutre) sera branché avec la refonte du front (**F3**). Le champ `membre.numero`
est alimenté à la création/approbation côté admin (**F5**, `approuver_nm`).

## STOP
F2 terminée.
