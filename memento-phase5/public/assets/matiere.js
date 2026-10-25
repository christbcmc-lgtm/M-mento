/* Mémento — page matière (phase 4 : contenu servi par un endpoint PROTÉGÉ).
   Le cours n'est plus un fichier public : on le demande à /api/contenu, qui
   vérifie la session (cookie mh_s) et l'abonnement AVANT de renvoyer quoi que ce soit. */
(function () {
  function $(id){ return document.getElementById(id); }
  function qs(k){ return new URLSearchParams(location.search).get(k) || ''; }
  var TOKEN = qs('t'), MAT = qs('m');

  function montrerErreur(msg){
    $('contenu').hidden = true;
    var b = $('bloc-erreur'); b.hidden = false;
    if (msg) $('txt-erreur').textContent = msg;
  }

  document.addEventListener('DOMContentLoaded', function(){
    $('retour').setAttribute('href', TOKEN ? ('espace.html?t=' + encodeURIComponent(TOKEN)) : 'espace.html');
    if (!MAT) { montrerErreur('Paramètre de matière manquant.'); return; }
    // Appel du contenu protégé (cookie de session envoyé automatiquement).
    fetch('/api/contenu?a=cours&m=' + encodeURIComponent(MAT), { credentials: 'same-origin' })
      .then(function(r){ return r.json().then(function(j){ return { ok:r.ok, s:r.status, j:j }; }); })
      .then(function(res){
        if (!res.ok || !res.j.ok) {
          var msg = (res.j && res.j.erreur) || 'Accès refusé.';
          if (res.s === 401) msg = 'Session requise. Ouvrez votre lien personnel pour vous connecter.';
          montrerErreur(msg); return;
        }
        $('contenu').hidden = false;
        var titre = (res.j.matiere && res.j.matiere.titre) || 'Matière';
        $('titre').textContent = titre;
        document.title = 'Mémento — ' + titre;
        var cours = res.j.cours;
        if (cours && window.CoursReader) {
          var ph = $('placeholder-matiere'); if (ph) ph.hidden = true;
          try { window.CoursReader.render(cours, $('cours-mount')); }
          catch (e) { if (ph) ph.hidden = false; }
        }
      })
      .catch(function(){ montrerErreur('Réseau indisponible, réessayez.'); });
  });
})();
