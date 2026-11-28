# Racó de treball · 28 de novembre de 2026

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

`patina.js` utilitza un únic camp procedural de 256 × 256 amb soroll interpolat a tres escales. Dues lectures del camp separen taques àmplies i porus fins, sense el patró d’ones repetitiu anterior. Cada material té un desplaçament diferent. Un atribut estàtic de coordenades de cara concentra el fregament irregular a les vores. Modula color i rugositat, conservant els mapes PBR locals; la tela utilitza un relleu normal més discret i evita el relleu procedural que donava taques excessives. No es descarreguen textures noves ni s’afegeixen polígons. Les petites ratlles de la taula tenen longituds i posicions irregulars, més concentrades a la zona de treball.

El test i el pot de llapis tenen rugositat alta, sense vernís transparent i amb reflex ambiental reduït. El camp compartit introdueix variacions fines de color i porus. Dues ombres de contacte petites els arrelen a l’ampit i la taula, independentment de les ombres projectades. S’ha ajustat el biaix de les ombres direccionals per reduir separacions aparents entre objecte i superfície.

Les etiquetes dels arxivadors són paper amb material il·luminat, no superfícies que conserven la brillantor quan s’apaguen els llums. De nit la llum ambiental i els reflexos de l’entorn baixen molt; en apagar la làmpada només queda una il·luminació residual molt feble. La fotografia exterior i la pols segueixen aquest nivell. La làmpada projecta ombres a la nit amb un mapa de 1.024 px i filtre PCF; durant el dia s’utilitza la projecció del sol. Les fitxes consultades conserven la seva nitidesa i ajusten la brillantor al dia i a la làmpada. Apagar el llum de taula de dia manté la llum natural de la finestra.

`garden.js` deixa la fotografia existent al fons, a 4,8 m del pla d’origen. Dues capes de branques i fulles instanciades, a 1,26 i 2,15 m, donen profunditat davant seu. El vent es calcula al shader i el gir de mirada aplica un desplaçament de paral·laxi petit, limitat a uns centímetres. La finestra gira amb frontissa, marc i vidre junts; obrir-la actualitza també el filtre del so. La llum continua seguint l’hora solar i la làmpada; el tema de la interfície es tria independentment.

## Pols, planta i mosca

La pols utilitza 820 punts en un únic dibuix amb moviment al shader. Es concentra prop de la zona visible, amb més densitat i una mida i deriva una mica més evidents; els contorns continuen sent suaus. La mida depèn de la distància i la llum de l’hora. No s’afegeixen rajos rectes ni volums de render addicionals.

Quatre fulles conserven els nervis com a part de la geometria mòbil. La resta de la planta s’agrupa per material. El punter impulsa un moll amortit amb força variable només quan la primera superfície de la planta que toca és una fulla o un nervi. El test, la terra i les tiges no activen aquesta reacció.

