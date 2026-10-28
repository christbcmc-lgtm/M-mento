/* Mémento — essai gratuit (phase 7 : circuit public v2, cookie mh_e).
   1) ?i= ouvre l'essai (GET /api/public?a=essai&i=…) : pose le cookie + renvoie restantSec ;
   2) le contenu (extrait + filigrane) est servi via cookie (GET /api/public?a=essai-contenu) ;
   3) une seule minuterie globale ; à 0, l'aperçu se verrouille. Lecture seule, zero HTML injecté. */
(function () {
  function $(id){ return document.getElementById(id); }
  function qs(k){ return new URLSearchParams(location.search).get(k) || ''; }
  function mmss(s){ s = Math.max(0, Math.round(s)); var m = Math.floor(s/60); var r = s%60; return m + ':' + (r<10?'0':'') + r; }
  function el(tag, cls, txt){ var n=document.createElement(tag); if(cls)n.className=cls; if(txt!=null)n.textContent=txt; return n; }

  var INVIT = qs('i');
  var itGlobal = null;

  function montrerErreur(msg){
    $('essai').hidden = true;
    var b = $('bloc-erreur'); b.hidden = false;
    if (msg) $('txt-erreur').textContent = msg;
  }
  function verrouiller(){
    var sec = $('zone-extrait');
    if (!sec) return;
    sec.classList.add('verrouille');
    var v = sec.querySelector('.voile'); if (v) v.classList.add('on');
  }

  // Dissuasion simple (lecture seule) : pas de menu contextuel ni de copie sur l'aperçu.
  function lectureSeule(){
    var main = $('essai');
    main.addEventListener('contextmenu', function(e){ e.preventDefault(); });
    main.addEventListener('copy', function(e){ e.preventDefault(); });
    main.style.userSelect = 'none';
  }

  function lancerGlobal(secondes){
    var reste = secondes;
    var span = $('glob');
    span.textContent = mmss(reste);
    itGlobal = setInterval(function(){
      reste -= 1;
      span.textContent = mmss(reste);
      if (reste <= 0) { clearInterval(itGlobal); span.textContent = '0:00'; verrouiller(); }
    }, 1000);
  }

  function rendreExtrait(extrait, filigrane){
    $('ex-titre').textContent = (extrait && extrait.titre) || 'Aper\u00e7u';
    var corps = $('ex-corps'); while (corps.firstChild) corps.removeChild(corps.firstChild);
    (extrait && extrait.blocs ? extrait.blocs : []).forEach(function(b){
      if (b && b.type === 'titre') corps.appendChild(el('h3', null, b.texte || ''));
      else corps.appendChild(el('p', null, (b && b.texte) || ''));
    });
    // Filigrane = email de l'essai, répété (dissuasion captures d'écran). Texte uniquement.
    var fw = $('ex-filigrane');
    if (filigrane) { fw.textContent = (filigrane + '  ').repeat(60); }
  }

  function chargerContenu(){
    fetch('/api/public?a=essai-contenu', { credentials: 'same-origin' })
      .then(function(r){ return r.json().then(function(j){ return { ok:r.ok, j:j }; }); })
      .then(function(res){
        if (!res.ok || !res.j.ok) { verrouiller(); return; }
        rendreExtrait(res.j.extrait, res.j.filigrane);
      })
      .catch(function(){ /* l'aperçu reste, la minuterie continue */ });
  }

  document.addEventListener('DOMContentLoaded', function(){
    if (!INVIT) { montrerErreur('Invitation d\'essai manquante.'); return; }
    fetch('/api/public?a=essai&i=' + encodeURIComponent(INVIT), { credentials: 'same-origin' })
      .then(function(r){ return r.json().then(function(j){ return { ok:r.ok, j:j }; }); })
      .then(function(res){
        if (!res.ok || !res.j.ok) { montrerErreur((res.j && res.j.erreur) || 'Essai non autoris\u00e9 ou termin\u00e9.'); return; }
        $('essai').hidden = false;
        lectureSeule();
        lancerGlobal(res.j.restantSec || 0);
        chargerContenu();
      })
      .catch(function(){ montrerErreur('R\u00e9seau indisponible, r\u00e9essayez.'); });
  });
})();
