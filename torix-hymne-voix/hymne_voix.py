#!/usr/bin/env python3
"""Voix de synthèse de Torix sur l'hymne — tout en local.

Lit config.yaml + paroles/*.txt + la mélodie guide (.mid ou .json), produit
un WAV 48 kHz / 24 bits de la durée du morceau, calé sur la mesure 1, plus un
WAV par section. Voir README.md.

    python hymne_voix.py                # tout régénérer (le cache TTS évite de refaire l'inutile)
    python hymne_voix.py --plan         # afficher le calage sans rien synthétiser
    python hymne_voix.py --section refrain1
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import shlex
import warnings
import shutil
import subprocess
import sys
import tempfile
from dataclasses import dataclass, field
from pathlib import Path

import numpy as np
import soundfile as sf
import yaml
from scipy.signal import resample_poly

warnings.filterwarnings("ignore", message="pkg_resources")

SR_SORTIE = 48000
TRAME_MS = 5.0  # pas d'analyse WORLD
VOYELLES = set("aeiouyɪɛəɑæʊɔʌɐɜɚɒøœɨʉɯɤɘɵ")
MODIF_AVANT = set("ˈˌ")  # se rattache au phonème suivant
MODIF_APRES = set("ːˑ̃")  # se rattache au phonème précédent
STYLES = ("parle", "chante", "murmure")


# ───────────────────────────── modèle de données ─────────────────────────────

@dataclass
class Vers:
    mesure: float
    duree: float  # en mesures
    style: str
    texte: str
    section: str


@dataclass
class Note:
    debut: float  # en temps (noires) depuis la mesure 1
    duree: float
    hauteur: int  # numéro MIDI


@dataclass
class Rendu:
    audio: np.ndarray  # mono, SR_SORTIE
    decalage_s: float  # position du début du tampon par rapport au début du vers
    infos: dict = field(default_factory=dict)


# ───────────────────────────── lecture des entrées ───────────────────────────

def lire_paroles(chemin: Path, section: str, style_defaut: str, duree_defaut: float) -> list[Vers]:
    """Format : `mesure[:durée] [@style] | texte`. `#` = commentaire."""
    vers = []
    for no, ligne in enumerate(chemin.read_text(encoding="utf-8").splitlines(), 1):
        ligne = ligne.strip()
        if not ligne or ligne.startswith("#"):
            continue
        if "|" not in ligne:
            sys.exit(f"{chemin}:{no} : attendu « mesure | texte », lu « {ligne} »")
        tete, texte = ligne.split("|", 1)
        style, duree = style_defaut, duree_defaut
        position = None
        for mot in tete.split():
            if mot.startswith("@"):
                style = mot[1:]
            else:
                position = mot
        if position is None:
            sys.exit(f"{chemin}:{no} : numéro de mesure manquant")
        if ":" in position:
            position, d = position.split(":", 1)
            duree = float(d)
        if style not in STYLES:
            sys.exit(f"{chemin}:{no} : style « {style} » inconnu ({', '.join(STYLES)})")
        if texte.strip():
            vers.append(Vers(float(position), duree, style, texte.strip(), section))
    return vers


def lire_guide(chemin: Path, decalage_mesures: float, temps_par_mesure: int) -> list[Note]:
    """Notes de la mélodie guide, en temps depuis la mesure 1.

    .mid  : export « Exporter le clip MIDI » d'Ableton (toutes pistes fusionnées).
    .json : liste de {"pitch", "start_time", "duration"} en temps, telle que la
            renvoient les outils qui lisent les notes d'un clip.
    """
    dec = decalage_mesures * temps_par_mesure
    notes: list[Note] = []
    if chemin.suffix.lower() == ".json":
        brut = json.loads(chemin.read_text(encoding="utf-8"))
        if isinstance(brut, dict):
            brut = brut.get("notes", [])
        for n in brut:
            debut = n.get("start_time", n.get("start"))
            notes.append(Note(float(debut) + dec, float(n["duration"]), int(n["pitch"])))
    else:
        import mido

        mid = mido.MidiFile(str(chemin))
        tpb = mid.ticks_per_beat
        for piste in mid.tracks:
            t, ouvertes = 0, {}
            for msg in piste:
                t += msg.time
                if msg.type == "note_on" and msg.velocity > 0:
                    ouvertes[msg.note] = t
                elif msg.type in ("note_off", "note_on") and msg.note in ouvertes:
                    d = ouvertes.pop(msg.note)
                    notes.append(Note(d / tpb + dec, max((t - d) / tpb, 0.05), msg.note))
    notes.sort(key=lambda n: (n.debut, -n.hauteur))
    # Mélodie monophonique : en cas d'accord, on garde la note la plus haute.
    mono: list[Note] = []
    for n in notes:
        if mono and abs(n.debut - mono[-1].debut) < 1e-3:
            continue
        if mono and mono[-1].debut + mono[-1].duree > n.debut:
            mono[-1].duree = n.debut - mono[-1].debut
        mono.append(n)
    return mono


def octaves_auto(notes: list[Note], tessiture_hz: float) -> int:
    if not notes:
        return 0
    mediane = float(np.median([n.hauteur for n in notes]))
    cible = 69 + 12 * np.log2(tessiture_hz / 440.0)
    return int(round((cible - mediane) / 12))


def hz(midi: float) -> float:
    return 440.0 * 2 ** ((midi - 69) / 12)


# ───────────────────────────── synthèse (Piper) ──────────────────────────────

class Synthese:
    """Piper : voix arabe pour le texte, voix anglaise pour les mots en lettres latines."""

    LATIN = re.compile(r"[A-Za-z][A-Za-z0-9'’\-]*(?:\s+[A-Za-z][A-Za-z0-9'’\-]*)*")

    def __init__(self, cfg: dict, base: Path, cache: Path):
        self.cfg, self.cache = cfg, cache
        self.dossier = (base / cfg.get("dossier_voix", "voix_piper")).resolve()
        self.nom = cfg["voix"]
        self.nom_latin = cfg.get("voix_latine") or ""
        self._voix: dict = {}

    def _charger(self, nom: str):
        if nom not in self._voix:
            from piper import PiperVoice

            modele = self.dossier / f"{nom}.onnx"
            if not modele.exists():
                self.dossier.mkdir(parents=True, exist_ok=True)
                print(f"  téléchargement de la voix {nom} (une seule fois)…")
                subprocess.run(
                    [sys.executable, "-m", "piper.download_voices", nom,
                     "--data-dir", str(self.dossier)], check=True)
            try:
                self._voix[nom] = (PiperVoice.load(str(modele), include_alignments=True), True)
            except Exception:  # paquet `onnx` absent : pas d'alignement
                self._voix[nom] = (PiperVoice.load(str(modele)), False)
        return self._voix[nom]

    def _bloc(self, nom: str, texte: str, debit: float):
        from piper import SynthesisConfig

        voix, align = self._charger(nom)
        morceaux, phon, pos = [], [], 0
        for bloc in voix.synthesize(texte, syn_config=SynthesisConfig(length_scale=debit),
                                    include_alignments=align):
            a = np.asarray(bloc.audio_float_array, dtype=np.float32)
            if bloc.phoneme_alignments:
                total = sum(int(p.num_samples) for p in bloc.phoneme_alignments) or 1
                echelle, p0 = len(a) / total, 0.0
                for p in bloc.phoneme_alignments:
                    p1 = p0 + int(p.num_samples) * echelle
                    phon.append((p.phoneme, pos + int(p0), pos + int(p1)))
                    p0 = p1
            morceaux.append(a)
            pos += len(a)
        audio = np.concatenate(morceaux) if morceaux else np.zeros(1, np.float32)
        return audio, voix.config.sample_rate, phon

    def dire(self, texte: str) -> tuple[np.ndarray, int, list[tuple[str, int, int]]]:
        """Renvoie (audio, fréquence, phonèmes [(symbole, début, fin) en échantillons])."""
        debit = float(self.cfg.get("debit", 1.0))
        cle = hashlib.sha1(f"{self.nom}|{self.nom_latin}|{debit}|{texte}".encode()).hexdigest()[:16]
        f = self.cache / f"tts_{cle}.npz"
        if f.exists():
            z = np.load(f, allow_pickle=False)
            phon = [(s, int(a), int(b)) for s, a, b in
                    zip(z["sym"].tolist(), z["deb"].tolist(), z["fin"].tolist())]
            return z["audio"], int(z["sr"]), phon
        # Découpage : mots latins → voix anglaise, le reste → voix arabe.
        parties, i = [], 0
        if self.nom_latin:
            for m in self.LATIN.finditer(texte):
                parties += [(self.nom, texte[i:m.start()]), (self.nom_latin, m.group())]
                i = m.end()
        parties.append((self.nom, texte[i:]))
        parties = [(n, t) for n, t in parties if re.search(r"\w", t)]
        sr_ref = self._charger(self.nom)[0].config.sample_rate
        audio, phon = np.zeros(0, np.float32), []
        for k, (nom, t) in enumerate(parties):
            a, sr, ph = self._bloc(nom, t, debit)
            if len(parties) > 1:  # raccord serré : on retire les silences de bord
                d, e = bornes_voix(a, sr)
                a = fondus(a[d:e], sr, 4)
                ph = [(s, max(x - d, 0), min(y - d, e - d)) for s, x, y in ph if y > d and x < e]
            if sr != sr_ref:
                ph = [(s, x * sr_ref // sr, y * sr_ref // sr) for s, x, y in ph]
                g = np.gcd(sr_ref, sr)
                a = resample_poly(a, sr_ref // g, sr // g).astype(np.float32)
            if k:
                audio = np.concatenate([audio, np.zeros(int(0.03 * sr_ref), np.float32)])
            phon += [(s, x + len(audio), y + len(audio)) for s, x, y in ph]
            audio = np.concatenate([audio, a])
        if len(audio) == 0:
            audio = np.zeros(1, np.float32)
        np.savez(f, audio=audio, sr=sr_ref, sym=np.array([p[0] for p in phon], dtype="U4"),
                 deb=np.array([p[1] for p in phon]), fin=np.array([p[2] for p in phon]))
        return audio, sr_ref, phon


# ───────────────────────────── outils audio ──────────────────────────────────

def bornes_voix(x: np.ndarray, sr: int, seuil_db: float = -40.0) -> tuple[int, int]:
    """Premier et dernier échantillon au-dessus du seuil (par fenêtres de 10 ms)."""
    pas = max(sr // 100, 1)
    n = len(x) // pas
    if n == 0:
        return 0, len(x)
    rms = np.sqrt(np.mean(x[: n * pas].reshape(n, pas) ** 2, axis=1) + 1e-12)
    actif = np.where(20 * np.log10(rms / (rms.max() + 1e-12)) > seuil_db)[0]
    if len(actif) == 0:
        return 0, len(x)
    return int(actif[0] * pas), int(min((actif[-1] + 1) * pas, len(x)))


def fondus(x: np.ndarray, sr: int, ms: float = 8.0) -> np.ndarray:
    n = min(int(sr * ms / 1000), len(x) // 2)
    if n > 0:
        r = np.linspace(0, 1, n, dtype=np.float32)
        x = x.copy()
        x[:n] *= r
        x[-n:] *= r[::-1]
    return x


def niveau(x: np.ndarray, cible_db: float) -> np.ndarray:
    """Ramène le niveau moyen des passages actifs à cible_db (dBFS RMS)."""
    fort = x[np.abs(x) > 0.02 * (np.abs(x).max() + 1e-9)]
    if len(fort) == 0:
        return x
    rms = np.sqrt(np.mean(fort ** 2))
    return x * (10 ** (cible_db / 20) / (rms + 1e-9))


def vers_48k(x: np.ndarray, sr: int) -> np.ndarray:
    if sr == SR_SORTIE:
        return x.astype(np.float32)
    g = np.gcd(SR_SORTIE, sr)
    return resample_poly(x, SR_SORTIE // g, sr // g).astype(np.float32)


_FILTRES: set[str] | None = None


def filtres_ffmpeg() -> set[str]:
    global _FILTRES
    if _FILTRES is None:
        if not shutil.which("ffmpeg"):
            sys.exit("ffmpeg est introuvable (macOS : brew install ffmpeg).")
        s = subprocess.run(["ffmpeg", "-hide_banner", "-filters"], capture_output=True, text=True).stdout
        _FILTRES = {l.split()[1] for l in s.splitlines() if len(l.split()) > 2}
    return _FILTRES


def ffmpeg_filtre(x: np.ndarray, sr: int, chaine: str) -> np.ndarray:
    with tempfile.TemporaryDirectory() as d:
        e, s = Path(d) / "e.wav", Path(d) / "s.wav"
        sf.write(e, x, sr, subtype="FLOAT")
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(e), "-af", chaine,
                        "-ar", str(sr), "-c:a", "pcm_f32le", str(s)], check=True)
        y, _ = sf.read(s, dtype="float32")
    return y


def etirer(x: np.ndarray, sr: int, facteur: float) -> np.ndarray:
    """Allonge (facteur > 1) ou raccourcit sans changer la hauteur."""
    if abs(facteur - 1) < 0.01:
        return x
    tempo = 1 / facteur
    if "rubberband" in filtres_ffmpeg():
        return ffmpeg_filtre(x, sr, f"rubberband=tempo={tempo:.5f}:formant=preserved")
    return ffmpeg_filtre(x, sr, f"atempo={tempo:.5f}")  # 0,5–2 : suffisant ici


# ───────────────────────────── rendu d'un vers ───────────────────────────────

def rendre_parle(audio, sr, duree_s: float, cfg: dict) -> Rendu:
    a, b = bornes_voix(audio, sr)
    x = audio[a:b]
    naturel = len(x) / sr
    voulu = duree_s * float(cfg.get("remplissage", 0.9)) / naturel
    facteur = float(np.clip(voulu, cfg.get("etirement_min", 0.75), cfg.get("etirement_max", 1.5)))
    y = etirer(x, sr, facteur)
    infos = {"naturel_s": round(naturel, 2), "etirement": round(facteur, 2)}
    if len(y) / sr > duree_s:
        infos["alerte"] = "vers trop long pour sa fenêtre, même accéléré : il déborde"
    elif voulu > facteur + 1e-6:
        infos["note"] = "vers court : il démarre sur le temps et laisse du silence après"
    return Rendu(vers_48k(y, sr), 0.0, infos)


def rendre_murmure(audio, sr, duree_s: float, cfg_parle: dict, cfg: dict) -> Rendu:
    """Parlé, puis rendu soufflé : on remplace une part du voisement par du bruit (WORLD)."""
    import pyworld as pw

    r = rendre_parle(audio, sr, duree_s, cfg_parle)
    x = r.audio.astype(np.float64)
    f0, t = pw.harvest(x, SR_SORTIE, frame_period=TRAME_MS)
    sp = pw.cheaptrick(x, f0, t, SR_SORTIE)
    ap = pw.d4c(x, f0, t, SR_SORTIE)
    souffle = float(cfg.get("souffle", 0.6))
    ap = ap + (1 - ap) * souffle
    y = pw.synthesize(f0, sp, ap, SR_SORTIE, TRAME_MS).astype(np.float32)
    r.audio = y[: len(r.audio)]
    return r


def syllabes(phon, debut: int, fin: int):
    """Noyaux vocaliques [(début, fin)] en échantillons, à partir de l'alignement."""
    fus: list[list] = []  # [symbole, début, fin]
    attente = None
    for s, a, b in phon:
        if s in MODIF_APRES and fus:
            fus[-1][2] = b
        elif s in MODIF_AVANT:
            attente = a if attente is None else attente
        else:
            fus.append([s, a if attente is None else attente, b])
            attente = None
    noyaux: list[list[int]] = []
    precedent_voyelle = False
    for s, a, b in fus:
        v = s in VOYELLES and b > debut and a < fin
        if v and precedent_voyelle:
            noyaux[-1][1] = b  # diphtongue : un seul noyau
        elif v:
            noyaux.append([max(a, debut), b])
        precedent_voyelle = v
    return [(a, min(b, fin)) for a, b in noyaux if min(b, fin) > a]


