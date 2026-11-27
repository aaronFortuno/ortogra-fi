# Motor del racó de treball

Motor de la vista principal `/escriptori/`. El nom del directori conserva la procedència del prototip; `/escriptori-v2/` redirigeix al principal. L’escena antiga i els seus minijocs continuen a `/escriptori/anterior.html`. Comprova només en local.

- Durant l’exploració la càmera està asseguda a `SEAT`: arrossegament i fletxes giren, la roda fa zoom òptic entre 34° i 62°. Per petició de l’autor, en obrir materials es trasllada suaument a una vista zenital i restaura posició, gir i zoom en tancar. Els fulls i les maquetes es poden acostar des d’aquesta vista.
- Mantén el croquis de racó: dues files recolzades, materials parcialment fora del marc inicial, planta a l’ampit, capsa oberta i descobertes mirant als costats o amunt. Les fulles reaccionen amb un moll amortit i la mosca fuig del punter; els recursos han de continuar sent fàcils d’obrir des de «Projectes».
- Reutilitza els exemples, manifests, logotips i enllaços reals. El menú de projectes dona accés a tots els materials, també fora de l’enquadrament.
- Trajectes de material: 2.500 ms; botons de mirada: 420 ms; acostament de paper/maqueta: 820 ms; interfície: 220 ms. Respecta el moviment reduït.
- L’obertura comença mentre es carrega només la primera parella de fulls. Carrega els altres exemples quan es demanen i conserva com a màxim els fulls de dos projectes en memòria. Un error ha de retornar el material i reactivar els controls.
- L’acabat és suau, sense ampliació de píxels per veí més proper. Es conserva un límit moderat de resolució i no s’utilitza MSAA. En llegir es recupera més resolució. La mosca vola i camina al seu aire, amb un biaix ocasional pel punter a 156–252 px; no l’ha de perseguir sempre. La mosca i les fulles actives es mouen a ritme de pantalla; l’ambient tranquil es limita a 30 Hz.
- Conserva els materials mats dels pots i les etiquetes il·luminades: la nit amb làmpada apagada ha de ser gairebé fosca. Només les fulles activen el dring, amb el mateix silenci/focus que l’ambient. El filtre perifèric és opcional i s’omet quan hi ha un material obert; no dupliquis el render de geometria ni els mapes d’ombres per aplicar-lo.
- Analítica pròpia `v4_*`, amb `interficie: escriptori-raco`. Les proves locals i automatitzades no contacten amb Umami.
- Verificació: `node tools/check-desk-corner.cjs`, `node tools/check-desk-life.cjs` i `node tools/check-desk-finish.cjs`; si modifiques un helper compartit, comprova també la ruta anterior. El comandament antic `check-desk-v2.cjs` és un àlies.
