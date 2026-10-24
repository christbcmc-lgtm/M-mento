# Mémento

Espace d'accès protégé aux cours (révision : cours, résumés, exercices, auto-évaluations).

Site statique destiné à l'hébergement **Vercel**, avec authentification et données via **Firebase** (projet dédié). Aucun contenu commercial : on parle uniquement de **demande d'accès** et d'**activation**.

## État d'avancement

- **Étape 1 — Socle de l'interface (fait).** Voir [`RAPPORT_ETAPE_1.md`](RAPPORT_ETAPE_1.md).
  - `index.html` : accueil (Se connecter / Demande d'accès)
  - `demande.html` : formulaire de demande
  - `assets/` : 8 thèmes, styles communs, sélecteur de thème, validations de format

## Étapes suivantes

- Étape 2 : backend d'accès (Firebase) — lien personnel, codes par matière, essai gratuit à durée limitée, messagerie administrateur.
- Étape 3 : accueil des matières + intégration des contenus.
- Publication : dépôt privé puis déploiement Vercel.

## Documents

- [`GUIDE_CONFIGURATION.md`](GUIDE_CONFIGURATION.md) — configuration pas à pas (Firebase, Vercel, Resend) côté utilisateur.
- [`DECISIONS.md`](DECISIONS.md) — choix d'architecture (accès, essai gratuit strict, messagerie admin).
- [`RAPPORT_ETAPE_1.md`](RAPPORT_ETAPE_1.md) — rapport du socle d'interface.

## Sécurité

Aucun secret côté client, aucun gestionnaire d'événement en ligne, aucun `javascript:`. La vérification réelle des accès se fait côté serveur.
