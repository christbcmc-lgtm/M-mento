/* Mémento — page de demande (F3 : circuit public v2).
   - Type d'accès : Abonnement / Essai gratuit.
   - Matières en cases à cocher, chargées depuis /api/public?a=matieres (liste blanche).
   - Numéro de téléphone OBLIGATOIRE (preuve d'identité, réutilisée pour le code perdu).
   Envoi réel vers /api/public?a=demande, en-tête de mutation + champ piège. Aucun HTML injecté. */
(function () {
  var CIT = [
    "Apprendre, c'est se souvenir de ce qu'on a compris.",
    "Un peu chaque jour vaut mieux que beaucoup une seule fois.",
    "La pers\u00e9v\u00e9rance transforme le difficile en habitude."
  ];
  function $(id){ return document.getElementById(id); }
  function validEmail(v){ return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); }

  function chargerMatieres(){
    var box = $('d-mat');
    fetch('/api/public?a=matieres', { credentials:'same-origin' })
      .then(function(r){ return r.json(); })
      .then(function(j){
        while (box.firstChild) box.removeChild(box.firstChild);
        var liste = (j && j.matieres) || [];
        if (!liste.length) { var s = document.createElement('span'); s.className='aide'; s.textContent='Aucune mati\u00e8re disponible.'; box.appendChild(s); return; }
        liste.forEach(function(m){
          var lab = document.createElement('label'); lab.className = 'case';
          var cb = document.createElement('input'); cb.type = 'checkbox'; cb.value = m.id; cb.className = 'mat-cb';
          lab.appendChild(cb);
          lab.appendChild(document.createTextNode(' ' + (m.titre || m.id)));
          box.appendChild(lab);
        });
      })
      .catch(function(){
        while (box.firstChild) box.removeChild(box.firstChild);
        var s = document.createElement('span'); s.className='aide'; s.textContent='Mati\u00e8res indisponibles, r\u00e9essayez.'; box.appendChild(s);
      });
  }
  function matieresChoisies(){
    var out = [];
    Array.prototype.forEach.call(document.querySelectorAll('.mat-cb'), function(cb){ if (cb.checked) out.push(cb.value); });
    return out;
  }
  function typeChoisi(){
    var r = document.querySelector('input[name="type"]:checked');
    return (r && r.value === 'essai') ? 'essai' : 'abonnement';
  }

  document.addEventListener('DOMContentLoaded', function(){
    chargerMatieres();
    var form = $('f-dem');
    if (!form) return;
    form.addEventListener('submit', function(e){
      e.preventDefault();
      var err = $('d-err'); err.textContent = '';
      var nom = $('d-nom').value.trim();
      var prenom = $('d-prenom').value.trim();
      var email = $('d-mail').value.trim();
      var numero = ($('d-num') && $('d-num').value.trim()) || '';
      if (!nom || !prenom) { err.textContent = 'Nom et pr\u00e9nom sont requis.'; return; }
      if (!validEmail(email)) { err.textContent = 'Adresse email invalide.'; return; }
      if (!numero) { err.textContent = 'Le num\u00e9ro de t\u00e9l\u00e9phone est requis.'; return; }
      var mats = matieresChoisies();
      if (!mats.length) { err.textContent = 'S\u00e9lectionnez au moins une mati\u00e8re.'; return; }
      var msg = ($('d-msg') && $('d-msg').value.trim()) || '';
      var piege = ($('d-site') && $('d-site').value) || '';
      var btn = form.querySelector('button[type="submit"]');
      btn.disabled = true; var libelle = btn.textContent; btn.textContent = 'Envoi\u2026';
      fetch('/api/public?a=demande', {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'mh' },
        body: JSON.stringify({ type: typeChoisi(), nom: nom, prenom: prenom, email: email, numero: numero, matieres: mats, message: msg, site_web: piege })
      }).then(function(r){ return r.json().then(function(j){ return { ok: r.ok, j: j }; }); })
        .then(function(res){
          btn.disabled = false; btn.textContent = libelle;
          if (!res.ok || !res.j.ok) { err.textContent = (res.j && res.j.erreur) || 'Envoi impossible.'; return; }
          $('cit').textContent = '\u00ab ' + CIT[Math.floor(Math.random()*CIT.length)] + ' \u00bb';
          $('ov').classList.add('on');
          form.reset();
          chargerMatieres();
        })
        .catch(function(){ btn.disabled = false; btn.textContent = libelle; err.textContent = 'R\u00e9seau indisponible, r\u00e9essayez.'; });
    });
  });
})();
