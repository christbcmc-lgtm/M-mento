/* Mémento — essai gratuit STRICT. Lecture seule : minuteries par zone + minuterie globale.
   Quand une zone atteint 0, elle est verrouillée (floutee). Aucun gestionnaire en ligne. */
(function () {
  function $(id){ return document.getElementById(id); }
  function qs(k){ return new URLSearchParams(location.search).get(k) || ''; }
  function mmss(s){ s = Math.max(0, Math.round(s)); var m = Math.floor(s/60); var r = s%60; return m + ':' + (r<10?'0':'') + r; }

  var INVIT = qs('i');
  var timers = {};

  function montrerErreur(msg){
    $('essai').hidden = true;
    var b = $('bloc-erreur'); b.hidden = false;
    if (msg) $('txt-erreur').textContent = msg;
  }

  function verrouiller(zone){
    var sec = document.querySelector('.zone-essai[data-zone="' + zone + '"]');
    if (!sec) return;
    sec.classList.add('verrouille');
    var v = sec.querySelector('.voile'); if (v) v.classList.add('on');
  }

  function lancerZone(zone, secondes){
    var span = document.querySelector('.minuterie[data-timer="' + zone + '"]');
    var reste = secondes;
    if (span) span.textContent = '(' + mmss(reste) + ')';
    timers[zone] = setInterval(function(){
      reste -= 1;
      if (span) span.textContent = '(' + mmss(reste) + ')';
      if (reste <= 0) { clearInterval(timers[zone]); if (span) span.textContent = '(0:00)'; verrouiller(zone); }
    }, 1000);
  }

  function lancerGlobal(minutes){
    var reste = minutes * 60;
    var span = $('glob');
    span.textContent = mmss(reste);
    var it = setInterval(function(){
      reste -= 1;
      span.textContent = mmss(reste);
      if (reste <= 0) {
        clearInterval(it);
        Object.keys(timers).forEach(function(z){ clearInterval(timers[z]); });
        ['cours','evaluation','revision','exercices'].forEach(verrouiller);
      }
    }, 1000);
  }

  // Dissuasion simple (lecture seule) : pas de menu contextuel ni de sélection sur l'aperçu.
  function lectureSeule(){
    var main = $('essai');
    main.addEventListener('contextmenu', function(e){ e.preventDefault(); });
    main.addEventListener('copy', function(e){ e.preventDefault(); });
    main.style.userSelect = 'none';
  }

  document.addEventListener('DOMContentLoaded', function(){
    if (!INVIT) { montrerErreur('Invitation d\'essai manquante.'); return; }
    fetch('/api/essai', { method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ invitation: INVIT }) })
      .then(function(r){ return r.json().then(function(j){ return { ok:r.ok, j:j }; }); })
      .then(function(res){
        if (!res.ok || !res.j.ok) { montrerErreur((res.j && res.j.erreur) || 'Essai non autorisé.'); return; }
        $('essai').hidden = false;
        lectureSeule();
        var lim = res.j.limites || { cours:300, evaluation:90, revision:90, exercices:120 };
        lancerGlobal(res.j.dureeGlobaleMin || 15);
        lancerZone('cours', lim.cours);
        lancerZone('evaluation', lim.evaluation);
        lancerZone('revision', lim.revision);
        lancerZone('exercices', lim.exercices);
      })
      .catch(function(){ montrerErreur('Réseau indisponible, réessayez.'); });
  });
})();
