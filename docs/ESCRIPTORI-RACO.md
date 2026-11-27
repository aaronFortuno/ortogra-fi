# Racó de treball · 27 de novembre de 2026

La vista principal d’[Escriptori](https://ortogra.fi/escriptori/) segueix el [croquis de l’autor](references/mockup-escriptori.png): una cantonada propera de taula, arxivadors recolzats i descobertes girant el cap. La finestra és a l’esquerra del dibuix. La portada ofereix un únic accés; `/escriptori-v2/` redirigeix al principal. L’escena anterior i els seus minijocs es conserven a `/escriptori/anterior.html`.

## Càmera: cadira i lectura

L’ull d’exploració és a `[-0.22, 1.06, 0.53]` metres, 30 cm a la dreta de la primera prova. La mirada inicial té inclinació `-0.42`, gir `-0.14` radians i camp vertical de 50°. En mòbil mira una mica cap al primer grup. Arrossegar el fons o un material, la roda i les fletxes només giren la mirada. Un clic sense arrossegar obre el recurs. No hi ha captura obligatòria del punter.

El gir horitzontal va de `-1.40` a `1.10` radians i el vertical de `-1.20` a `0.70`. Es poden descobrir la finestra, els papers, les carpetes, la làmpada i la prestatgeria superior. «Projectes» dona accés als nou recursos sense haver de trobar-los a l’escena.

Per petició de l’autor, la consulta d’un material és una excepció a la posició fixa: el material arriba a la zona de treball i la càmera puja en el mateix recorregut per mirar-lo des de sobre. Els fulls reposen plans. L’alçada de lectura s’adapta a la proporció de pantalla, amb un mínim de 76 cm sobre el material. La informació i els botons queden fora del material. En tancar es restauren exactament posició i gir previs, i es torna a explorar des de la cadira. Els fulls i les tres maquetes es poden acostar des d’aquesta vista.

## Obertura sense esperar tots els exemples

L’obertura inicia alhora la descàrrega de la primera parella de fulls i el moviment físic. La preparació dels veïns de l’arxivador dura 220 ms; no espera la xarxa. Es demana només la mostra central, i les altres dues es carreguen quan es consulten. Relleu carrega primer una maqueta detallada i després les altres sota demanda.

Els darrers dos projectes conserven les seves textures de paper en memòria, evitant tornar-les a descarregar a cada obertura. Els exemples evictats s’alliberen de la GPU. Si la xarxa triga més que el trajecte, es conserva el missatge de preparació sobre el material obert. Hi ha un límit d’espera de 20 segons; un error retorna el material, restaura la càmera i reactiva els controls perquè es pugui tornar a provar.

## Distribució i controls físics

- Plec, Trama i Ressò es recolzen entre ells i contra la paret del racó.
- Sentit, Fil i Compte i Món a mà es recolzen cap al costat contrari amb un subjectallibres metàl·lic en L.
- La planta és a l’ampit i el pot buit de llapis és damunt de la taula. No travessen el suport dels arxivadors.
- Relleu comença amb la capsa oberta i una còpia lleugera de la maqueta real. Els models detallats es carreguen en obrir-la.
- Pauta és una pila irregular de fulls impresos; Pentagrama queda més a la dreta i al fons. Les mostres comparteixen controls amb els altres projectes.
- L’interruptor és a la base de la làmpada, prop del costat dret de la taula, amb un cable que baixa per la vora. El clic físic i el botó de llum comparteixen estat. S’ha retirat l’interruptor de la paret.
- La grapadora respon amb una pressió real del capçal i el so enregistrat existent.

`createBinderShelf` conserva els recolzaments amb els paràmetres opcionals `right` i `leanSign`, sense canviar els valors de l’escena arxivada. Els veïns es redrecen abans de retirar un arxivador i tornen a recolzar-se quan és fora. Les etiquetes baixen lleugerament perquè el nom sigui llegible amb la part superior fora del marc.

## Acabat i exterior

L’escena explorable prova un acabat lleugerament pixelat. Es redueix la resolució del dibuix 3D i es prescindeix de MSAA; la interfície HTML conserva la seva resolució. En lectura, les fitxes recuperen fins a 1,5 píxels per píxel CSS. No es pixelitzen les imatges font de les fitxes.

`patina.js` afegeix un únic camp procedural de 256 × 256, compartit pels materials de tela, fusta, paret, ceràmica i metall pintat. Modula petites variacions de color, rugositat i normal: zones fregades reflecteixen diferent, la paret té porus i la tela conserva el teixit existent. Les coordenades són locals perquè el desgast segueixi els objectes. Es reutilitzen els mapes PBR locals; no es descarreguen textures noves. El mapa de guix baixa de 1.024 a 512 px.

`garden.js` deixa la fotografia existent al fons, a 4,8 m del pla d’origen. Dues capes de branques i fulles instanciades, a 1,26 i 2,15 m, donen profunditat davant seu. El vent es calcula al shader i el gir de mirada aplica un desplaçament de paral·laxi petit, limitat a uns centímetres. La finestra gira amb frontissa, marc i vidre junts; obrir-la actualitza també el filtre del so. La llum continua seguint l’hora solar i la làmpada; el tema de la interfície es tria independentment.

## Pols, planta i mosca

La pols utilitza 580 punts en un únic dibuix amb moviment al shader. Es concentra prop de la zona visible, amb mida segons la distància i llum segons l’hora. No s’afegeixen rajos rectes ni volums de render addicionals.

Quatre fulles conserven els nervis com a part de la geometria mòbil. La resta de la planta s’agrupa per material. El punter impulsa un moll amortit amb força variable i reutilitza els enregistraments de fregament.

La mosca fa vols d’entre 0,68 i 1,02 segons, amb recorreguts corbs. Quan té una posició recent del punter, prova punts de repòs a 78–126 px al voltant seu. Només accepta fusta descoberta dins de la taula: descarta punts tapats per materials o objectes. Si no en troba, torna als punts de repòs coneguts. Acostar-se a menys de 48 px la fa fugir. No s’envia la posició del punter a analítica. Durant la consulta queda oculta. Amb moviment reduït s’aturen el vol, les reaccions animades i el vent.

## Rendiment i comprovacions

L’exploració es limita a una escala de 0,8 en ordinador i 1 en mòbil, amb un sostre de 1.152 × 720. En una vista de 1.440 × 844 es dibuixa a 1.152 × 675: aproximadament un 36% menys de píxels que a escala 1. El mapa d’ombres baixa de 2.048 a 1.024 px. La reducció de píxels i de mostres no garanteix un increment concret d’FPS: també hi influeixen les crides de dibuix, els shaders i el dispositiu.

L’ambient tranquil es redibuixa a un màxim aproximat de 30 Hz. Durant el vol de la mosca o la reacció de les fulles, s’utilitza `requestAnimationFrame` a ritme de pantalla i s’actualitza el moviment a cada fotograma. Les ombres ambientals s’actualitzen a 4 Hz. La pestanya oculta atura el render. Els comptadors del header són locals i no consulten la GPU amb esperes bloquejants.

La interfície conserva transicions de 220 ms, els botons de mirada duren 420 ms, els acostaments i la finestra 820 ms i el recorregut dels materials 2.500 ms. Es respecta el moviment reduït.

`node tools/check-desk-corner.cjs` comprova la cadira durant exploració, vista zenital i retorn, moviment mentre es retarden les descàrregues, pols, jardí a diferents profunditats, vol ràpid, fulles, finestra, interruptor i grapadora físics, els nou recursos, mostres, maquetes, tema, V4V, mòbil i fallada de càrrega. Les captures queden a `output/desk-corner/`. `node tools/check.cjs` cobreix la portada. No es comprova el desplegament remot.

## Rutes i analítica

El motor conserva el directori `escriptori-v2/`; l’entrada és `escriptori/index.html`. `room.js` construeix el racó, `seated-look.js` fixa l’exploració, `scene.js` coordina material i càmera, `life.js` gestiona fulles i mosca, i `garden.js` i `patina.js` donen profunditat i acabat. `assets/desk/corner-loading.json` compta els recursos d’arrencada; `tools/prepare-desk-loading.cjs` el regenera juntament amb l’índex de l’escena arxivada.

La vista principal envia `v4_*`, amb `interficie: escriptori-raco` i etiqueta `escriptori-raco`. L’arxivada conserva `v2_*`. Només es compten accions explícites sobre recursos, controls i gestos complets de mirada. No s’envien trajectes del punter, vols ni impactes de fulles. Les proves i el desenvolupament local bloquegen tota l’analítica externa.
