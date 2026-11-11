'use strict';

/* =====================================================================
   APPLI MUSCU : tout le fonctionnement est dans ce fichier.

   Plan du fichier :
   1. Données et sauvegarde locale
   2. Petites fonctions utilitaires (dates, nombres, texte)
   3. Calculs : poids total, comparaison au même poids, pré-remplissage
   4. Navigation entre les écrans
   5. Dessin des écrans (une fonction par écran)
   6. Actions déclenchées par les boutons
   7. Export / import de la sauvegarde
   8. Démarrage
   ===================================================================== */


/* ============ 1. DONNÉES ET SAUVEGARDE LOCALE ============ */

// Les données sont rangées dans le "localStorage" : un petit espace de stockage
// du navigateur, propre à cette appli, qui reste sur le téléphone après fermeture.
const CLE_STOCKAGE = 'muscu-data-v1';

const RESSENTIS = { bonne: 'Bonne', moyenne: 'Moyenne', mauvaise: 'Mauvaise' };
const PAS_POIDS = 2.5; // kg ajoutés ou retirés à chaque appui sur + ou −

/* Forme des données :
   donnees = {
     reglages: { microKg: 2.3 },
     seances: [                      // les modèles créés dans "Créer mes séances"
       { id, nom, exercices: [ { id, nom, series } ] }
     ],
     entrainements: [                // l'historique : une entrée par séance réalisée
       { id, date: "2026-11-11", cree, seanceId, nom,
         exercices: [ { nom, prevu, series: [ { poids, micro, microKg, reps, ressenti } ] } ] }
     ]
   }
*/
function donneesVides() {
  return { version: 1, reglages: { microKg: 2.3 }, seances: [], entrainements: [] };
}

// Vérifie et remet en forme des données lues (stockage ou fichier importé).
function nettoyer(d) {
  if (!d || typeof d !== 'object' || !Array.isArray(d.seances) || !Array.isArray(d.entrainements)) {
    throw new Error('Format inconnu');
  }
  const nombre = (v, defaut) => {
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? n : defaut;
  };
  const texte = (v) => String(v == null ? '' : v).slice(0, 80);
  const liste = (v) => (Array.isArray(v) ? v.filter(Boolean) : []);
  const micro = Number(d.reglages && d.reglages.microKg);

  return {
    version: 1,
    reglages: { microKg: micro > 0 ? micro : 2.3 },
    seances: liste(d.seances).map((s) => ({
      id: texte(s.id) || nouvelId(),
      nom: texte(s.nom),
      exercices: liste(s.exercices).map((e) => ({
        id: texte(e.id) || nouvelId(),
        nom: texte(e.nom),
        series: Math.max(1, Math.round(nombre(e.series, 1)))
      }))
    })),
    entrainements: liste(d.entrainements)
      .filter((w) => /^\d{4}-\d{2}-\d{2}$/.test(w.date))
      .map((w) => ({
        id: texte(w.id) || nouvelId(),
        date: w.date,
        cree: nombre(w.cree, 0),
        seanceId: texte(w.seanceId),
        nom: texte(w.nom),
        exercices: liste(w.exercices).map((e) => ({
          nom: texte(e.nom),
          prevu: Math.round(nombre(e.prevu, 0)),
          series: liste(e.series).map((s) => ({
            poids: nombre(s.poids, 0),
            micro: Math.round(nombre(s.micro, 0)),
            microKg: nombre(s.microKg, 2.3),
            reps: Math.round(nombre(s.reps, 0)),
            ressenti: RESSENTIS[s.ressenti] ? s.ressenti : 'bonne'
          }))
        }))
      }))
  };
}

function charger() {
  let brut = null;
  try {
    brut = localStorage.getItem(CLE_STOCKAGE);
    if (!brut) return donneesVides();
    return nettoyer(JSON.parse(brut));
  } catch (e) {
    // Données illisibles : on en garde une copie de secours avant de repartir à zéro.
    try { if (brut) localStorage.setItem(CLE_STOCKAGE + '-illisible', brut); } catch (e2) { /* rien */ }
    return donneesVides();
  }
}

// À appeler après chaque modification : écrit tout dans le téléphone.
function enregistrer() {
  try {
    localStorage.setItem(CLE_STOCKAGE, JSON.stringify(donnees));
  } catch (e) {
    alert("Impossible d'enregistrer les données sur le téléphone (stockage plein ou bloqué).");
  }
}

let donnees = charger();


/* ============ 2. UTILITAIRES ============ */

const JOURS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
const JOURS_COURTS = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const MOIS_COURTS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

