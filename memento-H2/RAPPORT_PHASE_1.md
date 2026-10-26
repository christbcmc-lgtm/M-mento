# RAPPORT_PHASE_1 — Restructuration, en-têtes, indexation

**Objectif :** seul `public/` est servi ; en-têtes de sécurité complets ; rien
d'indexable.

## Ce qui a été fait (code réel, rien cassé)

1. **Dossier `public/` créé.** Y ont été déplacés : les 6 pages HTML
   (`index`, `demande`, `essai`, `espace`, `matiere`, `admin`) et tout `assets/`.
   Sont restés à la racine (donc **non servis**) : `api/`, `firestore.rules`,
   `package.json`, tous les `.md`.
   Les chemins relatifs (`assets/...`) restent valides car HTML et `assets/` ont
   été déplacés ensemble.

2. **`vercel.json`** :
   - `outputDirectory: public`
   - `functions` : `api/*.js` avec `includeFiles: contenu/**` et `maxDuration: 10`
   - `cleanUrls: true`
   - en-têtes sur `/(.*)` : `X-Content-Type-Options: nosniff`,
     `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`,
     `Permissions-Policy` (géoloc/micro/caméra vides),
     `Strict-Transport-Security: max-age=63072000; includeSubDomains`,
     `X-Robots-Tag: noindex, nofollow`, et la **CSP** complète.

3. **CSP** appliquée telle que spécifiée. Conséquence : **aucun script en ligne**.
   Le script anti-clignotement du thème (qui était inline dans chaque `<head>`) est
   devenu `public/assets/js/theme-boot.js`, chargé de façon synchrone dans le head.

4. **`public/robots.txt`** : `User-agent: *` / `Disallow: /`.
   `<meta name="robots" content="noindex,nofollow">` ajouté aux 6 pages.

5. **Liens externes** : aucun `<a href="http...">` dans les pages. Les seules
   ressources externes sont la feuille de style et le script **KaTeX** (jsdelivr),
   couverts par la CSP. Rien à passer en `rel=noopener` (étape sans objet ici).

## Vérifications déjà faites localement
- `grep '<script>'` sur les 6 pages → **0** script inline restant.
- Chaque page contient bien 1 meta robots + 1 référence `theme-boot.js`.
- `DECISIONS.md` / `firestore.rules` sont hors de `public/` → renverront 404.

## Acceptation — à contrôler APRÈS déploiement (gestes de votre côté)
Remplacez `VOTRE-SITE` par votre domaine Vercel.

```bash
# 1) Tous les en-têtes de sécurité présents
curl -I https://VOTRE-SITE/
#   -> doit montrer X-Content-Type-Options, X-Frame-Options, Referrer-Policy,
#      Permissions-Policy, Strict-Transport-Security, X-Robots-Tag,
#      Content-Security-Policy

# 2) Les fichiers internes ne sont plus servis
curl -s -o /dev/null -w "%{http_code}\n" https://VOTRE-SITE/DECISIONS.md     # -> 404
curl -s -o /dev/null -w "%{http_code}\n" https://VOTRE-SITE/firestore.rules  # -> 404

# 3) robots
curl -s https://VOTRE-SITE/robots.txt   # -> User-agent: * / Disallow: /
```
- Ouvrir chaque page, console du navigateur : **aucune violation CSP**.

## Exposition temporaire connue (volontaire)
`public/assets/cours-*.js` restent **publics** jusqu'à la **Phase 4** (protection
réelle du contenu). Ne rien y ajouter d'ici là.

## STOP
Phase 1 terminée. En attente de votre déploiement + des résultats des 3 `curl`
ci-dessus avant de passer à la Phase 2 (noyau d'accès serveur).
