# RAPPORT F1 — Exiger le code déverrouillé pour le contenu ET les évaluations

> Correction du guide (aucune phase renumérotée). Un test qui **échoue avant**,
> **passe après**.

## Problème corrigé
Le cours (`/api/contenu`) et les évaluations (`/api/evaluation`) étaient servis
dès qu'un membre avait une **session valide** + un **abonnement** à la matière.
Le **code** (déverrouillage de l'appareil pour 12 h, action `a=code` de
`/api/auth`) n'était **pas** exigé : un appareil non déverrouillé pouvait quand
même recevoir le contenu. C'était contraire à la règle du guide.

## Correctif
- **`api/_lib/session.js`** : nouvelle fonction `exigerDeverrouillage(db, membreId, deviceId)`
  — lève **403 « Code requis »** si `appareils/{deviceId}.deverrouilleJusqua`
  est absent ou expiré (≤ maintenant).
- **`api/_lib/contenu.js`** (`servirCours`) : appelle `exigerDeverrouillage` après
  la vérification d'abonnement → le **cours** n'est servi qu'appareil déverrouillé.
- **`api/_lib/evaluation.js`** (`verifierAcces`) : même exigence → **liste, quiz
  et soumission** d'évaluations exigent l'appareil déverrouillé.
- **Non gaté** volontairement : `GET /api/contenu?a=profil` (liste des matières
  pour la navigation) et `GET /api/evaluation?a=resultats` (historique des notes,
  n'expose aucun énoncé ni réponse) restent accessibles à une session valide.

Ordre des contrôles : **401** (pas de session) → **404** (matière inconnue) →
**403** (matière non incluse) → **403 « Code requis »** (appareil non déverrouillé)
→ **200**. Erreurs neutres, `Cache-Control: no-store`.

## Preuve (test qui échoue avant / passe après)
`test/f1.test.js` — 5 cas :
1. cours, appareil non déverrouillé → **403 « Code requis »** (rien n'est servi) ;
2. cours, appareil déverrouillé → **200** ;
3. évaluations, appareil non déverrouillé → **403 « Code requis »** ;
4. évaluations, appareil déverrouillé → **200** ;
5. `profil` accessible sans déverrouillage (navigation).

- **Avant** le correctif : `node --test test/f1.test.js` → échec
  (le cours était servi en 200 sans déverrouillage). *Vérifié : 1 fail.*
- **Après** le correctif : `node --test test/f1.test.js` → **pass**.

Les jeux de données des tests existants (`phase4`, `phase5`) ont été mis à jour
pour déverrouiller l'appareil, conformément à la nouvelle règle.

```
$ npm test
# tests 8        (f1, phase2..phase7)
# pass 8
# fail 0
```

## Note de numérotation
Le précédent rapport sur les quiz avait été nommé à tort « phase 5 ». Il est
renommé **`RAPPORT_EVALUATIONS.md`** ; **aucune phase du guide n'est renumérotée**.

## À suivre (hors F1)
L'écran de saisie du code côté interface (prompt « Code requis » sur la page
matière) sera branché avec la refonte du front (F3).

## STOP
F1 terminée. En attente du feu vert pour **F2**.