function nouvelId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// Protège le texte tapé par l'utilisateur avant de l'insérer dans la page.
function esc(t) {
  return String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function deux(n) { return (n < 10 ? '0' : '') + n; }

// Date au format "2026-11-11" (pratique à comparer et à trier).
function versTexteDate(d) {
  return d.getFullYear() + '-' + deux(d.getMonth() + 1) + '-' + deux(d.getDate());
}
function aujourdhui() { return versTexteDate(new Date()); }
function versDate(texte) {
  const p = texte.split('-').map(Number);
  return new Date(p[0], p[1] - 1, p[2]);
}
// "Mercredi 11 novembre"
function dateLongue(texte) {
  const d = versDate(texte);
  return JOURS[d.getDay()] + ' ' + d.getDate() + ' ' + MOIS[d.getMonth()];
}
// "mer. 4 nov."
function dateCourte(texte) {
  const d = versDate(texte);
  return JOURS_COURTS[d.getDay()] + ' ' + d.getDate() + ' ' + MOIS_COURTS[d.getMonth()];
}

function arrondi(n) { return Math.round(n * 100) / 100; }
// Affiche un nombre à la française : 82.3 devient "82,3".
function fmt(n) { return String(arrondi(n)).replace('.', ','); }
// Lit un nombre tapé dans un champ ("82,3" ou "82.3"). Renvoie NaN si ce n'est pas un nombre.
function lireNombre(id) {
  const champ = document.getElementById(id);
  if (!champ) return NaN;
  const t = champ.value.trim().replace(',', '.');
  return t === '' ? NaN : Number(t);
}
function pluriel(n, mot) { return n + ' ' + mot + (n > 1 ? 's' : ''); }
// Sert à reconnaître un même exercice même si la casse ou les espaces diffèrent.
function cle(nom) { return nom.trim().toLowerCase(); }

const ICONE_RETOUR = '<svg aria-hidden="true" width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4 L6 10 L12 16"/></svg>';
const ICONE_SUIVANT = '<svg aria-hidden="true" width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 4 L14 10 L8 16"/></svg>';
const FLECHE_HAUT = '<svg aria-hidden="true" width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 12 L7 2 M3 6 L7 2 L11 6"/></svg>';
const FLECHE_BAS = '<svg aria-hidden="true" width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 2 L7 12 M3 8 L7 12 L11 8"/></svg>';


/* ============ 3. CALCULS ============ */

// Poids total d'une série = poids + nombre de micro-charges × poids d'une micro-charge.
function poidsTotal(serie) {
  return arrondi(serie.poids + serie.micro * serie.microKg);
}

function trouverEntrainement(id) {
  return donnees.entrainements.find((w) => w.id === id);
}

function aDesSeries(w) {
  return w.exercices.some((e) => e.series.length > 0);
}

// Entraînements antérieurs à celui donné, du plus récent au plus ancien.
function entrainementsPrecedents(w) {
  const tries = donnees.entrainements.slice().sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    return a.cree - b.cree;
  });
  const position = tries.findIndex((x) => x.id === w.id);
  return (position < 0 ? tries : tries.slice(0, position)).reverse();
}

/* Comparaison AU MÊME POIDS TOTAL.
   On cherche la dernière séance où cet exercice a été fait à ce poids total exact :
   - si la série de même numéro y a été faite à ce poids, on la prend ;
   - sinon on prend la meilleure série à ce poids de cette séance-là.
   Renvoie null s'il n'existe aucune série à ce poids dans l'historique. */
function reference(w, nomExercice, indexSerie, total) {
  const k = cle(nomExercice);
  for (const ancien of entrainementsPrecedents(w)) {
    const ex = ancien.exercices.find((e) => cle(e.nom) === k);
    if (!ex) continue;
    const memePoids = ex.series
      .map((serie, index) => ({ serie, index }))
      .filter((o) => poidsTotal(o.serie) === total);
    if (memePoids.length === 0) continue;

    const memeNumero = memePoids.find((o) => o.index === indexSerie);
    if (memeNumero) {
      return { reps: memeNumero.serie.reps, numero: indexSerie + 1, date: ancien.date, meilleure: false };
    }
    const meilleure = memePoids.reduce((a, b) => (b.serie.reps > a.serie.reps ? b : a));
    return { reps: meilleure.serie.reps, numero: meilleure.index + 1, date: ancien.date, meilleure: true };
  }
  return null;
}

// Petit indicateur visuel : progression, égalité ou régression.
function htmlEcart(ecart) {
  if (ecart > 0) return '<span class="cmp haut">' + FLECHE_HAUT + '+' + pluriel(ecart, 'rep') + '</span>';
  if (ecart < 0) return '<span class="cmp bas">' + FLECHE_BAS + '−' + pluriel(-ecart, 'rep') + '</span>';
  return '<span class="cmp egal">= égalité</span>';
}

function htmlComparaisonSerie(w, ex, index) {
  const serie = ex.series[index];
  const ref = reference(w, ex.nom, index, poidsTotal(serie));
  if (!ref) return '<span class="cmp neutre">1re fois à ce poids</span>';
  return htmlEcart(serie.reps - ref.reps);
}

// "Forme dégradée dès la série X" : première série qui n'est pas notée "bonne".
function htmlDegradation(ex) {
  const i = ex.series.findIndex((s) => s.ressenti !== 'bonne');
  return i < 0 ? '' : '<div class="degradation">Forme dégradée dès la série ' + (i + 1) + '</div>';
}

// Valeurs proposées d'avance pour une nouvelle série.
function preRemplir(w, indexExo, indexSerie) {
  const ex = w.exercices[indexExo];
  const k = cle(ex.nom);
  let derniere = null; // le même exercice lors de la dernière séance où il a été fait
  for (const ancien of entrainementsPrecedents(w)) {
    const e = ancien.exercices.find((x) => cle(x.nom) === k);
    if (e && e.series.length > 0) { derniere = e; break; }
  }
  const modele =
    (derniere && derniere.series[indexSerie]) ||          // même numéro de série, la dernière fois
    ex.series[indexSerie - 1] ||                          // sinon la série précédente d'aujourd'hui
    (derniere && derniere.series[derniere.series.length - 1]); // sinon la dernière série de la dernière fois
  if (!modele) return { poids: 0, micro: 0, reps: 0 };
  return { poids: modele.poids, micro: modele.micro, reps: modele.reps };
}

// Une séance ouverte par erreur (aucune série saisie) ne doit pas apparaître dans le calendrier.
function retirerEntrainementsVides() {
  const avant = donnees.entrainements.length;
  donnees.entrainements = donnees.entrainements.filter(aDesSeries);
  if (donnees.entrainements.length !== avant) enregistrer();
}


