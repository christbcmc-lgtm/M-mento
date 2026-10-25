# Mémento — Rapport de l'Étape 1 (socle de l'interface & thèmes)

## Ce qui est livré

Un socle de site statique, prêt à être branché sur le backend (Firebase) à l'étape suivante. Tout est en français, sans aucun vocabulaire commercial (aucun prix, achat, paiement) : on parle uniquement de **demande d'accès** et d'**activation**.

### Fichiers

```
memento/
├─ index.html              Page officielle : « Se connecter » + « Demande d'accès »
├─ demande.html            Formulaire de demande (nom, prénom, email, matières, message)
├─ RAPPORT_ETAPE_1.md      Ce rapport
└─ assets/
   ├─ themes.css           Les 8 thèmes (variables de couleurs)
   ├─ base.css             Styles communs (en-tête, logo, cartes, formulaires, overlay)
   ├─ app-theme.js         Sélecteur de thème + mémorisation (anti-flash au chargement)
   ├─ access.js            Onglets + validation de format de la première connexion
   └─ demande.js           Validation de format du formulaire de demande
```

## Décisions prises (sans vous solliciter, comme convenu)

1. **Deux chemins clairement séparés sur l'accueil.**
   - *Se connecter* → « Première connexion » : nom + email + clé d'activation (format `XXXXX-XXXXX-XXXXX-XXXXX`). Un rappel indique que, une fois activé, il suffit d'ouvrir son **lien personnel** reçu par email (pas de reconnexion ici).
   - *Demande d'accès* → redirige vers `demande.html`.

2. **Page de demande neutre.** Elle ne révèle jamais l'adresse de l'administrateur. À l'envoi, une confirmation « Demande envoyée » s'affiche, avec une citation d'encouragement et un retour vers l'accueil. Une note mentionne qu'un **essai gratuit** peut être accordé par l'administrateur (conforme au §14 du plan).

3. **8 thèmes repris à l'identique** de la maquette (Clair, Sépia, Gris, Sombre, Noir, Bleu nuit, Vert forêt, Violet), mémorisés dans le navigateur, appliqués avant l'affichage pour éviter tout clignotement.

4. **Logo « M » (signet)** redessiné en SVG, qui prend automatiquement la couleur d'accent du thème actif.

5. **Sécurité dès le socle.** Aucun secret côté client, aucun gestionnaire d'événement en ligne (`onclick`…), aucun `javascript:`. Toute la logique passe par les fichiers `.js` séparés. Les validations actuelles portent **uniquement sur le format** ; la vérification réelle (clé, lien, code par matière) sera faite côté serveur à l'étape 2.

## Vérifications effectuées

- `index.html` et `demande.html` : analyse HTML sans erreur.
- Recherche de gestionnaires en ligne (`on…=`) et de `javascript:` : **aucun** (conforme aux règles de sécurité).
- Cohérence des classes CSS entre les pages et `base.css` : OK.

## Ce qui n'est PAS encore fait (étapes suivantes)

- **Étape 2 — Backend & accès réel :** projet Firebase dédié, génération du lien personnel à la 1re connexion, 2ᵉ email avec lien dédié, code/mot de passe **par matière** (réinitialisable par l'utilisateur via son numéro), seuil anti-fuite (~5 accès → code exigé), liens expirés → page « refaire une demande », gestion de l'essai gratuit (limites de temps par zone).
- **Étape 3 — Accueil des matières :** toutes les matières visibles, les non-abonnées estompées et non cliquables, bascule entre matières abonnées via l'icône près de la recherche.
- **Contenu des cours :** en attente des 3 PDF (Thermodynamique, Probabilités/Statistiques, Informatique). Mise en forme prévue en 2 couches (développé exhaustif + version assimilable), schémas en images, formules en KaTeX, réponses longues masquées / courtes floutées.
- **Publication :** dépôt GitHub privé puis hébergement Vercel — uniquement à la toute fin, une fois le tout vérifié.

## Prochaine action attendue de votre côté

M'envoyer les **3 PDF des matières** pour démarrer l'intégration du contenu. En parallèle, je peux enchaîner sur l'étape 2 (backend d'accès) dès que vous me le confirmez.
