#!/usr/bin/env python3
"""Sons temporaires des 5 enceintes, en attendant les vraies mélodies.

Cinq boucles de 4,8 s, douces, dans la même gamme (do pentatonique) et au
même tempo : deux enceintes entendues ensemble restent harmonieuses.
Mono (obligatoire pour le son spatial), 22 050 Hz, niveau volontairement bas.

    python3 outils/sons.py
"""
import math
import os
import struct
import wave

FREQUENCE = 22050
DUREE_NOTE = 0.6
NIVEAU = 0.30

NOTES = {
    "do3": 130.81, "re3": 146.83, "mi3": 164.81, "sol3": 196.00, "la3": 220.00,
    "do4": 261.63, "re4": 293.66, "mi4": 329.63, "sol4": 392.00, "la4": 440.00,
    "do5": 523.25, "re5": 587.33, "mi5": 659.25, "sol5": 783.99, "-": 0.0,
}

# Une mélodie par enceinte, chacune dans son registre pour la reconnaître.
MELODIES = [
    ["do4", "mi4", "sol4", "mi4", "la4", "sol4", "mi4", "-"],
    ["sol3", "-", "do4", "re4", "mi4", "-", "re4", "do4"],
    ["mi5", "re5", "do5", "-", "la4", "do5", "re5", "-"],
    ["do3", "sol3", "do4", "sol3", "la3", "mi3", "sol3", "-"],
    ["la4", "-", "sol4", "mi4", "-", "re4", "mi4", "sol4"],
]


def note(frequence):
    n = int(FREQUENCE * DUREE_NOTE)
    echantillons = []
    for i in range(n):
        if frequence == 0:
            echantillons.append(0.0)
            continue
        t = i / FREQUENCE
        # Attaque lente, extinction longue : jamais de son sec ni soudain.
        attaque = min(1.0, t / 0.08)
        extinction = math.exp(-3.2 * t) * min(1.0, (DUREE_NOTE - t) / 0.05)
        onde = math.sin(2 * math.pi * frequence * t) + 0.25 * math.sin(4 * math.pi * frequence * t)
        echantillons.append(NIVEAU * attaque * extinction * onde / 1.25)
    return echantillons


def main():
    dossier = os.path.join(os.path.dirname(__file__), "..", "SousSolEnglouti", "Ressources")
    os.makedirs(dossier, exist_ok=True)
    for numero, melodie in enumerate(MELODIES, start=1):
        echantillons = [e for nom in melodie for e in note(NOTES[nom])]
        chemin = os.path.join(dossier, f"enceinte_{numero}.wav")
        with wave.open(chemin, "wb") as fichier:
            fichier.setnchannels(1)
            fichier.setsampwidth(2)
            fichier.setframerate(FREQUENCE)
            fichier.writeframes(b"".join(struct.pack("<h", int(e * 32767)) for e in echantillons))
        print(chemin)


if __name__ == "__main__":
    main()
