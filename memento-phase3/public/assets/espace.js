/* Mémento — espace membre. Lit le jeton personnel (?t=), affiche les matières,
   la messagerie et gère la modale de code par matière. Aucun gestionnaire en ligne. */
(function () {
  function $(id){ return document.getElementById(id); }
  function qs(k){ return new URLSearchParams(location.search).get(k) || ''; }
  function esc(s){ var d=document.createElement('div'); d.textContent=(s==null?'':String(s)); return d.innerHTML; }
  function dateFr(v){ try{ var d=new Date(v&&v._seconds?v._seconds*1000:v); return isNaN(d)?'':d.toLocaleString('fr-FR'); }catch(e){ return ''; } }

  var TOKEN = qs('t');
  var matiereCourante = null;

  function api(url, opts){
    return fetch(url, opts).then(function(r){ return r.json().then(function(j){ return { ok:r.ok, j:j }; }); });
  }

  function montrerErreur(msg){
    $('espace').hidden = true;
    var b = $('bloc-erreur'); b.hidden = false;
    if (msg) $('txt-erreur').textContent = msg;
  }

  function carte(m){
    var div = document.createElement('div');
    div.className = 'carte' + (m.abonne ? (m.besoinCode ? ' verrou' : '') : ' estompe');
    var etat = m.abonne ? (m.besoinCode ? 'Code requis' : 'Ouverte') : 'Non incluse';
    div.innerHTML = '<span class="cadenas">' + (m.abonne ? (m.besoinCode ? '\uD83D\uDD12' : '\uD83D\uDCD6') : '\uD83D\uDD12') + '</span>' +
      '<h3>' + esc(m.nom) + '</h3>' +
      '<div class="etat">' + etat + '</div>' +
      (m.abonne ? '' : '<span class="tag">Demander à l\'admin</span>');
    if (m.abonne) {
      div.addEventListener('click', function(){
        if (m.besoinCode) { ouvrirModaleCode(m); }
        else { ouvrirMatiere(m); }
      });
    }
    return div;
  }

  function ouvrirMatiere(m){
    // Étape 3 : contenu des cours (2 couches + KaTeX + schémas). Pour l'instant, confirmation.
    location.href = 'matiere.html?t=' + encodeURIComponent(TOKEN) + '&m=' + encodeURIComponent(m.id);
  }

  function rendreGrille(data){
    var g = $('grille'); g.innerHTML = '';
    data.matieres.forEach(function(m){ g.appendChild(carte(m)); });
    $('aide-seuil').textContent = data.seuilAtteint
      ? 'Par sécurité, un code par matière est désormais demandé à l\'ouverture.'
      : 'Cliquez sur une matière incluse pour l\'ouvrir. Les matières estompées ne sont pas incluses dans votre accès.';
  }

  /* ---------- Modale code ---------- */
  function ouvrirModaleCode(m){
    matiereCourante = m;
    $('code-titre').textContent = 'Code — ' + m.nom;
    $('code-val').value = ''; $('code-err').textContent = '';
    $('reset-num').value = ''; $('reset-err').textContent = '';
    $('reset-zone').hidden = true;
    $('ov-code').classList.add('on');
  }
  function fermerModale(){ $('ov-code').classList.remove('on'); }

  function validerCode(){
    var code = $('code-val').value.trim();
    if (!code) { $('code-err').textContent = 'Saisissez le code.'; return; }
    api('/api/code-matiere', { method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ t: TOKEN, matiere: matiereCourante.id, code: code }) })
      .then(function(res){
        if (!res.ok || !res.j.ok) { $('code-err').textContent = (res.j && res.j.erreur) || 'Code incorrect.'; return; }
        fermerModale(); ouvrirMatiere(matiereCourante);
      })
      .catch(function(){ $('code-err').textContent = 'Réseau indisponible.'; });
  }

  function reinitCode(){
    var num = $('reset-num').value.trim();
    if (!num) { $('reset-err').textContent = 'Indiquez votre numéro.'; return; }
    api('/api/code-matiere', { method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ t: TOKEN, matiere: matiereCourante.id, reset: true, numero: num }) })
      .then(function(res){
        if (!res.ok || !res.j.ok) { $('reset-err').textContent = (res.j && res.j.erreur) || 'Réinitialisation impossible.'; return; }
        $('reset-err').textContent = '';
        $('code-err').textContent = 'Un nouveau code vient de vous être envoyé par email.';
        $('reset-zone').hidden = true;
      })
      .catch(function(){ $('reset-err').textContent = 'Réseau indisponible.'; });
  }

  /* ---------- Messagerie ---------- */
  function rendreFil(items){
    var f = $('fil'); f.innerHTML = '';
    if (!items || !items.length) { f.innerHTML = '<div class="vide">Aucun message pour le moment.</div>'; return; }
    items.forEach(function(it){
      var b = document.createElement('div');
      b.className = 'bulle ' + (it.de === 'membre' ? 'moi' : 'lui');
      var pieces = (it.pieces || []).map(function(p){
        return '<a class="piece" href="' + esc(p.url) + '" target="_blank" rel="noopener">\uD83D\uDCCE ' + esc(p.nom || 'pièce') + '</a>';
      }).join(' ');
      b.innerHTML = esc(it.texte) + (pieces ? '<br>' + pieces : '') +
        '<span class="meta">' + (it.de === 'membre' ? 'Vous' : 'Administrateur') + ' • ' + dateFr(it.le) + '</span>';
      f.appendChild(b);
    });
    f.scrollTop = f.scrollHeight;
  }

  function chargerFil(){
    api('/api/message?t=' + encodeURIComponent(TOKEN)).then(function(res){
      if (res.ok && res.j.ok) rendreFil(res.j.items);
    }).catch(function(){});
  }

  function envoyerMsg(e){
    e.preventDefault();
    var txt = $('m-txt').value.trim();
    if (!txt) { $('m-err').textContent = 'Message vide.'; return; }
    $('m-err').textContent = '';
    api('/api/message', { method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ t: TOKEN, texte: txt }) })
      .then(function(res){
        if (!res.ok || !res.j.ok) { $('m-err').textContent = (res.j && res.j.erreur) || 'Envoi impossible.'; return; }
        $('m-txt').value = ''; chargerFil();
      })
      .catch(function(){ $('m-err').textContent = 'Réseau indisponible.'; });
  }

  /* ---------- Init ---------- */
  document.addEventListener('DOMContentLoaded', function(){
    if (!TOKEN) { montrerErreur('Lien personnel manquant.'); return; }
    api('/api/acces?t=' + encodeURIComponent(TOKEN)).then(function(res){
      if (!res.ok || !res.j.ok) { montrerErreur((res.j && res.j.erreur) || 'Lien invalide ou expiré.'); return; }
      $('espace').hidden = false;
      var mb = res.j.membre || {};
      $('bonjour').textContent = 'Bonjour ' + ((mb.prenom || mb.nom || '')).trim();
      rendreGrille(res.j);
      chargerFil();
    }).catch(function(){ montrerErreur('Réseau indisponible, réessayez.'); });

    $('f-msg').addEventListener('submit', envoyerMsg);
    $('code-ok').addEventListener('click', validerCode);
    $('code-fermer').addEventListener('click', fermerModale);
    $('code-reset').addEventListener('click', function(){ $('reset-zone').hidden = false; });
    $('reset-ok').addEventListener('click', reinitCode);
  });
})();
