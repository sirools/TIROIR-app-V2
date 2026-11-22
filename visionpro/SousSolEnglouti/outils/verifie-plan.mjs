#!/usr/bin/env node
// Contrôle le plan du niveau 1 figé dans Sources/Jeu/Niveau.swift (relevé
// sur la planche Figma) : tout est relié, et chaque enceinte s'atteint
// depuis une borne avec 4 piles de 6 cases.
//
//   node outils/verifie-plan.mjs

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const AUTONOMIE = 24;
const ici = dirname(fileURLToPath(import.meta.url));
const swift = readFileSync(join(ici, '..', 'Sources', 'Jeu', 'Niveau.swift'), 'utf8');
const plan = [...swift.matchAll(/^\s*"([#.DEB]{27})",?$/gm)].map((m) => m[1]);
if (plan.length !== 19) throw new Error(`plan illisible : ${plan.length} lignes au lieu de 19`);

const COLONNES = 13;
const LIGNES = 9;
const cle = (x, y) => y * COLONNES + x;
const nom = (k) => `(${k % COLONNES},${Math.floor(k / COLONNES)})`;
const voisines = Array.from({ length: COLONNES * LIGNES }, () => []);
let depart = -1;
const enceintes = [];
const bornes = [];
for (let y = 0; y < LIGNES; y++) {
  for (let x = 0; x < COLONNES; x++) {
    const c = plan[y * 2 + 1][x * 2 + 1];
    if (c === 'D') depart = cle(x, y);
    if (c === 'E') enceintes.push(cle(x, y));
    if (c === 'B') bornes.push(cle(x, y));
    for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= COLONNES || ny >= LIGNES) continue;
      if (plan[y * 2 + 1 + dy][x * 2 + 1 + dx] !== '#') voisines[cle(x, y)].push(cle(nx, ny));
    }
  }
}

function distances(source) {
  const d = new Array(voisines.length).fill(-1);
  d[source] = 0;
  const file = [source];
  for (let i = 0; i < file.length; i++) {
    for (const v of voisines[file[i]]) {
      if (d[v] < 0) {
        d[v] = d[file[i]] + 1;
        file.push(v);
      }
    }
  }
  return d;
}

let ok = true;
const controle = (vrai, texte) => {
  console.log(`${vrai ? 'OK ' : 'NON'}  ${texte}`);
  ok = ok && vrai;
};

console.log(plan.join('\n'), '\n');
controle(depart >= 0 && enceintes.length === 5 && bornes.length === 3, '1 escalier, 5 enceintes, 3 bornes');
controle(distances(depart).every((d) => d >= 0), "toutes les cases sont reliées à l'escalier");

// Bornes atteignables de proche en proche depuis l'escalier.
const atteints = [depart];
let reste = [...bornes];
for (let avance = true; avance && reste.length; ) {
  avance = false;
  for (const b of reste) {
    if (atteints.some((a) => distances(a)[b] <= AUTONOMIE)) {
      atteints.push(b);
      reste = reste.filter((r) => r !== b);
      avance = true;
    }
  }
}
controle(reste.length === 0, "chaque borne s'atteint sans panne, de proche en proche");

for (const e of enceintes) {
  const d = distances(e);
  const pres = Math.min(...bornes.map((b) => d[b]));
  const retour = pres * 2 <= AUTONOMIE ? 'aller-retour possible' : 'la lampe s\'éteint au retour';
  controle(pres <= AUTONOMIE, `enceinte ${nom(e)} à ${pres} pas d'une borne (${retour})`);
}
process.exit(ok ? 0 : 1);
