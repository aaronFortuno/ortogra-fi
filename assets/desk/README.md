# Materials de l’escriptori beta

`oak.webp` és una textura de roure generada amb l’eina imagegen, comprimida a WebP a 1.024 × 1.024 px. El prompt utilitzat demanava una textura de color base de roure clar europeu, amb veta horitzontal fina, acabat mat, il·luminació uniforme i continuïtat als quatre costats, sense objectes, text ni ombres.

`paper.webp` és una textura de paper creada amb soroll determinista. El teixit dels arxivadors i la paret es calculen al navegador.

`escriptori.glb` conté els models creats amb Blender 5.2, amb la textura de roure i una textura d’oclusió ambiental de 2.048 × 2.048 píxels calculada amb Cycles. Els objectes interactius tenen noms estables `Item_<id>` i `Lid_<id>`. El navegador hi afegeix les etiquetes i les mostres impreses.

La font reproduïble és `tools/build-desk-assets.py`. Després de regenerar el GLB, el fitxer editable de Blender queda a `output/desk/escriptori.blend`, fora de Git. No cal Blender per servir ni utilitzar el web.

Els materials formen part del prototip d’ortogra.fi i es distribueixen amb la llicència MIT del projecte.
