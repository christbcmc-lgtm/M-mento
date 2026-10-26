/* Mémento — page de demande (phase 7 : branchée sur le circuit public v2).
   Envoi réel vers /api/public?a=demande, avec en-tête de mutation et champ piège. */
(function () {
  var CIT = [
    "Apprendre, c'est se souvenir de ce qu'on a compris.",
    "Un peu chaque jour vaut mieux que beaucoup une seule fois.",
    "La pers\u00e9v\u00e9rance transforme le difficile en habitude."
  ];
  function $(id){ return document.getElementById(id); }
  function validEmail(v){ return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); }

  document.addEventListener('DOMContentLoaded', function(){
    var form = $('f-dem');
    if (!form) return;
    form.addEventListener('submit', function(e){
      e.preventDefault();
      var err = $('d-err'); err.textContent = '';
      var nom = $('d-nom').value.trim();
      var prenom = $('d-prenom').value.trim();
      var email = $('d-mail').value.trim();
      if (!nom || !prenom) { err.textContent = 'Nom et pr\u00e9nom sont requis.'; return; }
      if (!validEmail(email)) { err.textContent = 'Adresse email invalide.'; return; }
      var matTxt = ($('d-mat') && $('d-mat').value.trim()) || '';
      var msg = ($('d-msg') && $('d-msg').value.trim()) || '';
      if (matTxt) msg = (msg ? (msg + '\n\n') : '') + 'Mati\u00e8res souhait\u00e9es : ' + matTxt;
      var piege = ($('d-site') && $('d-site').value) || '';
      var btn = form.querySelector('button[type="submit"]');
      btn.disabled = true; var libelle = btn.textContent; btn.textContent = 'Envoi\u2026';
      fetch('/api/public?a=demande', {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'mh' },
        body: JSON.stringify({ nom: nom, prenom: prenom, email: email, message: msg, site_web: piege })
      }).then(function(r){ return r.json().then(function(j){ return { ok: r.ok, j: j }; }); })
        .then(function(res){
          btn.disabled = false; btn.textContent = libelle;
          if (!res.ok || !res.j.ok) { err.textContent = (res.j && res.j.erreur) || 'Envoi impossible.'; return; }
          $('cit').textContent = '\u00ab ' + CIT[Math.floor(Math.random()*CIT.length)] + ' \u00bb';
          $('ov').classList.add('on');
          form.reset();
        })
        .catch(function(){ btn.disabled = false; btn.textContent = libelle; err.textContent = 'R\u00e9seau indisponible, r\u00e9essayez.'; });
    });
  });
})();
