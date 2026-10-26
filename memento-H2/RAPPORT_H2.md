# RAPPORT H2 — Messagerie membre↔admin (sous-collection, un document par message)

## Objet
Refondre la messagerie du « Mémento » pour qu'elle repose sur une sous-collection
`membres/{id}/messages/{auto}` (un document par message, aucune réécriture globale),
au cookie de session uniquement (suppression du repli `?t=`), avec pièces jointes
`https` seulement et un compteur fiable de messages non lus côté admin.

## Périmètre (inchangé pour le reste)
- Aucun changement de contenu pédagogique ni d'apparence.
- Aucune renumérotation de phases.
- Aucun push GitHub.

## Modèle de données (3.3)
- Fil = sous-collection `membres/{id}/messages/{auto}` :
  `{ de: 'membre' | 'admin', texte, pieces: [{nom, url}], le: <ts> }`.
- Compteurs de non-lus admin :
  - `membres/{id}.msgNonLusAdmin` (par membre),
  - `compteurs/global.msgNonLus` (total tous fils).
- Pièces jointes : URL **https uniquement** (rejet de `javascript:`, `http:`, `data:`),
  nom par défaut « pièce » si absent.

## Ce qui a changé
- **`api/_lib/messagerie.js`** (nouveau, lib injectable) :
  `validerPieces`, `envoyerMembre`, `listerFil`, `marquerLuAdmin`,
  `repondreAdmin`, `listerFilsAdmin`, `supprimerFil`.
  Tri du fil en JS (fake-db sans `orderBy`).
- **`api/message.js`** réécrit : cookie de session **uniquement** (plus de repli `?t=`),
  écriture d'un document par message, en-tête `X-Requested-With: mh` exigé pour la
  mutation (POST), erreurs neutres.
- **`api/admin.js`** migré : `stats`, `list_messages`, `repondre`, plus les nouvelles
  actions `marquer_lu` et `supprimer_fil`. `list_messages` renvoie
  `fils[{ id, nom, email, items[], nonLus }]` avec `id = membreId`
  (le `repondre` reçoit `messageId = membreId`).
- **`docs/CONTRAT-API.md`** + fixture attendue `h0` mis à jour.

## Sécurité
- Contrôle d'accès côté serveur : lecture/écriture du fil réservées au titulaire du
  cookie de session ; actions admin réservées à la zone admin.
- Suppression du repli `?t=` : un jeton d'URL n'authentifie plus la messagerie (401).
- Pièces jointes `https` seulement → pas d'injection `javascript:`/`data:`.
- Aucune adresse admin exposée dans les notifications e-mail au membre.
- Erreurs neutres (pas de fuite d'information).

## Tests — échouent AVANT, passent APRÈS
Nouveau fichier `test/h2.test.js` (8 cas) :
1. **H2a** `validerPieces` ne garde que les URL `https` (rejette `javascript:`, `http:`, `data:`).
2. **H2b** chaque message membre crée **un** document dans `membres/{id}/messages` (aucun écrasement).
3. **H2c** chaque message incrémente `msgNonLusAdmin` + `compteurs/global.msgNonLus` ;
   `marquerLuAdmin` remet à 0.
4. **H2d** `repondreAdmin` ajoute un message `de:admin`, notifie le membre (sans adresse admin),
   n'incrémente pas les non-lus admin.
5. **H2d'** `repondreAdmin` sur un membre inconnu → 404.
6. **H2e** `listerFilsAdmin` expose le fil (`id = membreId`) ; `supprimerFil` efface tout
   et remet les compteurs à 0.
7. **H2f** `GET /api/message?t=<jeton perso>` sans cookie → **401** (repli supprimé).
8. **H2f'** POST au cookie puis GET : le fil apparaît via la sous-collection,
   la pièce `javascript:` ayant été rejetée.

Correction de `test/phase6.test.js` : l'ancien test « repli `?t=` fonctionne »
(qui attendait 200) devient « repli supprimé → 401 », conforme à D4.

### Avant
Le test H2f (repli supprimé = 401) et les cas sous-collection/compteurs échouent
contre l'ancienne messagerie `items[]` réécrite en bloc et le repli `?t=` actif.

### Après
```
# test/h2.test.js     : 8 pass / 0 fail
# test/phase6.test.js : 9 pass / 0 fail
# suite complète      : 15 fichiers, 0 fail
```

## Livrable
`outputs/memento-H2.zip` (arborescence du projet corrigée).

## STOP
H2 terminé et livré. En attente du « feu vert » avant d'entamer H3 puis H4.
Aucun push GitHub effectué.