/* ============ 4. NAVIGATION ============ */

// La "pile" retient le chemin parcouru : le dernier élément est l'écran affiché.
// Le bouton retour enlève le dernier élément.
let pile = [{ ecran: 'accueil' }];

// Mémoire temporaire des formulaires (non sauvegardée tant qu'on n'a pas validé).
let brouillon = null;          // séance en cours de création / modification
let brouillonModifie = false;
let exoBrouillon = null;       // exercice en cours de saisie
let formulaire = null;         // série en cours de saisie
const exoOuvert = {};          // pour chaque entraînement : numéro de l'exercice déplié

const app = document.getElementById('app');

function courant() { return pile[pile.length - 1]; }

function aller(etape) {
  courant().defilement = window.scrollY;
  pile.push(etape);
  afficher(false);
}

function retour() {
  if (pile.length > 1) pile.pop();
  afficher(true);
}

function afficher(garderDefilement) {
  const etape = courant();
  app.innerHTML = ECRANS[etape.ecran](etape);
  window.scrollTo(0, garderDefilement ? (etape.defilement || 0) : 0);
  if (etape.ecran === 'serie') majComparaison();
}

function erreur(message) {
  const zone = document.getElementById('erreur');
  if (zone) zone.textContent = message;
}


/* ============ 5. DESSIN DES ÉCRANS ============ */

function htmlEntete(titre, sous, sousBleu) {
  return '<div class="entete">' +
    '<button class="retour" data-a="retour" aria-label="Retour">' + ICONE_RETOUR + '</button>' +
    '<div><h1>' + esc(titre) + '</h1>' +
    (sous ? '<div class="sous' + (sousBleu ? ' bleu-texte' : '') + '">' + esc(sous) + '</div>' : '') +
    '</div></div>';
}

// Champ numérique avec gros boutons − et +.
function htmlCompteur(id, etiquette, valeur, pas, clavier) {
  return '<div class="champ"><label for="' + id + '">' + etiquette + '</label><div class="pas">' +
    '<button class="pas-btn" data-a="pas" data-cible="' + id + '" data-d="' + (-pas) + '" aria-label="Diminuer">−</button>' +
    '<input class="pas-val" id="' + id + '" type="text" inputmode="' + clavier + '" autocomplete="off" value="' + valeur + '">' +
    '<button class="pas-btn" data-a="pas" data-cible="' + id + '" data-d="' + pas + '" aria-label="Augmenter">+</button>' +
    '</div></div>';
}

