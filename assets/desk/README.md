# Materials de l’escriptori beta

`oak.webp` és una textura de roure generada amb l’eina imagegen, comprimida a WebP a 1.024 × 1.024 px. El prompt utilitzat demanava una textura de color base de roure clar europeu, amb veta horitzontal fina, acabat mat, il·luminació uniforme i continuïtat als quatre costats, sense objectes, text ni ombres.

`paper.webp` és una textura de paper creada amb soroll determinista. El relleu de la paret es calcula al navegador.

`escriptori.glb` conté els models creats amb Blender 5.2, amb la textura de roure i una textura d’oclusió ambiental de 2.048 × 2.048 píxels calculada amb Cycles. Els objectes interactius tenen noms estables `Item_<id>` i `Lid_<id>`. El navegador hi afegeix les etiquetes i les mostres impreses.

La font reproduïble és `tools/build-desk-assets.py`. Després de regenerar el GLB, el fitxer editable de Blender queda a `output/desk/escriptori.blend`, fora de Git. No cal Blender per servir ni utilitzar el web.

`garden.webp` és el fons exterior de la finestra, generat amb l’eina imagegen integrada i comprimit a WebP de 900 × 1.200 px (183 KB). La vegetació que es mou davant seu és geometria 3D, amb nervadures procedimentals; la imatge no es deforma. `escriptori/atmosphere.js` deriva el mapa de relleu i la rugositat de la fusta de la textura original.

Prompt del jardí: «Use case: photorealistic-natural. Asset type: background photograph viewed through a side window inside a realistic browser 3D teacher desk scene. Create a natural photograph of a quiet leafy Mediterranean school garden on a bright overcast morning. Eye level from a first-floor window, softly blurred green deciduous trees and branches at mid distance, muted sage leaves, gentle blue-grey overcast sky visible through the upper third, a little distant garden wall at bottom. Real photography with subtle atmospheric depth, detailed natural leaves, no harsh sun, calm daylight and restrained colours, modest depth of field. Portrait 3:4 composition filling the frame edge to edge. No interior, no window frame, no building facade in foreground, no text, no people, no watermark. This is a background image, not a picture of the website or desk.»

`bookcloth.webp` és una textura de teixit d’enquadernació generada amb imagegen integrada, desaturada i comprimida a WebP de 1.024 × 1.024 px. Serveix de màscara neutra sobre els colors de les tapes, de textura de rugositat i de font del relleu, derivat al navegador.

Prompt del teixit: «Use case: product-mockup. Asset type: seamless flat surface albedo texture for physically based 3D rendering of a fabric-covered ring binder. A flat macro photograph of real fine bookbinding cloth, a tight woven linen-cotton crosshatch with tiny irregular natural fibers, subtle tonal variation and very fine pores. Neutral pale grey, high key around RGB 225-240, no coloured cast. Texture fills the entire square edge to edge, orthographic top down, perfectly even diffuse lighting, no shadows, no highlights, no directional lighting, no vignette, no perspective, no folds, no objects, no text, no watermark. Realistic textile surface only, seamlessly tileable at all four edges. Fine weave, not a thick hessian or coarse sack. One square 1024 texture.»

Els materials formen part del prototip d’ortogra.fi i es distribueixen amb la llicència MIT del projecte.
