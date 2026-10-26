/* Mémento — page de décision (phase 7). Accès réservé à l'administrateur via le
   jeton ?d= reçu par email (pas de console). Charge la demande puis approuve/refuse
   via /api/public?a=decision. Aucun HTML injecté (textContent), en-tête de mutation. */
(function () {
  function $(id){ return document.getElementById(id); }
  function qs(k){ return new URLSearchParams(location.search).get(k) || ''; }
  // Catalogue (liste blanche côté serveur : seules ces ids sont retenues à l'approbation).
  var CATALOGUE = [
    { id: 'thermo', titre: 'Thermodynamique' },
    { id: 'proba',  titre: 'Probabilit\u00e9s et statistiques' },
    { id: 'info',   titre: 'Informatique' }
  ];
  var TOKEN = qs('d');

  function montrerErreur(msg){
    $('charge').hidden = true; $('bloc').hidden = true;
    var b = $('bloc-erreur'); b.hidden = false;
    if (msg) $('txt-erreur').textContent = msg;
  }
  function fin(titre, txt){
    $('ov-titre').textContent = titre;
    $('ov-txt').textContent = txt || '';
    $('ov').classList.add('on');
  }

  function getJSON(url){ return fetch(url, { credentials:'same-origin' }).then(function(r){ return r.json().then(function(j){ return {ok:r.ok,s:r.status,j:j}; }); }); }
  function postJSON(url, corps){
    return fetch(url, { method:'POST', credentials:'same-origin',
      headers: { 'Content-Type':'application/json', 'X-Requested-With':'mh' },
      body: JSON.stringify(corps||{}) }).then(function(r){ return r.json().then(function(j){ return {ok:r.ok,s:r.status,j:j}; }); });
  }

  function rendreMatieres(preselect){
    var box = $('mat-liste');
    while (box.firstChild) box.removeChild(box.firstChild);
    CATALOGUE.forEach(function(m){
      var lab = document.createElement('label'); lab.className = 'case';
      var cb = document.createElement('input'); cb.type = 'checkbox'; cb.value = m.id; cb.className = 'mat-cb';
      if (preselect && preselect.indexOf(m.id) >= 0) cb.checked = true;
      lab.appendChild(cb);
      lab.appendChild(document.createTextNode(' ' + m.titre));
      box.appendChild(lab);
    });
  }
  function matieresChoisies(){
    var out = [];
    Array.prototype.forEach.call(document.querySelectorAll('.mat-cb'), function(cb){ if (cb.checked) out.push(cb.value); });
    return out;
  }

  function charger(){
    getJSON('/api/public?a=decision&d=' + encodeURIComponent(TOKEN)).then(function(res){
      if (!res.ok || !res.j.ok) { montrerErreur((res.j && res.j.erreur) || 'Lien invalide ou d\u00e9j\u00e0 trait\u00e9.'); return; }
      var d = res.j.demande || {};
      $('charge').hidden = true; $('bloc').hidden = false;
      $('d-nom').textContent = ((d.prenom||'') + ' ' + (d.nom||'')).trim() || '\u2014';
      $('d-email').textContent = d.email || '\u2014';
      $('d-type').textContent = d.type || 'abonnement';
      $('d-msg').textContent = d.message || '\u2014';
      rendreMatieres(d.matieres || []);
    }).catch(function(){ montrerErreur('R\u00e9seau indisponible, r\u00e9essayez.'); });
  }

  document.addEventListener('DOMContentLoaded', function(){
    if (!TOKEN) { montrerErreur('Jeton de d\u00e9cision manquant.'); return; }
    charger();

    $('f-ok').addEventListener('submit', function(e){
      e.preventDefault();
      var err = $('ok-err'); err.textContent = '';
      var mats = matieresChoisies();
      if (!mats.length) { err.textContent = 'S\u00e9lectionnez au moins une mati\u00e8re.'; return; }
      var duree = parseInt($('a-duree').value, 10) || 180;
      var app = $('a-app').value === '2' ? 2 : 1;
      var quota = parseInt($('a-quota').value, 10) || 0;
      var btn = this.querySelector('button[type="submit"]'); btn.disabled = true; var lib = btn.textContent; btn.textContent = 'Envoi\u2026';
      postJSON('/api/public?a=decision&d=' + encodeURIComponent(TOKEN), {
        decision: 'approuver', matieres: mats, dureeJours: duree, maxAppareils: app, quotaHeures: quota
      }).then(function(res){
        btn.disabled = false; btn.textContent = lib;
        if (!res.ok || !res.j.ok) { err.textContent = (res.j && res.j.erreur) || 'Action impossible.'; return; }
        $('bloc').hidden = true;
        fin('Acc\u00e8s accord\u00e9', 'La cl\u00e9 d\'activation a \u00e9t\u00e9 envoy\u00e9e au demandeur par email.');
      }).catch(function(){ btn.disabled = false; btn.textContent = lib; err.textContent = 'R\u00e9seau indisponible, r\u00e9essayez.'; });
    });

    $('f-no').addEventListener('submit', function(e){
      e.preventDefault();
      var err = $('no-err'); err.textContent = '';
      var motif = $('r-motif').value.trim();
      var btn = this.querySelector('button[type="submit"]'); btn.disabled = true; var lib = btn.textContent; btn.textContent = 'Envoi\u2026';
      postJSON('/api/public?a=decision&d=' + encodeURIComponent(TOKEN), { decision: 'refuser', motif: motif }).then(function(res){
        btn.disabled = false; btn.textContent = lib;
        if (!res.ok || !res.j.ok) { err.textContent = (res.j && res.j.erreur) || 'Action impossible.'; return; }
        $('bloc').hidden = true;
        fin('Demande refus\u00e9e', 'Le demandeur a \u00e9t\u00e9 inform\u00e9 par email.');
      }).catch(function(){ btn.disabled = false; btn.textContent = lib; err.textContent = 'R\u00e9seau indisponible, r\u00e9essayez.'; });
    });
  });
})();