const ECRANS = {

  /* ----- Écran 1 : accueil ----- */
  accueil() {
    retirerEntrainementsVides();
    return '<div class="ecran">' +
      '<div class="entete-accueil"><div class="gris">' + dateLongue(aujourdhui()) + '</div>' +
      '<h1 class="grand-titre">Musculation</h1></div>' +
      '<button class="gros" data-a="ouvrir" data-ecran="seances"><span class="gros-titre">Créer mes séances</span>' +
      '<span class="gris">Séances, exercices, nombre de séries</span></button>' +
      '<button class="gros bleu" data-a="ouvrir" data-ecran="choix"><span class="gros-titre">Séance du jour</span>' +
      '<span class="gris">Choisir une séance et commencer</span></button>' +
      '<div class="deux"><button class="btn" data-a="calendrier">Calendrier</button>' +
      '<button class="btn" data-a="ouvrir" data-ecran="reglages">Réglages</button></div>' +
      '</div>';
  },

  /* ----- Écran 2 : liste de mes séances ----- */
  seances() {
    const lignes = donnees.seances.map((s) =>
      '<button class="ligne haute" data-a="seance-modifier" data-id="' + s.id + '">' +
      '<span class="colonne"><span class="ligne-titre">' + esc(s.nom) + '</span>' +
      '<span class="gris">' + pluriel(s.exercices.length, 'exercice') + '</span></span>' +
      '<span class="gris">' + ICONE_SUIVANT + '</span></button>').join('');
    return '<div class="ecran">' + htmlEntete('Mes séances') +
      (lignes
        ? '<div class="gris">Appuie sur une séance pour la modifier.</div><div class="liste">' + lignes + '</div>'
        : '<div class="note">Aucune séance pour l\'instant. Crée la première avec le bouton ci-dessous.</div>') +
      '<div class="pousse"></div>' +
      '<button class="btn principal" data-a="seance-nouvelle">+ Nouvelle séance</button></div>';
  },

  /* ----- Écran 3 : créer / modifier une séance ----- */
  seance() {
    const exos = brouillon.exercices.map((e, i) =>
      '<button class="ligne" data-a="exo-modifier" data-i="' + i + '"><span class="ligne-titre">' + esc(e.nom) + '</span>' +
      '<span class="gris">' + pluriel(e.series, 'série') + '</span></button>').join('');
    return '<div class="ecran">' + htmlEntete(brouillon.id ? 'Modifier la séance' : 'Nouvelle séance') +
      '<div class="champ"><label for="nom-seance">Nom de la séance</label>' +
      '<input class="texte" id="nom-seance" type="text" maxlength="40" autocomplete="off" placeholder="Push, Pull, Legs…" value="' + esc(brouillon.nom) + '"></div>' +
      '<div class="gris">Exercices' + (exos ? ' (appuie pour modifier)' : '') + '</div>' +
      '<div class="liste">' + exos +
      '<button class="btn pointille" data-a="exo-nouveau">+ Ajouter un exercice</button></div>' +
      '<div class="pousse"></div><div class="erreur" id="erreur" role="alert"></div>' +
      '<button class="btn principal" data-a="seance-enregistrer">Enregistrer la séance</button>' +
      (brouillon.id ? '<button class="btn discret" data-a="seance-supprimer">Supprimer la séance</button>' : '') +
      '</div>';
  },

  /* ----- Écran 4 : ajouter / modifier un exercice ----- */
  exercice() {
    return '<div class="ecran">' + htmlEntete('Exercice', brouillon.nom ? 'Séance : ' + brouillon.nom : '') +
      '<div class="champ"><label for="nom-exo">Nom de l\'exercice</label>' +
      '<input class="texte" id="nom-exo" type="text" maxlength="50" autocomplete="off" placeholder="Développé couché…" value="' + esc(exoBrouillon.nom) + '"></div>' +
      '<div class="champ"><div class="etiquette">Nombre de séries prévu</div><div class="pas grand">' +
      '<button class="pas-btn" data-a="exo-series" data-d="-1" aria-label="Une série de moins">−</button>' +
      '<div class="pas-val" id="nb-series">' + exoBrouillon.series + '</div>' +
      '<button class="pas-btn" data-a="exo-series" data-d="1" aria-label="Une série de plus">+</button></div></div>' +
      '<div class="pousse"></div><div class="erreur" id="erreur" role="alert"></div>' +
      '<button class="btn principal" data-a="exo-enregistrer">Enregistrer l\'exercice</button>' +
      (exoBrouillon.index >= 0 ? '<button class="btn discret" data-a="exo-supprimer">Supprimer l\'exercice</button>' : '') +
      '</div>';
  },

  /* ----- Écran 5 : réglages + sauvegarde ----- */
  reglages() {
    const nb = donnees.entrainements.filter(aDesSeries).length;
    return '<div class="ecran">' + htmlEntete('Réglages') +
      '<div class="champ"><label for="f-microkg">Poids d\'une micro-charge</label><div class="unite">' +
      '<input class="texte" id="f-microkg" type="text" inputmode="decimal" autocomplete="off" value="' + fmt(donnees.reglages.microKg) + '"><span>kg</span></div></div>' +
      '<div class="note">Pendant une séance, tu indiques combien de micro-charges tu ajoutes. L\'appli calcule le poids total :<br>' +
      '<b>poids + nombre × ' + fmt(donnees.reglages.microKg) + ' kg</b><br>' +
      'Les séries déjà enregistrées gardent la valeur utilisée ce jour-là.</div>' +
      '<div class="erreur" id="erreur" role="alert"></div>' +
      '<button class="btn principal" data-a="reglages-enregistrer">Enregistrer</button>' +
      '<div class="titre-section">Sauvegarde</div>' +
      '<div class="note">' + pluriel(donnees.seances.length, 'séance') + ' créée' + (donnees.seances.length > 1 ? 's' : '') +
      ', ' + pluriel(nb, 'entraînement') + ' dans l\'historique. Exporte régulièrement un fichier de sauvegarde et garde-le dans Fichiers ou iCloud.</div>' +
      '<button class="btn contour" data-a="exporter">Exporter mes données</button>' +
      '<label class="btn" for="f-import">Importer une sauvegarde' +
      '<input type="file" id="f-import" accept=".json,application/json,text/plain"></label>' +
      '<div class="info" id="info" role="status"></div>' +
      '</div>';
  },

  /* ----- Écran 6 : séance du jour, choix de la séance ----- */
  choix() {
    const auj = aujourdhui();
    const boutons = donnees.seances.map((s) => {
      const enCours = donnees.entrainements.some((w) => w.date === auj && w.seanceId === s.id && aDesSeries(w));
      return '<button class="choix" data-a="demarrer" data-id="' + s.id + '"><span class="choix-titre">' + esc(s.nom) + '</span>' +
        '<span class="gris">' + (enCours ? 'Déjà commencée aujourd\'hui : reprendre' : pluriel(s.exercices.length, 'exercice')) + '</span></button>';
    }).join('');
    if (!boutons) {
      return '<div class="ecran">' + htmlEntete('Séance du jour', dateLongue(auj)) +
        '<div class="note">Tu n\'as pas encore créé de séance.</div>' +
        '<button class="btn principal" data-a="ouvrir" data-ecran="seances">Créer mes séances</button></div>';
    }
    return '<div class="ecran">' + htmlEntete('Séance du jour', dateLongue(auj)) +
      '<div class="titre-section">Quelle séance fais-tu aujourd\'hui ?</div>' +
      '<div class="liste">' + boutons + '</div>' +
      '<div class="pousse"></div>' +
      '<div class="gris centre">La séance est enregistrée à la date d\'aujourd\'hui dès ta première série.</div></div>';
  },

  /* ----- Écran 7 : séance en cours (ou séance passée en modification) ----- */
  entrainement(etape) {
    const w = trouverEntrainement(etape.id);
    if (!w) return '<div class="ecran">' + htmlEntete('Séance introuvable') + '</div>';

    // Exercice déplié : celui choisi, sinon le premier qui n'est pas terminé.
    let ouvert = exoOuvert[w.id];
    if (ouvert === undefined) {
      ouvert = w.exercices.findIndex((e) => e.series.length < e.prevu);
      if (ouvert < 0) ouvert = 0;
    }

    const exos = w.exercices.map((ex, i) => {
      const compteur = ex.series.length + ' / ' + pluriel(ex.prevu, 'série');
      if (i !== ouvert) {
        return '<button class="ligne" data-a="exo-ouvrir" data-i="' + i + '"><span class="ligne-titre">' + esc(ex.nom) + '</span>' +
          '<span class="gris">' + compteur + '</span></button>';
      }
      const series = ex.series.map((s, j) =>
        '<button class="serie" data-a="serie-modifier" data-e="' + i + '" data-i="' + j + '">' +
        '<span class="serie-no">' + (j + 1) + '</span>' +
        '<span class="serie-val">' + fmt(poidsTotal(s)) + ' kg × ' + s.reps + '</span>' +
        htmlComparaisonSerie(w, ex, j) +
        '<span class="ressenti ' + s.ressenti + '">' + RESSENTIS[s.ressenti] + '</span></button>').join('');
      const reste = ex.series.length < ex.prevu;
      return '<div class="carte"><div class="carte-tete"><div class="carte-titre">' + esc(ex.nom) + '</div>' +
        '<div class="gris">' + compteur + '</div></div>' + series +
        '<button class="btn ' + (reste ? 'principal' : 'pointille') + '" data-a="serie-nouvelle" data-e="' + i + '">' +
        (reste ? 'Saisir la série ' + (ex.series.length + 1) : '+ Série supplémentaire') + '</button>' +
        htmlDegradation(ex) + '</div>';
    }).join('');

    const estAujourdhui = w.date === aujourdhui();
    return '<div class="ecran">' + htmlEntete(w.nom, dateLongue(w.date)) +
      (exos ? '<div class="liste">' + exos + '</div>'
        : '<div class="note">Cette séance ne contient aucun exercice. Ajoute-en dans « Créer mes séances ».</div>') +
      '<div class="pousse"></div>' +
      '<button class="btn contour" data-a="terminer">' + (estAujourdhui ? 'Terminer la séance' : 'Terminer les modifications') + '</button></div>';
  },

  /* ----- Écran 8 : saisie d'une série ----- */
  serie(etape) {
    const w = trouverEntrainement(etape.id);
    const ex = w.exercices[etape.e];
    const existe = etape.i < ex.series.length;
    const total = Math.max(ex.prevu, ex.series.length + (existe ? 0 : 1));
    const boutons = Object.keys(RESSENTIS).map((v) =>
      '<button data-a="ressenti" data-v="' + v + '" aria-pressed="' + (formulaire.ressenti === v) + '">' + RESSENTIS[v] + '</button>').join('');
    return '<div class="ecran">' + htmlEntete(ex.nom, 'Série ' + (etape.i + 1) + ' sur ' + total) +
      htmlCompteur('f-poids', 'Poids (kg)', fmt(formulaire.poids), PAS_POIDS, 'decimal') +
      htmlCompteur('f-reps', 'Répétitions', formulaire.reps, 1, 'numeric') +
      htmlCompteur('f-micro', 'Micro-charges (' + fmt(formulaire.microKg) + ' kg chacune, optionnel)', formulaire.micro, 1, 'numeric') +
      '<div class="comparaison" id="comparaison" aria-live="polite"></div>' +
      '<div class="champ"><div class="etiquette">Exécution</div><div class="trois">' + boutons + '</div></div>' +
      '<div class="pousse"></div><div class="erreur" id="erreur" role="alert"></div>' +
      '<button class="btn principal" data-a="serie-valider">Valider la série</button>' +
      (existe ? '<button class="btn discret" data-a="serie-supprimer">Supprimer cette série</button>' : '') +
      '</div>';
  },

  /* ----- Écran 9 : calendrier ----- */
  calendrier(etape) {
    const parJour = {};
    donnees.entrainements.filter(aDesSeries).forEach((w) => {
      (parJour[w.date] = parJour[w.date] || []).push(w);
    });
    const auj = aujourdhui();
    const decalage = (new Date(etape.annee, etape.mois, 1).getDay() + 6) % 7; // lundi = première colonne
    const nbJours = new Date(etape.annee, etape.mois + 1, 0).getDate();

    let cases = '';
    for (let i = 0; i < decalage; i++) cases += '<div></div>';
    for (let j = 1; j <= nbJours; j++) {
      const date = etape.annee + '-' + deux(etape.mois + 1) + '-' + deux(j);
      const faits = parJour[date];
      const classeAuj = date === auj ? ' aujourdhui' : '';
      if (faits) {
        const nom = faits[0].nom + (faits.length > 1 ? ' +' + (faits.length - 1) : '');
        cases += '<button class="jour entraine' + classeAuj + '" data-a="jour" data-date="' + date + '" aria-label="' +
          esc(dateLongue(date) + ' : ' + faits.map((w) => w.nom).join(', ')) + '"><span>' + j + '</span><small>' + esc(nom) + '</small></button>';
      } else {
        cases += '<div class="jour' + classeAuj + '">' + j + '</div>';
      }
    }
    const titre = MOIS[etape.mois].charAt(0).toUpperCase() + MOIS[etape.mois].slice(1) + ' ' + etape.annee;
    return '<div class="ecran">' + htmlEntete('Calendrier') +
      '<div class="mois"><button data-a="mois" data-d="-1" aria-label="Mois précédent">' + ICONE_RETOUR + '</button>' +
      '<div class="mois-titre">' + titre + '</div>' +
      '<button data-a="mois" data-d="1" aria-label="Mois suivant">' + ICONE_SUIVANT + '</button></div>' +
      '<div class="semaine"><div>L</div><div>M</div><div>M</div><div>J</div><div>V</div><div>S</div><div>D</div></div>' +
      '<div class="grille">' + cases + '</div>' +
      '<div class="legende"><div><i class="plein"></i>Jour d\'entraînement, avec le nom de la séance</div>' +
      '<div><i class="vide"></i>Aujourd\'hui</div></div>' +
      '<div class="pousse"></div>' +
      '<div class="gris centre">Appuie sur un jour d\'entraînement pour voir le détail.</div></div>';
  },

  /* ----- Écran 10 : détail d'un jour passé ----- */
  jour(etape) {
    const faits = donnees.entrainements.filter((w) => w.date === etape.date && aDesSeries(w));
    const blocs = faits.map((w) => {
      const exos = w.exercices.filter((ex) => ex.series.length > 0).map((ex) => {
        const series = ex.series.map((s, j) =>
          '<div class="serie"><span class="serie-no">' + (j + 1) + '</span>' +
          '<span class="serie-val">' + fmt(poidsTotal(s)) + ' kg × ' + s.reps +
          (s.micro > 0 ? '<small>' + fmt(s.poids) + ' kg + ' + pluriel(s.micro, 'micro-charge') + '</small>' : '') + '</span>' +
          htmlComparaisonSerie(w, ex, j) +
          '<span class="ressenti ' + s.ressenti + '">' + RESSENTIS[s.ressenti] + '</span></div>').join('');
        return '<div class="carte"><div class="carte-titre">' + esc(ex.nom) + '</div>' + series + htmlDegradation(ex) + '</div>';
      }).join('');
      return '<div class="titre-section">Séance : ' + esc(w.nom) + '</div><div class="liste">' + exos + '</div>' +
        '<button class="btn contour" data-a="entrainement-ouvrir" data-id="' + w.id + '">Modifier cette séance</button>';
    }).join('');
    return '<div class="ecran">' + htmlEntete(dateLongue(etape.date), versDate(etape.date).getFullYear() + '') +
      (blocs || '<div class="note">Aucun entraînement enregistré ce jour-là.</div>') + '</div>';
  }
};


