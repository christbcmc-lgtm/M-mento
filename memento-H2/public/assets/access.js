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
      var btn = form.querySelector('button[type="submit"]');
      btn.disabled = true; var libelle = btn.textContent; btn.textContent = 'Activation…';
      fetch('/api/auth?a=activer', {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'mh' },
        body: JSON.stringify({ nom: nom, email: email, cle: k })
      }).then(function(r){ return r.json().then(function(j){ return { ok: r.ok, j: j }; }); })
        .then(function(res){
          btn.disabled = false; btn.textContent = libelle;
          if (!res.ok || !res.j.ok) { err.textContent = (res.j && res.j.erreur) || 'Activation impossible.'; return; }
          $('cit').textContent = '« ' + CIT[Math.floor(Math.random()*CIT.length)] + ' »';
          if (res.j.lien) {
            var z = $('lien-zone');
            if (z) {
              var a = document.createElement('a');
              a.className = 'btn'; a.href = res.j.lien; a.textContent = 'Ouvrir mon espace';
              a.style.display = 'block'; a.style.textAlign = 'center'; a.style.textDecoration = 'none';
              z.textContent = ''; z.appendChild(a);
            }
          }
          $('ov').classList.add('on');
        })
        .catch(function(){ btn.disabled = false; btn.textContent = libelle; err.textContent = 'Réseau indisponible, réessayez.'; });
    });

    var ok = $('ov-ok');
    if (ok) ok.addEventListener('click', function(){ $('ov').classList.remove('on'); });
  });
})();
