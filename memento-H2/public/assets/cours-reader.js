/* Mémento — moteur de lecture des cours.
   Rend un objet "cours" (chapitres > sections > étapes) avec :
   - formules KaTeX dans le fil, chacune numérotée (F1, F2, …) et reliée par des liens ;
   - explications détaillées masquées (couche repliable) pour ne pas alourdir ;
   - navigateur d'étapes intelligent et discret (avant / arrière, clavier, auto-masquage).
   Aucun gestionnaire d'événement en ligne : tout est attaché ici. */
(function (global) {
  'use strict';

  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  function mathInline(root) {
    if (!global.katex) return;
    root.querySelectorAll('span.m').forEach(function (s) {
      try { global.katex.render(s.textContent, s, { throwOnError: false }); }
      catch (e) { /* on laisse le texte brut */ }
    });
  }
  function renderFormule(f) {
    var wrap = el('figure', 'formule');
    wrap.id = 'f-' + f.id;
    var body = el('div', 'f-body');
    if (global.katex) {
      try { global.katex.render(f.tex, body, { displayMode: true, throwOnError: false }); }
      catch (e) { body.textContent = f.tex; }
    } else { body.textContent = f.tex; }
    wrap.appendChild(body);
    wrap.appendChild(el('span', 'f-tag', f.id));
    if (f.leg) wrap.appendChild(el('figcaption', 'f-leg', f.leg));
    return wrap;
  }

  // ---- Rendu du cours ----
  function render(cours, mount) {
    mount.innerHTML = '';
    var head = el('div', 'cours-head');
    head.appendChild(el('h1', 'cours-titre', cours.titre));
    if (cours.sous) head.appendChild(el('p', 'cours-sous', cours.sous));
    mount.appendChild(head);

    var etapes = [];
    (cours.chapitres || []).forEach(function (ch) {
      var secCh = el('section', 'chapitre');
      secCh.appendChild(el('h2', 'chapitre-t', ch.titre));
      (ch.sections || []).forEach(function (sc) {
        var sec = el('section', 'sous-section');
        if (sc.titre) sec.appendChild(el('h3', 'section-t', sc.titre));
        (sc.steps || []).forEach(function (st) {
          var n = etapes.length + 1;
          var bloc = el('div', 'etape');
          bloc.id = 'e-' + n;
          bloc.setAttribute('data-n', n);
          if (st.html) {
            var corps = el('div', 'etape-corps', st.html);
            mathInline(corps);
            bloc.appendChild(corps);
          }
          (st.formules || []).forEach(function (f) { bloc.appendChild(renderFormule(f)); });
          if (st.detail) {
            var d = el('details', 'explic');
            d.appendChild(el('summary', null, st.detailTitre || 'Comprendre — détail'));
            var dc = el('div', 'explic-corps', st.detail);
            mathInline(dc);
            (st.detailFormules || []).forEach(function (f) { dc.appendChild(renderFormule(f)); });
            d.appendChild(dc);
            bloc.appendChild(d);
          }
          sec.appendChild(bloc);
          etapes.push(bloc);
        });
        secCh.appendChild(sec);
      });
      mount.appendChild(secCh);
    });

    liensFormules(mount);
    navigateur(etapes);
    return etapes.length;
  }

  // ---- Liens vers les formules : défilement doux + mise en évidence ----
  function liensFormules(mount) {
    mount.querySelectorAll('a.fref').forEach(function (a) {
      a.addEventListener('click', function (ev) {
        var id = (a.getAttribute('href') || '').replace('#', '');
        var cible = document.getElementById(id);
        if (!cible) return;
        ev.preventDefault();
        cible.scrollIntoView({ behavior: 'smooth', block: 'center' });
        cible.classList.remove('flash');
        void cible.offsetWidth;
        cible.classList.add('flash');
      });
    });
  }

  // ---- Navigateur d'étapes intelligent et discret ----
  function navigateur(etapes) {
    var ancien = document.getElementById('nav-etapes');
    if (ancien) ancien.remove();
    if (!etapes.length) return;
    if (document.body.getAttribute('data-sensible') === '1') return;

    var cur = 0, idle = null;
    var bar = el('div', 'nav-etapes');
    bar.id = 'nav-etapes';
    bar.setAttribute('role', 'navigation');
    bar.setAttribute('aria-label', 'Étapes du cours');
    var prev = el('button', 'ne-btn', '‹');
    prev.title = 'Étape précédente (←)'; prev.setAttribute('aria-label', 'Étape précédente');
    var lab = el('span', 'ne-lab', '');
    var next = el('button', 'ne-btn', '›');
    next.title = 'Étape suivante (→)'; next.setAttribute('aria-label', 'Étape suivante');
    var prog = el('div', 'ne-prog'); var fill = el('i'); prog.appendChild(fill);
    bar.appendChild(prev); bar.appendChild(lab); bar.appendChild(next); bar.appendChild(prog);
    document.body.appendChild(bar);

    function maj() {
      lab.textContent = 'Étape ' + (cur + 1) + ' / ' + etapes.length;
      fill.style.width = ((cur + 1) / etapes.length * 100) + '%';
      prev.disabled = (cur === 0);
      next.disabled = (cur === etapes.length - 1);
      etapes.forEach(function (b, i) { b.classList.toggle('etape-active', i === cur); });
    }
    function aller(i, scroll) {
      cur = Math.max(0, Math.min(etapes.length - 1, i));
      maj();
      if (scroll) {
        var b = etapes[cur];
        b.scrollIntoView({ behavior: 'smooth', block: 'center' });
        b.classList.remove('flash'); void b.offsetWidth; b.classList.add('flash');
      }
      reveille();
    }
    prev.addEventListener('click', function () { aller(cur - 1, true); });
    next.addEventListener('click', function () { aller(cur + 1, true); });

    // clavier (ignore la saisie dans les champs)
    document.addEventListener('keydown', function (e) {
      var t = e.target || {};
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable) return;
      if (e.key === 'ArrowLeft') { aller(cur - 1, true); }
      else if (e.key === 'ArrowRight') { aller(cur + 1, true); }
    });

    // suit l'étape la plus centrée pendant le défilement libre
    function auDefilement() {
      var centre = window.innerHeight / 2, best = 0, dmin = Infinity;
      etapes.forEach(function (b, i) {
        var r = b.getBoundingClientRect();
        var d = Math.abs((r.top + r.bottom) / 2 - centre);
        if (d < dmin) { dmin = d; best = i; }
      });
      if (best !== cur) { cur = best; maj(); }
      reveille();
    }
    // auto-masquage discret
    function reveille() {
      bar.classList.remove('dort');
      clearTimeout(idle);
      idle = setTimeout(function () { bar.classList.add('dort'); }, 2600);
    }
    // masquer quand un champ est actif (pages de saisie / sécurisées)
    document.addEventListener('focusin', function (e) {
      var t = e.target || {};
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) bar.classList.add('cache');
    });
    document.addEventListener('focusout', function () { bar.classList.remove('cache'); });

    var tk = null;
    window.addEventListener('scroll', function () {
      bar.classList.remove('dort'); clearTimeout(tk);
      tk = setTimeout(auDefilement, 90);
    }, { passive: true });
    window.addEventListener('mousemove', reveille, { passive: true });
    bar.addEventListener('mouseenter', function () { bar.classList.remove('dort'); clearTimeout(idle); });

    maj();
    reveille();
  }

  global.CoursReader = { render: render };
})(window);