/* ============ 6. ACTIONS DES BOUTONS ============ */

// Chaque bouton porte un attribut data-a="nom-de-l-action".
// Un seul écouteur de clic lit cet attribut et lance la fonction correspondante.
const ACTIONS = {

  retour() {
    if (courant().ecran === 'seance' && brouillonModifie &&
        !confirm('Quitter sans enregistrer les changements de cette séance ?')) return;
    retour();
  },

  ouvrir(b) { aller({ ecran: b.dataset.ecran }); },

  /* --- Créer mes séances --- */
  'seance-nouvelle'() {
    brouillon = { id: null, nom: '', exercices: [] };
    brouillonModifie = false;
    aller({ ecran: 'seance' });
  },

  'seance-modifier'(b) {
    const s = donnees.seances.find((x) => x.id === b.dataset.id);
    if (!s) return;
    brouillon = JSON.parse(JSON.stringify(s)); // copie : rien n'est modifié tant qu'on n'enregistre pas
    brouillonModifie = false;
    aller({ ecran: 'seance' });
  },

  'seance-enregistrer'() {
    const nom = brouillon.nom.trim();
    if (!nom) return erreur('Donne un nom à la séance.');
    if (brouillon.exercices.length === 0) return erreur('Ajoute au moins un exercice.');
    brouillon.nom = nom;
    if (brouillon.id) {
      const i = donnees.seances.findIndex((x) => x.id === brouillon.id);
      donnees.seances[i] = brouillon;
    } else {
      brouillon.id = nouvelId();
      donnees.seances.push(brouillon);
    }
    enregistrer();
    brouillonModifie = false;
    retour();
  },

  'seance-supprimer'() {
    if (!confirm('Supprimer la séance « ' + brouillon.nom + ' » ? L\'historique déjà enregistré est conservé.')) return;
    donnees.seances = donnees.seances.filter((x) => x.id !== brouillon.id);
    enregistrer();
    brouillonModifie = false;
    retour();
  },

  'exo-nouveau'() {
    exoBrouillon = { index: -1, nom: '', series: 3 };
    aller({ ecran: 'exercice' });
  },

  'exo-modifier'(b) {
    const i = Number(b.dataset.i);
    const e = brouillon.exercices[i];
    exoBrouillon = { index: i, nom: e.nom, series: e.series };
    aller({ ecran: 'exercice' });
  },

  'exo-series'(b) {
    exoBrouillon.series = Math.min(20, Math.max(1, exoBrouillon.series + Number(b.dataset.d)));
    document.getElementById('nb-series').textContent = exoBrouillon.series;
  },

  'exo-enregistrer'() {
    const nom = exoBrouillon.nom.trim();
    if (!nom) return erreur('Donne un nom à l\'exercice.');
    const doublon = brouillon.exercices.some((e, i) => i !== exoBrouillon.index && cle(e.nom) === cle(nom));
    if (doublon) return erreur('Cet exercice est déjà dans la séance.');
    if (exoBrouillon.index >= 0) {
      brouillon.exercices[exoBrouillon.index].nom = nom;
      brouillon.exercices[exoBrouillon.index].series = exoBrouillon.series;
    } else {
      brouillon.exercices.push({ id: nouvelId(), nom: nom, series: exoBrouillon.series });
    }
    brouillonModifie = true;
    retour();
  },

  'exo-supprimer'() {
    brouillon.exercices.splice(exoBrouillon.index, 1);
    brouillonModifie = true;
    retour();
  },

  /* --- Séance du jour --- */
  demarrer(b) {
    const s = donnees.seances.find((x) => x.id === b.dataset.id);
    if (!s) return;
    const auj = aujourdhui();
    let w = donnees.entrainements.find((x) => x.date === auj && x.seanceId === s.id);
    if (!w) {
      // Nouvelle séance du jour : on recopie la liste d'exercices du modèle.
      w = {
        id: nouvelId(), date: auj, cree: Date.now(), seanceId: s.id, nom: s.nom,
        exercices: s.exercices.map((e) => ({ nom: e.nom, prevu: e.series, series: [] }))
      };
      donnees.entrainements.push(w);
    } else {
      // Séance déjà commencée aujourd'hui : on la reprend, en tenant compte du modèle s'il a changé.
      w.nom = s.nom;
      s.exercices.forEach((e) => {
        const ex = w.exercices.find((x) => cle(x.nom) === cle(e.nom));
        if (ex) ex.prevu = e.series;
        else w.exercices.push({ nom: e.nom, prevu: e.series, series: [] });
      });
    }
    enregistrer();
    aller({ ecran: 'entrainement', id: w.id });
  },

  'entrainement-ouvrir'(b) { aller({ ecran: 'entrainement', id: b.dataset.id }); },

  'exo-ouvrir'(b) {
    exoOuvert[courant().id] = Number(b.dataset.i);
    afficher(true);
  },

  terminer() {
    if (pile.some((e) => e.ecran === 'jour')) return retour(); // on modifiait une séance passée
    pile = [{ ecran: 'accueil' }];
    afficher(false);
  },

  /* --- Saisie d'une série --- */
  'serie-nouvelle'(b) {
    const etape = courant();
    const w = trouverEntrainement(etape.id);
    const e = Number(b.dataset.e);
    const i = w.exercices[e].series.length;
    const propose = preRemplir(w, e, i);
    formulaire = { poids: propose.poids, micro: propose.micro, reps: propose.reps, ressenti: null, microKg: donnees.reglages.microKg };
    exoOuvert[w.id] = e;
    aller({ ecran: 'serie', id: w.id, e: e, i: i });
  },

  'serie-modifier'(b) {
    const etape = courant();
    const w = trouverEntrainement(etape.id);
    const e = Number(b.dataset.e);
    const i = Number(b.dataset.i);
    const s = w.exercices[e].series[i];
    formulaire = { poids: s.poids, micro: s.micro, reps: s.reps, ressenti: s.ressenti, microKg: s.microKg };
    aller({ ecran: 'serie', id: w.id, e: e, i: i });
  },

  // Boutons − et + : modifient la valeur du champ visé.
  pas(b) {
    const champ = document.getElementById(b.dataset.cible);
    let v = lireNombre(b.dataset.cible);
    if (!Number.isFinite(v)) v = 0;
    v = Math.max(0, arrondi(v + Number(b.dataset.d)));
    champ.value = fmt(v);
    majComparaison();
  },

  ressenti(b) {
    formulaire.ressenti = b.dataset.v;
    document.querySelectorAll('.trois button').forEach((x) => {
      x.setAttribute('aria-pressed', String(x === b));
    });
    erreur('');
  },

  'serie-valider'() {
    const poids = lireNombre('f-poids');
    const reps = lireNombre('f-reps');
    let micro = lireNombre('f-micro');
    if (Number.isNaN(micro)) micro = 0; // champ vide = aucune micro-charge
    if (!(poids >= 0)) return erreur('Indique un poids (0 pour le poids du corps).');
    if (!(reps >= 1) || reps % 1 !== 0) return erreur('Indique un nombre de répétitions (au moins 1).');
    if (!(micro >= 0) || micro % 1 !== 0) return erreur('Le nombre de micro-charges doit être un entier : 0, 1, 2…');
    if (!formulaire.ressenti) return erreur('Choisis l\'exécution : bonne, moyenne ou mauvaise.');

    const etape = courant();
    const w = trouverEntrainement(etape.id);
    const ex = w.exercices[etape.e];
    const nouvelle = etape.i >= ex.series.length;
    ex.series[etape.i] = {
      poids: arrondi(poids), micro: micro, microKg: formulaire.microKg, reps: reps, ressenti: formulaire.ressenti
    };
    enregistrer();
    // Exercice terminé : on dépliera automatiquement le prochain exercice à faire.
    if (nouvelle && ex.series.length === ex.prevu) delete exoOuvert[w.id];
    retour();
  },

  'serie-supprimer'() {
    if (!confirm('Supprimer cette série ?')) return;
    const etape = courant();
    const w = trouverEntrainement(etape.id);
    w.exercices[etape.e].series.splice(etape.i, 1);
    enregistrer();
    retour();
  },

  /* --- Calendrier --- */
  calendrier() {
    const d = new Date();
    aller({ ecran: 'calendrier', annee: d.getFullYear(), mois: d.getMonth() });
  },

  mois(b) {
    const etape = courant();
    const d = new Date(etape.annee, etape.mois + Number(b.dataset.d), 1);
    etape.annee = d.getFullYear();
    etape.mois = d.getMonth();
    afficher(false);
  },

  jour(b) { aller({ ecran: 'jour', date: b.dataset.date }); },

  /* --- Réglages --- */
  'reglages-enregistrer'() {
    const v = lireNombre('f-microkg');
    if (!(v > 0)) return erreur('Indique un poids supérieur à 0, par exemple 2,3.');
    donnees.reglages.microKg = arrondi(v);
    enregistrer();
    afficher(false);
    document.getElementById('info').textContent = 'Poids de micro-charge enregistré.';
  },

  exporter() { exporter(); }
};

