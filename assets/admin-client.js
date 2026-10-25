/* Mémento — console d'administration (Firebase Auth compat).
   Toutes les actions passent par POST /api/admin avec un jeton Firebase (Bearer). */
(function () {
  function $(id){ return document.getElementById(id); }
  function esc(s){ var d=document.createElement('div'); d.textContent=(s==null?'':String(s)); return d.innerHTML; }
  function dateFr(v){ try{ var d=new Date(v&&v._seconds?v._seconds*1000:v); return isNaN(d)?'':d.toLocaleString('fr-FR'); }catch(e){ return ''; } }

  var MATIERES_DEF = [
    { id:'thermo', nom:'Thermodynamique' },
    { id:'probas-stats', nom:'Probabilités & Statistiques' },
    { id:'info', nom:'Informatique' }
  ];
  var selection = {};
  var filCourant = null;

  if (!window.firebase || !window.MEMENTO_FIREBASE) { return; }
  firebase.initializeApp(window.MEMENTO_FIREBASE);
  var auth = firebase.auth();

  function idToken(){ var u = auth.currentUser; return u ? u.getIdToken() : Promise.reject(new Error('non connecté')); }

  function appel(action, payload){
    return idToken().then(function(tok){
      return fetch('/api/admin', {
        method:'POST',
        headers:{ 'Content-Type':'application/json', 'Authorization':'Bearer ' + tok },
        body: JSON.stringify(Object.assign({ action: action }, payload || {}))
      });
    }).then(function(r){ return r.json().then(function(j){ return { ok:r.ok, j:j }; }); });
  }

  /* ---------- Chips matières ---------- */
  function rendreChips(){
    var box = $('g-chips'); box.innerHTML = '';
    MATIERES_DEF.forEach(function(m){
      var c = document.createElement('span');
      c.className = 'chip' + (selection[m.id] ? ' on' : '');
      c.textContent = m.nom;
      c.addEventListener('click', function(){
        selection[m.id] = !selection[m.id];
        c.classList.toggle('on');
      });
      box.appendChild(c);
    });
  }
  function matieresChoisies(){
    var ids = Object.keys(selection).filter(function(k){ return selection[k]; });
    var extra = ($('g-extra').value || '').split(',').map(function(s){ return s.trim(); }).filter(Boolean);
    extra.forEach(function(x){ if (ids.indexOf(x) === -1) ids.push(x); });
    return ids;
  }

  /* ---------- Demandes ---------- */
  function rendreDemandes(list){
    var box = $('liste-dem'); box.innerHTML = '';
    if (!list || !list.length) { box.innerHTML = '<div class="vide">Aucune demande.</div>'; return; }
    list.forEach(function(d){
      var el = document.createElement('div');
      el.className = 'ligne';
      var statut = d.statut === 'traitee' ? ' • traitée' : '';
      el.innerHTML = '<b>' + esc((d.prenom||'') + ' ' + (d.nom||'')) + '</b>' +
        '<div class="sous">' + esc(d.email||'') + ' • ' + dateFr(d.creeLe) + statut + '</div>' +
        (d.message ? '<div class="sous">« ' + esc(d.message) + ' »</div>' : '');
      var act = document.createElement('div'); act.className = 'actions';
      var b = document.createElement('button'); b.className = 'btn mini'; b.textContent = 'Préparer l\'activation';
      b.addEventListener('click', function(){
        $('g-prenom').value = d.prenom || ''; $('g-nom').value = d.nom || '';
        $('g-mail').value = d.email || ''; $('g-demande').value = d.id || '';
        $('g-ok').scrollIntoView({ behavior:'smooth', block:'center' });
      });
      act.appendChild(b); el.appendChild(act); box.appendChild(el);
    });
  }
  function chargerDemandes(){
    appel('list_demandes').then(function(res){ if (res.ok && res.j.ok) rendreDemandes(res.j.demandes); });
  }

  /* ---------- Messages ---------- */
  function rendreMessages(list){
    var box = $('liste-msg'); box.innerHTML = '';
    if (!list || !list.length) { box.innerHTML = '<div class="vide">Aucun message.</div>'; return; }
    list.forEach(function(f){
      var items = f.items || [];
      var dernier = items.length ? items[items.length-1] : null;
      var el = document.createElement('div'); el.className = 'ligne';
      el.innerHTML = '<b>' + esc(f.nom || f.email || '') + '</b>' +
        '<div class="sous">' + esc(f.email||'') + ' • ' + dateFr(f.majLe) + '</div>' +
        (dernier ? '<div class="sous">' + esc((dernier.de==='admin'?'Vous : ':'') + (dernier.texte||'')) + '</div>' : '');
      var act = document.createElement('div'); act.className = 'actions';
      var b = document.createElement('button'); b.className = 'btn mini'; b.textContent = 'Répondre';
      b.addEventListener('click', function(){ ouvrirReponse(f); });
      act.appendChild(b); el.appendChild(act); box.appendChild(el);
    });
  }
  function chargerMessages(){
    appel('list_messages').then(function(res){ if (res.ok && res.j.ok) rendreMessages(res.j.fils); });
  }

  function ouvrirReponse(f){
    filCourant = f;
    $('rep-dest').textContent = (f.nom || '') + ' — ' + (f.email || '');
    $('rep-txt').value = ''; $('rep-pnom').value = ''; $('rep-purl').value = ''; $('rep-err').textContent = '';
    var fil = $('rep-fil'); fil.innerHTML = '';
    (f.items || []).forEach(function(it){
      var b = document.createElement('div');
      b.className = 'bulle ' + (it.de === 'admin' ? 'moi' : 'lui');
      b.innerHTML = esc(it.texte) + '<span class="meta">' + (it.de==='admin'?'Vous':'Membre') + ' • ' + dateFr(it.le) + '</span>';
      fil.appendChild(b);
    });
    fil.scrollTop = fil.scrollHeight;
    $('ov-rep').classList.add('on');
  }
  function envoyerReponse(){
    var texte = $('rep-txt').value.trim();
    if (!texte) { $('rep-err').textContent = 'Réponse vide.'; return; }
    var pieces = [];
    var pn = $('rep-pnom').value.trim(), pu = $('rep-purl').value.trim();
    if (pu) pieces.push({ nom: pn || 'pièce', url: pu });
    appel('repondre', { messageId: filCourant.id, texte: texte, pieces: pieces }).then(function(res){
      if (!res.ok || !res.j.ok) { $('rep-err').textContent = (res.j && res.j.erreur) || 'Envoi impossible.'; return; }
      $('ov-rep').classList.remove('on'); chargerMessages();
    }).catch(function(){ $('rep-err').textContent = 'Réseau indisponible.'; });
  }

  /* ---------- Accorder un accès ---------- */
  function accorder(){
    var email = $('g-mail').value.trim();
    if (!email) { $('g-err').textContent = 'Email requis.'; return; }
    var mats = matieresChoisies();
    if (!mats.length) { $('g-err').textContent = 'Sélectionnez au moins une matière.'; return; }
    $('g-err').textContent = '';
    appel('approuver', {
      prenom: $('g-prenom').value.trim(), nom: $('g-nom').value.trim(),
      email: email, numero: $('g-num').value.trim(),
      matieres: mats, avecCode: $('g-code').checked,
      demandeId: $('g-demande').value || null
    }).then(function(res){
      if (!res.ok || !res.j.ok) { $('g-err').textContent = (res.j && res.j.erreur) || 'Opération impossible.'; return; }
      $('g-err').textContent = 'Clé d\'activation envoyée ✔';
      selection = {}; rendreChips();
      $('g-prenom').value=''; $('g-nom').value=''; $('g-mail').value=''; $('g-num').value=''; $('g-extra').value=''; $('g-demande').value=''; $('g-code').checked=false;
      chargerDemandes();
    }).catch(function(){ $('g-err').textContent = 'Réseau indisponible.'; });
  }

  /* ---------- Invitation d'essai ---------- */
  function inviterEssai(){
    var email = $('e-mail').value.trim();
    if (!email) { $('e-err').textContent = 'Email requis.'; return; }
    $('e-err').textContent = '';
    appel('inviter_essai', { email: email }).then(function(res){
      if (!res.ok || !res.j.ok) { $('e-err').textContent = (res.j && res.j.erreur) || 'Envoi impossible.'; return; }
      $('e-err').textContent = 'Invitation envoyée ✔'; $('e-mail').value = '';
    }).catch(function(){ $('e-err').textContent = 'Réseau indisponible.'; });
  }

  /* ---------- Auth ---------- */
  function connexion(e){
    e.preventDefault();
    $('a-err').textContent = '';
    auth.signInWithEmailAndPassword($('a-mail').value.trim(), $('a-pass').value)
      .catch(function(){ $('a-err').textContent = 'Identifiants incorrects.'; });
  }

  document.addEventListener('DOMContentLoaded', function(){
    rendreChips();
    $('f-login').addEventListener('submit', connexion);
    $('deco').addEventListener('click', function(){ auth.signOut(); });
    $('rafr-dem').addEventListener('click', chargerDemandes);
    $('rafr-msg').addEventListener('click', chargerMessages);
    $('g-ok').addEventListener('click', accorder);
    $('e-ok').addEventListener('click', inviterEssai);
    $('rep-ok').addEventListener('click', envoyerReponse);
    $('rep-fermer').addEventListener('click', function(){ $('ov-rep').classList.remove('on'); });

    auth.onAuthStateChanged(function(user){
      if (user) {
        $('bloc-login').hidden = true; $('bloc-admin').hidden = false;
        $('deco').hidden = false; $('qui').textContent = user.email || '';
        chargerDemandes(); chargerMessages();
      } else {
        $('bloc-login').hidden = false; $('bloc-admin').hidden = true;
        $('deco').hidden = true; $('qui').textContent = '';
      }
    });
  });
})();
