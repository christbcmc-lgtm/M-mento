/* Mémento — console d'administration (Firebase Auth compat).
   Toutes les actions passent par POST /api/admin avec un jeton Firebase (Bearer). */
(function () {
  function $(id){ return document.getElementById(id); }
  function esc(s){ var d=document.createElement('div'); d.textContent=(s==null?'':String(s)); return d.innerHTML; }
  function dateFr(v){ try{ var d=new Date(v&&v._seconds?v._seconds*1000:v); return isNaN(d)?'':d.toLocaleString('fr-FR'); }catch(e){ return ''; } }

  var MATIERES_DEF = [];
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

  /* ---------- Chips matières (chargées depuis le catalogue réel) ---------- */
  function rendreChips(){
    var box = $('g-chips'); box.innerHTML = '';
    if (!MATIERES_DEF.length) { box.innerHTML = '<span class="aide">Aucune matière déclarée dans le catalogue.</span>'; return; }
    MATIERES_DEF.forEach(function(m){
      var c = document.createElement('span');
      c.className = 'chip' + (selection[m.id] ? ' on' : '');
      c.textContent = m.nom;
      c.setAttribute('role','button'); c.tabIndex = 0;
      c.addEventListener('click', function(){
        selection[m.id] = !selection[m.id];
        c.classList.toggle('on');
      });
      box.appendChild(c);
    });
  }
  function chargerMatieres(){
    return appel('list_matieres').then(function(res){
      if (res.ok && res.j.ok) { MATIERES_DEF = res.j.matieres || []; }
      rendreChips();
    }).catch(function(){ rendreChips(); });
  }
  function matieresChoisies(){
    return Object.keys(selection).filter(function(k){ return selection[k]; });
  }

  /* ---------- Tableau de bord ---------- */
  function chargerStats(){
    appel('stats').then(function(res){
      if (!res.ok || !res.j.ok) return;
      var s = res.j.stats;
      $('s-dem').textContent = s.demandes; $('s-dem-a').textContent = s.demandesEnAttente + ' en attente';
      $('s-mem').textContent = s.membres; $('s-mem-a').textContent = s.membresActifs + ' actifs';
      $('s-msg').textContent = s.messages; $('s-msg-a').textContent = s.messagesOuverts + ' ouverts';
    });
  }

  /* ---------- Membres ---------- */
  function nomMatiere(id){ for (var i=0;i<MATIERES_DEF.length;i++){ if (MATIERES_DEF[i].id===id) return MATIERES_DEF[i].nom; } return id; }
  function rendreMembres(list){
    var box = $('liste-mem'); box.innerHTML = '';
    if (!list || !list.length) { box.innerHTML = '<div class="vide">Aucun membre.</div>'; return; }
    list.forEach(function(m){
      var el = document.createElement('div'); el.className = 'ligne';
      var mats = (m.matieres||[]).map(nomMatiere).join(', ') || '—';
      var badge = m.statut === 'actif' ? '✔ actif' : (m.statut === 'cle_emise' ? '⏳ clé émise' : esc(m.statut));
      el.innerHTML = '<b>' + esc((m.prenom||'') + ' ' + (m.nom||'')) + '</b>' +
        '<div class="sous">' + esc(m.email||'') + ' • ' + badge + ' • ' + (m.compteurAcces||0) + ' accès</div>' +
        '<div class="sous">Matières : ' + esc(mats) + '</div>';
      box.appendChild(el);
    });
  }
  function chargerMembres(){
    appel('list_membres').then(function(res){ if (res.ok && res.j.ok) rendreMembres(res.j.membres); });
  }

  /* ---------- Demandes ---------- */
  function rendreDemandes(list){
    var box = $('liste-dem'); box.innerHTML = '';
    if (!list || !list.length) { box.innerHTML = '<div class="vide">Aucune demande.</div>'; return; }
    list.forEach(function(d){
      var el = document.createElement('div');
      el.className = 'ligne';
      var statut = d.statut === 'traitee' ? ' • traitée' : (d.statut === 'rejetee' ? ' • rejetée' : '');
      el.innerHTML = '<b>' + esc((d.prenom||'') + ' ' + (d.nom||'')) + '</b>' +
        '<div class="sous">' + esc(d.email||'') + ' • ' + dateFr(d.creeLe) + statut + '</div>' +
        (d.message ? '<div class="sous">« ' + esc(d.message) + ' »</div>' : '');
      var act = document.createElement('div'); act.className = 'actions';
      var b = document.createElement('button'); b.className = 'btn mini'; b.textContent = 'Préparer l\'activation';
      b.addEventListener('click', function(){
        $('g-prenom').value = d.prenom || ''; $('g-nom').value = d.nom || '';
        $('g-mail').value = d.email || ''; $('g-num').value = d.numero || '';
        $('g-demande').value = d.id || '';
        selection = {};
        (d.matieres || []).forEach(function(k){ selection[k] = true; });
        rendreChips();
        $('g-ok').scrollIntoView({ behavior:'smooth', block:'center' });
      });
      act.appendChild(b);
      var r = document.createElement('button'); r.className = 'btn mini ghost'; r.textContent = 'Rejeter';
      r.addEventListener('click', function(){
        var motif = window.prompt('Motif du refus (facultatif, visible par le demandeur) :', '') ;
        if (motif === null) return;
        r.disabled = true; r.textContent = '…';
        appel('rejeter', { demandeId: d.id, email: d.email, motif: motif }).then(function(res){
          if (res.ok && res.j.ok) { chargerDemandes(); chargerStats(); }
          else { r.disabled = false; r.textContent = 'Rejeter'; }
        }).catch(function(){ r.disabled = false; r.textContent = 'Rejeter'; });
      });
      act.appendChild(r);
      el.appendChild(act); box.appendChild(el);
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
    if (!mats.length) { $('g-err').textContent = 'Cochez au moins une matière.'; return; }
    $('g-err').textContent = '';
    var demandeId = $('g-demande').value || '';
    // G4 : l'approbation passe exclusivement par le nouveau modèle approuver_nm
    // (clé unique + code 8 car.). Une demande est obligatoire ; il n'y a plus de
    // chemin « approuver » legacy côté serveur.
    if (!demandeId) { $('g-err').textContent = 'Sélectionnez une demande à approuver.'; return; }
    // G3 : paramètres d'accès transmis à l'approbation.
    var dureeSel = $('g-duree') ? $('g-duree').value : '30';
    var dureeJours;
    if (dureeSel === 'perso') {
      dureeJours = parseInt($('g-duree-perso') ? $('g-duree-perso').value : '', 10);
      if (!(dureeJours > 0)) { $('g-err').textContent = 'Durée personnalisée invalide.'; return; }
    } else {
      dureeJours = parseInt(dureeSel, 10) || 30;
    }
    var maxAppareils = ($('g-appareils') && $('g-appareils').value === '2') ? 2 : 1;
    var quotaHeures = $('g-quota') ? (parseInt($('g-quota').value, 10) || 0) : 0;
    appel('approuver_nm', {
      demandeId: demandeId, matieres: mats,
      dureeJours: dureeJours, maxAppareils: maxAppareils, quotaHeures: quotaHeures
    }).then(function(res){
      if (!res.ok || !res.j.ok) { $('g-err').textContent = (res.j && res.j.erreur) || 'Opération impossible.'; return; }
      $('g-err').textContent = 'Clé d\'activation envoyée ✔';
      selection = {}; rendreChips();
      $('g-prenom').value=''; $('g-nom').value=''; $('g-mail').value=''; $('g-num').value=''; $('g-demande').value=''; $('g-code').checked=true;
      if (location.hash) location.hash = '';
      chargerDemandes(); chargerMembres(); chargerStats();
    }).catch(function(){ $('g-err').textContent = 'Réseau indisponible.'; });
  }

  /* ---------- Invitation d'essai ---------- */
  function inviterEssai(){
    var email = $('e-mail').value.trim();
    if (!email) { $('e-err').textContent = 'Email requis.'; return; }
    $('e-err').textContent = ''; $('e-lien').hidden = true;
    appel('inviter_essai', { email: email }).then(function(res){
      if (!res.ok || !res.j.ok) { $('e-err').textContent = (res.j && res.j.erreur) || 'Envoi impossible.'; return; }
      $('e-err').textContent = 'Invitation envoyée ✔';
      if (res.j.lien) { $('e-lien-url').value = res.j.lien; $('e-lien').hidden = false; }
      $('e-mail').value = '';
    }).catch(function(){ $('e-err').textContent = 'Réseau indisponible.'; });
  }
  function copier(input, bouton){
    try { input.select(); input.setSelectionRange(0, 99999); } catch(e){}
    var done = function(){ var t=bouton.textContent; bouton.textContent='Copié ✔'; setTimeout(function(){ bouton.textContent=t; }, 1500); };
    if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(input.value).then(done, function(){ try{document.execCommand('copy');}catch(e){} done(); }); }
    else { try{document.execCommand('copy');}catch(e){} done(); }
  }

  /* ---------- Finalisation d'une demande depuis le lien de décision (#/valider/<id>) ---------- */
  function traiterHash(){
    var m = (location.hash || '').match(/^#\/valider\/(.+)$/);
    if (!m) return;
    var id = decodeURIComponent(m[1]);
    appel('list_demandes').then(function(res){
      if (!res.ok || !res.j.ok) return;
      var d = (res.j.demandes || []).filter(function(x){ return x.id === id; })[0];
      if (!d) { $('g-err').textContent = 'Demande introuvable ou déjà traitée.'; return; }
      $('g-prenom').value = d.prenom || ''; $('g-nom').value = d.nom || '';
      $('g-mail').value = d.email || ''; $('g-num').value = d.numero || '';
      $('g-demande').value = d.id || '';
      selection = {};
      (d.matieres || []).forEach(function(k){ selection[k] = true; });
      rendreChips();
      $('g-ok').scrollIntoView({ behavior:'smooth', block:'center' });
    });
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
    $('rafr-mem').addEventListener('click', chargerMembres);
    $('rafr-tout').addEventListener('click', function(){ chargerStats(); chargerDemandes(); chargerMessages(); chargerMembres(); });
    $('g-ok').addEventListener('click', accorder);
    window.addEventListener('hashchange', function(){ if (!$('bloc-admin').hidden) traiterHash(); });
    $('e-ok').addEventListener('click', inviterEssai);
    $('e-lien-copy').addEventListener('click', function(){ copier($('e-lien-url'), this); });
    $('rep-ok').addEventListener('click', envoyerReponse);
    $('rep-fermer').addEventListener('click', function(){ $('ov-rep').classList.remove('on'); });

    auth.onAuthStateChanged(function(user){
      if (user) {
        $('bloc-login').hidden = true; $('bloc-admin').hidden = false;
        $('deco').hidden = false; $('qui').textContent = user.email || '';
        chargerMatieres().then(function(){ chargerMembres(); traiterHash(); });
        chargerStats(); chargerDemandes(); chargerMessages();
      } else {
        $('bloc-login').hidden = false; $('bloc-admin').hidden = true;
        $('deco').hidden = true; $('qui').textContent = '';
      }
    });
  });
})();