// Met à jour l'encadré "poids total + comparaison" pendant la saisie.
function majComparaison() {
  const etape = courant();
  const boite = document.getElementById('comparaison');
  const w = trouverEntrainement(etape.id);
  if (!boite || !w) return;
  const ex = w.exercices[etape.e];
  const poids = lireNombre('f-poids');
  let micro = lireNombre('f-micro');
  if (Number.isNaN(micro)) micro = 0; // champ vide = aucune micro-charge
  const reps = lireNombre('f-reps');

  if (!(poids >= 0) || !(micro >= 0)) {
    boite.innerHTML = '<div class="cmp-bas">Indique un poids pour voir la comparaison.</div>';
    return;
  }
  const total = arrondi(poids + Math.round(micro) * formulaire.microKg);
  const ref = reference(w, ex.nom, etape.i, total);
  let indicateur = '';
  let detail;
  if (!ref) {
    indicateur = '<span class="cmp neutre">1re fois à ce poids</span>';
    detail = 'Aucune séance précédente à ' + fmt(total) + ' kg : pas de comparaison possible.';
  } else {
    if (reps >= 1) indicateur = htmlEcart(Math.round(reps) - ref.reps);
    detail = 'Dernière fois à ' + fmt(total) + ' kg : ' + pluriel(ref.reps, 'rep') + ' (' +
      (ref.meilleure ? 'meilleure série' : 'série ' + ref.numero) + ', ' + dateCourte(ref.date) + ')';
  }
  boite.innerHTML = '<div class="cmp-haut"><span>Poids total : <b>' + fmt(total) + ' kg</b></span>' + indicateur + '</div>' +
    '<div class="cmp-bas">' + detail + '</div>';
}


