# Rapport — Phase 7 : Circuit public (demande · décision · essai)

## Objectif
Brancher le FRONT du circuit d'entrée public sur le modèle v2 (`api/public.js`
et `api/auth.js`), et ajouter la page de **décision** que l'administrateur ouvre
depuis le lien reçu par email (sans console). Le contrôle d'accès reste
entièrement côté serveur.

## Ce qui a été fait

### Demande d'accès — `public/demande.html` + `assets/demande.js`
- Envoi réel vers `POST /api/public?a=demande` avec en-tête `X-Requested-With: mh`.
- **Champ piège anti-robot** (`site_web`) ajouté au formulaire, hors écran et
  `aria-hidden` : s'il est rempli, le serveur répond 200 sans rien enregistrer.
- La matière souhaitée (texte libre) est jointe au message transmis à l'admin.

### Activation — `public/acces.html` + `assets/access.js`
- Bascule de `/api/activer` (legacy) vers `POST /api/auth?a=activer` avec en-tête
  de mutation. En l'absence d'envoi email (dev), le lien personnel renvoyé est
  proposé directement dans la fenêtre de confirmation.

### Essai gratuit — `public/essai.html` + `assets/essai.js`
- Réécrit sur le modèle v2 : `GET /api/public?a=essai&i=…` pose le cookie `mh_e`
  et renvoie `restantSec` (minuterie serveur, non remise à zéro par un
  rafraîchissement), puis `GET /api/public?a=essai-contenu` sert l'extrait via
  le cookie.
- Une seule minuterie globale ; à 0, l'aperçu se verrouille (voile). Extrait rendu
  en lecture seule avec **filigrane** = email de l'essai (dissuasion captures),
  tout en `textContent` (zero HTML injecté).

### Décision — `public/decision.html` + `assets/decision.js` (NOUVEAU)
- Ouverte via `/decision?d=<jeton>` (jeton emaillé à l'admin ; sa possession
  autorise la décision, conformément au guide « pas de console »).
- `GET /api/public?a=decision&d=…` charge la demande (nom, email, type, message).
- **Approuver** : cases à cocher des matières (liste blanche côté serveur),
  durée, nombre d'appareils (1/2), quota d'heures → `POST …&decision=approuver`.
- **Refuser** : motif facultatif → `POST …&decision=refuser`.
- Toutes les mutations portent `X-Requested-With: mh`, tout le texte via
  `textContent`.

### Style
- CSS ajoutée : filigrane d'essai (`espace.css`), fiche d'infos + cases à cocher
  de la décision (`base.css`).

## Tests — `test/phase7.test.js`
Handler `api/public.js` testé de bout en bout (base factice, mailer capturé). 9 cas, verts :
1. demande sans en-tête → 403.
2. champ piège rempli → 200 mais aucune demande stockée ni email.
3. demande valide → 200 + demande `nouvelle` + email admin avec lien `/decision?d=`.
4. `decision` GET avec jeton → renvoie la demande.
5. `decision` POST approuver → membre créé (`cle_emise`, matières) + email clé au demandeur.
6. `decision` POST refuser → demande `rejetee` + email au demandeur.
7. `decision` POST sans en-tête → 403.
8. essai : ouverture pose `mh_e`, contenu (extrait + filigrane) servi via cookie.
9. `essai-contenu` sans cookie → 401.

## Vérification
`npm test` : 7 fichiers (fake-db, phases 2 → 7), **7 pass / 0 fail**.

## Suite
Phase 8 : console admin (`admin.html` + `admin-client.js` sur `/api/admin`,
protégée par un idToken Firebase).
