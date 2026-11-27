# Escriptori v2: prova des d’una cadira

Primera prova: 24 de novembre de 2026. Ruta pròpia `/escriptori-v2/`, accessible des de la portada. L’escriptori anterior continua a `/escriptori/`.

## Contracte de navegació

La càmera es manté a `[0, 1.16, 0.73]` metres. El render reafirma aquesta posició a cada fotograma. La mirada gira, amb límits horitzontals i verticals, mitjançant l’arrossegament del fons, el tacte, les fletxes del teclat o els botons. La roda inclina la mirada. El camp de visió és de 54 graus: el gest no desplaça ni acosta la cadira.

En obrir un recurs, els arxivadors veïns es redrecen i el material surt cap a la zona de treball. La mirada s’hi orienta, però l’ull no canvia de lloc. En desar-lo es recupera la mirada anterior i els arxivadors es tornen a recolzar. El recorregut dura 2.500 ms; els botons de mirada, 420 ms. El paper i les maquetes s’acosten durant 820 ms. Els controls i les transicions de contingut duren 220 ms. Amb moviment reduït s’aplica directament l’estat final i s’atura l’animació ambiental.

«Acosta la fitxa» porta el paper davant del lector dins de l’escena. La roda, l’arrossegament tàctil i les fletxes amunt/avall desplacen el paper. «Torna al material» o Escape el retorna. Les maquetes es poden girar amb arrossegament i roda. El selector de mostres dona accés als tres exemples, i diferencia el solucionari d’una segona plantilla.

## Escena i interaccions

- Taula de 1,65 × 0,87 m amb organitzador baix i separadors de fusta.
- Finestra propera amb marc, ampit, vidre amb reflexos i irregularitats suaus, i jardí exterior reutilitzat.
- Paret amb variació de color i fissures fines. La textura es genera en una passada de píxels per evitar la quadrícula que produïa la superposició de degradats translúcids.
- Planta, full, llapis, grapadora i llum com a context de treball. Les interaccions se centren en els projectes, la mirada i els controls d’ambient.
- Arxivadors per a Plec, Trama, Ressò, Sentit i Fil i Compte; capsa de Relleu Obert; carpetes de Pentagrama i Pauta.

Els enllaços, les descripcions i els logotips es llegeixen de la portada. Les mostres surten d’`assets/desk/samples/examples.json`; les maquetes, del manifest existent de relleus. Es reutilitzen els mateixos fitxers i les seves atribucions. Els efectes i l’ambient conserven el silenci desat, les restriccions d’inici automàtic i l’esvaïment en perdre el focus.

El 27 de novembre s’hi incorpora Món a mà, com un arxivador vertical de Medi al costat de la capsa de Relleu Obert, amb les mateixes tres mostres que la ruta anterior. La capsa es redueix proporcionalment per deixar lloc als dos materials dins del compartiment.

El menú «Projectes» permet obrir qualsevol material sense haver-lo de localitzar visualment. Si falla el motor o una càrrega inicial, el menú ofereix enllaços directes als recursos. La portada continua sent una altra via d’accés.

## Organització del codi

| Fitxer | Responsabilitat |
| --- | --- |
| `escriptori-v2/app.js` | Interfície, tema compartit, llista, V4V i accions |
| `escriptori-v2/catalogue.js` | Catàleg, enllaços i manifests reals |
| `escriptori-v2/seated-look.js` | Rotació de cap i posició fixa |
| `escriptori-v2/room.js` | Habitació i textures procedimentals |
| `escriptori-v2/scene.js` | Materials, trajectes, mostres, maquetes i render |
| `tools/check-desk-v2.cjs` | Verificació local en navegador |

Es reutilitzen els mòduls de càrrega, ambient, PBR, etiquetes, deformació d’arxivadors, recolzament, posició solar i rendiment de l’escriptori anterior. L’únic ajust al seu comportament compartit és un paràmetre opcional `gap` a `createBinderShelf`, amb el valor anterior `.004` per defecte; la nova escala utilitza `.0007`. L’altra ruta conserva el mateix espaiat.

## Cost i comprovació

La planta conserva dues fulles amb moviment suau i agrupa la resta per material i atributs compatibles. Les superfícies estàtiques de l’habitació també s’agrupen. La densitat de píxels es limita a 1,6; hi ha un únic mapa d’ombres de 2.048 px i el vidre utilitza transparència senzilla. La pols es mou al shader, amb 380 punts. L’ambient es redibuixa a un màxim aproximat de 24 Hz; les animacions utilitzen la freqüència de pantalla. La pestanya oculta suspèn aquest cicle. La llum solar s’actualitza cada minut.

En la comprovació local inicial de 1.440 × 960: 198 crides de dibuix, 89.987 triangles i 24 textures. A 390 × 844: 162 crides, 43.599 triangles visibles i 20 textures. Són comptadors del render i depenen de l’enquadrament; no són una garantia de FPS. Les maquetes s’afegeixen sota demanda. Les textures dels exemples de paper s’alliberen en tancar cada material.

Verificacions locals:

```text
node tools/serve.cjs
node tools/check-desk-v2.cjs
node tools/check-desk-materials.cjs
node tools/check.cjs
```

La prova de v2 comprova la posició de càmera durant tot un trajecte amb animació normal, els gestos de mirada, els nou recursos, les parelles de mostres, les tres maquetes, inspecció amb roda/tacte, tema, V4V, moviment reduït i pantalles de 390 i 320 px. La prova de materials comprova que l’altra ruta conserva els recolzaments i la interacció. Les captures queden a `output/desk-v2/`, fora de Git. La verificació remota correspon a l’autor.

## Analítica i continuïtat

La portada afegeix `obre_escriptori_v2`. La nova ruta utilitza `v3_*`, `interficie: escriptori-v2` i etiqueta `escriptori-v3` per distingir-la de `/escriptori/`, que conserva els seus esdeveniments. Es compten obertures de material, canvis de mostra, consulta propera, entrada al recurs, mirada amb gest complet o botó, tema, llum, finestra i V4V. No s’envien fotogrames ni moviments continus del punter. No es carrega l’analítica en local ni amb `navigator.webdriver`.

És una prova per comparar escala, proximitat i navegació asseguda. Conserva les mostres reals i permet seguir ajustant el desgast, la llum i l’enquadrament sense alterar el model de càmera ni haver de modificar l’altra escena.
