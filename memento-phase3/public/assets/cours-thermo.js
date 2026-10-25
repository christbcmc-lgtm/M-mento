/* Mémento — cours de THERMODYNAMIQUE (1re année Génie des procédés, d'après R. Ouargli-Saker).
   Contenu structuré : chapitres > sections > étapes. Chaque formule porte un identifiant
   (F1, F2, …) ; les rappels renvoient à la formule d'origine par un lien <a class="fref">. */
window.COURS = window.COURS || {};
window.COURS.thermo = {
  id: 'thermo',
  titre: 'Thermodynamique',
  sous: '1re année Génie des procédés — d’après le cours de R. Ouargli-Saker (USTO-MB)',
  chapitres: []
};
(function (C) {
  C.chapitres.push({
    titre: 'Chapitre I — Notions fondamentales',
    sections: [
      {
        titre: 'I.1. Introduction',
        steps: [
          { html: '<p>La <b>thermodynamique</b> naît à la fin du XVII<sup>e</sup> siècle avec un besoin industriel précis : <i>transformer la chaleur en travail</i>. Son nom vient du grec « chaleur » (<i>thermo</i>) et « force » (<i>dynamis</i>).</p><p>On l’aborde de deux façons complémentaires :</p><ul><li><b>Macroscopique</b> : on décrit le système par quelques variables globales <span class="m">P</span>, <span class="m">V</span>, <span class="m">T</span>, <span class="m">m</span>…</li><li><b>Microscopique</b> : on remonte à l’agitation des molécules (vitesses, énergies individuelles).</li></ul>' }
        ]
      },
      {
        titre: 'I.1.1. Température',
        steps: [
          { html: '<p>La température mesure le <b>degré d’agitation</b> des molécules : plus leur énergie cinétique moyenne est grande, plus la température est élevée. Au zéro absolu (<span class="m">0\\,\\mathrm{K} = -273{,}15\\,^{\\circ}\\mathrm{C}</span>) l’agitation cesse.</p><p>La théorie cinétique relie énergie cinétique moyenne et température :</p>',
            formules: [ { id: 'F1', tex: '\\tfrac{1}{2}\\,m\\,\\overline{v^{2}} \\;=\\; \\tfrac{3}{2}\\,k\\,T', leg: 'm : masse d’une particule · v : vitesse · k : constante de Boltzmann · T : température (K).' } ],
            detail: '<p>Le facteur <span class="m">3/2</span> vient des trois directions d’espace : chaque degré de liberté de translation apporte <span class="m">\\tfrac{1}{2}kT</span> (principe d’équipartition). La température est donc une <i>mesure directe</i> de l’énergie cinétique moyenne.</p>' },
          { html: '<p>Passage entre l’échelle Celsius et l’échelle absolue (Kelvin) :</p>',
            formules: [ { id: 'F2', tex: 'T(\\mathrm{K}) \\;=\\; \\theta(^{\\circ}\\mathrm{C}) + 273{,}15', leg: 'Une différence de 1 K vaut une différence de 1 °C.' } ] }
        ]
      },
      {
        titre: 'I.1.2. Pression',
        steps: [
          { html: '<p>La <b>pression</b> résulte des chocs incessants des molécules sur les parois. En notant <span class="m">n^{*}=N/V</span> le nombre de molécules par unité de volume :</p>',
            formules: [ { id: 'F3', tex: 'P \\;=\\; \\tfrac{1}{3}\\,\\frac{N}{V}\\,m\\,\\overline{v^{2}}', leg: 'Pression cinétique : plus les chocs sont nombreux et énergiques, plus P augmente.' } ],
            detail: '<p>En rapprochant cette expression de <a class="fref" href="#f-F1">F1</a>, on voit que <span class="m">P</span> et <span class="m">T</span> traduisent la même agitation microscopique : c’est ce lien qui mènera à l’équation d’état <a class="fref" href="#f-F6">F6</a>.</p>' },
          { html: '<p>On distingue pression <b>absolue</b> et <b>relative</b> :</p>',
            formules: [ { id: 'F4', tex: 'P_{\\text{abs}} \\;=\\; P_{\\text{rel}} + P_{\\text{atm}}', leg: 'P_atm ≈ 1,013×10⁵ Pa = 1 atm.' } ] },
          { html: '<p>Pour un mélange de gaz, loi de Dalton des <b>pressions partielles</b> :</p>',
            formules: [ { id: 'F5', tex: 'P_i = x_i\\,P_{T} \\qquad P_{T} = \\sum_i P_i', leg: 'x_i : fraction molaire du constituant i · P_T : pression totale.' } ] }
        ]
      },
      {
        titre: 'I.1.4. Unités (S.I.)',
        steps: [
          { html: '<ul><li>Température : kelvin <span class="m">[\\mathrm{K}]</span></li><li>Pression : pascal <span class="m">[\\mathrm{Pa}]=[\\mathrm{N/m^2}]</span> ; <span class="m">1\\,\\mathrm{atm}=1{,}013\\times10^{5}\\,\\mathrm{Pa}=760\\,\\mathrm{Torr}</span></li><li>Énergie : joule <span class="m">[\\mathrm{J}]</span> ; <span class="m">1\\,\\mathrm{cal}=4{,}184\\,\\mathrm{J}</span></li><li>Puissance : watt <span class="m">1\\,\\mathrm{W}=1\\,\\mathrm{J/s}</span></li></ul>' }
        ]
      },
      {
        titre: 'I.2. Systèmes et états d’équilibre',
        steps: [
          { html: '<p>Un <b>système</b> est une portion de matière délimitée du milieu extérieur. Selon ses échanges :</p><table class="tbl"><thead><tr><th>Système</th><th>Matière</th><th>Énergie</th><th>Exemple</th></tr></thead><tbody><tr><td>Isolé</td><td>Non</td><td>Non</td><td>Calorimètre</td></tr><tr><td>Fermé</td><td>Non</td><td>Oui</td><td>Pile électrique</td></tr><tr><td>Ouvert</td><td>Oui</td><td>Oui</td><td>Être vivant</td></tr></tbody></table>' },
          { html: '<p>Les variables d’état se classent en <b>extensives</b> (proportionnelles à la quantité de matière : <span class="m">m, V, U</span>) et <b>intensives</b> (indépendantes de la masse : <span class="m">P, T</span>). Une transformation est <b>réversible</b> si elle est une suite d’états d’équilibre (infiniment lente) ; sinon elle est <b>irréversible</b>.</p>' }
        ]
      },
      {
        titre: 'I.2.4. Équation d’état des gaz parfaits',
        steps: [
          { html: '<p>Les variables d’état sont liées. Pour un gaz parfait :</p>',
            formules: [ { id: 'F6', tex: 'P\\,V \\;=\\; n\\,R\\,T', leg: 'P (Pa) · V (m³) · n (mol) · T (K) · R : constante des gaz parfaits.' } ],
            detail: '<p>Chaque variable dépend des deux autres : <span class="m">P=\\dfrac{nRT}{V}</span>, <span class="m">V=\\dfrac{nRT}{P}</span>, <span class="m">T=\\dfrac{PV}{nR}</span>. Cette équation est le point de départ de presque tous les calculs de transformations (chapitre II).</p>' },
          { html: '<p>En partant de <a class="fref" href="#f-F6">F6</a> avec une mole à <span class="m">T=273{,}15\\,\\mathrm{K}</span>, <span class="m">P=1\\,\\mathrm{atm}</span>, <span class="m">V=22{,}4\\,\\mathrm{L}</span>, on obtient la valeur de R en S.I. :</p>',
            formules: [ { id: 'F7', tex: 'R \\;=\\; \\frac{P\\,V}{n\\,T} \\;=\\; 8{,}314\\;\\mathrm{J\\,mol^{-1}\\,K^{-1}}', leg: 'Soit encore 0,082 L·atm·mol⁻¹·K⁻¹ · 2 cal·mol⁻¹·K⁻¹.' } ] }
        ]
      },
      {
        titre: 'I.2.6. Fonctions d’état · I.2.7. Principe zéro',
        steps: [
          { html: '<p>Une <b>fonction d’état</b> ne dépend que des états initial et final, jamais du chemin suivi : sa différentielle est <i>totale exacte</i>.</p>',
            formules: [ { id: 'F8', tex: '\\oint \\mathrm{d}F = 0 \\qquad \\int_{1}^{2}\\mathrm{d}F = F_2 - F_1', leg: 'U, H, S sont des fonctions d’état ; W et Q n’en sont pas (ils dépendent du chemin).' } ] },
          { html: '<p><b>Principe zéro :</b> « Deux systèmes en équilibre thermique avec un troisième sont en équilibre entre eux. » Il fonde l’existence même de la température comme paramètre intensif commun à l’équilibre.</p>' }
        ]
      }
    ]
  });
})(window.COURS.thermo);
(function (C) {
  C.chapitres.push({
    titre: 'Chapitre II — Échanges d’énergie : travail, chaleur, énergie interne',
    sections: [
      {
        titre: 'II.2. Énergie interne (U)',
        steps: [
          { html: '<p>L’<b>énergie interne</b> <span class="m">U</span> est le contenu énergétique microscopique du système (agitation + interactions des particules). C’est une <i>fonction d’état</i> (voir <a class="fref" href="#f-F8">F8</a>) et une grandeur <i>extensive</i>.</p>' }
        ]
      },
      {
        titre: 'II.6. Premier principe',
        steps: [
          { html: '<p>Le <b>premier principe</b> traduit la conservation de l’énergie : la variation d’énergie interne égale la somme des échanges de travail et de chaleur avec l’extérieur.</p>',
            formules: [ { id: 'F9', tex: '\\mathrm{d}U \\;=\\; \\delta W + \\delta Q', leg: 'Forme différentielle. δ (et non d) rappelle que W et Q ne sont pas des fonctions d’état.' } ] },
          { html: '<p>Intégrée entre deux états :</p>',
            formules: [ { id: 'F10', tex: '\\Delta U \\;=\\; U_2 - U_1 \\;=\\; W + Q', leg: 'Convention : W et Q comptent positivement lorsqu’ils sont reçus par le système.' } ],
            detail: '<p>Comme <span class="m">U</span> est une fonction d’état (<a class="fref" href="#f-F8">F8</a>), <span class="m">\\Delta U</span> ne dépend pas du chemin, alors que <span class="m">W</span> et <span class="m">Q</span> pris séparément en dépendent : seule leur <i>somme</i> est fixée par les états initial et final.</p>' }
        ]
      },
      {
        titre: 'II.3. La chaleur (Q)',
        steps: [
          { html: '<p><b>Chaleur sensible</b> : échangée sans changement d’état, elle fait varier la température.</p>',
            formules: [ { id: 'F11', tex: 'Q \\;=\\; m\\,c\\,\\Delta T \\;=\\; n\\,C\\,\\Delta T', leg: 'c : chaleur massique (J·kg⁻¹·K⁻¹) · C : chaleur molaire · ΔT = T_f − T_i.' } ] },
          { html: '<p><b>Chaleur latente</b> : échangée lors d’un changement d’état, à température constante.</p>',
            formules: [ { id: 'F12', tex: 'Q \\;=\\; m\\,L', leg: 'L : chaleur latente de fusion, vaporisation ou sublimation (J·kg⁻¹).' } ] },
          { html: '<p><b>Calorimétrie</b> : dans une enceinte isolée, la somme des chaleurs échangées est nulle (ce que l’un cède, l’autre le reçoit).</p>',
            formules: [ { id: 'F13', tex: '\\sum_i Q_i \\;=\\; 0', leg: 'Principe des échanges de chaleur dans un calorimètre (système isolé).' } ] }
        ]
      },
      {
        titre: 'II.4. Le travail (W)',
        steps: [
          { html: '<p>Le <b>travail des forces de pression</b> lors d’une variation de volume :</p>',
            formules: [ { id: 'F14', tex: '\\delta W = -P_{\\text{ext}}\\,\\mathrm{d}V \\qquad W = -\\int_{V_1}^{V_2} P\\,\\mathrm{d}V', leg: 'Le signe − : une détente (dV>0) fournit du travail au milieu (W<0).' } ],
            detail: '<p>Pour une transformation <i>réversible</i>, la pression du système égale à chaque instant la pression extérieure, et l’on peut remplacer <span class="m">P_{\\text{ext}}</span> par <span class="m">P=\\dfrac{nRT}{V}</span> issu de <a class="fref" href="#f-F6">F6</a> dans l’intégrale. C’est ce qui permet le calcul de <a class="fref" href="#f-F21">F21</a>.</p>' }
        ]
      },
      {
        titre: 'II.7. Enthalpie · II.8. Capacités calorifiques',
        steps: [
          { html: '<p>L’<b>enthalpie</b> est définie pour traiter commodément les transformations à pression constante :</p>',
            formules: [ { id: 'F15', tex: 'H \\;=\\; U + P\\,V', leg: 'H est une fonction d’état (combinaison de U, P, V).' } ] },
          { html: '<p>Les <b>capacités calorifiques</b> mesurent la chaleur nécessaire pour élever la température :</p>',
            formules: [ { id: 'F16', tex: 'C_V = \\left(\\frac{\\partial U}{\\partial T}\\right)_V \\qquad C_P = \\left(\\frac{\\partial H}{\\partial T}\\right)_P', leg: 'à volume constant (C_V) et à pression constante (C_P).' } ] },
          { html: '<p>Pour un gaz parfait, <b>relation de Mayer</b> reliant les deux :</p>',
            formules: [ { id: 'F17', tex: 'C_P - C_V \\;=\\; n\\,R', leg: 'Conséquence directe de H = U + PV (F15) et de PV = nRT (F6).' },
                         { id: 'F18', tex: '\\gamma \\;=\\; \\dfrac{C_P}{C_V} \\;(>1)', leg: 'Coefficient de Laplace, utilisé pour les adiabatiques (F22).' } ],
            detail: '<p>En différenciant <a class="fref" href="#f-F15">F15</a> : <span class="m">\\mathrm{d}H=\\mathrm{d}U+\\mathrm{d}(PV)</span>. Avec <a class="fref" href="#f-F6">F6</a>, <span class="m">\\mathrm{d}(PV)=nR\\,\\mathrm{d}T</span>, d’où <span class="m">C_P\\,\\mathrm{d}T = C_V\\,\\mathrm{d}T + nR\\,\\mathrm{d}T</span> et donc <a class="fref" href="#f-F17">F17</a>.</p>' }
        ]
      },
      {
        titre: 'II.9. Les quatre transformations réversibles',
        steps: [
          { html: '<p><b>Isochore</b> (<span class="m">V=\\text{cste}</span>) : aucun travail de pression, toute la chaleur sert à varier <span class="m">U</span>.</p>',
            formules: [ { id: 'F19', tex: 'W = 0 \\qquad Q_V = \\Delta U = n\\,C_V\\,\\Delta T', leg: 'La chaleur échangée à V constant mesure directement ΔU.' } ] },
          { html: '<p><b>Isobare</b> (<span class="m">P=\\text{cste}</span>) : la chaleur échangée mesure la variation d’<i>enthalpie</i>.</p>',
            formules: [ { id: 'F20', tex: 'W = -P\\,\\Delta V \\qquad Q_P = \\Delta H = n\\,C_P\\,\\Delta T', leg: 'C’est pourquoi H (F15) est la grandeur reine de la thermochimie (chap. III).' } ] },
          { html: '<p><b>Isotherme</b> (<span class="m">T=\\text{cste}</span>) : pour un gaz parfait <span class="m">\\Delta U=0</span>, donc <span class="m">Q=-W</span>.</p>',
            formules: [ { id: 'F21', tex: '\\Delta U = 0 \\qquad W = -Q = -n\\,R\\,T\\,\\ln\\!\\frac{V_2}{V_1}', leg: 'Obtenue en intégrant F14 avec P = nRT/V (F6) à T constante.' } ],
            detail: '<p>Départ : <a class="fref" href="#f-F14">F14</a> <span class="m">W=-\\int P\\,\\mathrm{d}V</span>. On remplace <span class="m">P</span> par <span class="m">nRT/V</span> (<a class="fref" href="#f-F6">F6</a>) : <span class="m">W=-nRT\\int_{V_1}^{V_2}\\frac{\\mathrm{d}V}{V}=-nRT\\ln(V_2/V_1)</span>. Comme <span class="m">\\Delta U=0</span> (gaz parfait, T constante), <a class="fref" href="#f-F10">F10</a> donne <span class="m">Q=-W</span>.</p>' },
          { html: '<p><b>Adiabatique</b> (<span class="m">Q=0</span>) : lois de Laplace.</p>',
            formules: [ { id: 'F22', tex: 'P\\,V^{\\gamma}=\\text{cste} \\quad T\\,V^{\\gamma-1}=\\text{cste} \\quad W=\\Delta U = n\\,C_V\\,\\Delta T', leg: 'γ = C_P/C_V (F18). Sans échange de chaleur, tout le travail modifie U (F10).' } ] }
        ]
      }
    ]
  });
})(window.COURS.thermo);
(function (C) {
  C.chapitres.push({
    titre: 'Chapitre III — Thermochimie : le 1er principe appliqué à la chimie',
    sections: [
      {
        titre: 'III.2. Relation entre ΔH et ΔU d’une réaction',
        steps: [
          { html: '<p>À pression constante la chaleur de réaction vaut <span class="m">\\Delta H</span> (voir <a class="fref" href="#f-F20">F20</a>) ; à volume constant elle vaut <span class="m">\\Delta U</span> (<a class="fref" href="#f-F19">F19</a>). Les deux sont reliées par :</p>',
            formules: [ { id: 'F23', tex: '\\Delta H = \\Delta U + \\Delta(PV) = \\Delta U + \\Delta n_{\\text{gaz}}\\,R\\,T', leg: 'Δn_gaz : variation du nombre de moles de GAZ entre produits et réactifs.' } ],
            detail: '<p>On part de <a class="fref" href="#f-F15">F15</a> <span class="m">H=U+PV</span>. Pour les constituants gazeux, <a class="fref" href="#f-F6">F6</a> donne <span class="m">PV=n_{\\text{gaz}}RT</span> ; à <span class="m">T</span> constante, <span class="m">\\Delta(PV)=\\Delta n_{\\text{gaz}}RT</span>. Les phases condensées (solides, liquides) ont un <span class="m">\\Delta(PV)</span> négligeable.</p>' }
        ]
      },
      {
        titre: 'III.3. Enthalpie standard de réaction',
        steps: [
          { html: '<p>Dans les conditions standard (<span class="m">P=1\\,\\mathrm{atm}</span>, souvent <span class="m">T=298\\,\\mathrm{K}</span>) :</p>',
            formules: [ { id: 'F24', tex: '\\Delta_r H^{\\circ} = \\sum_{\\text{prod}} \\nu_i\\,\\Delta_f H^{\\circ}_i - \\sum_{\\text{r\u00e9act}} \\nu_j\\,\\Delta_f H^{\\circ}_j', leg: 'ν : coefficients stœchiométriques · Δ_fH° : enthalpie standard de formation.' } ],
            detail: '<p>Par convention, l’enthalpie standard de formation d’un <i>corps simple</i> dans son état le plus stable est nulle.</p>' }
        ]
      },
      {
        titre: 'III.4. Loi de Hess',
        steps: [
          { html: '<p><b>Loi de Hess :</b> l’enthalpie d’une réaction ne dépend que des états initial et final, pas du chemin suivi — c’est une conséquence directe du caractère de <i>fonction d’état</i> de <span class="m">H</span> (<a class="fref" href="#f-F8">F8</a>).</p>',
            formules: [ { id: 'F25', tex: '\\Delta_r H = \\sum_k \\Delta_r H_k \\quad\\text{(pour tout chemin d\u00e9compos\u00e9 en \u00e9tapes } k)', leg: 'On additionne les enthalpies d’étapes intermédiaires d’un cycle thermochimique.' } ] }
        ]
      },
      {
        titre: 'III.5. Loi de Kirchhoff',
        steps: [
          { html: '<p>Comment varie l’enthalpie de réaction avec la température ? La <b>loi de Kirchhoff</b> relie cette variation aux capacités calorifiques (<a class="fref" href="#f-F16">F16</a>) :</p>',
            formules: [ { id: 'F26', tex: '\\frac{\\mathrm{d}(\\Delta_r H^{\\circ})}{\\mathrm{d}T} = \\Delta_r C_P \\;\\Rightarrow\\; \\Delta_r H^{\\circ}(T_2)=\\Delta_r H^{\\circ}(T_1)+\\int_{T_1}^{T_2}\\Delta_r C_P\\,\\mathrm{d}T', leg: 'Δ_rC_P = ΣνC_P(produits) − ΣνC_P(réactifs).' } ] }
        ]
      },
      {
        titre: 'III.6. Énergie de liaison',
        steps: [
          { html: '<p>L’<b>énergie de liaison</b> est l’enthalpie nécessaire pour rompre une mole de liaisons en phase gazeuse. Par la loi de Hess (<a class="fref" href="#f-F25">F25</a>) :</p>',
            formules: [ { id: 'F27', tex: '\\Delta_r H^{\\circ} \\approx \\sum E_{\\text{liaisons rompues}} - \\sum E_{\\text{liaisons form\u00e9es}}', leg: 'Bilan : énergie fournie pour casser − énergie libérée en formant.' } ] }
        ]
      }
    ]
  });
})(window.COURS.thermo);
(function (C) {
  C.chapitres.push({
    titre: 'Chapitre IV — Deuxième principe, entropie, machines thermiques',
    sections: [
      {
        titre: 'IV.2–IV.3. Nécessité et énoncés du second principe',
        steps: [
          { html: '<p>Le premier principe (<a class="fref" href="#f-F10">F10</a>) comptabilise l’énergie mais n’indique pas le <i>sens</i> d’évolution. Le <b>second principe</b> le fixe.</p><ul><li><b>Clausius :</b> la chaleur ne passe jamais spontanément du froid vers le chaud.</li><li><b>Kelvin :</b> on ne peut pas, avec une seule source, convertir intégralement de la chaleur en travail.</li></ul>' },
          { html: '<p><b>Énoncé mathématique</b> (inégalité de Clausius) :</p>',
            formules: [ { id: 'F28', tex: '\\oint \\frac{\\delta Q}{T} \\le 0 \\qquad \\mathrm{d}S \\ge \\frac{\\delta Q}{T}', leg: 'égalité si réversible, inégalité stricte si irréversible.' } ] }
        ]
      },
      {
        titre: 'IV.4. Notion d’entropie',
        steps: [
          { html: '<p>L’<b>entropie</b> <span class="m">S</span> est la fonction d’état (<a class="fref" href="#f-F8">F8</a>) dont la différentielle, pour une transformation réversible, vaut :</p>',
            formules: [ { id: 'F29', tex: '\\mathrm{d}S = \\frac{\\delta Q_{\\text{rev}}}{T} \\qquad [\\mathrm{J\\,K^{-1}}]', leg: 'Pour aller d’un état à l’autre on intègre sur un chemin réversible, même si la transfo réelle ne l’est pas.' } ] }
        ]
      },
      {
        titre: 'IV.5. Variation d’entropie selon la transformation',
        steps: [
          { html: '<p><b>Isotherme réversible</b> : on intègre <a class="fref" href="#f-F29">F29</a> à <span class="m">T</span> constante, avec <span class="m">Q</span> tiré de <a class="fref" href="#f-F21">F21</a>.</p>',
            formules: [ { id: 'F30', tex: '\\Delta S = \\frac{Q_{\\text{rev}}}{T} = n\\,R\\,\\ln\\!\\frac{V_2}{V_1}', leg: 'Une détente (V₂>V₁) augmente l’entropie.' } ] },
          { html: '<p><b>Isobare réversible</b> : <span class="m">\\delta Q = nC_P\\,\\mathrm{d}T</span> (<a class="fref" href="#f-F20">F20</a>).</p>',
            formules: [ { id: 'F31', tex: '\\Delta S = n\\,C_P\\,\\ln\\!\\frac{T_2}{T_1}', leg: 'Chauffer à pression constante.' } ] },
          { html: '<p><b>Isochore réversible</b> : <span class="m">\\delta Q = nC_V\\,\\mathrm{d}T</span> (<a class="fref" href="#f-F19">F19</a>).</p>',
            formules: [ { id: 'F32', tex: '\\Delta S = n\\,C_V\\,\\ln\\!\\frac{T_2}{T_1}', leg: 'Chauffer à volume constant.' } ] },
          { html: '<p><b>Adiabatique réversible</b> : <span class="m">\\delta Q=0</span>, donc l’entropie est conservée (transformation isentropique).</p>',
            formules: [ { id: 'F33', tex: '\\Delta S = 0', leg: 'C’est la définition d’une évolution isentropique.' } ] },
          { html: '<p><b>Changement d’état</b> à température constante (chaleur latente, <a class="fref" href="#f-F12">F12</a>) :</p>',
            formules: [ { id: 'F34', tex: '\\Delta S = \\frac{Q}{T} = \\frac{m\\,L}{T}', leg: 'Fusion / vaporisation / sublimation à la température de transition.' } ] }
        ]
      },
      {
        titre: 'IV.6. Nouvelles expressions de l’entropie',
        steps: [
          { html: '<p>En combinant le premier principe <a class="fref" href="#f-F9">F9</a> et la définition <a class="fref" href="#f-F29">F29</a>, pour une mole de gaz parfait :</p>',
            formules: [ { id: 'F35', tex: '\\mathrm{d}S = n\\,C_V\\frac{\\mathrm{d}T}{T} + n\\,R\\frac{\\mathrm{d}V}{V}', leg: 'Entropie en fonction de T et V.' },
                         { id: 'F36', tex: '\\mathrm{d}S = n\\,C_P\\frac{\\mathrm{d}T}{T} - n\\,R\\frac{\\mathrm{d}P}{P}', leg: 'Entropie en fonction de T et P (via H, F15, et Mayer F17).' } ],
            detail: '<p>Pour <a class="fref" href="#f-F35">F35</a> : <span class="m">\\delta Q_{\\text{rev}}=\\mathrm{d}U+P\\,\\mathrm{d}V=nC_V\\,\\mathrm{d}T+P\\,\\mathrm{d}V</span>, puis <span class="m">P/T=nR/V</span> (<a class="fref" href="#f-F6">F6</a>). Diviser par <span class="m">T</span> donne le résultat. On passe à <a class="fref" href="#f-F36">F36</a> en utilisant <span class="m">H</span> au lieu de <span class="m">U</span> et la relation de Mayer <a class="fref" href="#f-F17">F17</a>.</p>' }
        ]
      },
      {
        titre: 'IV.7. Entropie créée',
        steps: [
          { html: '<p>Toute transformation réelle crée de l’entropie. On sépare l’échange et la création :</p>',
            formules: [ { id: 'F37', tex: '\\Delta S = \\Delta S_{\\text{\u00e9ch}} + \\Delta S_{\\text{cr\u00e9\u00e9e}}, \\quad \\Delta S_{\\text{\u00e9ch}}=\\frac{Q}{T_{\\text{\u00e9ch}}}, \\quad \\Delta S_{\\text{cr\u00e9\u00e9e}}\\ge 0', leg: 'ΔS_créée = 0 si réversible, > 0 si irréversible (jamais < 0).' } ],
            detail: '<p>C’est la forme « bilan » de l’inégalité de Clausius <a class="fref" href="#f-F28">F28</a> : la positivité de <span class="m">\\Delta S_{\\text{cr\u00e9\u00e9e}}</span> impose le sens des évolutions spontanées.</p>' }
        ]
      },
      {
        titre: 'IV.8–IV.9. Entropie et enthalpie libre d’une réaction',
        steps: [
          { html: '<p>Entropie standard de réaction (même logique que <a class="fref" href="#f-F24">F24</a>) :</p>',
            formules: [ { id: 'F38', tex: '\\Delta_r S^{\\circ} = \\sum_{\\text{prod}}\\nu_i S^{\\circ}_i - \\sum_{\\text{r\u00e9act}}\\nu_j S^{\\circ}_j', leg: 'S° : entropies molaires standard.' } ] },
          { html: '<p><b>Enthalpie libre de Gibbs</b> <span class="m">G</span> : elle décide du sens spontané à <span class="m">T,P</span> fixés, en combinant énergie (<a class="fref" href="#f-F15">F15</a>) et désordre (<a class="fref" href="#f-F29">F29</a>).</p>',
            formules: [ { id: 'F39', tex: 'G = H - T\\,S \\qquad \\Delta_r G^{\\circ} = \\Delta_r H^{\\circ} - T\\,\\Delta_r S^{\\circ}', leg: 'ΔG<0 : réaction spontanée · ΔG=0 : équilibre · ΔG>0 : non spontanée.' } ] }
        ]
      },
      {
        titre: 'IV.10–IV.11. Machines thermiques et cycles',
        steps: [
          { html: '<p>Une machine thermique fonctionne entre une <b>source chaude</b> (<span class="m">T_c</span>) et une <b>source froide</b> (<span class="m">T_f</span>). Les <i>machines thermodynamiques</i> (moteurs) produisent du travail ; les <i>machines dynamo-thermiques</i> (frigos, pompes à chaleur) transfèrent la chaleur au prix d’un travail. Bilan (1er principe) : <span class="m">Q_2 = W + Q_1</span>.</p>' },
          { html: '<p><b>Cycle de Carnot</b> (rendement maximal, référence de tous les autres) : détente isotherme → détente adiabatique → compression isotherme → compression adiabatique.</p>',
            formules: [ { id: 'F40', tex: '\\eta_{\\text{Carnot}} = 1 - \\frac{Q_f}{Q_c} = 1 - \\frac{T_f}{T_c}', leg: 'Rendement toujours < 1 (énoncé de Kelvin, F28) ; il augmente quand l’écart T_c−T_f grandit.' } ],
            detail: '<p>Les autres cycles en découlent par leurs transformations caractéristiques : <b>Beau de Rochas/Otto</b> (essence : 2 adiabatiques + 2 isochores), <b>Diesel</b> (2 adiabatiques + 1 isobare + 1 isochore), <b>Rankine</b> (vapeur : 2 adiabatiques + 2 isobares), <b>Stirling</b> (2 isothermes + 2 isochores). Chacun se calcule avec les transformations <a class="fref" href="#f-F19">F19</a>–<a class="fref" href="#f-F22">F22</a>.</p>' }
        ]
      }
    ]
  });
})(window.COURS.thermo);
