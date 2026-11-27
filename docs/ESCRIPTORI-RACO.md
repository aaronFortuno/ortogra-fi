# Racó de treball · 27 de novembre de 2026

La vista principal d’[Escriptori](https://ortogra.fi/escriptori/) segueix el [croquis de l’autor](references/mockup-escriptori.png): una cantonada propera de taula, arxivadors recolzats i descobertes girant el cap. La finestra és a l’esquerra del dibuix. La portada ofereix un únic accés; `/escriptori-v2/` redirigeix al principal. L’escena anterior i els seus minijocs es conserven a `/escriptori/anterior.html`.

## Càmera: cadira i lectura

L’ull d’exploració és a `[-0.22, 1.06, 0.53]` metres, 30 cm a la dreta de la primera prova. La mirada inicial té inclinació `-0.42`, gir `-0.14` radians i camp vertical de 50°. En mòbil mira una mica cap al primer grup. Arrossegar el fons o un material i les fletxes giren la mirada. La roda fa zoom òptic suau entre 34° i 62° sense alterar ni la posició ni la inclinació. S’admeten esdeveniments de roda expressats en píxels, línies o pàgines; Ctrl+roda queda per al navegador. «Mirada inicial» restaura també els 50°. Un clic sense arrossegar obre el recurs. No hi ha captura obligatòria del punter.

El gir horitzontal va de `-1.40` a `1.10` radians i el vertical de `-1.20` a `0.70`. Es poden descobrir la finestra, els papers, les carpetes, la làmpada i la prestatgeria superior. «Projectes» dona accés als nou recursos sense haver de trobar-los a l’escena.

Per petició de l’autor, la consulta d’un material és una excepció a la posició fixa: el material arriba a la zona de treball i la càmera puja en el mateix recorregut per mirar-lo des de sobre, amb un camp de 50°. Els fulls reposen plans. L’alçada de lectura s’adapta a la proporció de pantalla, amb un mínim de 76 cm sobre el material. La informació i els botons queden fora del material. En tancar es restauren exactament posició, gir i zoom previs, i es torna a explorar des de la cadira. Els fulls i les tres maquetes es poden acostar des d’aquesta vista.

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

Després de la primera prova pixelada, l’escena explorable recupera més resolució i interpolació suau: el canvas deixa d’utilitzar `image-rendering: pixelated` i les fulles exteriors utilitzen filtrat lineal. Es conserva una resolució moderada i es prescindeix de MSAA; la interfície HTML manté la seva resolució. En lectura, les fitxes recuperen fins a 1,5 píxels per píxel CSS. No es pixelitzen les imatges font de les fitxes. El petit relleu procedural de la pàtina també s’ha suavitzat per evitar un aspecte massa granulat.

`patina.js` afegeix un únic camp procedural de 256 × 256, compartit pels materials de tela, fusta, paret, ceràmica i metall pintat. Modula petites variacions de color, rugositat i normal: zones fregades reflecteixen diferent, la paret té porus i la tela conserva el teixit existent. Les coordenades són locals perquè el desgast segueixi els objectes. Es reutilitzen els mapes PBR locals; no es descarreguen textures noves. El mapa de guix baixa de 1.024 a 512 px.

`garden.js` deixa la fotografia existent al fons, a 4,8 m del pla d’origen. Dues capes de branques i fulles instanciades, a 1,26 i 2,15 m, donen profunditat davant seu. El vent es calcula al shader i el gir de mirada aplica un desplaçament de paral·laxi petit, limitat a uns centímetres. La finestra gira amb frontissa, marc i vidre junts; obrir-la actualitza també el filtre del so. La llum continua seguint l’hora solar i la làmpada; el tema de la interfície es tria independentment.

## Pols, planta i mosca

La pols utilitza 820 punts en un únic dibuix amb moviment al shader. Es concentra prop de la zona visible, amb més densitat i una mida i deriva una mica més evidents; els contorns continuen sent suaus. La mida depèn de la distància i la llum de l’hora. No s’afegeixen rajos rectes ni volums de render addicionals.

Quatre fulles conserven els nervis com a part de la geometria mòbil. La resta de la planta s’agrupa per material. El punter impulsa un moll amortit amb força variable i reutilitza els enregistraments de fregament.

La mosca alterna repòs, passejades i vols autònoms. Les pauses, els punts de repòs, el nombre de corbes i les desviacions del vol varien, amb aleatorietat nova a cada visita. Els vols duren entre 0,38 i 1,3 segons segons el recorregut. En un 35% dels intents es prova un lloc a 156–252 px del punter recent; si no és una superfície vàlida s’explora de forma independent. La resta d’intents no depenen del punter. Acostar-se a menys de 48 px la fa fugir.

Els punts de repòs es comproven amb raigs sobre els sòlids visibles. La mosca pot caminar per la taula, els materials i les parets: valida vuit punts del recorregut i la normal abans de caminar, evitant passar una vora o penetrar un objecte. El cos s’orienta segons la superfície i les potes tenen una petita alternança. Les decisions i la posició del punter no s’envien a analítica. Durant la consulta queda oculta. Amb moviment reduït s’aturen el vol, les passejades, les reaccions animades i el vent.

## Rendiment i comprovacions

L’exploració es limita a una escala màxima d’1,05, amb un sostre de 1.440 × 900. En una vista de 1.440 × 844 i densitat 1 es dibuixa a la mida CSS, amb una interpolació més suau que en la primera prova a escala 0,8. Es manté el mapa d’ombres de 1.024 px i la densitat limitada en pantalles d’alta resolució. La reducció de píxels i de mostres no garanteix un increment concret d’FPS: també hi influeixen les crides de dibuix, els shaders i el dispositiu.

L’ambient tranquil es redibuixa a un màxim aproximat de 30 Hz. Durant el vol o les passejades de la mosca, el zoom o la reacció de les fulles, s’utilitza `requestAnimationFrame` a ritme de pantalla. Les ombres ambientals s’actualitzen a 4 Hz. La pestanya oculta atura el render. Els comptadors del header són locals i no consulten la GPU amb esperes bloquejants. Les àrees interactives es recalculen també quan canvia la projecció del zoom.

La interfície conserva transicions de 220 ms, els botons de mirada duren 420 ms, els acostaments i la finestra 820 ms i el recorregut dels materials 2.500 ms. Es respecta el moviment reduït.

`node tools/check-desk-corner.cjs` comprova el zoom sense inclinar ni desplaçar la cadira, els límits i el retorn del zoom després de llegir, l’acabat suau, la vista zenital, les descàrregues lentes i fallides, la pols, el jardí, les fulles, els controls físics, els nou recursos, les mostres, les maquetes, el tema, V4V i el mòbil. `node tools/check-desk-life.cjs` simula el mòdul real amb una llavor de prova: comprova l’autonomia, les rutes variades, les passejades adherides a superfícies, el biaix ocasional, la distància ampliada, el moviment reduït i la pausa. Les captures queden a `output/desk-corner/`. `node tools/check.cjs` cobreix la portada. No es comprova el desplegament remot.

## Rutes i analítica

El motor conserva el directori `escriptori-v2/`; l’entrada és `escriptori/index.html`. `room.js` construeix el racó, `seated-look.js` fixa l’exploració, `scene.js` coordina material i càmera, `life.js` gestiona fulles i mosca, i `garden.js` i `patina.js` donen profunditat i acabat. `assets/desk/corner-loading.json` compta els recursos d’arrencada; `tools/prepare-desk-loading.cjs` el regenera juntament amb l’índex de l’escena arxivada.

La vista principal envia `v4_*`, amb `interficie: escriptori-raco` i etiqueta `escriptori-raco`. L’arxivada conserva `v2_*`. Només es compten accions explícites sobre recursos, controls i gestos complets de mirada. No s’envien trajectes del punter, vols ni impactes de fulles. Les proves i el desenvolupament local bloquegen tota l’analítica externa.
