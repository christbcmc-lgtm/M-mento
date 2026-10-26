/* Mémento — page de décision (F4bis). Le jeton ?d= reçu par email permet de
   CONSULTER la demande et de la REFUSER. L'APPROBATION ne se fait plus ici :
   « Accepter » redirige vers la console admin (admin.html#/valider/<id>), où
   l'approbation passe par admin?a=approuver_nm (authentification Firebase).
   Aucun HTML injecté (textContent), en-tête de mutation pour le refus. */
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
  var DEMANDE_ID = '';

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

  function rendreMatieres(){ /* F4bis : plus de sélection de matières ici (côté console admin). */ }
  function matieresChoisies(){ return []; }

  function charger(){
    getJSON('/api/public?a=decision&d=' + encodeURIComponent(TOKEN)).then(function(res){
      if (!res.ok || !res.j.ok) { montrerErreur((res.j && res.j.erreur) || 'Lien invalide ou d\u00e9j\u00e0 trait\u00e9.'); return; }
      var d = res.j.demande || {};
      DEMANDE_ID = d.id || '';
      $('charge').hidden = true; $('bloc').hidden = false;
      $('d-nom').textContent = ((d.prenom||'') + ' ' + (d.nom||'')).trim() || '\u2014';
      $('d-email').textContent = d.email || '\u2014';
      $('d-type').textContent = d.type || 'abonnement';
      $('d-msg').textContent = d.message || '\u2014';
    }).catch(function(){ montrerErreur('R\u00e9seau indisponible, r\u00e9essayez.'); });
  }

  document.addEventListener('DOMContentLoaded', function(){
    if (!TOKEN) { montrerErreur('Jeton de d\u00e9cision manquant.'); return; }
    charger();

    $('b-valider').addEventListener('click', function(){
      var err = $('ok-err'); err.textContent = '';
      if (!DEMANDE_ID) { err.textContent = 'Demande introuvable.'; return; }
      // F4bis : on finalise l'approbation dans la console admin (connexion Firebase).
      location.href = 'admin.html#/valider/' + encodeURIComponent(DEMANDE_ID);
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
