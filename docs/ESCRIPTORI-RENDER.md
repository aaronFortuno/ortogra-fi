# Materials, llum i moviment de l’escriptori

Revisió acotada del 18 de novembre de 2026. L’escena continua sent un GLB preparat amb Blender i renderitzat amb Three.js 0.180.0, amb recursos locals. Les propostes pendents són hipòtesis per comparar visualment en local; no són millores de rendiment ja mesurades.

## Aplicat en aquesta iteració

- Els objectes tenen petites diferències de posició, profunditat i inclinació. Hi ha papers desalineats, un clip i un llapis, sense afegir moviments constants als elements que es poden obrir.
- Les fulles interiors s’han separat de la geometria estàtica. Tant aquestes com la vegetació exterior es mouen només quan són visibles, no hi ha cap fitxa oberta i es permet el moviment.
- S’ha corregit la desconnexió entre vegetació en moviment i ombres congelades: el mapa d’ombres es refresca com a màxim a 4 Hz mentre hi ha ambient animat; l’animació es limita a 24 fotogrames per segon. La pestanya oculta i el moviment reduït aturen aquest cicle.
- El contorn de ressaltat es calcula projectant els límits de cada objecte i dibuixant-ne l’embolcall en SVG. No afegeix cap passada de postprocessament a WebGL.
- Els PDF es mostren sobre fulls fins, amb vores i un petit desplaçament entre pàgines. La consulta ampliada utilitza les mateixes imatges completes, carregades en obrir l’objecte.

## Ajust de lectura posterior

La fitxa i el solucionari de Trama, Fil i Compte i Sentit es mostren als dos costats de l’arxivador. El paper aprofita gairebé tot el suport físic i l’enquadrament reserva només una barra inferior per a les accions. L’ampliació és directa en clicar el full, amb canvi de document al visor.

Una llum direccional més freda s’encén en obrir i s’apaga en tancar, sense mapa d’ombres addicional. La cara impresa utilitza `MeshBasicMaterial` amb blanc `#fbfdff` i `toneMapped: false`: preserva la tinta del PDF i evita que la llum o els reflexos rentin les lletres. Les vores mantenen el material físic. Aquests fulls fins no reben autoombres que puguin deixar ratlles sobre el text; continuen projectant ombra sobre el suport. Les tapes, el paper de base i les anelles mantenen els materials físics. És una decisió de llegibilitat per al document, mentre la resta de l’objecte continua responent a la llum.

## Cicle solar

La llum directa ja segueix el sol amb SunCalc 1.9.0: referència 41,39° N / 2,17° E, finestra al sud-oest i un refresc per minut amb la pestanya visible. Les ombres de la finestra provenen de la mateixa geometria i del mapa d’ombres existent. El jardí, l’ambient i la llum de sala s’interpolen segons l’alçada del sol. El plafó de sostre es crea a `escriptori/daylight.js`; no requereix una nova exportació de Blender ni un segon mapa d’ombres. La llum de lectura continua protegint la llegibilitat del document.

El càlcul astronòmic dona la posició del sol; el color i les intensitats interiors són decisions visuals. L’HDRI d’estudi continua aportant els reflexos de base, amb intensitat variable; la meteorologia i els núvols no es consulten. El control de data/hora permet comparar condicions amb la mateixa càmera. La prova manual no es desa entre visites. Les convencions angulars i la llicència de la versió emprada es documenten a [`assets/vendor/suncalc.README.md`](../assets/vendor/suncalc.README.md).

## Recorregut continu dels objectes

`escriptori/journey.js` calcula un únic camí de Bézier de quart grau. Els primers controls mantenen el material alineat amb el prestatge fins que n’ha sortit. La inclinació es produeix després de separar-se de la balda i la tapa s’obre durant l’arribada. Una sola acceleració i desacceleració envolta tot el recorregut de 2.500 ms.

