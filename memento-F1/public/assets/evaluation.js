/* Mémento — évaluations (phase 5, côté interface).
   Les bonnes réponses ne sont jamais dans la page : on demande les questions à
   /api/evaluation (session vérifiée côté serveur), on envoie les réponses, et
   le serveur renvoie la note /20 + la correction. Tout le texte est inséré via
   textContent (aucun HTML injecté). */
(function () {
  function $(id){ return document.getElementById(id); }
  function qs(k){ return new URLSearchParams(location.search).get(k) || ''; }
  var MAT = qs('m');
  var API = '/api/evaluation';

  function el(tag, cls, txt){
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (txt != null) n.textContent = txt;
    return n;
  }
  function vider(n){ while (n.firstChild) n.removeChild(n.firstChild); }

  function getJSON(url){
    return fetch(url, { credentials: 'same-origin' })
      .then(function(r){ return r.json().then(function(j){ return { ok:r.ok, s:r.status, j:j }; }); });
  }
  function postJSON(url, corps){
    return fetch(url, {
      method: 'POST', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'mh' },
      body: JSON.stringify(corps)
    }).then(function(r){ return r.json().then(function(j){ return { ok:r.ok, s:r.status, j:j }; }); });
  }

  var mount;

  function rendreListe(evals){
    vider(mount);
    if (!evals || !evals.length) { mount.appendChild(el('p', 'aide', 'Aucune évaluation disponible pour le moment.')); return; }
    var ul = el('div', 'eval-liste');
    evals.forEach(function(e){
      var carte = el('div', 'eval-carte');
      carte.appendChild(el('h3', null, e.titre));
      if (e.chapitre) carte.appendChild(el('div', 'eval-meta', e.chapitre));
      carte.appendChild(el('div', 'eval-meta', e.nbQuestions + ' question(s) · noté sur ' + e.bareme));
      var b = el('button', 'btn', 'Commencer');
      b.type = 'button';
      b.addEventListener('click', function(){ ouvrirQuiz(e.id); });
      carte.appendChild(b);
      ul.appendChild(carte);
    });
    mount.appendChild(ul);
  }

  function ouvrirQuiz(quizId){
    getJSON(API + '?a=quiz&m=' + encodeURIComponent(MAT) + '&q=' + encodeURIComponent(quizId)).then(function(res){
      if (!res.ok || !res.j.ok) { rendreErreur(res); return; }
      rendreQuiz(res.j.quiz);
    }).catch(rendreReseau);
  }

  function rendreQuiz(quiz){
    vider(mount);
    var retour = el('button', 'btn mini ghost', '← Retour aux évaluations');
    retour.type = 'button';
    retour.addEventListener('click', charger);
    mount.appendChild(retour);
    mount.appendChild(el('h3', 'eval-titre', quiz.titre));
    var form = el('form', 'eval-form');
    (quiz.questions || []).forEach(function(q, i){
      var bloc = el('fieldset', 'eval-q');
      bloc.appendChild(el('legend', null, (i + 1) + '. ' + q.enonce));
      (q.options || []).forEach(function(opt, j){
        var lab = el('label', 'eval-opt');
        var inp = document.createElement('input');
        inp.type = 'radio'; inp.name = q.id; inp.value = String(j);
        lab.appendChild(inp);
        lab.appendChild(el('span', null, opt));
        bloc.appendChild(lab);
      });
      form.appendChild(bloc);
    });
    var msg = el('div', 'err');
    var envoyer = el('button', 'btn', 'Rendre ma copie');
    envoyer.type = 'submit';
    form.appendChild(msg);
    form.appendChild(envoyer);
    form.addEventListener('submit', function(ev){
      ev.preventDefault();
      var reponses = {};
      (quiz.questions || []).forEach(function(q){
        var choisi = form.querySelector('input[name="' + q.id + '"]:checked');
        if (choisi) reponses[q.id] = parseInt(choisi.value, 10);
      });
      envoyer.disabled = true; var lib = envoyer.textContent; envoyer.textContent = 'Correction…';
      postJSON(API + '?a=soumettre&m=' + encodeURIComponent(MAT), { q: quiz.id, reponses: reponses }).then(function(res){
        envoyer.disabled = false; envoyer.textContent = lib;
        if (!res.ok || !res.j.ok) { msg.textContent = (res.j && res.j.erreur) || 'Envoi impossible.'; return; }
        rendreCorrection(quiz, res.j.resultat);
      }).catch(function(){ envoyer.disabled = false; envoyer.textContent = lib; msg.textContent = 'Réseau indisponible, réessayez.'; });
    });
    mount.appendChild(form);
  }

  function rendreCorrection(quiz, r){
    vider(mount);
    var score = el('div', 'eval-score');
    score.appendChild(el('span', 'eval-note', r.note + ' / ' + r.sur));
    score.appendChild(el('span', 'eval-detail', r.bonnes + ' bonne(s) sur ' + r.total));
    mount.appendChild(score);
    var parId = {};
    (quiz.questions || []).forEach(function(q){ parId[q.id] = q; });
    (r.details || []).forEach(function(d, i){
      var q = parId[d.id] || { enonce: '', options: [] };
      var bloc = el('div', 'eval-corr ' + (d.correct ? 'ok' : 'ko'));
      bloc.appendChild(el('div', 'eval-corr-q', (i + 1) + '. ' + q.enonce));
      var votre = (d.choisi != null && q.options[d.choisi] != null) ? q.options[d.choisi] : 'Aucune réponse';
      bloc.appendChild(el('div', 'eval-corr-l', 'Votre réponse : ' + votre + (d.correct ? '  ✓' : '  ✗')));
      if (!d.correct && q.options[d.bonne] != null) bloc.appendChild(el('div', 'eval-corr-l bonne', 'Bonne réponse : ' + q.options[d.bonne]));
      if (d.explication) bloc.appendChild(el('div', 'eval-corr-exp', d.explication));
      mount.appendChild(bloc);
    });
    var rejouer = el('button', 'btn', 'Retour aux évaluations');
    rejouer.type = 'button';
    rejouer.addEventListener('click', charger);
    mount.appendChild(rejouer);
  }

  function rendreResultats(){
    getJSON(API + '?a=resultats&m=' + encodeURIComponent(MAT)).then(function(res){
      if (!res.ok || !res.j.ok) { rendreErreur(res); return; }
      vider(mount);
      var retour = el('button', 'btn mini ghost', '← Retour aux évaluations');
      retour.type = 'button'; retour.addEventListener('click', charger);
      mount.appendChild(retour);
      mount.appendChild(el('h3', 'eval-titre', 'Mes résultats'));
      var liste = res.j.resultats || [];
      if (!liste.length) { mount.appendChild(el('p', 'aide', 'Vous n\'avez pas encore rendu de copie.')); return; }
      var tbl = el('div', 'eval-histo');
      liste.forEach(function(x){
        var ligne = el('div', 'eval-histo-l');
        ligne.appendChild(el('span', 'h-titre', x.titre || x.quizId));
        ligne.appendChild(el('span', 'h-note', x.note + '/' + x.sur));
        var d = x.le ? new Date(x.le) : null;
        ligne.appendChild(el('span', 'h-date', d ? d.toLocaleDateString('fr-FR') : ''));
        tbl.appendChild(ligne);
      });
      mount.appendChild(tbl);
    }).catch(rendreReseau);
  }

  function rendreErreur(res){
    vider(mount);
    var msg = (res && res.j && res.j.erreur) || 'Accès refusé.';
    if (res && res.s === 401) msg = 'Session requise. Ouvrez votre lien personnel.';
    mount.appendChild(el('p', 'err', msg));
  }
  function rendreReseau(){ vider(mount); mount.appendChild(el('p', 'err', 'Réseau indisponible, réessayez.')); }

  function charger(){
    getJSON(API + '?a=liste&m=' + encodeURIComponent(MAT)).then(function(res){
      if (!res.ok || !res.j.ok) {
        // Pas d'évaluation / pas d'accès : on laisse le bloc masqué silencieusement.
        if (res.s === 404) return;
        if (res.s === 401 || res.s === 403) return;
        return;
      }
      $('bloc-eval').hidden = false;
      rendreListe(res.j.evaluations);
    }).catch(function(){});
  }

  document.addEventListener('DOMContentLoaded', function(){
    if (!MAT) return;
    mount = $('eval-mount');
    var vr = $('voir-resultats');
    if (vr) vr.addEventListener('click', rendreResultats);
    charger();
  });
})();
