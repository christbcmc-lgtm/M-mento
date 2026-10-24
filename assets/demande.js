/* Mémento — page de demande (étape 1 : interface + validation de format).
   L'envoi réel de la demande à l'administrateur sera branché au backend à l'étape 2. */
(function () {
  var CIT = [
    "Apprendre, c'est se souvenir de ce qu'on a compris.",
    "Un peu chaque jour vaut mieux que beaucoup une seule fois.",
    "La persévérance transforme le difficile en habitude."
  ];
  function $(id){ return document.getElementById(id); }
  function validEmail(v){ return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); }

  document.addEventListener('DOMContentLoaded', function(){
    var form = $('f-dem');
    if (form) form.addEventListener('submit', function(e){
      e.preventDefault();
      var err = $('d-err'); err.textContent = '';
      var nom = $('d-nom').value.trim();
      var prenom = $('d-prenom').value.trim();
      var email = $('d-mail').value.trim();
      if (!nom || !prenom) { err.textContent = 'Nom et prénom sont requis.'; return; }
      if (!validEmail(email)) { err.textContent = 'Adresse email invalide.'; return; }
      // Étape 2 : POST de la demande -> notification à l'administrateur.
      $('cit').textContent = '« ' + CIT[Math.floor(Math.random()*CIT.length)] + ' »';
      $('ov').classList.add('on');
    });
  });
})();
