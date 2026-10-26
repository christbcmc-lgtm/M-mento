# RAPPORT_PHASE_2 — Noyau d'accès côté serveur

**Objectif :** sessions, appareils, code unique, limites, unicité d'email — tout le
contrôle d'accès CÔTÉ SERVEUR. Preuve par **tests automatisés** (`node --test`).

## Fichiers créés / modifiés (code réel)
- `api/_lib/limites.js` — `limiter(db, cle, max, fenetreSec)` en transaction.
  IP lue dans `x-forwarded-for` (1re valeur), hachée HMAC-SHA256 avec `TOKEN_SECRET`.
  Le compteur est incrémenté PUIS la limite vérifiée (une tentative refusée reste
  comptée).
- `api/_lib/emails.js` — `normaliser`, `hacheEmail`, `verrouiller` (transaction, 409
  si déjà pris), `liberer`, `refDepuisEmail`. Verrou dans `emails/{hash}`.
- `api/_lib/session.js` — cookie `mh_s` = JWT `{m,d,v}`, `HttpOnly; Secure;
  SameSite=Strict; Path=/`, durée = min(expireLe, 180 j). Enregistrement/comptage
  des appareils avec plafond, en-tête `X-Requested-With: mh` exigé pour les mutations,
  `authentifier()` qui recharge le membre et vérifie statut / expireLe / tokenVersion
  à chaque appel.
- `api/_lib/secret.js` — code unique porté à **8 caractères** (sans 0/O/1/I).
- `api/auth.js` — fonction groupée, actions `a=` : `activer`, `session`, `acces`,
  `code`, `code-reset`, `lien-perdu`, `deconnexion`. Erreurs neutres (on ne révèle
  jamais si un email existe). Déverrouillage du code valable **12 h** (par appareil).
- `test/fake-db.js` + `test/phase2.test.js` — Firestore en mémoire + tests.
- `package.json` — ajout du script `test`.

> Les anciens points d'entrée (`api/activer.js`, `acces.js`, `code-matiere.js`…)
> sont **laissés en place** pour ne rien casser du site actuel ; ils seront
> remplacés par `auth.js` quand l'interface sera reconstruite (phases 6–7).
> L'envoi des emails (confirmation, lien perdu, reset) est branché en **phase 3**
> (Gmail + nodemailer) ; en phase 2 `activer` renvoie directement le lien.

## Preuve (tests — tous au vert)
Commande : `npm test`  (équivaut à `node --test`). Résultat : **pass 2, fail 0**.
Contenu couvert, correspondant à l'acceptation du guide :
- (a) plafond d'appareils : avec `max=1` le 2e appareil est refusé « Appareil non
  autorisé » ; avec `max=2` le 3e est refusé.
- (b) 6 codes faux d'affilée → **429**, et le bon code reste refusé jusqu'à la fin
  de la fenêtre.
- (c) tokenVersion différent (équivalent « après régénération du lien ») → **401**.
- (d) membre expiré → **403 « Accès expiré »**.
- (e) tout appel sans cookie → **401**.
- (f) le parcours `activer → session → acces` fonctionne via le cookie `mh_s` ;
  le jeton `?t=` n'est utilisé qu'une fois pour poser le cookie (le client remplace
  ensuite l'URL — côté interface, phase 6).

Reproduire localement :
```bash
cd memento
npm install          # installe jsonwebtoken
npm test             # node --test  -> pass, fail 0
```

## Note de sécurité / limites connues
- `enregistrerAppareil` fait lecture-puis-écriture (pas une transaction unique sur
  la sous-collection) : risque de course négligeable à l'échelle visée, à renforcer
  si besoin au durcissement (phase 10).
- Rien ne fonctionne réellement en production tant que les variables Vercel de la
  **phase 0** ne sont pas en place (notamment `TOKEN_SECRET` et les `FIREBASE_*`).

## STOP
Phase 2 terminée, tests au vert en local. À déployer (après la config phase 0) ;
ensuite on enchaîne sur la **phase 3** (demandes, décision, validation, essai, emails).