/* ============ 7. EXPORT / IMPORT DE LA SAUVEGARDE ============ */

async function exporter() {
  const info = document.getElementById('info');
  const contenu = JSON.stringify(donnees, null, 2);
  const nom = 'muscu-sauvegarde-' + aujourdhui() + '.json';

  // Sur iPhone : on ouvre la feuille de partage ("Enregistrer dans Fichiers", AirDrop, Mail…).
  for (const type of ['application/json', 'text/plain']) {
    try {
      const fichier = new File([contenu], nom, { type: type });
      if (navigator.canShare && navigator.canShare({ files: [fichier] })) {
        await navigator.share({ files: [fichier], title: 'Sauvegarde Musculation' });
        if (info) info.textContent = 'Sauvegarde exportée.';
        return;
      }
    } catch (e) {
      if (e && e.name === 'AbortError') return; // partage annulé par l'utilisateur
    }
  }

  // Ailleurs (ordinateur) : téléchargement classique du fichier.
  const url = URL.createObjectURL(new Blob([contenu], { type: 'application/json' }));
  const lien = document.createElement('a');
  lien.href = url;
  lien.download = nom;
  document.body.appendChild(lien);
  lien.click();
  lien.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  if (info) info.textContent = 'Fichier de sauvegarde téléchargé.';
}

