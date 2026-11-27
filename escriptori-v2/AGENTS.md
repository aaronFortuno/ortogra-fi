# Motor del racó de treball

Motor de la vista principal `/escriptori/`. El nom del directori conserva la procedència del prototip; `/escriptori-v2/` redirigeix al principal. L’escena antiga i els seus minijocs continuen a `/escriptori/anterior.html`. Comprova només en local.

- Durant l’exploració la càmera està asseguda a `SEAT` i només gira. Per petició de l’autor, en obrir materials es trasllada suaument a una vista zenital i restaura posició i gir en tancar. Els fulls i les maquetes es poden acostar des d’aquesta vista.
- Mantén el croquis de racó: dues files recolzades, materials parcialment fora del marc inicial, planta a l’ampit, capsa oberta i descobertes mirant als costats o amunt. Les fulles reaccionen amb un moll amortit i la mosca fuig del punter; els recursos han de continuar sent fàcils d’obrir des de «Projectes».
- Reutilitza els exemples, manifests, logotips i enllaços reals. El menú de projectes dona accés a tots els materials, també fora de l’enquadrament.
- Trajectes de material: 2.500 ms; botons de mirada: 420 ms; acostament de paper/maqueta: 820 ms; interfície: 220 ms. Respecta el moviment reduït.
- L’obertura comença mentre es carrega només la primera parella de fulls. Carrega els altres exemples quan es demanen i conserva com a màxim els fulls de dos projectes en memòria. Un error ha de retornar el material i reactivar els controls.
- L’acabat és lleugerament pixelat en explorar, amb menys píxels i sense MSAA. En llegir es recupera la resolució dels fulls. La mosca i les fulles actives es mouen a ritme de pantalla; l’ambient tranquil es limita a 30 Hz. No confonguis reducció de píxels amb una promesa d’FPS.
- Analítica pròpia `v4_*`, amb `interficie: escriptori-raco`. Les proves locals i automatitzades no contacten amb Umami.
- Verificació: `node tools/check-desk-corner.cjs`; si modifiques un helper compartit, comprova també la ruta anterior. El comandament antic `check-desk-v2.cjs` és un àlies.
