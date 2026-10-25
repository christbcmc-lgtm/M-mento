/* Anti-clignotement du thème. Chargé de façon synchrone dans le <head>.
   Externalisé depuis un <script> en ligne pour respecter la CSP (aucun script inline). */
(function () {
  try {
    document.documentElement.setAttribute(
      'data-theme',
      localStorage.getItem('memento-theme') || 'clair'
    );
  } catch (e) {
    document.documentElement.setAttribute('data-theme', 'clair');
  }
})();