function importer(fichier) {
  const info = document.getElementById('info');
  const lecteur = new FileReader();
  lecteur.onload = () => {
    let nouvelles;
    try {
      nouvelles = nettoyer(JSON.parse(String(lecteur.result)));
    } catch (e) {
      erreur('Ce fichier n\'est pas une sauvegarde de l\'appli.');
      return;
    }
    const resume = pluriel(nouvelles.seances.length, 'séance') + ' et ' + pluriel(nouvelles.entrainements.length, 'entraînement');
    if (!confirm('Remplacer TOUTES les données actuelles par cette sauvegarde (' + resume + ') ?')) return;
    donnees = nouvelles;
    enregistrer();
    afficher(false);
    document.getElementById('info').textContent = 'Sauvegarde importée : ' + resume + '.';
  };
  lecteur.onerror = () => { if (info) info.textContent = ''; erreur('Lecture du fichier impossible.'); };
  lecteur.readAsText(fichier);
}


/* ============ 8. DÉMARRAGE ============ */

// Un seul écouteur pour tous les boutons de l'appli.
app.addEventListener('click', (evenement) => {
  const bouton = evenement.target.closest('[data-a]');
  if (!bouton) return;
  const action = ACTIONS[bouton.dataset.a];
  if (action) action(bouton);
});

// Saisie au clavier dans les champs.
app.addEventListener('input', (evenement) => {
  const id = evenement.target.id;
  if (id === 'nom-seance') { brouillon.nom = evenement.target.value; brouillonModifie = true; }
  else if (id === 'nom-exo') { exoBrouillon.nom = evenement.target.value; }
  else if (id === 'f-poids' || id === 'f-reps' || id === 'f-micro') { majComparaison(); }
});

// Choix d'un fichier de sauvegarde à importer.
app.addEventListener('change', (evenement) => {
  if (evenement.target.id === 'f-import' && evenement.target.files[0]) {
    importer(evenement.target.files[0]);
    evenement.target.value = '';
  }
});

// Quand on touche un champ numérique, son contenu est sélectionné : on tape directement la nouvelle valeur.
app.addEventListener('focusin', (evenement) => {
  if (evenement.target.classList && evenement.target.classList.contains('pas-val') && evenement.target.select) {
    evenement.target.select();
  }
});

// Service worker : permet d'ouvrir l'appli sans réseau (voir sw.js).
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => { /* hors ligne impossible, l'appli marche quand même */ });
  });
}

// Demande au navigateur de ne pas effacer les données de lui-même (accepté ou non selon l'appareil).
if (navigator.storage && navigator.storage.persist) {
  navigator.storage.persist().catch(() => {});
}

afficher(false);