El so de les fulles utilitza el [chime enregistrat aportat per l’autor](../assets/desk/audio/README.md#dring-de-les-fulles), servit localment (32.640 bytes). `escriptori/leaf-chime.js` el descodifica una sola vegada i crea una veu nova en cada entrada del punter en una fulla, encara que altres drings estiguin sonant. Cada veu puja aleatòriament entre 3 i 10 semitons, evita repetir el to anterior i té un volum molt baix. No hi ha un interval global entre fulles. Mantenir el punter dins de la mateixa fulla no el repeteix; sortir-ne i tornar-hi sí. Un escombrat ràpid comprova fins a 16 punts intermedis per conservar els contactes.

L’agrupació estàtica de la planta conserva l’identificador de cadascuna de les 26 fulles amb rangs de triangles, sense més geometria, atributs de GPU ni crides de dibuix. Fulla i nervis comparteixen identificador. El test, la terra i les tiges continuen silenciosos. L’impuls del moll té el seu límit propi, independent del so; amb moviment reduït es pot sentir el dring sense animar les fulles.

Les veus respecten el silenci, el focus i la política d’activació del navegador de l’ambient compartit. Silenciar cancel·la també els contactes pendents de la primera descàrrega, per evitar reproduir-los després de reactivar el so. No es descarrega el banc de fregaments en tocar una fulla. L’escena arxivada manté els seus enregistraments i accions anteriors.

La mosca alterna repòs, passejades i vols autònoms. Les pauses, els punts de repòs, el nombre de corbes i les desviacions del vol varien, amb aleatorietat nova a cada visita. Els vols duren entre 0,38 i 1,3 segons segons el recorregut. En un 35% dels intents es prova un lloc a 156–252 px del punter recent; si no és una superfície vàlida s’explora de forma independent. La resta d’intents no depenen del punter. Acostar-se a menys de 48 px la fa fugir.

Els punts de repòs es comproven amb raigs sobre els sòlids visibles. La mosca pot caminar per la taula, els materials i les parets: valida vuit punts del recorregut i la normal abans de caminar, evitant passar una vora o penetrar un objecte. El cos s’orienta segons la superfície i les potes tenen una petita alternança. Les ales es pleguen sobre el dors en repòs i caminant; només es despleguen i bateguen durant el vol, amb una transició breu. Les decisions i la posició del punter no s’envien a analítica. Durant la consulta queda oculta. Amb moviment reduït s’aturen el vol, les passejades, les reaccions animades i el vent.

## Rendiment i comprovacions

L’exploració es limita a una escala màxima d’1,05, amb un sostre de 1.440 × 900. En una vista de 1.440 × 844 i densitat 1 es dibuixa a la mida CSS, amb una interpolació més suau que en la primera prova a escala 0,8. Es manté el mapa d’ombres de 1.024 px i la densitat limitada en pantalles d’alta resolució. La reducció de píxels i de mostres no garanteix un increment concret d’FPS: també hi influeixen les crides de dibuix, els shaders i el dispositiu.

L’ambient tranquil es redibuixa a un màxim aproximat de 30 Hz. Durant el vol o les passejades de la mosca, el zoom o la reacció de les fulles, s’utilitza `requestAnimationFrame` a ritme de pantalla. Les ombres ambientals s’actualitzen a 4 Hz. La pestanya oculta atura el render. Els comptadors del header són locals i no consulten la GPU amb esperes bloquejants. Les àrees interactives es recalculen també quan canvia la projecció del zoom.

`focus.js` afegeix un desenfocament perifèric opcional: el centre queda nítid i els marges barregen mostres properes amb un radi màxim de 2,2 píxels (1,35 en pantalles petites). És un efecte de lent segons posició a la pantalla, no una simulació de profunditat de camp amb mapa de profunditat. Es dibuixa l’escena una sola vegada en un buffer HDR limitat a la resolució del visor, i un triangle final aplica el filtrat i la conversió de color, seguint el patró de sortida de [Three.js](https://github.com/mrdoob/three.js/blob/r180/examples/jsm/postprocessing/OutputPass.js). No hi ha un segon recorregut de la geometria. La prova local registra 220 crides sense l’efecte i 221 amb l’efecte en el mateix enquadrament.

El botó de focus als controls del visor permet desactivar-lo i desa la preferència al dispositiu. En desactivar-lo s’allibera el buffer auxiliar; quan es consulta un material sempre s’omet el filtre per conservar les fitxes nítides. Si el dispositiu no admet el buffer necessari, el visor continua sense aquest efecte. Els comptadors de rendiment sumen els dos passos quan està actiu, sense presentar el triangle final com si fos tota l’escena.

La interfície conserva transicions de 220 ms, els botons de mirada duren 420 ms, els acostaments i la finestra 820 ms i el recorregut dels materials 2.500 ms. Es respecta el moviment reduït.

`node tools/check-desk-corner.cjs` comprova el zoom sense inclinar ni desplaçar la cadira, els límits i el retorn del zoom després de llegir, l’acabat suau, la vista zenital, les descàrregues lentes i fallides, la pols, el jardí, les fulles, els controls físics, els nou recursos, les mostres, les maquetes, el tema, V4V i el mòbil. `node tools/check-desk-life.cjs` simula el mòdul real amb una llavor de prova: comprova l’autonomia, les rutes variades, les passejades adherides a superfícies, el biaix ocasional, la distància ampliada, el moviment reduït i la pausa.

`node tools/check-desk-finish.cjs` comprova materials mats, etiquetes il·luminades, silenci sobre el test, dring variable i fluix, el botó de silenci, foscor nocturna i llum natural de dia. Compara també el centre i els marges amb el filtre activat/desactivat i el nombre de crides. La lectura de píxels és només a la resposta injectada de prova, mai al monitor de rendiment públic. Les captures queden a `output/desk-finish/`. `node tools/check-desk-loading-audio.cjs` comprova la compatibilitat de l’ambient compartit a la ruta arxivada. `node tools/check.cjs` cobreix la portada. No es comprova el desplegament remot.

`node tools/check-desk-chime.cjs` comprova amb raigs i àudio natius que cinc contactes ràpids en cinc fulles agrupades creen cinc veus superposades del mateix buffer. Valida els tons aguts, el nivell del senyal, l’absència de repetició mentre es roman dins d’una fulla i el retorn en tornar-hi, el silenci del test i la cancel·lació de veus actives i pendents. La prova de vida comprova també les ales plegades caminant/en repòs i obertes en vol.

## Rutes i analítica

El motor conserva el directori `escriptori-v2/`; l’entrada és `escriptori/index.html`. `room.js` construeix el racó, `seated-look.js` fixa l’exploració, `scene.js` coordina material i càmera, `life.js` gestiona fulles i mosca, i `garden.js` i `patina.js` donen profunditat i acabat. `assets/desk/corner-loading.json` compta els recursos d’arrencada; `tools/prepare-desk-loading.cjs` el regenera juntament amb l’índex de l’escena arxivada.

La vista principal envia `v4_*`, amb `interficie: escriptori-raco` i etiqueta `escriptori-raco`. L’arxivada conserva `v2_*`. Només es compten accions explícites sobre recursos, controls i gestos complets de mirada. No s’envien trajectes del punter, vols ni impactes de fulles. Les proves i el desenvolupament local bloquegen tota l’analítica externa.