def repartir(k: int, notes: list[Note]) -> list[float]:
    """Temps de départ (en temps musicaux) de k syllabes sur les notes."""
    m = len(notes)
    if k <= m:  # mélisme : une syllabe peut tenir plusieurs notes
        return [notes[(i * m) // k].debut for i in range(k)]
    # plus de syllabes que de notes : on partage les notes, au prorata de leur durée
    durees = np.array([n.duree for n in notes])
    part = 1 + (k - m) * durees / durees.sum()
    nb = np.floor(part).astype(int)
    for i in np.argsort(-(part - nb))[: k - nb.sum()]:
        nb[i] += 1
    departs = []
    for n, c in zip(notes, nb):
        departs += [n.debut + j * n.duree / c for j in range(c)]
    return departs


def rendre_chante(audio, sr, phon, notes: list[Note], t0_temps: float, s_par_temps: float,
                  octaves: int, cfg: dict) -> Rendu:
    """Voix chantée : chaque syllabe est posée sur sa note, la hauteur suit le MIDI.

    Analyse WORLD (hauteur, timbre, souffle), déformation du temps syllabe par
    syllabe — ce sont les voyelles qui s'allongent, pas les consonnes — puis
    resynthèse avec la hauteur des notes.
    """
    import pyworld as pw

    a, b = bornes_voix(audio, sr)
    noy = syllabes(phon, a, b) if phon else []
    x = audio.astype(np.float64)
    f0, t = pw.harvest(x, sr, f0_floor=60, f0_ceil=500, frame_period=TRAME_MS)
    sp = pw.cheaptrick(x, f0, t, sr)
    ap = pw.d4c(x, f0, t, sr)

    # Temps cible, en secondes depuis le début du vers.
    n_deb = [(n.debut - t0_temps) * s_par_temps for n in notes]
    n_fin = [(n.debut + n.duree - t0_temps) * s_par_temps for n in notes]
    fin_cible = n_fin[-1]
    src, dst = [], []  # ancres source (s) → cible (s)
    if noy:
        departs = [(d - t0_temps) * s_par_temps for d in repartir(len(noy), notes)]
        tete = min((noy[0][0] - a) / sr, 0.25)
        src.append(a / sr)
        dst.append(departs[0] - tete)
        for i, (va, vb) in enumerate(noy):
            src.append(va / sr)
            dst.append(departs[i])
            suiv_src = noy[i + 1][0] / sr if i + 1 < len(noy) else b / sr
            suiv_dst = departs[i + 1] if i + 1 < len(noy) else fin_cible
            consonnes = min(suiv_src - vb / sr, 0.5 * (suiv_dst - departs[i]), 0.30)
            src.append(vb / sr)
            dst.append(suiv_dst - max(consonnes, 0.0))
        src.append(b / sr)
        dst.append(fin_cible)
    else:  # pas d'alignement : étirement uniforme de la première à la dernière note
        src, dst = [a / sr, b / sr], [n_deb[0], fin_cible]
    src, dst = np.array(src), np.array(dst)
    for i in range(1, len(dst)):  # strictement croissant
        dst[i] = max(dst[i], dst[i - 1] + 1e-3)
        src[i] = max(src[i], src[i - 1] + 1e-4)

    pas = TRAME_MS / 1000
    debut_tampon = dst[0]
    tc = debut_tampon + np.arange(int(np.ceil((dst[-1] - debut_tampon) / pas)) + 1) * pas
    ts = np.interp(tc, dst, src)  # temps source de chaque trame cible
    pos = np.clip(ts / pas, 0, len(f0) - 1)
    i0 = np.floor(pos).astype(int)
    i1 = np.minimum(i0 + 1, len(f0) - 1)
    w = (pos - i0)[:, None]
    sp2 = sp[i0] * (1 - w) + sp[i1] * w
    ap2 = ap[i0] * (1 - w) + ap[i1] * w
    voise = f0[np.round(pos).astype(int)] > 0

    # Hauteur : la note en cours (tenue jusqu'à la suivante), glissée, avec vibrato.
    idx = np.clip(np.searchsorted(n_deb, tc, side="right") - 1, 0, len(notes) - 1)
    midi = np.array([n.hauteur for n in notes], float)[idx] + 12 * octaves
    liss = max(int(float(cfg.get("glissando_ms", 40)) / TRAME_MS), 1)
    midi = np.convolve(np.pad(midi, liss, mode="edge"), np.ones(liss) / liss, "same")[liss:-liss]
    depuis = tc - np.array(n_deb)[idx]
    longue = np.array([f - d for d, f in zip(n_deb, n_fin)])[idx] > 0.35
    prof = float(cfg.get("vibrato_cents", 25)) / 100 * np.clip((depuis - 0.18) / 0.25, 0, 1) * longue
    midi = midi + prof * np.sin(2 * np.pi * float(cfg.get("vibrato_hz", 5.5)) * depuis)
    f0c = np.where(voise, 440.0 * 2 ** ((midi - 69) / 12), 0.0)

    y = pw.synthesize(f0c, np.ascontiguousarray(sp2), np.ascontiguousarray(ap2), sr, TRAME_MS)

    # Silences de la mélodie : on coupe la voyelle tenue pendant les vrais silences.
    env = np.ones(len(y))
    ty = debut_tampon + np.arange(len(y)) / sr
    for i in range(len(notes) - 1):
        if n_deb[i + 1] - n_fin[i] > 0.25:
            env *= 1 - np.clip((ty - n_fin[i]) / 0.06, 0, 1) * np.clip((n_deb[i + 1] - 0.12 - ty) / 0.04, 0, 1)
    y = (y * env).astype(np.float32)
    infos = {"notes": len(notes), "syllabes": len(noy),
             "etirement": round(float((dst[-1] - dst[0]) / max(src[-1] - src[0], 1e-3)), 2)}
    if not noy:
        infos["note"] = "pas d'alignement phonétique : étirement uniforme (pip install 'piper-tts[alignment]')"
    return Rendu(vers_48k(y, sr), float(debut_tampon), infos)


# ───────────────────────────── conversion de voix, finition ──────────────────

def convertir_voix(x: np.ndarray, commande: str, cache: Path) -> np.ndarray:
    """Passe un extrait dans le module de voix de Torix (commande externe)."""
    cle = hashlib.sha1(commande.encode() + x.tobytes()).hexdigest()[:16]
    sortie = cache / f"vc_{cle}.wav"
    if not sortie.exists():
        entree = cache / f"vc_{cle}_entree.wav"
        sf.write(entree, x, SR_SORTIE, subtype="PCM_24")
        args = [m.format(entree=str(entree), sortie=str(sortie)) for m in shlex.split(commande)]
        subprocess.run(args, check=True)
        if not sortie.exists():
            sys.exit(f"La conversion de voix n'a pas écrit {sortie}")
    y, sr = sf.read(sortie, dtype="float32")
    if y.ndim > 1:
        y = y.mean(axis=1)
    y = vers_48k(y, sr)
    y = y[: len(x)] if len(y) >= len(x) else np.pad(y, (0, len(x) - len(y)))
    return niveau(y, 20 * np.log10(np.sqrt(np.mean(x ** 2)) + 1e-9)) if np.any(x) else y


def finition(x: np.ndarray, cfg: dict) -> np.ndarray:
    """Passe-haut, de-essing léger, compression douce. Pas de reverb."""
    chaine = ["highpass=f=80"]
    if cfg.get("deesser", True) and "deesser" in filtres_ffmpeg():
        chaine.append("deesser=i=0.35:m=0.5:f=0.5")
    if cfg.get("compression", True):
        chaine.append("acompressor=threshold=-22dB:ratio=2.5:attack=15:release=160:knee=6:makeup=1")
    y = ffmpeg_filtre(x, SR_SORTIE, ",".join(chaine))
    return y[: len(x)] if len(y) >= len(x) else np.pad(y, (0, len(x) - len(y)))


# ───────────────────────────── programme ─────────────────────────────────────

def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--config", default=str(Path(__file__).with_name("config.yaml")))
    ap.add_argument("--section", action="append", help="ne régénérer que cette section (répétable)")
    ap.add_argument("--plan", action="store_true", help="afficher le calage et s'arrêter")
    ap.add_argument("--sans-conversion", action="store_true", help="ne pas passer par le module de voix")
    args = ap.parse_args()

    chemin_cfg = Path(args.config).resolve()
    base = chemin_cfg.parent
    cfg = yaml.safe_load(chemin_cfg.read_text(encoding="utf-8"))
    bpm, tpm, mesures = float(cfg["tempo"]), int(cfg.get("temps_par_mesure", 4)), int(cfg["mesures"])
    s_par_temps = 60.0 / bpm
    total = int(round(mesures * tpm * s_par_temps * SR_SORTIE))
    sortie = base / cfg.get("sortie", "sortie")
    cache = sortie / "cache"
    (sortie / "sections").mkdir(parents=True, exist_ok=True)
    cache.mkdir(exist_ok=True)

    sections = []
    for s in cfg["sections"]:
        f = base / s["fichier"]
        vers = lire_paroles(f, s["nom"], s.get("style", "parle"), float(cfg.get("mesures_par_vers", 2))) \
            if f.exists() else []
        sections.append((s["nom"], vers))
    if args.section:
        inconnues = set(args.section) - {n for n, _ in sections}
        if inconnues:
            sys.exit(f"Section inconnue : {', '.join(inconnues)}")

    g = cfg.get("guide", {})
    notes: list[Note] = []
    chemin_guide = base / g["fichier"] if g.get("fichier") else None
    if chemin_guide and chemin_guide.exists():
        notes = lire_guide(chemin_guide, float(g.get("decalage_mesures", 0)), tpm)
    octaves = g.get("transposition_octaves", "auto")
    octaves = octaves_auto(notes, float(g.get("tessiture_hz", 300))) if octaves == "auto" else int(octaves)

    def notes_du_vers(v: Vers) -> list[Note]:
        d = (v.mesure - 1) * tpm
        return [n for n in notes if d - 1e-3 <= n.debut < d + v.duree * tpm - 1e-3]

    print(f"{bpm:g} BPM, {tpm}/4, {mesures} mesures = {total / SR_SORTIE:.2f} s — "
          f"guide : {len(notes)} notes, transposition {octaves:+d} octave(s)")
    for nom, vers in sections:
        if not vers:
            print(f"  [{nom}] aucun vers (fichier absent ou vide)")
        for v in vers:
            t = (v.mesure - 1) * tpm * s_par_temps
            nb = f", {len(notes_du_vers(v))} notes" if v.style == "chante" else ""
            print(f"  [{nom}] mes. {v.mesure:g} ({int(t // 60)}:{t % 60:05.2f}) {v.style}{nb} — {v.texte}")
    if args.plan:
        return

    tts = Synthese(cfg["tts"], base, cache)
    cv = cfg.get("conversion_voix", {})
    commande = "" if args.sans_conversion else (cv.get("commande") or "")
    if not commande:
        print("  ! conversion de voix non configurée : timbre brut de la synthèse (voir README)")
    gains = {"parle": 0.0, "chante": 0.0, "murmure": float(cfg.get("murmure", {}).get("gain_db", -6))}
    rapport = []

    for nom, vers in sections:
        fichier = sortie / "sections" / f"torix_voix_{nom}.wav"
        if args.section and nom not in args.section:
            continue
        piste = np.zeros(total, np.float32)
        for v in vers:
            audio, sr, phon = tts.dire(v.texte)
            duree_s = v.duree * tpm * s_par_temps
            style, ns = v.style, notes_du_vers(v)
            if style == "chante" and not ns:
                print(f"  ! [{nom}] mes. {v.mesure:g} : aucune note du guide dans ce vers → parlé")
                style = "parle"
            if style == "chante":
                r = rendre_chante(audio, sr, phon, ns, (v.mesure - 1) * tpm, s_par_temps,
                                  octaves, cfg.get("chante", {}))
            elif style == "murmure":
                r = rendre_murmure(audio, sr, duree_s, cfg.get("parle", {}), cfg.get("murmure", {}))
            else:
                r = rendre_parle(audio, sr, duree_s, cfg.get("parle", {}))
            x = fondus(niveau(r.audio, -20 + gains[style]), SR_SORTIE)
            debut = int(round(((v.mesure - 1) * tpm * s_par_temps + r.decalage_s) * SR_SORTIE))
            if debut < 0:
                x, debut = x[-debut:], 0
            x = x[: max(total - debut, 0)]
            piste[debut: debut + len(x)] += x
            rapport.append({"section": nom, "mesure": v.mesure, "style": style, "texte": v.texte,
                            "debut_s": round(debut / SR_SORTIE, 3), **r.infos})
            alerte = r.infos.get("alerte") or r.infos.get("note")
            print(f"  [{nom}] mes. {v.mesure:g} {style} ×{r.infos.get('etirement')}"
                  + (f" — {alerte}" if alerte else ""))
        actif = np.nonzero(piste)[0]
        if len(actif):
            a, b = max(actif[0] - 4800, 0), min(actif[-1] + 4800, total)
            if commande:
                piste[a:b] = convertir_voix(piste[a:b], commande, cache)
            piste[a:b] = fondus(finition(piste[a:b], cfg.get("finition", {})), SR_SORTIE)
        sf.write(fichier, piste, SR_SORTIE, subtype="FLOAT")  # provisoire, niveau final plus bas

    # Assemblage : toutes les sections (y compris celles non régénérées), un seul gain global.
    pistes = {}
    for nom, _ in sections:
        f = sortie / "sections" / f"torix_voix_{nom}.wav"
        if f.exists():
            x, _sr = sf.read(f, dtype="float32")
            pistes[nom] = np.pad(x, (0, max(total - len(x), 0)))[:total]
    brut = cache / "gain.json"
    if args.section and brut.exists():  # sections déjà au niveau final : on défait le gain précédent
        ancien = json.loads(brut.read_text())["gain"]
        for nom in pistes:
            if nom not in args.section:
                pistes[nom] = pistes[nom] / ancien
    melange = sum(pistes.values(), np.zeros(total, np.float32))
    crete = float(np.abs(melange).max())
    gain = 10 ** (float(cfg.get("finition", {}).get("crete_dbfs", -3)) / 20) / crete if crete > 0 else 1.0
    brut.write_text(json.dumps({"gain": gain}))
    for nom, x in pistes.items():
        sf.write(sortie / "sections" / f"torix_voix_{nom}.wav", x * gain, SR_SORTIE, subtype="PCM_24")
    final = sortie / "torix_voix.wav"
    sf.write(final, melange * gain, SR_SORTIE, subtype="PCM_24")
    ancien_rapport = []
    f_rapport = sortie / "rapport.json"
    if args.section and f_rapport.exists():
        ancien_rapport = [r for r in json.loads(f_rapport.read_text(encoding="utf-8"))
                          if r["section"] not in args.section]
    f_rapport.write_text(json.dumps(ancien_rapport + rapport, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"→ {final} ({total / SR_SORTIE:.2f} s, 48 kHz / 24 bits) + {len(pistes)} sections, rapport.json")


if __name__ == "__main__":
    main()
