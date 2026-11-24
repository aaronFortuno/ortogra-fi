# Escriptori v2

Prototip separat de l’escriptori anterior. Mantén `/escriptori/` disponible i comprova només en local.

- La càmera està asseguda a `SEAT`, amb posició immutable. Només gira la mirada; els materials i les mostres s’acosten a l’usuari. Conserva aquest contracte durant obertura, retorn, lectura i maquetes.
- Les interaccions se centren en els recursos i els controls d’ambient. Els objectes decoratius formen part de l’escena.
- Reutilitza els exemples, manifests, logotips i enllaços reals. El menú de projectes dona accés a tots els materials, també fora de l’enquadrament.
- Trajectes de material: 2.500 ms; botons de mirada: 420 ms; acostament de paper/maqueta: 820 ms; interfície: 220 ms. Respecta el moviment reduït.
- Analítica pròpia `v3_*`, amb `interficie: escriptori-v2`. Les proves locals i automatitzades no contacten amb Umami.
- Verificació: `node tools/check-desk-v2.cjs`; si modifiques un helper compartit, comprova també la ruta anterior.
