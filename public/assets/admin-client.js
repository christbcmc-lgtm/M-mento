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
    }).then(function(r){ return r.json().then(function(j){ return { ok:r.ok, status:r.status, j:j }; },
      function(){ return { ok:r.ok, status:r.status, j:{} }; }); });
  }

  /* ---------- K1ter : bandeau d'erreur global (jamais d'erreur ignorée) ----------
     Toute réponse non OK de /api/admin est affichée dans un bandeau visible.
     401 -> « Session expirée, reconnectez-vous » ; 403 -> « Accès refusé » ;
     5xx -> « Erreur serveur » ; échec réseau (.catch) -> « Réseau indisponible ». */
  function elBandeau(){
    var b = $('bandeau');
    if (!b){
      b = document.createElement('div'); b.id = 'bandeau'; b.className = 'bandeau';
      b.setAttribute('role','alert'); b.setAttribute('aria-live','assertive'); b.hidden = true;
      if (document.body) document.body.insertBefore(b, document.body.firstChild);
    }
    return b;
  }
  function bandeau(message){ var b = elBandeau(); b.textContent = message; b.hidden = false; }
  function cacherBandeau(){ var b = $('bandeau'); if (b){ b.hidden = true; b.textContent = ''; } }
  function messagePourStatut(status){
    if (status === 401) return 'Session expirée, reconnectez-vous';
    if (status === 403) return 'Accès refusé';
    if (status >= 500) return 'Erreur serveur';
    return 'Erreur serveur';
  }
  // Renvoie true si l'appel a réussi ; sinon affiche le bandeau et renvoie false.
  function reponseOk(res){
    if (res && res.ok && res.j && res.j.ok) return true;
    bandeau(messagePourStatut(res ? res.status : 500));
    return false;
  }
  function erreurReseau(){ bandeau('Réseau indisponible'); }

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
      if (!reponseOk(res)) { rendreChips(); return false; }
      MATIERES_DEF = res.j.matieres || [];
      rendreChips();
      return true;
    }).catch(function(){ erreurReseau(); rendreChips(); return false; });
  }
  function matieresChoisies(){
    return Object.keys(selection).filter(function(k){ return selection[k]; });
  }

  /* ---------- Tableau de bord ---------- */
  function chargerStats(){
    return appel('stats').then(function(res){
      if (!reponseOk(res)) return false;
      var s = res.j.stats;
      $('s-dem').textContent = s.demandes; $('s-dem-a').textContent = s.demandesEnAttente + ' en attente';
      $('s-mem').textContent = s.membres; $('s-mem-a').textContent = s.membresActifs + ' actifs';
      $('s-msg').textContent = s.messages; $('s-msg-a').textContent = s.messagesOuverts + ' ouverts';
      return true;
    }).catch(function(){ erreurReseau(); return false; });
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

      // I4 : actions sur la fiche membre (vider les appareils / régénérer le lien).
      var nomM = ((m.prenom||'') + ' ' + (m.nom||'')).trim() || (m.email||'ce membre');
      var msg = document.createElement('div'); msg.className = 'sous';
      msg.setAttribute('role','status'); msg.setAttribute('aria-live','polite');
      var act = document.createElement('div'); act.className = 'actions';

      // Lance une action admin confirmée, avec garde-fou anti double-clic et message de résultat.
      function lancer(bouton, question, action, succes){
        if (!window.confirm(question)) return;
        var label = bouton.textContent;
        bouton.disabled = true; bouton.textContent = '…'; msg.textContent = '';
        appel(action, { membreId: m.id }).then(function(res){
          bouton.disabled = false; bouton.textContent = label;
          if (res.ok && res.j && res.j.ok) {
            msg.textContent = '✔ ' + succes(res.j.appareilsSupprimes || 0);
          } else {
            msg.textContent = '✗ Échec : ' + ((res.j && res.j.erreur) || 'opération impossible.');
          }
        }).catch(function(){
          bouton.disabled = false; bouton.textContent = label;
          msg.textContent = '✗ Échec : réseau indisponible.';
        });
      }

      var bVid = document.createElement('button'); bVid.className = 'btn mini ghost'; bVid.textContent = 'Vider les appareils';
      bVid.addEventListener('click', function(){
        lancer(bVid,
          'Vider tous les appareils enregistrés de ' + nomM + ' ?\nLe membre devra rouvrir une session sur ses appareils.',
          'vider_appareils',
          function(n){ return n + ' appareil(s) fermé(s).'; });
      });
      act.appendChild(bVid);

      var bReg = document.createElement('button'); bReg.className = 'btn mini ghost'; bReg.textContent = 'Régénérer le lien';
      bReg.addEventListener('click', function(){
        lancer(bReg,
          'Régénérer le lien d\'accès de ' + nomM + ' ?\nL\'ancien lien cesse de fonctionner, les appareils sont fermés, et un nouveau lien est envoyé par email.',
          'regenerer_lien',
          function(n){ return 'Nouveau lien envoyé par email' + (n ? ' • ' + n + ' appareil(s) fermé(s)' : '') + '.'; });
      });
      act.appendChild(bReg);

      el.appendChild(act); el.appendChild(msg);
      box.appendChild(el);
    });
  }
  function chargerMembres(){
    return appel('list_membres').then(function(res){
      if (!reponseOk(res)) return false;
      rendreMembres(res.j.membres);
      return true;
    }).catch(function(){ erreurReseau(); return false; });
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
    return appel('list_demandes').then(function(res){
      if (!reponseOk(res)) return false;
      rendreDemandes(res.j.demandes);
      return true;
    }).catch(function(){ erreurReseau(); return false; });
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
    return appel('list_messages').then(function(res){
      if (!reponseOk(res)) return false;
      rendreMessages(res.j.fils);
      return true;
    }).catch(function(){ erreurReseau(); return false; });
  }

  function ouvrirReponse(f){
    filCourant = f;
    $('rep-dest').textContent = (f.nom || '') + ' — ' + (f.email || '');
    $('rep-txt').value = ''; $('rep-pnom').value = ''; $('rep-purl').value = ''; $('rep-err').textContent = '';
    var fil = $('rep-fil'); fil.innerHTML = '';
    (f.items || []).forEach(function(it){
      var b = document.createElement('div');
      b.className = 'bulle ' + (it.de === 'admin' ? 'moi' : 'lui');
      var txt = document.createElement('span');
      txt.textContent = it.texte || '';
      b.appendChild(txt);
      // K7 : afficher les ressources jointes (PDF/livres) comme liens cliquables.
      // Liens posés via la propriété DOM .href (pas d'injection d'attribut) et
      // restreints à https:// (défense en profondeur, miroir de validerPieces).
      (it.pieces || []).forEach(function(p){
        if (!p || !/^https:\/\//i.test(String(p.url || ''))) return;
        var a = document.createElement('a');
        a.className = 'pj';
        a.href = p.url;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.textContent = '📎 ' + (p.nom || 'pièce');
        b.appendChild(a);
      });
      var meta = document.createElement('span');
      meta.className = 'meta';
      meta.textContent = (it.de === 'admin' ? 'Vous' : 'Membre') + ' • ' + dateFr(it.le);
      b.appendChild(meta);
      fil.appendChild(b);
    });
    fil.scrollTop = fil.scrollHeight;
    $('ov-rep').classList.add('on');
  }
  function envoyerReponse(){
    var texte = $('rep-txt').value.trim();
    var pieces = [];
    var pn = $('rep-pnom').value.trim(), pu = $('rep-purl').value.trim();
    if (pu) pieces.push({ nom: pn || 'pièce', url: pu });
    // K7 : l'admin peut envoyer une ressource (PDF) SEULE, sans texte.
    if (!texte && !pieces.length) { $('rep-err').textContent = 'Message ou ressource requis.'; return; }
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
    appel('accorder_essai', { email: email }).then(function(res){
      if (!res.ok || !res.j.ok) { $('e-err').textContent = (res.j && res.j.erreur) || 'Envoi impossible.'; return; }
      $('e-err').textContent = 'Essai accordé ✔ (lien envoyé par email)';
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

  /* ---------- K1ter : console + vérification d'email ----------
     demarrerConsole(user)  : affiche la console et lance les chargements.
     afficherVerif(user)    : affiche/masque le bandeau « email non vérifié » et
                              câble l'envoi de l'email et la re-vérification. */
  function demarrerConsole(user){
    $('bloc-login').hidden = true; $('bloc-admin').hidden = false;
    $('deco').hidden = false; $('qui').textContent = user.email || '';
    // chargerMatieres doit précéder chargerMembres (noms de matières) et traiterHash.
    chargerMatieres().then(function(okMat){
      traiterHash();
      return Promise.all([ okMat, chargerMembres(), chargerStats(), chargerDemandes(), chargerMessages() ]);
    }).then(function(resultats){
      // K1quater (1) : si TOUTE la série de chargements réussit, on efface le
      // bandeau d'erreur éventuellement laissé par un échec précédent.
      if (resultats.every(Boolean)) cacherBandeau();
    });
  }

  // K1quater (1) : « Tout rafraîchir » — on masque d'abord le bandeau, puis on le
  // réaffiche seulement si un appel échoue ; s'ils réussissent tous, il reste caché.
  function rafraichirTout(){
    cacherBandeau();
    Promise.all([ chargerStats(), chargerDemandes(), chargerMessages(), chargerMembres() ])
      .then(function(resultats){ if (resultats.every(Boolean)) cacherBandeau(); });
  }

  function afficherVerif(user){
    var b = $('bandeau-verif');
    if (!b) return;
    if (!user || user.emailVerified) { b.hidden = true; return; }
    b.hidden = false;
    var msg = $('verif-msg'); if (msg) msg.textContent = '';

    var bEnvoyer = $('verif-envoyer');
    if (bEnvoyer && !bEnvoyer._cable){
      bEnvoyer._cable = true;
      bEnvoyer.addEventListener('click', function(){
        var u = auth.currentUser; if (!u) return;
        bEnvoyer.disabled = true; if (msg) msg.textContent = 'Envoi…';
        u.sendEmailVerification().then(function(){
          if (msg) msg.textContent = 'Email de vérification envoyé. Vérifiez votre boîte de réception.';
        }).catch(function(){
          if (msg) msg.textContent = 'Envoi impossible pour le moment.';
        }).then(function(){ bEnvoyer.disabled = false; });
      });
    }

    var bRecheck = $('verif-recheck');
    if (bRecheck && !bRecheck._cable){
      bRecheck._cable = true;
      bRecheck.addEventListener('click', function(){
        var u = auth.currentUser; if (!u) return;
        bRecheck.disabled = true; if (msg) msg.textContent = 'Vérification…';
        u.reload().then(function(){ return u.getIdToken(true); }).then(function(){
          var cur = auth.currentUser;
          if (cur && cur.emailVerified) {
            // K1quater (2) : email désormais vérifié → on masque les deux bandeaux
            // et on relance la console pour recharger stats/demandes/messages/
            // membres/matières avec un jeton frais.
            afficherVerif(cur);
            cacherBandeau();
            demarrerConsole(cur);
          }
          else if (msg) { msg.textContent = 'Toujours non vérifié. Cliquez sur le lien reçu par email.'; }
        }).catch(function(){
          if (msg) msg.textContent = 'Vérification impossible pour le moment.';
        }).then(function(){ bRecheck.disabled = false; });
      });
    }
  }

  document.addEventListener('DOMContentLoaded', function(){
    rendreChips();
    $('f-login').addEventListener('submit', connexion);
    $('deco').addEventListener('click', function(){ auth.signOut(); });
    $('rafr-dem').addEventListener('click', function(){ cacherBandeau(); chargerDemandes(); });
    $('rafr-msg').addEventListener('click', function(){ cacherBandeau(); chargerMessages(); });
    $('rafr-mem').addEventListener('click', function(){ cacherBandeau(); chargerMembres(); });
    $('rafr-tout').addEventListener('click', function(){ rafraichirTout(); });
    $('g-ok').addEventListener('click', accorder);
    window.addEventListener('hashchange', function(){ if (!$('bloc-admin').hidden) traiterHash(); });
    $('e-ok').addEventListener('click', inviterEssai);
    $('e-lien-copy').addEventListener('click', function(){ copier($('e-lien-url'), this); });
    $('rep-ok').addEventListener('click', envoyerReponse);
    $('rep-fermer').addEventListener('click', function(){ $('ov-rep').classList.remove('on'); });

    auth.onAuthStateChanged(function(user){
      if (user) {
        demarrerConsole(user);
        afficherVerif(user);
      } else {
        $('bloc-login').hidden = false; $('bloc-admin').hidden = true;
        $('deco').hidden = true; $('qui').textContent = '';
        var bv = $('bandeau-verif'); if (bv) bv.hidden = true;
        cacherBandeau();
      }
    });
  });
})();
