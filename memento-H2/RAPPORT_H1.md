# RAPPORT_H1 — Révocation des liens personnels (tokenVersion)

## (a) Ce qui est fait

Problème corrigé : un lien personnel `?t=` restait valide à vie. Le jeton
`token.signPersonnel` ne portait **pas** la `tokenVersion` du membre et
`auth.js` (action `session`) ne la vérifiait pas à l'échange lien → cookie.
Résultat : impossible de couper l'accès d'un membre dont le lien a fuité, sauf
à le suspendre. (Le cookie `mh_s` portait déjà `v` et était recontrôlé par
`session.authentifier`, mais la **poignée de main par lien** ne l'était pas.)

Corrections, sans toucher au contenu pédagogique ni à l'apparence :

1. **`api/_lib/token.js`** — `signPersonnel(membreId, dureeJours, tokenVersion)`
   embarque désormais `v = tokenVersion || 0` dans le jeton `perso`
   (rétro-compatible : sans argument, `v = 0`).
2. **`api/auth.js`** —
   - `lienPersonnel(membreId, dureeJours, tokenVersion)` passe la version ;
   - `activer` génère le lien avec `m.tokenVersion || 0` ;
   - `session` refuse (`401` « Lien invalide. ») tout jeton dont
     `p.v !== m.tokenVersion`, avant toute pose de cookie.
3. **`api/_lib/inscription.js`** — nouvelle fonction injectable
   `regenererLien(db, params, mailer, siteUrl)` :
   - incrémente `tokenVersion` (périme d'un coup **tous** les anciens liens
     `?t=` ET cookies `mh_s`) ;
   - envoie le **nouveau** lien par email **AVANT** toute écriture (même
     discipline que G2 / F2b) : si l'envoi échoue, l'écriture n'a pas lieu
     (version inchangée, anciens accès toujours valides) et l'appelant reçoit
     un `502` clair ;
   - écrit `tokenVersion` + `majLe`, puis journalise l'action.
   - `404` si le membre est introuvable. Aucun secret exposé.
4. **`api/admin.js`** — nouvelle action POST `regenerer_lien` (`{ membreId }`),
   réservée à l'administrateur, qui appelle `inscLib.regenererLien`
   (même branchement que `approuver_nm`).
5. **`docs/CONTRAT-API.md`** — mis à jour : note de révocation H1 sous
   `auth·session`, ligne `regenerer_lien` dans le tableau `admin`, précision du
   `401` version périmée. Garde-fou `test/h0.test.js` aligné (action ajoutée
   à `ATTENDU`).

## (b) Preuves — test dédié `test/h1.test.js` (échoue AVANT, passe APRÈS)

Six sous-tests :
- **H1a** : `signPersonnel` embarque `v` (et `v=0` par défaut).
- **H1b** : un lien dont `v ≠ tokenVersion` → `401`, aucun cookie posé.
- **H1c** : un lien dont `v == tokenVersion` → `200`, cookie à la bonne version.
- **H1d** : `regenererLien` incrémente la version, envoie le **nouveau** lien
  (v=1) à l'adresse du membre, révoque l'ancien lien et accepte le nouveau.
- **H1e** : échec d'envoi → `502`, `tokenVersion` inchangée, ancien lien
  toujours valide (aucune écriture).
- **H1f** : membre inconnu → `404`/`410`, aucun email.

AVANT (code non corrigé) : `# pass 1 # fail 5` (5 des 6 sous-tests échouent).

APRÈS : `# pass 6 # fail 0` pour `h1.test.js`.

**Suite complète** (`node --test`) : `# tests 14 # pass 14 # fail 0` — aucune
régression (F1/F2/F3, G1→G5, H0 toujours verts).

## (c) Périmètre et garde-fous respectés

- Contrôle d'accès **côté serveur** uniquement ; messages d'erreur neutres.
- Aucun secret en clair (aucun jeton ni code dans le dépôt / les rapports).
- Mutations admin : même cadre d'autorisation (`Bearer` = `ADMIN_EMAIL`).
- Aucune phase renumérotée ; contenu pédagogique et apparence intacts.
- **Aucun push GitHub** effectué.

## (d) Fichiers touchés

- `api/_lib/token.js`, `api/auth.js`, `api/_lib/inscription.js`, `api/admin.js`
- `docs/CONTRAT-API.md`, `test/h0.test.js` (garde-fou), `test/h1.test.js` (nouveau)

## (e) STOP

Élément **H1 terminé**. J'attends le feu vert avant d'entamer **H2**.
