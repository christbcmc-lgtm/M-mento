# Mémento — Rapport de tes exigences et état de correction

_Document de suivi. Il recense **tout ce que tu as demandé** (sur l'ensemble des échanges), dit **ce qui était cassé**, et **ce que je corrige**. Je coche au fur et à mesure. Je ne déclare « fait » que ce que j'ai réellement vérifié._

---

## 1. Rappel du cadre (non négociable)

| # | Exigence | Statut |
|---|----------|--------|
| C1 | Site éducatif « Mémento », en **français**. | respecté |
| C2 | **Aucun prix, aucun paiement** affiché nulle part. | respecté |
| C3 | Accès **contrôlé** aux cours (clé d'activation + lien personnel + code par matière). | en place |
| C4 | **Aucun lien vers GitHub** sur le site ; code privé. | respecté |
| C5 | **Aucun secret côté navigateur** : vérifs côté serveur (fonctions Vercel + Firebase). | respecté |
| C6 | Email admin **jamais exposé** au membre : tout passe par la messagerie interne. | respecté |
| C7 | HTML **sans gestionnaires en ligne** (`onclick`, etc.). | respecté |

---

## 2. Problèmes que tu as signalés — diagnostic honnête

### P1 — « Dans *Mon espace*, je ne vois AUCUNE matière, je clique, il n'y a rien. »
**Cause réelle trouvée :** la grille des matières (côté membre) et les cases à cocher (côté admin) étaient alimentées **uniquement** par une collection Firestore `matieres` qui **n'a jamais été remplie**. Les cours (thermo, proba) existaient seulement comme fichiers de code, **sans entrée de catalogue** → catalogue vide → écran vide. C'était le défaut central.
**Correction :** un **catalogue canonique** est désormais intégré au code (source de vérité). Les matières s'affichent **toujours**, même si Firestore est vide. Firestore ne fait plus qu'ajouter d'éventuelles matières supplémentaires.
**Statut : CORRIGÉ (vérifié par harnais).**

### P2 — « Après avoir ACCEPTÉ une demande, le bouton *Rejeter* est toujours là. Ça n'a pas de sens. »
**Cause réelle :** la liste des demandes affichait toujours les deux mêmes boutons, **sans tenir compte du statut** de la demande (en attente / traitée / rejetée).
**Correction :** les actions dépendent maintenant du statut :
- **En attente** → `Préparer l'activation` + `Rejeter`.
- **Traitée (devenue membre)** → badge **« ✔ Devenu membre »**, plus de bouton Rejeter.
- **Rejetée** → badge **« ✖ Rejetée »** + `Reconsidérer` (pour rouvrir si c'était une erreur).
**Statut : CORRIGÉ (vérifié par harnais).**

### P3 — « J'ai *rejeté* un email déjà accepté, et il garde quand même l'accès. »
**Cause réelle :** « Rejeter » n'agissait que sur la *demande*, jamais sur le *membre* déjà actif. Rejeter une demande ne coupait pas l'accès d'un membre.
**Correction :** séparation claire de deux gestes distincts :
- **Rejeter une demande** (avant acceptation) : refuse la demande, prévient par email. N'a aucun effet sur un membre actif.
- **Résilier / suspendre un membre** (après acceptation) : geste placé **dans la fiche membre**, qui **coupe réellement l'accès** (statut → `suspendu`, le lien personnel ne fonctionne plus).
**Statut : CORRIGÉ (vérifié par harnais).**

### P4 — « Il faut SÉPARER la page de *décision* et la page d'*administration*. Tout est en désordre. »
**Compris.** La console était une seule page fourre-tout.
**Correction :** la console est réorganisée en **onglets clairs** :
1. **Décisions** — uniquement les demandes à trancher (accorder / rejeter) + le formulaire d'activation.
2. **Membres** — récapitulatif de tous les membres, leurs matières, leur état, résiliation, et **gestion du contenu/PDF par matière**.
3. **Messagerie** — fils de discussion avec les membres.
4. **Essais** — invitations d'essai.
**Statut : CORRIGÉ (structure vérifiée).**

### P5 — « Le contenu / les PDF n'existent même pas. Dans *Mon espace* il devrait y avoir des boutons (je t'ai envoyé des captures). »
**Note :** je n'ai pas reçu les captures d'écran dans ce tour — je m'appuie donc sur ta description. Dis-moi si l'agencement visé diffère.
**Correction (1re étape, sans dépendre d'un stockage de fichiers) :** l'admin peut **attacher à chaque matière** des ressources (PDF/livres) par **nom + lien**, et le membre les voit et les ouvre depuis la page de la matière, à côté du cours. Un vrai **téléversement de fichiers** (upload) nécessite un espace de stockage (Firebase Storage) que tu devras activer — je te guiderai ; en attendant, l'attache par lien fonctionne immédiatement.
**Statut : 1re étape CORRIGÉE ; upload de fichiers = étape suivante (à configurer ensemble).**

### P6 — « Les boutons *Rafraîchir* un peu partout, ça fait rire, c'est inutile. »
**Correction :** suppression des multiples boutons « Rafraîchir ». La console se **met à jour toute seule** (à l'ouverture d'un onglet et après chaque action). Un seul petit bouton discret de rafraîchissement manuel reste disponible, sans encombrer.
**Statut : CORRIGÉ.**

### P7 — « L'essai gratuit : quand c'est fini, ça ne coupe rien. On avait dit : gratuit quelques minutes, puis ça coupe ; le temps dépend de l'abonnement. »
**État actuel :** l'aperçu d'essai **verrouille bien** chaque zone à la fin de sa minuterie et au bout du temps global (vérifié dans le code). Ce qui manque, c'est **l'expiration réelle de l'accès membre** selon une durée (le « temps selon l'abonnement »). Aujourd'hui un membre actif n'a **pas de date de fin**.
**Correction prévue :** ajout d'une **échéance** par membre (date d'expiration) posée par l'admin à l'activation ; passé le délai, le lien personnel est refusé automatiquement côté serveur. _(En cours — voir §4.)_
**Statut : essai = OK ; échéance membre = EN COURS.**

---

## 3. Récapitulatif des corrections de ce tour

- [x] P1 — Catalogue canonique → les matières s'affichent toujours (membre + admin).
- [x] P2 — Boutons de demande selon le statut (plus de « Rejeter » après acceptation).
- [x] P3 — Résiliation d'un membre distincte du rejet d'une demande (coupe l'accès).
- [x] P4 — Console réorganisée en onglets : Décisions / Membres / Messagerie / Essais.
- [x] P5 — Ressources (PDF/livres) attachables par matière, visibles côté membre (par lien).
- [x] P6 — Suppression des boutons « Rafraîchir » superflus ; mise à jour automatique.
- [ ] P7 — Échéance d'accès par membre (expiration réelle).
- [ ] P5bis — Téléversement de vrais fichiers (nécessite activer Firebase Storage).
- [ ] Cours « Informatique » (3ᵉ PDF) pas encore intégré (thermo + proba faits).

---

## 4. Ce qu'il reste et qui a besoin de toi

1. **Échéance membre (P7)** : je l'ajoute côté code ; à l'activation tu choisiras la durée. _(En cours.)_
2. **Upload de PDF (P5bis)** : nécessite d'activer **Firebase Storage** sur ton projet `memento-b4176`. Dis-moi quand tu veux, je prépare la configuration et je te guide pas à pas.
3. **3ᵉ cours (Informatique)** : à intégrer après validation des deux premiers.
4. **Sécurité urgente** : la clé de service déposée dans les fichiers reste **compromise** — à régénérer dans la console Firebase.

---

_Je mets ce rapport à jour à chaque étape. Si l'agencement des boutons côté membre diffère de tes captures, précise-le et je l'aligne exactement._
