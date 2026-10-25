/* Mémento — gestion du thème (8 thèmes). Aucun gestionnaire d'événement en ligne. */
(function () {
  var THEMES = ['clair','sepia','gris','sombre','noir','bleu-nuit','vert-foret','violet'];
  var root = document.documentElement;

  function read() {
    try { return localStorage.getItem('memento-theme'); } catch (e) { return null; }
  }
  function write(t) {
    try { localStorage.setItem('memento-theme', t); } catch (e) {}
  }
  function apply(t) {
    if (THEMES.indexOf(t) === -1) t = 'clair';
    root.setAttribute('data-theme', t);
    var sel = document.querySelector('select.theme');
    if (sel) sel.value = t;
    write(t);
  }

  // Applique immédiatement (anti-flash) : appelé aussi tôt que possible.
  apply(read() || 'clair');

  document.addEventListener('DOMContentLoaded', function () {
    apply(read() || 'clair');
    var sel = document.querySelector('select.theme');
    if (sel) {
      sel.addEventListener('change', function () { apply(sel.value); });
    }
  });
})();
