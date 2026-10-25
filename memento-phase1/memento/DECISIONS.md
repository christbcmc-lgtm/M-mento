# Mémento — Décisions d'architecture (prises sans te solliciter)

Conformément à ta consigne (« tu évalues les risques et tu décides »), voici les choix que je prends pour la suite. Tu peux les contester, sinon j'avance ainsi.

## Accès & sécurité
- **Aucun lien vers GitHub** nulle part sur le site public. Le code reste privé ; le site n'y renvoie jamais.
- **Aucun secret côté navigateur.** La vérification des clés, liens personnels et codes par matière se fait **côté serveur** (fonctions Vercel) avec la clé Firebase et des **jetons signés**.
- **Lien personnel** généré à la 1re connexion (nom + email + clé) ; un 2e email contient le lien dédié. Seuil anti-fuite (~5 accès) → code exigé. Lien expiré → page « refaire une demande ».
- **Code / mot de passe par matière**, réinitialisable par l'utilisateur via son numéro.

## Essai gratuit (volontairement STRICT)
- But unique : **laisser visualiser/tester le site**, pas consommer le contenu. Durées courtes, en lecture seule, **sans code**, **sans téléchargement**.
- Limites par zone appliquées côté serveur (jeton d'essai à expiration courte + minuteur par zone) :
  - **Cours : ~5 min** · **Évaluation / Révision / Exercices : ~1–2 min** chacune.
- Objectif : empêcher que l'essai gratuit devienne un moyen de piratage.

## Messagerie administrateur ↔ membre
- Chaque membre a un **fil de discussion privé** avec l'administrateur.
- Le membre envoie un message ; **l'administrateur le reçoit** et peut **répondre**, **joindre des PDF / livres**, envoyer des réponses et ressources.
- **L'adresse de l'administrateur n'apparaît jamais** côté membre : tout passe par la messagerie interne. Toute suggestion/contact se fait via ce canal.
- Panneau d'administration protégé (page admin réservée) pour gérer demandes, abonnements, messages et envois.

## Technique
- **Firebase** : Authentication (email + lien email) + **Firestore** (membres, matières, abonnements, demandes, messages, essais).
- **Vercel** : hébergement du site statique + **fonctions serverless** (validation d'accès, génération des liens, codes par matière, messagerie, essai gratuit).
- **Emails** : service **Resend** (une seule clé API, offre gratuite suffisante).
- **Contenu des cours** : 2 couches (développé exhaustif + version assimilable), schémas en images, formules en KaTeX, réponses longues masquées / courtes floutées.
