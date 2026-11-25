#!/bin/sh
# Comprime i personaggi 3D con gltfpack (Meshopt): circa 2,4 volte più leggeri, uguali a vederli.
# Si lancia una volta sola, dalla cartella del progetto, sui modelli originali KayKit:
#   sh scripts/comprimi-modelli.sh cartella-con-i-glb-originali
# -cc: compressione Meshopt più spinta; -kn e -km tengono i nomi dei nodi e i materiali,
# che il gioco usa per mostrare cappello, mantello e oggetto in mano.
set -e
for f in "$1"/*.glb; do
  npx gltfpack -i "$f" -o "public/characters/$(basename "$f")" -cc -kn -km
done
