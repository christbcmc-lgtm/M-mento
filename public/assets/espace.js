/* Mémento — espace membre (phase 6 : modèle COOKIE).
   1) le lien personnel (?t=) est échangé UNE fois contre un cookie de session ;
   2) le profil et les matières sont lus via des endpoints protégés côté serveur ;
   3) le déverrouillage d'appareil et la messagerie passent par le cookie.
   Aucun gestionnaire en ligne ; tout le texte dynamique via textContent. */
(function () {
  function $(id){ return document.getElementById(id); }
  function qs(k){ return new URLSearchParams(location.search).get(k) || ''; }
  function dateFr(v){ try{ var d=new Date(typeof v==='number'?v:(v&&v._seconds?v._seconds*1000:v)); return isNaN(d)?'':d.toLocaleString('fr-FR'); }catch(e){ return ''; } }
  function el(tag, cls, txt){ var n=document.createElement(tag); if(cls)n.className=cls; if(txt!=null)n.textContent=txt; return n; }
  function vider(n){ while(n.firstChild) n.removeChild(n.firstChild); }

  var ENTETE = { 'Content-Type': 'application/json', 'X-Requested-With': 'mh' };
  function getJSON(url){ return fetch(url, { credentials:'same-origin' }).then(function(r){ return r.json().then(function(j){ return {ok:r.ok,s:r.status,j:j}; }); }); }
  function postJSON(url, corps){ return fetch(url, { method:'POST', credentials:'same-origin', headers:ENTETE, body:JSON.stringify(corps||{}) }).then(function(r){ return r.json().then(function(j){ return {ok:r.ok,s:r.status,j:j}; }); }); }

  function montrerErreur(msg){ $('espace').hidden = true; var b=$('bloc-erreur'); b.hidden=false; if(msg)$('txt-erreur').textContent=msg; }

  /* ---------- Matières ---------- */
  function carte(m){
    var div = el('div', 'carte' + (m.disponible ? '' : ' verrou'));
    div.appendChild(el('span', 'cadenas', m.disponible ? '\uD83D\uDCD6' : '\uD83D\uDD12'));
    div.appendChild(el('h3', null, m.titre));
    div.appendChild(el('div', 'etat', m.disponible ? 'Ouverte' : 'Bient\u00f4t disponible'));
    if (m.disponible) div.addEventListener('click', function(){ location.href = 'matiere.html?m=' + encodeURIComponent(m.id); });
    return div;
  }
  function rendreGrille(matieres){
    var g = $('grille'); vider(g);
    if (!matieres || !matieres.length) { g.appendChild(el('p','aide','Aucune mati\u00e8re incluse dans votre acc\u00e8s pour le moment.')); return; }
    matieres.forEach(function(m){ g.appendChild(carte(m)); });
  }

  /* ---------- Déverrouillage d'appareil (code 12 h) ---------- */
  function ouvrirModale(){
    $('code-val').value=''; $('code-err').textContent='';
    var z=$('reset-zone'); if(z) z.hidden=true;
    var b=$('code-reset'); if(b) b.hidden=false;
    if($('code-email')) $('code-email').value='';
    if($('code-numero')) $('code-numero').value='';
    $('ov-code').classList.add('on');
  }
  function fermerModale(){ $('ov-code').classList.remove('on'); }
  function majVerrou(deverrouille){
    var b = $('btn-verrou'); if(!b) return;
    b.hidden = false;
    b.textContent = deverrouille ? 'Appareil d\u00e9verrouill\u00e9' : 'D\u00e9verrouiller';
  }
  function validerCode(){
    var code = $('code-val').value.trim();
    if (!code) { $('code-err').textContent = 'Saisissez le code.'; return; }
    postJSON('/api/auth?a=code', { code: code }).then(function(res){
      if (!res.ok || !res.j.ok) { $('code-err').textContent = (res.j && res.j.erreur) || 'Code incorrect.'; return; }
      fermerModale(); majVerrou(true);
    }).catch(function(){ $('code-err').textContent = 'R\u00e9seau indisponible.'; });
  }
  function montrerReset(){
    var z = $('reset-zone'); if (z) z.hidden = false;
    var b = $('code-reset'); if (b) b.hidden = true;
    $('code-err').textContent = '';
  }
  function renvoyerCode(){
    // Voie PUBLIQUE (F2/F3) : email + numéro ; le code part à l'adresse enregistrée.
    var email = ($('code-email') && $('code-email').value.trim()) || '';
    var numero = ($('code-numero') && $('code-numero').value.trim()) || '';
    if (!email || !numero) { $('code-err').textContent = 'Indiquez votre email et votre num\u00e9ro.'; return; }
    postJSON('/api/public?a=code-reset', { email: email, numero: numero }).then(function(res){
      $('code-err').textContent = (res.j && res.j.message) || 'Si les informations correspondent, un nouveau code a \u00e9t\u00e9 envoy\u00e9.';
    }).catch(function(){ $('code-err').textContent = 'R\u00e9seau indisponible.'; });
  }

  /* ---------- Messagerie ---------- */
  function rendreFil(items){
    var f = $('fil'); vider(f);
    if (!items || !items.length) { f.appendChild(el('div','vide','Aucun message pour le moment.')); return; }
    items.forEach(function(it){
      var b = el('div', 'bulle ' + (it.de === 'membre' ? 'moi' : 'lui'));
      b.appendChild(el('span', 'txt', it.texte));
      (it.pieces || []).forEach(function(p){
        if (!p || !p.url) return;
        var a = document.createElement('a'); a.className='piece'; a.href=p.url; a.target='_blank'; a.rel='noopener';
        a.textContent = '\uD83D\uDCCE ' + (p.nom || 'pi\u00e8ce');
        b.appendChild(document.createElement('br')); b.appendChild(a);
      });
      b.appendChild(el('span', 'meta', (it.de === 'membre' ? 'Vous' : 'Administrateur') + ' \u00b7 ' + dateFr(it.le)));
      f.appendChild(b);
    });
    f.scrollTop = f.scrollHeight;
  }
  function chargerFil(){ getJSON('/api/message').then(function(res){ if(res.ok && res.j.ok) rendreFil(res.j.items); }).catch(function(){}); }
  function envoyerMsg(e){
    e.preventDefault();
    var txt = $('m-txt').value.trim();
    if (!txt) { $('m-err').textContent = 'Message vide.'; return; }
    $('m-err').textContent = '';
    postJSON('/api/message', { texte: txt }).then(function(res){
      if (!res.ok || !res.j.ok) { $('m-err').textContent = (res.j && res.j.erreur) || 'Envoi impossible.'; return; }
      $('m-txt').value = ''; chargerFil();
    }).catch(function(){ $('m-err').textContent = 'R\u00e9seau indisponible.'; });
  }

  /* ---------- Démarrage ---------- */
  function demarrer(){
    // Profil via cookie (accès recontrôlé serveur), titres via /api/contenu?a=profil.
    getJSON('/api/auth?a=acces').then(function(res){
      if (!res.ok || !res.j.ok) { montrerErreur('Session requise. Ouvrez votre lien personnel.'); return; }
      $('espace').hidden = false;
      var pr = res.j.profil || {};
      $('bonjour').textContent = 'Bonjour ' + ((pr.prenom || pr.nom || '')).trim();
      majVerrou(!!res.j.deverrouille);
      return getJSON('/api/contenu?a=profil').then(function(r2){
        rendreGrille((r2.ok && r2.j.ok) ? r2.j.matieres : []);
        chargerFil();
      });
    }).catch(function(){ montrerErreur('R\u00e9seau indisponible, r\u00e9essayez.'); });
  }

  document.addEventListener('DOMContentLoaded', function(){
    $('f-msg').addEventListener('submit', envoyerMsg);
    $('code-ok').addEventListener('click', validerCode);
    $('code-fermer').addEventListener('click', fermerModale);
    $('code-reset').addEventListener('click', montrerReset);
    var cro = $('code-reset-ok'); if (cro) cro.addEventListener('click', renvoyerCode);
    var bv = $('btn-verrou'); if (bv) bv.addEventListener('click', ouvrirModale);
    var bd = $('btn-deco'); if (bd) bd.addEventListener('click', function(){ postJSON('/api/auth?a=deconnexion', {}).then(function(){ location.href='index.html'; }).catch(function(){ location.href='index.html'; }); });

    var TOKEN = qs('t');
    if (TOKEN) {
      // Échange UNIQUE du lien personnel contre un cookie de session, puis URL nettoy\u00e9e.
      getJSON('/api/auth?a=session&t=' + encodeURIComponent(TOKEN)).then(function(res){
        try { history.replaceState(null, '', 'espace.html'); } catch (e) {}
        if (!res.ok || !res.j.ok) { montrerErreur((res.j && res.j.erreur) || 'Lien invalide ou expir\u00e9.'); return; }
        demarrer();
      }).catch(function(){ montrerErreur('R\u00e9seau indisponible, r\u00e9essayez.'); });
    } else {
      demarrer();
    }
  });
})();
