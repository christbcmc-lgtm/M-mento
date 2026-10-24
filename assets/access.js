/* Mémento — page d'accès (étape 1 : interface + validations de format).
   La vérification réelle (clé/lien/code) sera branchée sur le backend à l'étape 2. */
(function () {
  var CIT = [
    "Apprendre, c'est se souvenir de ce qu'on a compris.",
    "Un peu chaque jour vaut mieux que beaucoup une seule fois.",
    "La persévérance transforme le difficile en habitude."
  ];

  function $(id){ return document.getElementById(id); }

  // Onglets
  function selectTab(which){
    var con = which === 'con';
    $('t-con').setAttribute('aria-selected', con ? 'true':'false');
    $('t-dem').setAttribute('aria-selected', con ? 'false':'true');
    $('p-con').hidden = !con;
    $('p-dem').hidden = con;
  }

  function validEmail(v){ return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); }
  function validKey(v){ return /^[A-Z0-9]{5}-[A-Z0-9]{5}-[A-Z0-9]{5}-[A-Z0-9]{5}$/.test(v); }

  document.addEventListener('DOMContentLoaded', function(){
    $('t-con').addEventListener('click', function(){ selectTab('con'); });
    $('t-dem').addEventListener('click', function(){ selectTab('dem'); });

    var cle = $('c-cle');
    if (cle) cle.addEventListener('input', function(){ cle.value = cle.value.toUpperCase(); });

    var form = $('f-con');
    if (form) form.addEventListener('submit', function(e){
      e.preventDefault();
      var err = $('c-err'); err.textContent = '';
      var nom = $('c-nom').value.trim();
      var email = $('c-mail').value.trim();
      var k = $('c-cle').value.trim();
      if (!nom) { err.textContent = 'Veuillez indiquer votre nom.'; return; }
      if (!validEmail(email)) { err.textContent = 'Adresse email invalide.'; return; }
      if (!validKey(k)) { err.textContent = 'Clé au format XXXXX-XXXXX-XXXXX-XXXXX.'; return; }
      // Étape 2 : envoyer au backend pour vérification + génération du lien personnel.
      $('cit').textContent = '« ' + CIT[Math.floor(Math.random()*CIT.length)] + ' »';
      var ov = $('ov'); ov.classList.add('on');
    });

    var ok = $('ov-ok');
    if (ok) ok.addEventListener('click', function(){ $('ov').classList.remove('on'); });
  });
})();
