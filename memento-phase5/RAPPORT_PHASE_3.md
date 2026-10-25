# RAPPORT — Phase 3 : Circuit d'entrée (demande → décision → accès / essai)

## Objectif de la phase
Construire, côté serveur uniquement, tout le parcours d'entrée d'un nouveau visiteur :
déposer une demande d'accès, la traiter (approuver/refuser) via un lien emaillé à
l'administrateur, et gérer les **essais gratuits** stricts (lecture seule, minutés).

## Ce qui est livré (vrai code)

### Nouvelles fonctions pures (testables hors ligne) — `api/_lib/`
- **`inscription.js`**
  - `creerDemande(db, data, mailer, siteUrl)` : honeypot déjà filtré en amont, filtre les matières
    sur le catalogue, **pose le verrou email AVANT** d'alerter l'admin, crée la demande
    (`statut: nouvelle`), incrémente le compteur, envoie à l'admin un mail avec **lien de décision signé**.
    Le message du visiteur est **échappé (HTML-escape)** dans l'email.
  - `decisionGet(db, tok)` : lit la demande pour la page de décision ; demande déjà traitée → **410**.
  - `decisionRefus(db, tok, motif, mailer)` : passe en `rejetee`, **libère le verrou email**, journalise,
    prévient le demandeur (motif optionnel, échappé).
  - `approuverDemande(db, params, mailer, siteUrl)` : génère **clé + code 8 car. côté serveur**
    (stockés **hachés**, jamais en clair), crée un membre `statut: cle_emise`
    (matières = tableau, `maxAppareils` 1/2, durée, quota), **rattache le verrou email au membre**,
    marque la demande `traitee`, envoie la clé au membre. Deuxième approbation → **410**.
- **`essais.js`**
  - `accorderEssai(db, data, mailer, siteUrl)` : **2–5 min**, un email = un essai (`essais/{hashEmail}`),
    **doublon → 409**, envoie le lien d'essai signé.
  - `ouvrirEssai(db, tok)` : la **première** ouverture pose `utiliseLe` (horloge serveur) ;
    une ré-ouverture **ne prolonge jamais** l'essai ; renvoie le cookie `mh_e` et le temps restant ;
    essai terminé → **410**.
  - `essaiContenu(db, cookie)` : sert l'extrait avec **filigrane (email)** + `lectureSeule`,
    recontrôle l'expiration côté serveur → **410** si fini, **401** sans cookie.
  - `listEssais` / `supprimerEssai` pour l'administration.

### Point d'entrée HTTP — `api/public.js`
Wrapper sans session membre : `a=demande | decision | essai | essai-contenu`.
- `demande` (POST) : exige l'en-tête `X-Requested-With: mh`, **honeypot `site_web`** (→ 200 sans rien enregistrer),
  **limite 3 demandes/h/IP** (IP hachée).
- `decision` : GET lit la demande ; POST **approuve ou refuse** selon `decision` (jeton emaillé = autorisation, pas de console).
- `essai` (GET) : ouvre l'essai et pose le cookie `mh_e` (`HttpOnly; Secure; SameSite=Strict`).
- `essai-contenu` (GET) : sert l'extrait à partir du cookie.

### Administration (sans casser l'existant) — `api/admin.js`
Actions **ajoutées** (modèle cible) : `approuver_nm`, `accorder_essai`, `list_essais`, `supprimer_essai`.
Les anciennes actions restent intactes.

### Dépendance
`nodemailer@6.9.15` **épinglé exact** (emails Gmail, décision D13).

## Preuve réelle (tests exécutés)
`npm test` (`node --test`) — **3 fichiers, 0 échec**. `test/phase3.test.js` couvre :
1. demande enregistrée + verrou posé + notif admin + message échappé ; **doublon → 409** (aucun 2e mail) ;
2. **honeypot → 200 sans enregistrer** ; **4e demande → 429** (limite 3/h) ;
3. en-tête `X-Requested-With` manquant → **403** ;
4. décision : lecture OK, **refus** → `rejetee` + verrou libéré + email au demandeur ; re-décision → **410** ;
5. **approbation** : membre `cle_emise` (hashes `s1$…`), verrou rattaché au membre, clé au format dans l'email, demande `traitee`, 2e approbation → **410** ;
6. essais : accorder + **doublon 409**, ouverture **ne prolonge pas**, filigrane + lecture seule, **expiré → 410** ;
7. list / supprimer essais.

```
# tests 3
# pass 3
# fail 0
```

## Conformité au guide v2
- Contrôle d'accès **toujours côté serveur** ; aucun secret en clair (clé/code **hachés**, IP/email **hachés**).
- **Erreurs neutres** : on ne révèle jamais si un email existe (verrou avant notif, mêmes messages).
- Aucun secret dans le code ni en chat (tout en variables d'environnement Vercel : `TOKEN_SECRET`, `ADMIN_EMAIL`, `SITE_URL`, `MAIL_*`).
- Modèle cible respecté : `matieres` = tableau, un seul `codeHash`/membre, cookies `mh_s`/`mh_e`, verrou `emails/{hash}`.
- Ancien code non cassé ; nouvelle logique **injectée** et testée hors ligne.

## Reste pour une phase suivante (hors périmètre phase 3)
- Pages front associées : `public/decision.html` (formulaire approuver/refuser lisant `?d=`) et
  branchement de `public/essai.html` / `public/demande.html` sur ce circuit.
- Minuteurs d'essai **par zone** (cours ~5 min, évaluation/révision ~1–2 min) au-delà du minuteur global actuel.

---
**STOP.** Phase 3 terminée. Dis **« suite »** pour enchaîner la phase suivante.
