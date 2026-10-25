/* Mémento — page matière (placeholder jusqu'à l'intégration des contenus, étape 3).
   Vérifie le lien personnel et l'abonnement à la matière avant d'afficher quoi que ce soit. */
(function () {
  function $(id){ return document.getElementById(id); }
  function qs(k){ return new URLSearchParams(location.search).get(k) || ''; }
  var TOKEN = qs('t'), MAT = qs('m');

  function montrerErreur(msg){
    $('contenu').hidden = true;
    var b = $('bloc-erreur'); b.hidden = false;
    if (msg) $('txt-erreur').textContent = msg;
  }

  function trouverCours(id, nom){
    var C = window.COURS || {};
    if (C[id]) return C[id];
    var cle = String(nom || '').toLowerCase();
    for (var k in C){ if (!C.hasOwnProperty(k)) continue;
      if (cle.indexOf(k) >= 0) return C[k];
      var t = String(C[k].titre || '').toLowerCase();
      if (t && cle.indexOf(t) >= 0) return C[k];
    }
    return null;
  }

  document.addEventListener('DOMContentLoaded', function(){
    $('retour').setAttribute('href', 'espace.html?t=' + encodeURIComponent(TOKEN));
    if (!TOKEN || !MAT) { montrerErreur('Paramètres manquants.'); return; }
    fetch('/api/acces?t=' + encodeURIComponent(TOKEN))
      .then(function(r){ return r.json().then(function(j){ return { ok:r.ok, j:j }; }); })
      .then(function(res){
        if (!res.ok || !res.j.ok) { montrerErreur((res.j && res.j.erreur) || 'Lien invalide ou expiré.'); return; }
        var m = (res.j.matieres || []).filter(function(x){ return x.id === MAT; })[0];
        if (!m || !m.abonne) { montrerErreur('Cette matière n\'est pas incluse dans votre accès.'); return; }
        $('contenu').hidden = false;
        $('titre').textContent = m.nom;
        document.title = 'Mémento — ' + m.nom;
        var cours = trouverCours(MAT, m.nom);
        if (cours && window.CoursReader) {
          var ph = $('placeholder-matiere'); if (ph) ph.hidden = true;
          try { window.CoursReader.render(cours, $('cours-mount')); }
          catch (e) { if (ph) ph.hidden = false; }
        }
      })
      .catch(function(){ montrerErreur('Réseau indisponible, réessayez.'); });
  });
})();
