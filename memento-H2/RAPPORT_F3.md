# RAPPORT F3 — Suppression des fonctions legacy + front branché sur { auth, public }

> Correction du guide (aucune phase renumérotée). Un test qui **échoue avant**,
> **passe après**.

## Problème corrigé
Le projet devait converger vers **6 fonctions API** unifiées
(`admin`, `auth`, `contenu`, `evaluation`, `message`, `public`) et les anciennes
fonctions legacy de premier niveau (`acces`, `activer`, `code-matiere`,
`demande`, `essai`) devaient disparaître. De plus, le front devait appeler
**uniquement** ce couple unifié. Deux points restaient à corriger côté front :
- l'espace membre appelait encore l'**ancienne** action authentifiée
  `POST /api/auth?a=code-reset`, **supprimée en F2** → bouton « Code oublié » cassé ;
- la réinitialisation du code n'était pas branchée sur la nouvelle **voie publique**
  (`/api/public?a=code-reset`, email + numéro).

## Correctif
- **API** : vérifié que `api/` contient **exactement** les 6 fonctions et plus aucun
  fichier legacy (`acces.js`, `activer.js`, `code-matiere.js`, `demande.js`,
  `essai.js` absents).
- **`public/espace.html`** : la modale de déverrouillage expose désormais une zone
  « Code oublié ? » (masquée par défaut) avec deux champs **email** + **numéro** et
  un bouton **Envoyer**. Aucun gestionnaire en ligne.
- **`public/assets/espace.js`** :
  - `renvoyerCode()` poste désormais vers **`/api/public?a=code-reset`** avec
    `{ email, numero }` et affiche le message **neutre** renvoyé par le serveur ;
  - `montrerReset()` révèle la zone de réinitialisation ;
  - `ouvrirModale()` réinitialise l'état (champs vidés, zone reset repliée) à
    chaque ouverture.
  L'appel à l'ancien `/api/auth?a=code-reset` est **supprimé**.

Règles respectées : texte dynamique via `textContent`, en-tête `X-Requested-With: mh`
sur la mutation, message neutre (aucune fuite d'existence), contrôle serveur.

## Preuve (test qui échoue avant / passe après)
`test/f3.test.js` — 5 cas :
1. `api/` contient exactement les 6 fonctions ;
2. aucun fichier API legacy ne subsiste ;
3. le front n'appelle aucun endpoint legacy ; tout `/api/<fn>` vise l'une des 6 ;
4. le front n'appelle **plus** `/api/auth?a=code-reset` (supprimée en F2) ;
5. le front appelle bien la nouvelle voie **`/api/public?a=code-reset`**.

- **Avant** : cas 4 et 5 **échouent** (le front appelait encore l'ancien
  code-reset authentifié).
- **Après** : `node --test test/f3.test.js` → **pass** (5/5).

```
$ npm test
# f1, f2, f3, phase2..phase7
# pass
# fail 0
```

## À suivre (hors F3)
La page de demande charge la liste blanche des matières via
`/api/public?a=matieres` : l'action correspondante, ainsi que les cases à cocher,
l'en-tête, le champ piège et l'écran de succès à lien copiable, sont traités en
**F4**.

## STOP
F3 terminée.
