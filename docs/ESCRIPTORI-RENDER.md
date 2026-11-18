# Materials, llum i moviment de l’escriptori

Revisió acotada del 18 de novembre de 2026. L’escena continua sent un GLB preparat amb Blender i renderitzat amb Three.js 0.180.0, amb recursos locals. Les propostes pendents són hipòtesis per comparar visualment en local; no són millores de rendiment ja mesurades.

## Aplicat en aquesta iteració

- Els objectes tenen petites diferències de posició, profunditat i inclinació. Hi ha papers desalineats, un clip i un llapis, sense afegir moviments constants als elements que es poden obrir.
- Les fulles interiors s’han separat de la geometria estàtica. Tant aquestes com la vegetació exterior es mouen només quan són visibles, no hi ha cap fitxa oberta i es permet el moviment.
- S’ha corregit la desconnexió entre vegetació en moviment i ombres congelades: el mapa d’ombres es refresca com a màxim a 4 Hz mentre hi ha ambient animat; l’animació es limita a 24 fotogrames per segon. La pestanya oculta i el moviment reduït aturen aquest cicle.
- El contorn de ressaltat es calcula projectant els límits de cada objecte i dibuixant-ne l’embolcall en SVG. No afegeix cap passada de postprocessament a WebGL.
- Els PDF es mostren sobre fulls fins, amb vores i un petit desplaçament entre pàgines. La consulta ampliada utilitza les mateixes imatges completes, carregades en obrir l’objecte.

## Properes proves, per ordre

1. **Coherència de la llum d’entorn.** L’HDRI actual, [Studio Small 09](https://polyhaven.com/a/studio_small_09), és d’estudi. Cal provar una orientació coherent amb la finestra i una intensitat de 0,8–1,0, reajustant l’exposició després. Si continuen apareixent reflexos d’estudi, comparar-lo amb un entorn de llum de dia. Canviar l’HDRI modifica els reflexos de tots els materials; convé comparar la vista de prestatge i la de lectura juntes. Three.js permet rotar i graduar l’entorn des de [Scene](https://github.com/mrdoob/three.js/blob/r180/docs/api/en/scenes/Scene.html).
2. **Rugositat abans de més geometria.** En [MeshStandardMaterial](https://github.com/mrdoob/three.js/blob/r180/docs/api/en/materials/MeshStandardMaterial.html), el valor de rugositat multiplica el mapa: no estableix un mínim. Provar el roure amb factor 1 i l’acer amb rugositat 0,28–0,35, reduint-ne la intensitat d’entorn a 0,8–1. Són punts de partida, no valors aprovats visualment.
3. **Ombres de contacte del paper.** Els ajustos de `normalBias` i `bias` actuals van eliminar ratlles d’autoombra en la vista propera. El `normalBias` de 0,025 equival aproximadament a 3,8 mm amb l’escala de l’escena, més que el gruix d’un full. Una prova amb límits d’ombra més ajustats i menys suavitzat podria millorar el contacte; no s’ha de reduir el biaix sense tornar a comprovar les tres obertures. Vegeu [LightShadow](https://github.com/mrdoob/three.js/blob/r180/docs/api/en/lights/shadows/LightShadow.html).
4. **Variació continguda dels materials.** Ja hi ha desplaçaments UV per peça. Es poden comparar diferències de color del 2–3% i de rugositat de ±0,03, mantenint la direcció de la veta i l’escala física. La repetició de la fusta sobre una superfície llarga s’ha de jutjar des de la càmera habitual, abans d’afegir més mapes. Vegeu [Texture](https://github.com/mrdoob/three.js/blob/r180/docs/api/en/textures/Texture.html).
5. **Llum indirecta precalculada.** Si les proves anteriors encara deixen el mobiliari pla, provar un mapa de llum indirecta separat de l’oclusió ambiental, només per a parets i mobles estàtics. Els objectes mòbils conservarien la llum en temps real. Un mapa RGBA8 de 1.024² amb mipmaps ocupa aproximadament 5,3 MiB de memòria gràfica; un de 2.048², 21,3 MiB. És una estimació de memòria, no de temps de dibuix. Three.js tracta [lightMap](https://github.com/mrdoob/three.js/blob/r180/src/renderers/shaders/ShaderChunk/lights_fragment_maps.glsl.js) i [aoMap](https://github.com/mrdoob/three.js/blob/r180/src/renderers/shaders/ShaderChunk/aomap_fragment.glsl.js) de manera diferent; no convé enfosquir la mateixa aportació dues vegades.

## Com comparar

Guardar captures amb la mateixa càmera, tema i mida: prestatge, finestra, arxivador obert, carpeta i capsa. Canviar una variable cada vegada. Revisar la llegibilitat del paper, el contacte dels objectes i les ombres en moviment abans de conservar el canvi. Les comprovacions es fan en local; l’autor valida el desplegament remot.
