# Motor del racó de treball

Motor de la vista principal `/escriptori/`. El nom del directori conserva la procedència del prototip; `/escriptori-v2/` redirigeix al principal. L’escena antiga i els seus minijocs continuen a `/escriptori/anterior.html`. Comprova només en local.

- La càmera està asseguda a `SEAT`, amb posició immutable. Només gira la mirada; els materials i les mostres s’acosten a l’usuari. Conserva aquest contracte durant obertura, retorn, lectura i maquetes.
- Mantén el croquis de racó: dues files recolzades, materials parcialment fora del marc inicial, planta a l’ampit, capsa oberta i descobertes mirant als costats o amunt. Les fulles reaccionen amb un moll amortit i la mosca fuig del punter; els recursos han de continuar sent fàcils d’obrir des de «Projectes».
- Reutilitza els exemples, manifests, logotips i enllaços reals. El menú de projectes dona accés a tots els materials, també fora de l’enquadrament.
- Trajectes de material: 2.500 ms; botons de mirada: 420 ms; acostament de paper/maqueta: 820 ms; interfície: 220 ms. Respecta el moviment reduït.
- Analítica pròpia `v4_*`, amb `interficie: escriptori-raco`. Les proves locals i automatitzades no contacten amb Umami.
- Verificació: `node tools/check-desk-corner.cjs`; si modifiques un helper compartit, comprova també la ruta anterior. El comandament antic `check-desk-v2.cjs` és un àlies.