La càmera es desplaça respecte del centre del material en moviment, centrant-hi progressivament la mirada i apropant-se a la vista de lectura. El canvi del centre d’atenció cap als fulls acompanya l’obertura. El camí es manté sota el sostre i s’avalua a l’inrevés per al retorn. Les textures es pugen i els programes de materials es compilen abans del moviment; el temps comença al primer fotograma. La prova de trajectòria mesura l’enquadrament, la continuïtat i la restauració de la càmera des de diferents vistes inicials.

## Properes proves, per ordre

1. **Coherència de la llum d’entorn.** L’HDRI actual, [Studio Small 09](https://polyhaven.com/a/studio_small_09), és d’estudi. Cal provar una orientació coherent amb la finestra i una intensitat de 0,8–1,0, reajustant l’exposició després. Si continuen apareixent reflexos d’estudi, comparar-lo amb un entorn de llum de dia. Canviar l’HDRI modifica els reflexos de tots els materials; convé comparar la vista de prestatge i la de lectura juntes. Three.js permet rotar i graduar l’entorn des de [Scene](https://github.com/mrdoob/three.js/blob/r180/docs/api/en/scenes/Scene.html).
2. **Rugositat abans de més geometria.** En [MeshStandardMaterial](https://github.com/mrdoob/three.js/blob/r180/docs/api/en/materials/MeshStandardMaterial.html), el valor de rugositat multiplica el mapa: no estableix un mínim. Provar el roure amb factor 1 i l’acer amb rugositat 0,28–0,35, reduint-ne la intensitat d’entorn a 0,8–1. Són punts de partida, no valors aprovats visualment.
3. **Ombres de contacte del paper.** Els ajustos de `normalBias` i `bias` actuals van eliminar ratlles d’autoombra en la vista propera. El `normalBias` de 0,025 equival aproximadament a 3,8 mm amb l’escala de l’escena, més que el gruix d’un full. Una prova amb límits d’ombra més ajustats i menys suavitzat podria millorar el contacte; no s’ha de reduir el biaix sense tornar a comprovar les tres obertures. Vegeu [LightShadow](https://github.com/mrdoob/three.js/blob/r180/docs/api/en/lights/shadows/LightShadow.html).
4. **Variació continguda dels materials.** Ja hi ha desplaçaments UV per peça. Es poden comparar diferències de color del 2–3% i de rugositat de ±0,03, mantenint la direcció de la veta i l’escala física. La repetició de la fusta sobre una superfície llarga s’ha de jutjar des de la càmera habitual, abans d’afegir més mapes. Vegeu [Texture](https://github.com/mrdoob/three.js/blob/r180/docs/api/en/textures/Texture.html).
5. **Llum indirecta precalculada.** Si les proves anteriors encara deixen el mobiliari pla, provar un mapa de llum indirecta separat de l’oclusió ambiental, només per a parets i mobles estàtics. Els objectes mòbils conservarien la llum en temps real. Un mapa RGBA8 de 1.024² amb mipmaps ocupa aproximadament 5,3 MiB de memòria gràfica; un de 2.048², 21,3 MiB. És una estimació de memòria, no de temps de dibuix. Three.js tracta [lightMap](https://github.com/mrdoob/three.js/blob/r180/src/renderers/shaders/ShaderChunk/lights_fragment_maps.glsl.js) i [aoMap](https://github.com/mrdoob/three.js/blob/r180/src/renderers/shaders/ShaderChunk/aomap_fragment.glsl.js) de manera diferent; no convé enfosquir la mateixa aportació dues vegades.

## Com comparar

Guardar captures amb la mateixa càmera, tema i mida: prestatge, finestra, arxivador obert, carpeta i capsa. Canviar una variable cada vegada. Revisar la llegibilitat del paper, el contacte dels objectes i les ombres en moviment abans de conservar el canvi. Les comprovacions es fan en local; l’autor valida el desplegament remot.
