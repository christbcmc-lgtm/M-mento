/* Mémento — cours de PROBABILITÉ ET STATISTIQUE (Licence Énergétique, ESMER,
   d'après le cours de A. Essoun). Structure : chapitres > sections > étapes.
   Chaque formule porte un identifiant (P1, P2, …) ; les rappels renvoient à la
   formule d'origine par un lien <a class="fref" href="#f-Pxx">. */
window.COURS = window.COURS || {};
window.COURS.proba = {
  id: 'proba',
  titre: 'Probabilité et statistique',
  sous: 'Licence Énergétique — ESMER, d’après le cours de A. Essoun',
  chapitres: []
};
(function (C) {
  /* ===================== CHAPITRE I — DÉNOMBREMENT ===================== */
  C.chapitres.push({
    titre: 'Chapitre I — Dénombrement',
    sections: [
      {
        titre: 'I.1. Cardinal d’un ensemble fini',
        steps: [
          { html: '<p>Le <b>cardinal</b> d’un ensemble fini <span class="m">A</span> est son nombre d’éléments, noté <span class="m">\\operatorname{card}A</span>. Par exemple <span class="m">A=\\{1,2,3,4,6,7\\}</span> donne <span class="m">\\operatorname{card}A=6</span>.</p><p>Pour deux ensembles finis quelconques, le cardinal de la réunion se calcule en retranchant la partie comptée deux fois :</p>',
            formules: [ { id: 'P1', tex: '\\operatorname{card}(A\\cup B) \\;=\\; \\operatorname{card}A + \\operatorname{card}B - \\operatorname{card}(A\\cap B)', leg: 'On soustrait card(A\u2229B) car les éléments communs seraient sinon comptés deux fois.' } ],
            detail: '<p>Si <span class="m">B\\subset A</span> alors <span class="m">A\\cap B=B</span> et la formule se réduit à <span class="m">\\operatorname{card}(A\\cup B)=\\operatorname{card}A</span>. Si <span class="m">A</span> et <span class="m">B</span> sont disjoints (<span class="m">A\\cap B=\\varnothing</span>), alors <span class="m">\\operatorname{card}(A\\cup B)=\\operatorname{card}A+\\operatorname{card}B</span>.</p>' }
        ]
      },
      {
        titre: 'I.2. Applications d’un ensemble fini dans un autre',
        steps: [
          { html: '<p>Une <b>application</b> de <span class="m">A</span> dans <span class="m">B</span> associe à chaque élément de <span class="m">A</span> un et un seul élément de <span class="m">B</span>. Avec <span class="m">\\operatorname{card}A=p</span> et <span class="m">\\operatorname{card}B=n</span>, le nombre total d’applications est :</p>',
            formules: [ { id: 'P2', tex: '\\mathcal{N} \\;=\\; n^{p} \\;=\\; (\\operatorname{card}B)^{\\operatorname{card}A}', leg: 'Chacun des p éléments de A peut viser l’un des n éléments de B, indépendamment.' } ],
            detail: '<p><b>Exemple.</b> On lance 7 fois une pièce (pile/face). Chaque lancer a 2 issues, d’où <span class="m">2^{7}=128</span> suites de résultats possibles, par exemple <i>P\u2009P\u2009P\u2009P\u2009F\u2009F\u2009F</i>. Ici <span class="m">p=7</span> (les lancers) et <span class="m">n=2</span> (les faces).</p>' },
          { html: '<p>Si l’application est <b>injective</b> (deux éléments distincts de <span class="m">A</span> ont des images distinctes), avec <span class="m">n\\ge p</span>, on compte les <b>arrangements</b> :</p>',
            formules: [ { id: 'P3', tex: 'A_{n}^{p} \\;=\\; n(n-1)(n-2)\\cdots(n-p+1) \\;=\\; \\frac{n!}{(n-p)!}', leg: 'Nombre de façons d’ordonner p objets choisis parmi n (l’ordre compte).' } ],
            detail: '<p>La <b>factorielle</b> est définie par <span class="m">n! = 1\\times 2\\times\\cdots\\times n</span>, avec la convention <span class="m">0!=1</span> et <span class="m">A_{n}^{0}=1</span>. On lit <span class="m">A_{n}^{p}</span> «\u00a0arrangement de p parmi n\u00a0».</p>' }
        ]
      },
      {
        titre: 'I.3. Problème classique de tirage',
        steps: [
          { html: '<p>On dispose de <span class="m">n</span> objets et on en tire <span class="m">p</span>. Trois schémas selon l’ordre et la remise.</p><p><b>(a) Tirages simultanés</b> (<span class="m">p\\le n</span>, l’ordre ne compte pas) → <b>combinaisons</b> :</p>',
            formules: [ { id: 'P4', tex: 'N_1 \\;=\\; C_{n}^{p} \\;=\\; \\binom{n}{p} \\;=\\; \\frac{n!}{p!\\,(n-p)!}', leg: 'On divise l’arrangement P3 par p! car les p objets ne sont plus ordonnés.' } ],
            detail: '<p>Lien avec l’arrangement <a class="fref" href="#f-P3">P3</a> : <span class="m">C_{n}^{p}=A_{n}^{p}/p!</span>. Propriétés utiles : <span class="m">C_{n}^{0}=C_{n}^{n}=1</span> et la symétrie <span class="m">C_{n}^{p}=C_{n}^{\\,n-p}</span>.</p>' },
          { html: '<p><b>(b) Tirages successifs sans remise</b> (ordre compte, pas de répétition) :</p>',
            formules: [ { id: 'P5', tex: 'N_2 \\;=\\; A_{n}^{p} \\;=\\; \\frac{n!}{(n-p)!}', leg: 'Même dénombrement que l’arrangement P3.' } ] },
          { html: '<p><b>(c) Tirages successifs avec remise</b> (ordre compte, <span class="m">p</span> quelconque) :</p>',
            formules: [ { id: 'P6', tex: 'N_3 \\;=\\; n^{p}', leg: 'On remet l’objet avant chaque tirage : n choix à chaque fois (cf. P2).' } ],
            detail: '<p><b>Application (tontine de 10 personnes : 6 H, 4 F).</b> (a) Choisir 3 personnes au hasard : <span class="m">C_{10}^{3}=120</span>. (b) Bureau ordonné président\u2013secrétaire\u2013trésorier : <span class="m">A_{10}^{3}=720</span> (cf. <a class="fref" href="#f-P5">P5</a>). (c) Délégation de 4 dont 3 hommes : <span class="m">C_{6}^{3}\\times C_{4}^{1}=20\\times 4=80</span>.</p>' }
        ]
      }
    ]
  });

  /* ============== CHAPITRE II — PROBABILITÉ SUR UN ENSEMBLE FINI ============== */
  C.chapitres.push({
    titre: 'Chapitre II — Probabilité sur un ensemble fini',
    sections: [
      {
        titre: 'II.1. Univers et événements',
        steps: [
          { html: '<p>Une <b>expérience aléatoire</b> <span class="m">E</span> a un ensemble de résultats possibles appelé <b>univers</b> <span class="m">\\Omega</span> (supposé fini). Toute partie de <span class="m">\\Omega</span> est un <b>événement</b> :</p><ul><li>un singleton <span class="m">\\{\\omega\\}</span> est un événement <b>élémentaire</b>\u00a0;</li><li>l’ensemble vide <span class="m">\\varnothing</span> est l’événement <b>impossible</b>\u00a0;</li><li><span class="m">\\Omega</span> lui-même est l’événement <b>certain</b>.</li></ul>' }
        ]
      },
      {
        titre: 'II.2. Axiomes du calcul des probabilités',
        steps: [
          { html: '<p>Une <b>probabilité</b> est une application <span class="m">p:\\mathcal{P}(\\Omega)\\to[0,1]</span> telle que <span class="m">p(\\Omega)=1</span> et, pour deux événements incompatibles (<span class="m">A\\cap B=\\varnothing</span>) :</p>',
            formules: [ { id: 'P7', tex: 'p(A\\cup B) \\;=\\; p(A) + p(B) \\qquad (A\\cap B=\\varnothing)', leg: 'Additivité pour des événements qui ne peuvent se produire ensemble.' } ],
            detail: '<p>Le triplet <span class="m">(\\Omega,\\mathcal{P}(\\Omega),p)</span> est appelé <b>espace probabilisé fini</b>. Ces deux conditions suffisent à déduire toutes les propriétés suivantes.</p>' }
        ]
      },
      {
        titre: 'II.3. Propriétés',
        steps: [
          { html: '<p>La probabilité de l’événement <b>contraire</b> complète à 1 :</p>',
            formules: [ { id: 'P8', tex: 'p(\\bar{A}) \\;=\\; 1 - p(A)', leg: 'Souvent, calculer le contraire est plus simple que l’événement lui-même.' } ],
            detail: '<p>Cela découle de <a class="fref" href="#f-P7">P7</a> appliqué à <span class="m">A</span> et <span class="m">\\bar A</span> (incompatibles, de réunion <span class="m">\\Omega</span>) : <span class="m">p(A)+p(\\bar A)=p(\\Omega)=1</span>.</p>' },
          { html: '<p>Pour deux événements <b>quelconques</b> (formule de Poincaré) :</p>',
            formules: [ { id: 'P9', tex: 'p(A\\cup B) \\;=\\; p(A) + p(B) - p(A\\cap B)', leg: 'Analogue probabiliste de P1 : on retranche la partie commune.' } ],
            detail: '<p>À comparer avec le cardinal <a class="fref" href="#f-P1">P1</a>. Si <span class="m">A\\cap B=\\varnothing</span> on retombe sur <a class="fref" href="#f-P7">P7</a>.</p>' }
        ]
      },
      {
        titre: 'II.4. Équiprobabilité',
        steps: [
          { html: '<p>Si tous les événements élémentaires sont équiprobables, la probabilité est <b>uniforme</b> :</p>',
            formules: [ { id: 'P10', tex: 'p(A) \\;=\\; \\frac{\\operatorname{card}A}{\\operatorname{card}\\Omega} \\;=\\; \\frac{\\text{cas favorables}}{\\text{cas possibles}}', leg: 'C’est ici que le dénombrement du chapitre I devient indispensable.' } ],
            detail: '<p>Tout l’outillage de dénombrement (combinaisons <a class="fref" href="#f-P4">P4</a>, arrangements <a class="fref" href="#f-P3">P3</a>) sert à compter numérateur et dénominateur.</p>' }
        ]
      }
    ]
  });

  /* ====== CHAPITRE III — PROBABILITÉ CONDITIONNELLE ET INDÉPENDANCE ====== */
  C.chapitres.push({
    titre: 'Chapitre III — Probabilité conditionnelle et indépendance',
    sections: [
      {
        titre: 'III.1. Probabilité conditionnelle',
        steps: [
          { html: '<p>La probabilité de <span class="m">B</span> <b>sachant que</b> <span class="m">A</span> est réalisé (<span class="m">p(A)>0</span>) :</p>',
            formules: [ { id: 'P11', tex: 'p(B\\mid A) \\;=\\; \\frac{p(A\\cap B)}{p(A)}', leg: 'On restreint l’univers à A : A devient le nouvel «\u00a0certain\u00a0».' } ],
            detail: '<p>Noté aussi <span class="m">P_A(B)</span>. Intuitivement, savoir que <span class="m">A</span> s’est produit «\u00a0réduit\u00a0» l’univers à <span class="m">A</span>, et on y mesure la part occupée par <span class="m">A\\cap B</span>.</p>' }
        ]
      },
      {
        titre: 'III.2. Théorème des probabilités composées',
        steps: [
          { html: '<p>En multipliant <a class="fref" href="#f-P11">P11</a> par <span class="m">p(A)</span>, on obtient la probabilité de réalisation <b>simultanée</b> :</p>',
            formules: [ { id: 'P12', tex: 'p(A\\cap B) \\;=\\; p(A)\\,p(B\\mid A) \\;=\\; p(B)\\,p(A\\mid B)', leg: 'Deux lectures symétriques du même événement A∩B.' } ] }
        ]
      },
      {
        titre: 'III.3. Indépendance en probabilité',
        steps: [
          { html: '<p>Deux événements sont <b>indépendants</b> si la réalisation de l’un n’informe pas sur l’autre :</p>',
            formules: [ { id: 'P13', tex: 'p(A\\cap B) \\;=\\; p(A)\\,p(B)', leg: 'Équivaut à p(B\u2223A)=p(B) et p(A\u2223B)=p(A).' } ],
            detail: '<p>En remplaçant dans <a class="fref" href="#f-P12">P12</a> : si <span class="m">A,B</span> sont indépendants, <span class="m">p(B\\mid A)=p(B)</span> — connaître <span class="m">A</span> ne change rien.</p>' }
        ]
      },
      {
        titre: 'III.4. Théorème de Bayes',
        steps: [
          { html: '<p>Si <span class="m">A_1,\\dots,A_n</span> forment une <b>partition</b> de <span class="m">\\Omega</span> (incompatibles, de réunion <span class="m">\\Omega</span>), la <b>probabilité totale</b> décompose tout événement <span class="m">B</span> :</p>',
            formules: [ { id: 'P14', tex: 'p(B) \\;=\\; \\sum_{i=1}^{n} p(A_i)\\,p(B\\mid A_i)', leg: 'On somme les contributions de chaque «\u00a0cause\u00a0» A_i.' } ],
            detail: '<p>Chaque <span class="m">A_i\\cap B</span> est incompatible avec les autres ; leur réunion reconstitue <span class="m">B</span>. On applique ensuite <a class="fref" href="#f-P12">P12</a> à chaque terme.</p>' },
          { html: '<p>En inversant le conditionnement, on «\u00a0remonte aux causes\u00a0» (théorème de Bayes) :</p>',
            formules: [ { id: 'P15', tex: 'p(A_i\\mid B) \\;=\\; \\frac{p(A_i)\\,p(B\\mid A_i)}{\\displaystyle\\sum_{j=1}^{n} p(A_j)\\,p(B\\mid A_j)}', leg: 'Numérateur : la cause visée ; dénominateur : la probabilité totale P14.' } ],
            detail: '<p><b>Application.</b> Dans un lycée, 4\u202f% des garçons et 1\u202f% des filles mesurent plus de 1,50\u202fm ; 60\u202f% des élèves sont des filles. Pour un élève de plus de 1,50\u202fm, <span class="m">p(\\text{fille}\\mid B)=\\dfrac{0{,}60\\times 0{,}01}{0{,}60\\times 0{,}01+0{,}40\\times 0{,}04}=\\dfrac{0{,}006}{0{,}022}\\approx 0{,}27</span> ; donc <span class="m">p(\\text{gar\u00e7on}\\mid B)\\approx 0{,}73</span> (complément, cf. <a class="fref" href="#f-P8">P8</a>).</p>' }
        ]
      }
    ]
  });

  /* ============== CHAPITRE IV — ÉPREUVE DE BERNOULLI ============== */
  C.chapitres.push({
    titre: 'Chapitre IV — Épreuve de Bernoulli',
    sections: [
      {
        titre: 'IV.1. Définition et formule',
        steps: [
          { html: '<p>Une <b>épreuve de Bernoulli</b> n’a que deux issues : <b>succès</b> <span class="m">S</span> (probabilité <span class="m">p</span>) et <b>échec</b> (probabilité <span class="m">q=1-p</span>). On la répète <span class="m">n</span> fois dans les mêmes conditions, de façon indépendante. La probabilité d’obtenir <span class="m">k</span> succès est :</p>',
            formules: [ { id: 'P16', tex: 'p(A_k) \\;=\\; C_{n}^{k}\\,p^{k}\\,(1-p)^{\\,n-k}', leg: 'C_n^k : le nombre de positions des k succès ; p^k q^{n-k} : une séquence donnée.' } ],
            detail: '<p>Le facteur <span class="m">C_{n}^{k}</span> compte les façons de placer les <span class="m">k</span> succès parmi les <span class="m">n</span> épreuves (combinaison <a class="fref" href="#f-P4">P4</a>). Chaque séquence précise a la probabilité <span class="m">p^{k}q^{\\,n-k}</span> par indépendance (<a class="fref" href="#f-P13">P13</a>). C’est le germe de la loi binomiale <a class="fref" href="#f-P25">P25</a>.</p>' },
          { html: '<p><b>Application.</b> Un dé a ses faces marquées 2,2,2,2,5,5, donc <span class="m">p(\\text{\u00ab\u20092\u2009\u00bb})=\\tfrac{4}{6}=\\tfrac{2}{3}</span>. Sur 4 jets, probabilité d’obtenir 3 fois le 2 :</p>',
            formules: [ { id: 'P17', tex: 'C_{4}^{3}\\left(\\tfrac{2}{3}\\right)^{3}\\left(\\tfrac{1}{3}\\right)^{1} \\;=\\; 4\\cdot\\tfrac{8}{27}\\cdot\\tfrac{1}{3} \\;=\\; \\tfrac{32}{81}\\approx 0{,}395', leg: 'Application directe de P16 avec n=4, k=3, p=2/3.' } ] }
        ]
      }
    ]
  });

  /* ====== CHAPITRE V — VARIABLES ALÉATOIRES DISCRÈTES ====== */
  C.chapitres.push({
    titre: 'Chapitre V — Variables aléatoires discrètes',
    sections: [
      {
        titre: 'V.1. Définition et loi de probabilité',
        steps: [
          { html: '<p>Une <b>variable aléatoire</b> <span class="m">X</span> est une application <span class="m">f:\\Omega\\to\\mathbb{R}</span> qui associe un réel à chaque résultat. La <b>loi de probabilité</b> de <span class="m">X</span> donne, pour chaque valeur <span class="m">x_i</span>, la probabilité <span class="m">p_i=p(X=x_i)</span>, avec :</p>',
            formules: [ { id: 'P18', tex: '\\sum_{i=1}^{n} p_i \\;=\\; 1, \\qquad p_i \\ge 0', leg: 'Les probabilités sont positives et de somme 1 (l’une des valeurs se réalise).' } ],
            detail: '<p>On présente la loi sous forme de tableau. <b>Exemple</b> (tirage de 2 boules parmi 5 blanches et 3 noires, <span class="m">X</span>\u2009=\u2009nombre de noires) : <span class="m">\\operatorname{card}\\Omega=C_{8}^{2}=28</span>, d’où <span class="m">p(X{=}0)=\\tfrac{10}{28}</span>, <span class="m">p(X{=}1)=\\tfrac{15}{28}</span>, <span class="m">p(X{=}2)=\\tfrac{3}{28}</span> (dénombrement par <a class="fref" href="#f-P4">P4</a>).</p>' }
        ]
      },
      {
        titre: 'V.2. Fonction de répartition',
        steps: [
          { html: '<p>La <b>fonction de répartition</b> cumule les probabilités jusqu’à <span class="m">x</span> :</p>',
            formules: [ { id: 'P19', tex: 'F(x) \\;=\\; p(X\\le x) \\;=\\; \\sum_{x_i \\le x} p_i', leg: 'Fonction en escalier, croissante, de 0 à 1.' } ] }
        ]
      },
      {
        titre: 'V.3. Espérance, variance, écart-type',
        steps: [
          { html: '<p>L’<b>espérance mathématique</b> est la valeur moyenne pondérée :</p>',
            formules: [ { id: 'P20', tex: 'E(X) \\;=\\; \\sum_{i=1}^{n} x_i\\,p_i', leg: 'Moyenne des valeurs pondérée par leurs probabilités.' } ] },
          { html: '<p>La <b>variance</b> mesure la dispersion autour de l’espérance :</p>',
            formules: [ { id: 'P21', tex: 'V(X) \\;=\\; \\sum_{i=1}^{n} \\bigl(x_i-E(X)\\bigr)^{2} p_i \\;=\\; E(X^{2}) - \\bigl[E(X)\\bigr]^{2}', leg: 'La 2e forme (König–Huygens) est la plus commode en calcul.' } ],
            detail: '<p><b>Preuve de l’égalité.</b> En développant <span class="m">(x_i-E(X))^2=x_i^2-2x_iE(X)+E(X)^2</span> et en sommant avec <a class="fref" href="#f-P18">P18</a> (<span class="m">\\sum p_i=1</span>) et <a class="fref" href="#f-P20">P20</a> (<span class="m">\\sum x_i p_i=E(X)</span>) : <span class="m">V(X)=E(X^2)-2E(X)^2+E(X)^2=E(X^2)-E(X)^2</span>.</p>' },
          { html: '<p>L’<b>écart-type</b> ramène la dispersion à l’unité de <span class="m">X</span> :</p>',
            formules: [ { id: 'P22', tex: '\\sigma(X) \\;=\\; \\sqrt{V(X)}', leg: 'Même unité que X, contrairement à la variance.' } ] },
          { html: '<p>Transformations affines <span class="m">Y=\\alpha X+\\beta</span> :</p>',
            formules: [ { id: 'P23', tex: 'E(\\alpha X+\\beta)=\\alpha E(X)+\\beta, \\qquad V(\\alpha X+\\beta)=\\alpha^{2}V(X)', leg: 'L’espérance est linéaire ; la variance ignore le décalage β et met α au carré.' } ],
            detail: '<p>Une v.a. est <b>centrée</b> si <span class="m">E(X)=0</span> et <b>réduite</b> si <span class="m">V(X)=1</span>. La variable <span class="m">Y=X-E(X)</span> est centrée ; ce principe servira pour la loi normale centrée réduite <a class="fref" href="#f-P33">P33</a>.</p>' }
        ]
      },
      {
        titre: 'V.4. Moments',
        steps: [
          { html: '<p><b>Moment d’ordre r</b> (non centré) et <b>moment centré</b> :</p>',
            formules: [ { id: 'P24', tex: 'm_r = \\sum_{i} x_i^{\\,r} p_i = E(X^{r}), \\qquad M_r = \\sum_{i} \\bigl(x_i-E(X)\\bigr)^{r} p_i', leg: 'm₁=E(X) ; M₁=0 ; M₂=V(X).' } ],
            detail: '<p>Cas particuliers : <span class="m">m_1=E(X)</span> (la moyenne, cf. <a class="fref" href="#f-P20">P20</a>), <span class="m">M_1=0</span> et <span class="m">M_2=V(X)</span> (cf. <a class="fref" href="#f-P21">P21</a>).</p>' }
        ]
      },
      {
        titre: 'V.5. Inégalité de Bienaymé–Tchebychev',
        steps: [
          { html: '<p>Elle borne la probabilité de s’éloigner de la moyenne de plus de <span class="m">t</span> écarts-types, <b>sans connaître la loi</b> :</p>',
            formules: [ { id: 'Pbt', tex: 'p\\bigl(|X-E(X)| \\ge t\\,\\sigma\\bigr) \\;\\le\\; \\frac{1}{t^{2}} \\qquad\\Longleftrightarrow\\qquad p\\bigl(|X-E(X)| < t\\,\\sigma\\bigr) \\;\\ge\\; 1-\\frac{1}{t^{2}}', leg: 'Majoration universelle de la dispersion.' } ],
            detail: '<p><b>Application (100 tirages, urne équilibrée).</b> Avec <span class="m">E(X)=50</span>, <span class="m">\\sigma=5</span>, l’intervalle [40,60] correspond à <span class="m">t=2</span> ; donc <span class="m">p(40<X<60)\\ge 1-\\tfrac{1}{4}=0{,}75</span>.</p>' }
        ]
      }
    ]
  });

  /* ====== CHAPITRE VI — LOIS DISCRÈTES PARTICULIÈRES ====== */
  C.chapitres.push({
    titre: 'Chapitre VI — Lois discrètes particulières',
    sections: [
      {
        titre: 'VI.1. Loi binomiale',
        steps: [
          { html: '<p>On répète <span class="m">n</span> épreuves de Bernoulli indépendantes (succès de probabilité <span class="m">p</span>). La variable <span class="m">X</span> = nombre de succès suit la <b>loi binomiale</b> <span class="m">\\mathcal{B}(n,p)</span> :</p>',
            formules: [ { id: 'P25', tex: 'p(X=k) \\;=\\; C_{n}^{k}\\,p^{k}(1-p)^{\\,n-k}, \\quad k=0,1,\\dots,n', leg: 'Exactement la formule de Bernoulli P16, vue comme loi d’une variable.' } ],
            detail: '<p>C’est la formalisation de l’épreuve de Bernoulli <a class="fref" href="#f-P16">P16</a> en loi de probabilité.</p>' },
          { html: '<p>Espérance et variance de la loi binomiale :</p>',
            formules: [ { id: 'P26', tex: 'E(X) \\;=\\; n\\,p', leg: 'En moyenne, une proportion p des n épreuves réussit.' }, { id: 'P27', tex: 'V(X) \\;=\\; n\\,p\\,(1-p)', leg: 'Dispersion maximale quand p=1/2.' } ],
            detail: '<p><b>Application.</b> 4\u202f% des ordinateurs tombent en panne/mois ; parc de 300. <span class="m">Y\\sim\\mathcal{B}(300;\\,0{,}04)</span>, <span class="m">E(Y)=12</span>, <span class="m">\\sigma=\\sqrt{300\\cdot0{,}04\\cdot0{,}96}\\approx 3{,}39</span> ; <span class="m">p(Y=5)=C_{300}^{5}(0{,}04)^{5}(0{,}96)^{295}</span>.</p>' }
        ]
      },
      {
        titre: 'VI.2. Loi de Poisson',
        steps: [
          { html: '<p>La <b>loi de Poisson</b> de paramètre <span class="m">\\lambda</span> modélise un nombre d’événements rares :</p>',
            formules: [ { id: 'P28', tex: 'p(X=k) \\;=\\; \\frac{\\lambda^{k}}{k!}\\,e^{-\\lambda}, \\quad k\\in\\mathbb{N}', leg: 'λ est le nombre moyen d’occurrences.' } ] },
          { html: '<p>Propriété caractéristique : espérance et variance coïncident :</p>',
            formules: [ { id: 'P29', tex: 'E(X) \\;=\\; V(X) \\;=\\; \\lambda', leg: 'Un jeu de données dont moyenne ≈ variance peut être ajusté par Poisson.' } ] },
          { html: '<p>La loi de Poisson <b>approxime</b> la binomiale quand <span class="m">n</span> est grand et <span class="m">p</span> petit :</p>',
            formules: [ { id: 'P30', tex: '\\mathcal{B}(n,p) \\;\\approx\\; \\mathcal{P}(\\lambda) \\quad\\text{avec } \\lambda = n\\,p, \\;\\; n\\ge 50,\\; p\\le 0{,}1', leg: 'On pose λ=np pour conserver la même espérance (cf. P26).' } ],
            detail: '<p>Le paramètre <span class="m">\\lambda=np</span> fait coïncider l’espérance de Poisson <a class="fref" href="#f-P29">P29</a> avec celle de la binomiale <a class="fref" href="#f-P26">P26</a>.</p>' }
        ]
      }
    ]
  });

  /* ====== CHAPITRE VII — VARIABLES ALÉATOIRES CONTINUES ====== */
  C.chapitres.push({
    titre: 'Chapitre VII — Variables aléatoires continues',
    sections: [
      {
        titre: 'VII.1. Densité de probabilité',
        steps: [
          { html: '<p>Une variable <b>continue</b> prend ses valeurs dans un intervalle. Sa <b>densité</b> <span class="m">f\\ge 0</span> vérifie la normalisation, et la probabilité s’obtient par intégration :</p>',
            formules: [ { id: 'P31', tex: '\\int_{\\mathbb{R}} f(x)\\,\\mathrm{d}x = 1, \\qquad p(a\\le X\\le b) = \\int_{a}^{b} f(x)\\,\\mathrm{d}x', leg: 'L’aire totale sous f vaut 1 ; une probabilité est une aire.' } ],
            detail: '<p>Pour une v.a. continue, <span class="m">p(X=a)=0</span> : seule la probabilité d’un intervalle a un sens. C’est l’analogue continu de la somme <a class="fref" href="#f-P18">P18</a>.</p>' }
        ]
      },
      {
        titre: 'VII.2. Espérance, variance',
        steps: [
          { html: '<p>Les sommes discrètes deviennent des intégrales :</p>',
            formules: [ { id: 'P32', tex: 'E(X) = \\int_{\\mathbb{R}} x\\,f(x)\\,\\mathrm{d}x, \\qquad V(X) = E(X^{2}) - \\bigl[E(X)\\bigr]^{2}', leg: 'Transposition continue de P20 et P21.' } ],
            detail: '<p>Avec <span class="m">E(X^{2})=\\int x^{2}f(x)\\,\\mathrm{d}x</span> et <span class="m">\\sigma(X)=\\sqrt{V(X)}</span> (cf. <a class="fref" href="#f-P22">P22</a>).</p>' }
        ]
      },
      {
        titre: 'VII.3. Fonction de répartition',
        steps: [
          { html: '<p>La <b>fonction de répartition</b> continue est la primitive de la densité :</p>',
            formules: [ { id: 'P35', tex: 'F(x) = p(X\\le x) = \\int_{-\\infty}^{x} f(t)\\,\\mathrm{d}t, \\qquad p(a\\le X\\le b) = F(b) - F(a)', leg: 'F croissante, de 0 à 1 ; f = F′.' } ],
            detail: '<p>Version continue de la répartition discrète <a class="fref" href="#f-P19">P19</a>.</p>' }
        ]
      }
    ]
  });

  /* ====== CHAPITRE VIII — LOIS CONTINUES PARTICULIÈRES ====== */
  C.chapitres.push({
    titre: 'Chapitre VIII — Lois continues particulières',
    sections: [
      {
        titre: 'VIII.1. Loi uniforme',
        steps: [
          { html: '<p>La <b>loi uniforme</b> sur <span class="m">[a,b]</span> répartit la probabilité de façon constante sur l’intervalle :</p>',
            formules: [ { id: 'P36', tex: 'f(x) = \\dfrac{1}{b-a}\\ \\text{ si } x\\in[a,b],\\quad 0 \\text{ sinon}', leg: 'Densité constante : tous les sous-intervalles de même longueur sont équiprobables.' } ],
            detail: '<p>Espérance et variance : <span class="m">E(X)=\\dfrac{a+b}{2}</span>, <span class="m">V(X)=\\dfrac{(b-a)^2}{12}</span>. C’est l’analogue continu de l’équiprobabilité <a class="fref" href="#f-P10">P10</a>.</p>' }
        ]
      },
      {
        titre: 'VIII.2. Loi exponentielle',
        steps: [
          { html: '<p>La <b>loi exponentielle</b> de paramètre <span class="m">\\lambda>0</span> modélise des durées de vie / temps d’attente :</p>',
            formules: [ { id: 'P37', tex: 'f(x) = \\lambda e^{-\\lambda x}\\ \\text{ si } x\\ge 0,\\quad 0 \\text{ sinon}', leg: 'λ est le taux de défaillance ; plus λ est grand, plus la durée est courte.' } ],
            detail: '<p>Répartition <span class="m">F(x)=1-e^{-\\lambda x}</span> pour <span class="m">x\\ge 0</span> (cf. <a class="fref" href="#f-P35">P35</a>) ; <span class="m">E(X)=\\dfrac{1}{\\lambda}</span>, <span class="m">V(X)=\\dfrac{1}{\\lambda^{2}}</span>. Loi « sans mémoire » : <span class="m">p(X>s+t\\mid X>s)=p(X>t)</span>.</p>' }
        ]
      },
      {
        titre: 'VIII.3. Loi normale',
        steps: [
          { html: '<p>La <b>loi normale</b> (ou de Laplace–Gauss) <span class="m">\\mathcal{N}(\\mu,\\sigma^{2})</span> est la loi continue la plus importante ; sa densité est la « courbe en cloche » :</p>',
            formules: [ { id: 'P33b', tex: 'f(x) = \\dfrac{1}{\\sigma\\sqrt{2\\pi}}\\, e^{-\\frac{1}{2}\\left(\\frac{x-\\mu}{\\sigma}\\right)^{2}}', leg: 'Symétrique autour de μ ; σ règle la largeur de la cloche.' } ],
            detail: '<p>Ici <span class="m">E(X)=\\mu</span> et <span class="m">V(X)=\\sigma^{2}</span>. La densité est maximale en <span class="m">x=\\mu</span> et admet deux points d’inflexion en <span class="m">\\mu\\pm\\sigma</span>.</p>' },
          { html: '<p>En <b>centrant et réduisant</b> (<a class="fref" href="#f-P23">P23</a>) on obtient la <b>loi normale centrée réduite</b> <span class="m">\\mathcal{N}(0,1)</span> :</p>',
            formules: [ { id: 'P33', tex: 'T = \\dfrac{X-\\mu}{\\sigma}\\ \\sim\\ \\mathcal{N}(0,1),\\qquad \\varphi(t)=\\dfrac{1}{\\sqrt{2\\pi}}\\,e^{-t^{2}/2}', leg: 'La standardisation ramène toute loi normale à une table unique.' } ],
            detail: '<p>On lit alors les probabilités dans la table de la fonction <span class="m">\\Pi(t)=p(T\\le t)</span>. Par symétrie <span class="m">\\Pi(-t)=1-\\Pi(t)</span>.</p>' },
          { html: '<p>Règle pratique (intervalles de confiance autour de la moyenne) :</p>',
            formules: [ { id: 'P34', tex: 'p(\\mu-\\sigma<X<\\mu+\\sigma)\\approx 0{,}68,\\quad p(\\mu-2\\sigma<X<\\mu+2\\sigma)\\approx 0{,}95,\\quad p(\\mu-3\\sigma<X<\\mu+3\\sigma)\\approx 0{,}997', leg: 'Règle « 68–95–99,7 » : presque toute la masse tient en ±3σ.' } ],
            detail: '<p>La loi normale <b>approxime</b> la binomiale <a class="fref" href="#f-P25">P25</a> pour <span class="m">n</span> grand (théorème de Moivre–Laplace) : <span class="m">\\mathcal{B}(n,p)\\approx\\mathcal{N}(np,\\,np(1-p))</span> dès que <span class="m">np\\ge 5</span> et <span class="m">n(1-p)\\ge 5</span>.</p>' }
        ]
      }
    ]
  });
})(window.COURS.proba);
