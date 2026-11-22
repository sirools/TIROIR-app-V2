#!/usr/bin/env node
// Référence du plan du niveau 1 « Le sous-sol englouti ».
//
// Génère le labyrinthe (13 × 9, backtracking récursif, graine 20261119),
// place les 5 enceintes et les 3 bornes, vérifie que le niveau est jouable
// avec 4 piles de 6 cases, puis écrit le plan en ASCII.
//
//   node outils/plan.mjs            affiche le plan et les contrôles
//   node outils/plan.mjs --verifie  compare au plan figé dans Niveau.swift
//
// Le plan figé dans Sources/Jeu/Niveau.swift fait foi pour l'app : si le
// plan Figma diffère, on colle le plan Figma là-bas, pas ici.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const COLONNES = 13;
const LIGNES = 9;
const GRAINE = 20261119;
const CASES_PAR_PILE = 6;
const PILES = 4;
const AUTONOMIE = CASES_PAR_PILE * PILES;

// Mulberry32 : le même générateur que Sources/Jeu/GenerateurAleatoire.swift.
function mulberry32(graine) {
  let a = graine >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Ordre fixe des directions : nord, est, sud, ouest.
const DIRECTIONS = [
  { dx: 0, dy: -1 },
  { dx: 1, dy: 0 },
  { dx: 0, dy: 1 },
  { dx: -1, dy: 0 },
];

const cle = (x, y) => y * COLONNES + x;

function genere() {
  const hasard = mulberry32(GRAINE);
  // ouvert[cle] = ensemble des cases voisines reliées
  const ouvert = Array.from({ length: COLONNES * LIGNES }, () => new Set());
  const vu = new Array(COLONNES * LIGNES).fill(false);
  const pile = [{ x: 0, y: 0 }];
  vu[0] = true;
  while (pile.length) {
    const c = pile[pile.length - 1];
    const libres = [];
    for (const d of DIRECTIONS) {
      const x = c.x + d.dx;
      const y = c.y + d.dy;
      if (x >= 0 && y >= 0 && x < COLONNES && y < LIGNES && !vu[cle(x, y)]) libres.push({ x, y });
    }
    if (!libres.length) {
      pile.pop();
      continue;
    }
    const n = libres[Math.floor(hasard() * libres.length)];
    ouvert[cle(c.x, c.y)].add(cle(n.x, n.y));
    ouvert[cle(n.x, n.y)].add(cle(c.x, c.y));
    vu[cle(n.x, n.y)] = true;
    pile.push(n);
  }
  return ouvert;
}

function distances(ouvert, depart) {
  const d = new Array(ouvert.length).fill(-1);
  d[depart] = 0;
  const file = [depart];
  for (let i = 0; i < file.length; i++) {
    for (const v of ouvert[file[i]]) {
      if (d[v] < 0) {
        d[v] = d[file[i]] + 1;
        file.push(v);
      }
    }
  }
  return d;
}

// Les 4 pièces sont les 4 quarts du plan.
function piece(k) {
  const x = k % COLONNES;
  const y = Math.floor(k / COLONNES);
  return (y < 5 ? 0 : 2) + (x < 7 ? 0 : 1);
}
const NOMS_PIECES = ['Chaufferie', 'Atelier', 'Cave à vin', 'Local serveur'];

function place(ouvert) {
  const depart = cle(0, 0);
  const toutes = ouvert.map((_, k) => distances(ouvert, k));
  const impasse = ouvert.map((s, k) => s.size === 1 && k !== depart);
  const cases = ouvert.map((_, k) => k).filter((k) => k !== depart);

  // On choisit ensemble les 3 bornes et les 5 enceintes : chaque borne est
  // atteignable de proche en proche depuis l'escalier, et chaque enceinte
  // est à un aller-retour d'une borne (il reste 2 cases de marge).
  const PORTEE = Math.floor((AUTONOMIE - 2) / 2);
  let meilleur = null;
  for (let i = 0; i < cases.length; i++) {
    for (let j = i + 1; j < cases.length; j++) {
      for (let l = j + 1; l < cases.length; l++) {
        const bornes = [cases[i], cases[j], cases[l]];
        if (!chaine(toutes, depart, bornes)) continue;
        const pres = (k) => Math.min(...bornes.map((b) => toutes[b][k]));
        const candidates = cases.filter((k) => impasse[k] && pres(k) >= 2 && pres(k) <= PORTEE);
        if (candidates.length < 5) continue;
        const enceintes = [];
        const pieces = new Set();
        while (enceintes.length < 5) {
          let choix = -1;
          let note = -1;
          for (const k of candidates) {
            if (enceintes.includes(k)) continue;
            const ecart = Math.min(toutes[depart][k], ...enceintes.map((e) => toutes[e][k]));
            const n = ecart + (pieces.has(piece(k)) ? 0 : 1000);
            if (n > note) {
              note = n;
              choix = k;
            }
          }
          enceintes.push(choix);
          pieces.add(piece(choix));
        }
        let ecartMin = Infinity;
        for (const a of enceintes) for (const b of enceintes) if (a !== b) ecartMin = Math.min(ecartMin, toutes[a][b]);
        const score = pieces.size * 1000 + ecartMin;
        if (!meilleur || score > meilleur.score) meilleur = { bornes, enceintes, score };
      }
    }
  }
  return { depart, enceintes: meilleur.enceintes, bornes: meilleur.bornes, toutes };
}

// Vrai si chaque borne est atteignable depuis l'escalier par étapes d'au
// plus 18 cases (il reste alors une pile de marge).
function chaine(toutes, depart, bornes) {
  const atteints = [depart];
  let reste = [...bornes];
  let avance = true;
  while (reste.length && avance) {
    avance = false;
    for (const b of reste) {
      if (atteints.some((a) => toutes[a][b] <= AUTONOMIE - CASES_PAR_PILE)) {
        atteints.push(b);
        reste = reste.filter((r) => r !== b);
        avance = true;
      }
    }
  }
  return reste.length === 0;
}

function ascii(ouvert, { depart, enceintes, bornes }) {
  const l = [];
  for (let y = 0; y <= LIGNES * 2; y++) l.push(new Array(COLONNES * 2 + 1).fill('#'));
  for (let y = 0; y < LIGNES; y++) {
    for (let x = 0; x < COLONNES; x++) {
      const k = cle(x, y);
      let c = '.';
      if (k === depart) c = 'D';
      else if (enceintes.includes(k)) c = 'E';
      else if (bornes.includes(k)) c = 'B';
      l[y * 2 + 1][x * 2 + 1] = c;
      if (x + 1 < COLONNES && ouvert[k].has(cle(x + 1, y))) l[y * 2 + 1][x * 2 + 2] = '.';
      if (y + 1 < LIGNES && ouvert[k].has(cle(x, y + 1))) l[y * 2 + 2][x * 2 + 1] = '.';
    }
  }
  return l.map((r) => r.join(''));
}

const ouvert = genere();
const niveau = place(ouvert);
const plan = ascii(ouvert, niveau);

if (process.argv.includes('--verifie')) {
  const ici = dirname(fileURLToPath(import.meta.url));
  const swift = readFileSync(join(ici, '..', 'Sources', 'Jeu', 'Niveau.swift'), 'utf8');
  const fige = [...swift.matchAll(/^\s*"([#.DEB]{27})",?$/gm)].map((m) => m[1]);
  const pareil = fige.length === plan.length && fige.every((r, i) => r === plan[i]);
  console.log(pareil ? 'Le plan figé dans Niveau.swift est celui de la graine 20261119.' : 'Le plan figé diffère du plan généré (normal si le plan Figma a été collé).');
  process.exit(0);
}

console.log(plan.join('\n'));
const { depart, enceintes, bornes, toutes } = niveau;
const pos = (k) => `(${k % COLONNES},${Math.floor(k / COLONNES)})`;
console.log('\nEnceintes :');
for (const e of enceintes) {
  const d = Math.min(...bornes.map((b) => toutes[b][e]));
  console.log(`  ${pos(e)}  ${NOMS_PIECES[piece(e)]}  à ${d} cases de la borne la plus proche, ${toutes[depart][e]} de l'escalier`);
}
console.log('Bornes :');
for (const b of bornes) console.log(`  ${pos(b)}  ${NOMS_PIECES[piece(b)]}  à ${toutes[depart][b]} cases de l'escalier`);
const pire = Math.max(...enceintes.map((e) => Math.min(...bornes.map((b) => toutes[b][e]))));
console.log(`\nAller-retour le plus long borne → enceinte → borne : ${pire * 2} cases (autonomie ${AUTONOMIE}).`);
console.log(pire * 2 <= AUTONOMIE ? 'Jouable sans jamais tomber en panne.' : 'ATTENTION : une enceinte demande une panne pour être atteinte.');
