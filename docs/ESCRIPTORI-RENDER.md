# Materials, llum i moviment de l’escriptori

Revisió del 20 de novembre de 2026. L’escena continua sent un GLB preparat amb Blender i renderitzat amb Three.js 0.180.0, amb recursos locals. Les propostes pendents són hipòtesis per comparar visualment en local; no són millores de rendiment ja mesurades.

## Fulls grapats amb unió flexible · 1.20

Els fulls grapats conserven el seu node, selecció, massa, recolzaments i deformació. S'elimina el grup rígid de l'escena; el conjunt passa a ser només informació sobre les unions entre pàgines. Agafar un full concret el converteix en guia, i els altres l'acompanyen amb gir, amortiment i flexió. La grapa es fixa a coordenades baricèntriques d'un triangle de cada full: segueix el mateix punt material durant la flexió i el rebregat, en comptes de conservar una coordenada de món o del grup.

`paper-links.js` recorre les unions des del full que s'està agafant. Les estrebades aporten gir als fulls arrossegats; una deformació local al voltant de la grapa permet mantenir les vores lliures recolzades. Els contactes es tornen a calcular quan canvien la posició, l'orientació o els suports. Una petita arruga acumulada conserva el rastre dels moviments més bruscos. Qualsevol full es pot convertir en bola independentment, i dues boles poden seguir unides. Les unions no creen cossos nous ni afegeixen geometria, textures o passades de renderitzat. El treball està acotat als cinc fulls de l'escena i dotze unions per full; quan s'assenten deixa d'actualitzar-se. Amb moviment reduït s'aturen els girs residuals en deixar anar el full.

La recollida conserva les unions entre els fulls caiguts. Per deixar lliure un recorregut es mouen primer els estris petits; si els papers han quedat massa oberts, una animació de 220 ms els apila al voltant de les grapes i els aparta. Aquesta subjecció és temporal durant l'endreça: no tornen a convertir-se en un objecte rígid. Continua sent una aproximació guiada per a aquesta taula, sense una simulació completa de làmines, torsió o contacte del paper amb si mateix.

La detecció de dependències considera tots els fulls units per evitar cicles de suport entre un estri i els papers que té sota. En aixecar un full, els objectes que hi descansaven tornen a recolzar-se a la taula; no es realimenta la seva alçada amb la deformació del full arrossegat.

`tools/check-desk-paper-links.cjs` utilitza el ratolí per seleccionar cadascun de dos fulls, comprova el gir relatiu i la continuïtat de la grapa, els recolzaments sobre un objecte, les arrugues del full arrossegat, el rebregat independent de tots dos fulls i la recollida. Inclou escriptori amb animació i mòbil de 320 px amb tema fosc i moviment reduït. Les captures són a `output/desk/flexible-staple-*.png`. Les proves generals actualitzen les expectatives de selecció: es tria el full real, no un identificador de grup.

## Boca de la grapadora, rodolament i foley · 1.19

El GLB havia fusionat les peces de la grapadora per material: els noms de Blender ja no existien, i la primera animació girava un grup buit. `stapler-mechanism.js` recupera els components connexos de les malles soldant posicions coincidents i separa capçal, carregador i cos fix, conservant materials i atributs. El capçal i el carregador tenen recorreguts diferents perquè el mecanisme metàl·lic no travessi la base. Les peces tornen a la posició inicial en acabar els 220 ms; amb moviment reduït s'aplica el resultat directament. La boca inicial mira cap a l'espai lliure de la taula.

`stapler-paper.js` detecta una vora de full pròxima a la boca. La marca verda assenyala l'entrada. En deixar-lo anar, el full passa per davant del cos, baixa i llisca dins de la ranura. Una deformació suau aixeca la vora sobre l'enclusa i deixa descansar la resta del paper sobre la taula. Un segon full se situa una mica més amunt. Es poden grapar i moure junts; arrossegar la grapadora o obrir un material allibera els fulls de la ranura. És un acoblament guiat per a fulls solts, no una simulació lliure d'inserció de qualsevol objecte dins del mecanisme.

Les boles tenen radi, proporcions i fases de plecs diferents a cada rebregat. El gir es fa al voltant del centre local de la bola, amb l'eix horitzontal derivat del desplaçament i l'angle proporcional a la distància recorreguda. La forma irregular modifica el recolzament. Els límits de les boles es calculen a partir dels vèrtexs transformats: girar la caixa local sencera inflava el volum i les deixava flotant. Un impuls es frena progressivament, els obstacles retornen part de la velocitat i dues boles es poden transmetre moviment. Els papers baixos es tracten com superfícies de rodolament, evitant que la seva caixa envolupant bloquegi una bola ben recolzada. No hi ha un motor de física general ni simulació de rebots verticals.

Els sons sintetitzats se substitueixen per set retalls d'enregistraments CC0, compartits i carregats en activar el so. Fonts, llicències i preparació a [Foley](../assets/desk/audio/foley/README.md). El reproductor utilitza mostres a la velocitat original i respecta silenci i pausa; no genera oscil·ladors ni soroll artificial. Les verificacions numèriques i de reproducció no equivalen a una validació auditiva humana.

`tools/check-desk-tactile.cjs` utilitza el ratolí per inserir dos fulls, grapar-los i comprovar el desplaçament dels vèrtexs visibles del capçal. Verifica formes diferents, rodolament horitzontal i recolzament, integritat i descodificació dels set àudios i zero oscil·ladors. Inclou 320 px amb tema fosc i moviment reduït. Captures locals: `output/desk/slot-paper-*.png`.

## Grapadora i paper rebregat · 1.18

Fer clic a la grapadora pressiona el capçal al voltant de la frontissa durant 220 ms i reprodueix un clic metàl·lic sintetitzat, amb el control de silenci compartit. La boca comprova tres punts sobre les malles reals dels fulls. Sense paper expulsa una grapa plegada; amb paper hi fixa la grapa. Dos o més fulls es reagrupen sota un node rígid comú, sense modificar-ne les posicions relatives. Es pot ampliar o unir un conjunt existent, es normalitzen les referències als suports evitant cicles, i el conjunt continua participant en col·lisions, caigudes, recollida i apartament per obrir materials. Les grapes fixades segueixen la deformació del full.

Un arrossegament recte o petites vibracions no rebreguen el paper. El detector demana almenys cinc inversions ràpides, amb recorregut i amplada mínims, en una finestra de 1,8 segons. La malla del full solt es transforma durant 220 ms en una bola irregular amb arrugues i ombreig facetat. Conserva els triangles originals, passa a tractar-se com un volum rígid i recalcula l’aterratge després del canvi de forma. Els conjunts grapats no es rebreguen. La deformació és un efecte guiat, no una simulació de plasticitat del paper; recarregar la pàgina restaura els materials.

La geometria i el material metàl·lic es creen al primer ús i es comparteixen entre grapes. S’acumulen com a màxim 24 grapes soltes, reciclant les més antigues, i dotze punts de grapa per full; repetir al mateix punt no hi superposa grapes noves. Els sons de grapadora i paper es generen localment. No hi ha nous fitxers multimèdia, textures ni passades de renderitzat; les grapes afegeixen malles només quan s’utilitzen. La càrrega inicial conserva les 189 crides i els 57.965 triangles de la vista d’escriptori. Les accions emeten `v2_grapa` i `v2_rebrega_full`, sense desar els moviments del punter i amb les mateixes exclusions de proves locals.

En fer lloc per a un material, els papers i conjunts es poden aixecar sobre fulls, clips i llapis baixos i deixar-hi damunt. L’altura final es calcula sobre les superfícies reals abans de fer el recorregut. Els objectes amb un pare traslladat, com el clip del munt de fulls, converteixen l’alçada d’aterratge de coordenades de món a locals; així no es resta dues vegades l’alçada del munt.

`tools/check-desk-play.cjs` comprova pressió en buit, grapa fixa, unió i arrossegament de dos fulls, ampliació a tres, sacsejada intencionada, compactació i aterratge de la bola, obertura d’un material amb els nous objectes, caiguda i recollida conjunta i límit de grapes. Inclou escriptori animat i mòbil de 320 px en fosc amb moviment reduït. Les captures locals són a `output/desk/minigames-*.png`.

## Recolzaments i paper flexible · 1.17

La comprovació d’aterratge deixa d’acceptar només papers com a suport: un llapis pot reposar sobre un full, també corbat, i un full pot quedar sobre la grapadora, la cinta o un altre estri. Els volums de col·lisió conserven l’alçada real, sense extrudir-se fins a la taula. Durant l’arrossegament s’aixeca l’objecte sobre els estris que troba al recorregut; els materials fixes continuen bloquejant-lo. Un gest cancel·lat deixa l’objecte a l’últim punt accessible i l’assenta, sense retornar-lo al lloc on s’havia agafat.

`table-support.js` reutilitza la malla dels cinc papers solts. Uneix els vèrtexs duplicats del gruix exportat i obté els veïns a partir dels triangles. Els contactes imposen alçades mínimes; una relaxació amb pendent acotat deixa caure les zones lliures i suavitza la corba. Les envolupants de triangles dels estris protegeixen tota la cel·la del paper perquè no sobresurtin puntes entre vèrtexs. Els objectes rígids mostregen la superfície real de sota amb raigs verticals. La deformació s’interpola durant 220 ms i actualitza normals, límits i ombres; amb moviment reduït s’aplica directament.

Cada objecte conserva els seus suports. En moure’ls o canviar-ne la forma, els dependents tornen a assentar-se, evitant dependències circulars. Les cerques de contacte es fan quan canvien els suports; les malles només s’actualitzen mentre dura la transició. Es mantenen el GLB, les textures, els triangles i les passades de renderitzat. Continua sent una aproximació de superfície per a aquesta taula: no hi ha deformació lateral, plecs permanents, bolcades ni equilibri complet de piles.

`tools/check-desk-support.cjs` prova l’arrossegament real d’un llapis sobre un full, paper corbat sobre la grapadora i sobre un llapis prim, absència de puntes que el travessin, un llapis sobre paper corbat, retirada del suport i cancel·lació sense salt a l’origen. També comprova que el full corbat i el seu suport s’aparten del recorregut d’un arxivador. Inclou caiguda animada, moviment reduït i 320 px en tema fosc. Les captures locals són a `output/desk/support-bent-paper.png`. Passen també les proves de sòlids i trajectòries, caiguda i recollida i gestos tàctils. La vista inicial de retorn continua amb 189 crides i 57.965 triangles en escriptori.

## Frases de preparació aleatòries · 1.16.1

El repertori creix fins a vint frases. Cada càrrega comença amb l’ordre barrejat, inclosa la primera frase. Cada cicle les mostra totes una vegada; en acabar es tornen a barrejar evitant repetir la darrera frase just després. Es conserven els cinc segons entre missatges i les transicions de 220 ms.

## Espai sòlid i resposta als gestos · 1.16

Abans de treure un material se’n mostregen 65 posicions de cada recorregut de sortida i retorn, inclosa l’obertura de la tapa i la diferència de posició que introdueix el hover. L’envolupant entre cada parella de posicions, amb un marge de 0,055 unitats, reserva l’espai que ocuparà. Els estris que hi interfereixen s’aparten abans de començar el recorregut continu de 2.500 ms. Relleu Obert reserva també la zona frontal on es deixen les maquetes. Els materials s’aixequen una mica més en sortir per passar sobre els papers baixos. Els objectes apartats es queden a la nova posició, sense tornar automàticament al lloc anterior.

`table-space.js` busca camins sobre la taula amb volums conservadors, una graella de 0,22 unitats i un màxim de 2.400 expansions. La cerca i el mostreig només s’executen quan cal fer lloc. Si un estri està encaixonat, es pot aixecar, passar sobre els altres i deixar en un espai lliure; si la taula no ofereix cap espai vàlid, el material no s’obre i es demana fer lloc. Pauta i Pentagrama s’assenten sobre la taula amb separació entre les seves petjades.

Els arrossegaments avancen en passos curts i comproven el volum escombrat per evitar travessar obstacles prims. Un estri pesant pot empènyer-ne un de més lleuger; els obstacles aturen o desvien el moviment. Agafar un objecte fora del centre introdueix gir. En deixar-lo, una inèrcia curta i un fregament dependent del tipus d’objecte eviten acabar sempre amb la mateixa orientació. Les caigudes i la recollida continuen disponibles; la recollida busca un lloc lliure si l’original està ocupat.

Les fulles tenen rigidesa, amortiment i velocitat angular pròpies. El contacte aporta impuls segons la direcció, la intensitat i la distància al pecíol, i es transmet suaument a les fulles properes. Un nou contacte modifica el moviment existent. Els grups glTF que separen làmina i nervis es tracten com una mateixa fulla. El test, no la capçada flexible, és el volum sòlid de la planta.

És una aproximació guiada per a aquesta escena, amb volums envolupants i moviment principalment sobre la taula: no simula apilaments arbitraris, deformació dels papers per contacte ni bolcades completes dels recipients. No incorpora cap motor físic, textura, llum ni passada de renderitzat addicional. La inèrcia només manté el render actiu mentre hi ha moviment; la vegetació conserva el seu cicle de 24 Hz i la pausa amb moviment reduït o pestanya oculta. La vista inicial conserva 189 crides de dibuix, 57.965 triangles, 32 textures i 4.174.406 bytes d’atributs/índexs de geometria; el treball addicional és de CPU durant les interaccions. `tools/check-desk-solids.cjs` cobreix els estris davant de la capsa, la grapadora sota un arxivador, l’extracció de maquetes, el gir del llapis i els impulsos acumulats de les fulles. L’enquadrament d’Utilitats té en compte els dos portafolis i les barres inferiors, i redueix la inclinació de la mirada en pantalles molt verticals per mantenir la càmera dins de l’habitació.

## Missatges de preparació · 1.15.2

Sobre el cercle de càrrega apareix una frase en cursiva, més gran, amb el to d’un docent fent lloc a la taula. Vuit missatges roten cada cinc segons amb transicions de 220 ms; amb moviment reduït el text canvia directament. El percentatge i l’estat tècnic continuen reflectint el progrés real, sense afegir cap espera. La rotació s’atura en completar-se o fallar la càrrega i no canvia el text mentre la pestanya és oculta.

## Pes i suport entre arxivadors · 1.15.1

La referència és la fotografia generada d’arxivadors en bon estat, lleugerament carregats, contra un lateral esquerre. Els cinc arxivadors comparteixen ara una inclinació cap al mateix costat: 5°, 7,5°, 10°, 12,5° i 15°. La geometria tancada determina la posició de cada peu sobre la taula i la separació mínima respecte del separador i de l’arxivador anterior. Es calcula una envolupant convexa en el pla vertical, conservadora respecte de la profunditat, amb un marge de 0,004 unitats per evitar interseccions. No hi ha un motor de física ni càlcul de contactes continu; els veïns romanen al seu lloc durant l’extracció.

La deformació diferencia la inclinació del conjunt de la pressió dels fulls: les tapes s’eixamplen una mica més a la boca, el llom agafa una convexitat suau i el cap del bloc de paper s’enfonsa de manera irregular. La càrrega varia discretament entre arxivadors. Etiquetes i folres segueixen la mateixa deformació, que es retira durant l’obertura i es recupera en tancar. Les zones clicables es retallen amb la silueta projectada del llom; així, els rectangles dels arxivadors adjacents no es tapen. Els accessos d’àrea es recentren sobre les noves posicions.

Comparació local amb `2867c05`, mateix enquadrament d’escriptori i hora solar: 189 crides de dibuix i 32 textures en totes dues versions; 56.045 → 57.965 triangles. A la vista propera es mantenen 170 crides i 32 textures. Els atributs i índexs de les geometries de l’escena passen de 4.130.246 a 4.174.406 bytes (+44.160 bytes, aproximadament 1,1%). No s’han afegit textures, llums, recursos ni passades de renderitzat. El GLB i el manifest de càrrega no canvien. Aquestes són mesures de complexitat de l’escena, no una mesura comparativa d’FPS. Captures: `output/desk/binder-support/`.

`node tools/check-desk-binders.cjs` comprova els peus, la proximitat real entre tapes a la part alta, la selecció individual dels lloms i el retorn exacte de la geometria carregada, en escriptori i a 320 píxels amb tema fosc. La prova tàctil comprova també arrossegament, pinça i primer toc posterior. Les set trajectòries de la prova de recorregut passen en escriptori, mòbil i tauleta: obertura contínua, material visible i retorn exacte de la càmera.

## Objectes de taula i arxivadors carregats · 1.15

Els cinc fulls, la grapadora, la cinta i els estris d’escriptura tenen geometria seleccionable. El gest conserva el punt per on s’agafa l’objecte. El cantell i el terra determinen on aterra. El mateix control de silenci governa els sons de contacte i el pati. Els sons de paper, de fregament i d’impacte es generen durant el gest i no passen pel filtre de la finestra.

El pes eixampla les tapes i enfonsa lleugerament el cap dels plecs. La deformació desapareix a mesura que l’arxivador s’obre. El jardí i les branques ocupen profunditats diferents darrere del mur. La llum solar actualitza les ombres de les fulles fins i tot quan la càmera només mira la taula.

Revisió local abans de publicar: càrrega dels mòduls, integritat dels sis MP3, control de finestra i silenci, suspensió i retorn de l’àudio, canvi físic de pàgina en tots dos sentits i extracció de les maquetes. S’ha comprovat que arrossegar un full no modifica la càmera, que pot caure de la taula i que el botó de recollida recupera la posició original. Les obertures de Plec, Trama i Relleu Obert mantenen el recorregut continu de 2.500 ms i el retorn exacte de la càmera. Les captures d’escriptori i de 320 píxels amb tema fosc no mostren desbordament ni errors de navegador. El manifest inicial conserva 16 recursos i suma 10.183.157 bytes.

La prova tàctil ha detectat que el navegador pot ometre el clic del primer toc després d’arrossegar. Els controls de càmera activen els tocs breus en acabar el gest i consumeixen el possible clic duplicat, com ja feia el visor ampliat. La prova d’arrossegament, pinça i primer toc posterior passa amb aquesta correcció; ratolí i teclat conserven l’activació per clic.

## Ajust del pati i del volum · 1.14.1

Un fragment de 17 segons de canalla jugant substitueix les veus sintetitzades. Sona a la velocitat original. El guany general baixa 3 dB tant amb la finestra oberta com tancada, també durant la lectura. Els sis àudios continuen ocupant 1.040.260 bytes. La font, la llicència de Mixkit i el tractament del WAV consten a [la fitxa dels àudios](../assets/desk/audio/README.md).

## Finestra, ambient i material de taula · 1.14

La maneta i el vidre obren una fulla practicable. La claror arriba pel mateix buit tant amb el vidre tancat com obert. Les branques a fora comparteixen la fase de la ràfega i l’obertura de la fulla augmenta el moviment del potos a dins. El cicle ambiental continua limitat a 24 Hz i les ombres de la vegetació a 4 Hz. Amb moviment reduït la finestra passa directament a la posició final.

L’ambient comença tan aviat com el navegador permet la reproducció. El silenci es recorda. El filtre del vidre passa progressivament de 1.500 a 7.200 Hz en obrir i el guany de la mescla passa de 0,24 a 0,42. La lectura multiplica el nivell per 0,43. El vent s’encadena i les entrades d’ocells, del vehicle i del pati tenen pauses variables. El fragment de pati és una recreació original de 17 segons amb crides de joc i bots de pilota. Els sis MP3 es carreguen quan pot començar l’àudio i ocupen 1.040.260 bytes.

La cinta es guarda a l’esquerra de Plec, al costat de la grapadora. El rodet té cares planes, capes concèntriques i una punta translúcida que surt tangent a la bobina. La grapadora té dues orelles de suport a la frontissa, guia metàl·lica inclinada, boca alineada amb l’enclusa i espai lliure per al paper. S’ha recalculat l’oclusió ambiental estàtica amb els objectes al seu lloc.

Respecte de `598ff68`, el manifest passa de 10.416.185 a 10.446.713 bytes, repartits en 16 recursos. A la vista general es mesuren 186 crides de dibuix, 79.473 triangles i 32 textures. A l’enquadrament de la finestra les crides passen de 67 a 70. Les captures i el clip local són a `output/desk/finestra-pati/`. La comprovació de recorregut mostreja 81 posicions per arxivador i hi troba separació amb la cinta en totes cinc trajectòries.

## Tela i llum de finestra · 1.13

La referència d’aquesta passada és `fe44a97`. La tela dels lloms i de la capsa utilitza els escaneigs originals de Book Pattern. El tint de la coberta queda visible entre els fils. La trama és més fina, el relleu de la normal és més suau i la rugositat mínima és més alta. Les transformacions estan registrades a `assets/desk/pbr/sources.json`. Els dos WebP junts ocupen 58.730 bytes menys. El manifest inicial suma 10.416.185 bytes en 16 recursos.

El cel que es veu des de la taula es representa amb una obertura orientada cap a l’interior i d’àrea equivalent a la finestra. La llum difusa depèn de l’àrea aparent i de la inclinació de la superfície que la rep. L’oclusió del prestatge s’aplica després. El terme s’anul·la de nit. El sol conserva el seu mapa d’ombres i els núvols, i el plafó i el llum de lectura conserven els seus controls. El càlcul aprofita la passada de material existent.

Les sis parelles de captures a `output/desk/teixit-llum/` comparteixen enquadrament i hora solar. A la taula de dia, totes dues versions registren 186 crides de dibuix, 79.347 triangles i 32 textures. El retall de 288 × 422 píxels del full imprès de Trama és idèntic. En quatre càrregues locals d’escriptori per versió, la mediana de preparació ha passat d’1,37 a 1,45 segons. Les proves d’interacció en escriptori i mòbil han acabat sense errors de consola.

## Passada de realisme · 1.12

La veta del roure segueix l’eix llarg de cada peça. Els mapes de color, normals i rugositat comparteixen la mateixa escala perquè els porus coincideixin amb el dibuix de la xapa. El vernís distingeix la zona d’escriptura del fons dels separadors.

Al potos, la variació de verd i groc segueix el teixit de cada fulla, amb menys contrast al nervi central i una brillantor irregular. A la finestra, els pecíols arrenquen de punts de les branques corbades i les fulles joves són més petites a les puntes. Les ràfegues continuen utilitzant el rellotge d’ambient de l’escena.

De dia, una part de la llum difusa arriba de l’hemisferi orientat cap a la finestra. Aquest pes disminueix amb l’altura solar i el plafó conserva la il·luminació nocturna. Es reutilitzen les llums, els mapes d’ombres i l’oclusió del moble. El manifest inicial conté 16 recursos que sumen 10.474.915 bytes.

La comparació local parteix de `32d466b`. Dos pecíols de l’esborrany intermedi quedaven més enllà del final de la seva branca i Three.js interrompia la càrrega. La variació de posició es limita ara als brots interiors. Les 33 fulles tenen un punt d’ancoratge vàlid.

Les cinc parelles de captures són a `output/desk/pilot-realisme/`. En la vista de la finestra, les crides de dibuix passen de 119 a 109, els triangles dibuixats de 64.100 a 65.180 i les textures residents de 35 a 34. A la taula de dia es mantenen 186 crides, 79.347 triangles i 32 textures. Mesures amb ANGLE Intel D3D11, DPR 1,25, ombres de 2.048² i moviment reduït.

## Aplicat en aquesta iteració

- Els objectes tenen petites diferències de posició, profunditat i inclinació. Hi ha papers desalineats, un clip i un llapis, sense afegir moviments constants als elements que es poden obrir.
- Les fulles interiors s’han separat de la geometria estàtica. Tant aquestes com la vegetació exterior es mouen només quan són visibles, no hi ha cap fitxa oberta i es permet el moviment.
- S’ha corregit la desconnexió entre vegetació en moviment i ombres congelades: el mapa d’ombres es refresca com a màxim a 4 Hz mentre hi ha ambient animat; l’animació es limita a 24 fotogrames per segon. La pestanya oculta i el moviment reduït aturen aquest cicle.
- El contorn de ressaltat es calcula projectant els límits de cada objecte i dibuixant-ne l’embolcall en SVG. No afegeix cap passada de postprocessament a WebGL.
- Els PDF es mostren sobre fulls fins, amb vores i un petit desplaçament entre pàgines. La consulta ampliada utilitza les mateixes imatges completes, carregades en obrir l’objecte.

## Ajust de lectura posterior

Totes les eines mostren dos fulls de material real i tres exemples diferents, segons `assets/desk/samples/examples.json`. La informació del projecte es presenta sempre fora de l’objecte, amb text HTML de 16 px, també a Pauta i Pentagrama. L’enquadrament reserva l’alçada real d’aquest quadre abans de començar el recorregut, per evitar un reenquadrament quan apareix.

`reading.js` manté els fulls dins dels mateixos models. Una malla subdividida doblega la cantonada en passar-hi per sobre i durant el canvi d’exemple; el full inferior mostra el material entrant. S’obre la mostra central, amb un exemple anterior i un de posterior, sense carrusel circular. Els botons externs i les fletxes són alternatives al gest de cantonada. Canvien els dos fulls junts per conservar la correspondència entre fitxa i solucionari.

`paper-view.js` desa la posició, orientació i punt de mira exactes de la vista de taula. L’ampliació desplaça la càmera sobre la normal del full, sense obrir un segon visor ni substituir el material per una imatge HTML. La vista deixa part del full fora de pantalla: el punter, l’arrossegament tàctil, la roda i les fletxes desplacen el punt de mira dins dels límits del document. Clic o Escape recupera la vista de taula; el següent Escape desa l’objecte. Si s’ha canviat la mida de la finestra, s’adapta l’enquadrament de retorn. Les textures dels sis fulls es carreguen en obrir i es destrueixen en tancar, sense acumular les de totes les eines a la GPU.

Un focus més fred, limitat a la zona de lectura, s’encén en obrir i s’apaga en tancar, sense mapa d’ombres addicional; el con evita tornar a il·luminar els recessos de l’organitzador amb una direccional global. La cara impresa utilitza `MeshBasicMaterial` amb blanc `#fbfdff` i `toneMapped: false`: preserva la tinta del PDF i evita que la llum o els reflexos rentin les lletres. Les vores mantenen el material físic. Aquests fulls fins no reben autoombres que puguin deixar ratlles sobre el text; continuen projectant ombra sobre el suport. Les tapes, el paper de base i les anelles mantenen els materials físics. És una decisió de llegibilitat per al document, mentre la resta de l’objecte continua responent a la llum.

## Cicle solar

La llum directa ja segueix el sol amb SunCalc 1.9.0: referència 41,39° N / 2,17° E, finestra al sud-oest i un refresc per minut amb la pestanya visible. Les ombres de la finestra provenen de la mateixa geometria i del mapa d’ombres existent. El jardí, l’ambient i la llum de sala s’interpolen segons l’alçada del sol. El plafó de sostre es crea a `escriptori/daylight.js`; no requereix una nova exportació de Blender; a la nit incorpora un mapa d’ombres de 2.048², desactivat quan no intervé la llum artificial. La llum de lectura continua protegint la llegibilitat del document.

El càlcul astronòmic dona la posició del sol; el color i les intensitats interiors són decisions visuals. L’HDRI d’estudi continua aportant els reflexos de base, amb intensitat variable; la meteorologia i els núvols no es consulten. El control de data/hora permet comparar condicions amb la mateixa càmera. La prova manual no es desa entre visites. Les convencions angulars i la llicència de la versió emprada es documenten a [`assets/vendor/suncalc.README.md`](../assets/vendor/suncalc.README.md).

## Recorregut continu dels objectes

`escriptori/journey.js` calcula un únic camí de Bézier de quart grau. Els primers controls mantenen el material alineat amb el prestatge fins que n’ha sortit. La inclinació es produeix després de separar-se de la balda i la tapa s’obre durant l’arribada. Una sola acceleració i desacceleració envolta tot el recorregut de 2.500 ms.

La càmera es desplaça respecte del centre del material en moviment, centrant-hi progressivament la mirada i apropant-se a la vista de lectura. El canvi del centre d’atenció cap als fulls acompanya l’obertura. El camí es manté sota el sostre i s’avalua a l’inrevés per al retorn. Les textures es pugen i els programes de materials es compilen abans del moviment. Un dibuix de preparació i una tanca GPU asíncrona completen també les passades d’ombres abans del primer fotograma en moviment; el temps comença al primer fotograma. La prova de trajectòria mesura l’enquadrament, la continuïtat i la restauració de la càmera des de diferents vistes inicials.

## Parets i ombres

Les parets tenen gra d’arrebossat procedural en coordenades de món, amb mostreig triplanar: la mida dels porus no depèn dels retalls UV del GLB. La textura de 512² es genera localment, sense cap descàrrega. El color i la rugositat varien molt lleument; el relleu es manté discret per evitar soroll a distància. El roure conserva els mapes PBR amb rugositat 1 i menys reflex d’entorn; el metall té rugositat 0,3. La intensitat del mapa d’oclusió precalculat s’ha ajustat sense tornar a coure el GLB.

La llum artificial nocturna és un focus interior ample amb atenuació per distància, en lloc d’una direccional que projectava ombres físicament inadequades de la paret lateral. El mapa d’ombres nocturn s’activa només quan intervé aquesta llum. La llum solar conserva el seu mapa i té el biaix ajustat per recuperar contacte sense autoombres a la tinta. Les aportacions de cel i rebot ara són hemisfèriques: les llums directes sense ombra feien arribar llum a un fons tapat pels arxivadors. El refresc limitat a 4 Hz també s’aplica a la nit mentre es mou la vegetació interior; durant una animació d’objecte les ombres es refresquen amb la geometria.

`contact-shadows.js` afegeix una malla de gradients estrets als encaixos reals dels mobles i petjades petites calculades a partir dels vèrtexs inferiors de cada objecte. Les petjades es retallen als suports i es retiren progressivament quan el material s’aixeca, gira o surt de la balda; no queda una taca immòbil quan se l’emporta la càmera. És una aproximació local d’oclusió, separada de les ombres projectades per les fonts de llum, sense postprocessament per fotograma.

L’escena continua utilitzant il·luminació directa en temps real, reflexos d’entorn i oclusió precalculada. No és un traçat de raigs en temps real ni una simulació completa de llum indirecta. Una futura comparació de llum indirecta precalculada per a parets i mobles estàtics es pot fer sense aplicar-la als objectes mòbils. Cal jutjar qualsevol increment de cost amb la vista de prestatge i la lectura propera.

## Com comparar

Guardar captures amb la mateixa càmera, tema i mida: prestatge, finestra, arxivador obert, carpeta i capsa. Canviar una variable cada vegada. Revisar la llegibilitat del paper, el contacte dels objectes i les ombres en moviment abans de conservar el canvi. Les comprovacions es fan en local; l’autor valida el desplegament remot.


## Organitzadors propers i desgast

Els divisors i els sis objectes que abans eren al prestatge s’han abaixat 1,8 unitats. El pla de treball els suporta directament, sense balda inferior ni sostre profund: hi ha un llistó de fixació i cargols a la paret. `desk-layout.js` comparteix els límits físics amb els helpers de contacte i d’oclusió. La càmera inicial d’ordinador centra la zona compartida de treball (en mòbil, Llengua); el selector d’àrea, també visible en ordinador, recorre la resta de la taula amb una transició de 420 ms. Les etiquetes prenen els logotips del mateix catàleg de la portada i es dibuixen sobre paper procedural envellit. Una malla subdividida aixeca discretament una cantonada. La planta i els objectes de taula es generen al mateix script de Blender, sense recursos externs nous.

`shelf-occlusion.js` estima la visibilitat ambiental dins de l’organitzador a partir de l’obertura frontal, una aportació superior petita i les caixes orientades dels sis objectes reals. Una textura 3D de 64×16×8 (8 KiB) atenua la llum **indirecta** dels materials de fusta i paret; les ombres solars i de sostre continuen depenent de les seves llums. La visibilitat es reconstrueix només si canvia la geometria, a un màxim de 4 Hz, i de forma exacta en completar l’anada o el retorn. El càlcul geomètric inicial es desa en uns 96 KiB de memòria de CPU. La prova local de l’agent amb el GLB final ha mesurat uns 6 ms per reconstrucció; no és una promesa de rendiment en altres dispositius. El resultat pot comparar-se amb `setStrength(0)` en una prova local. No s’afegeix una paret negra superposada ni una passada de postprocessament.

## Interruptor de sala

`daylight.js` separa la data de prova, el tema de la interfície i l’interruptor. El valor inicial segueix l’hora; prémer la bombeta força encès o apagat fins que l’usuari torna a «Automàtica». Un refresc de rellotge, una tornada de pestanya o un canvi de tema conserva la tria manual. En apagar de nit es redueixen també els rebots i la llum de suport de lectura, mantenint només l’ambient exterior residual. Els canvis de potència duren 220 ms. La tria no es desa entre visites.

## Maquetes físiques a la caixa

`reliefs.js` carrega només per a Relleu Obert els tres GLB derivats dels 3MF originals. Hi ha dues còpies 3D dins de cada combinació de la caixa; les planes impreses d’aquest projecte queden amagades i les zones d’acció es projecten sobre els límits reals de cada maqueta. En inspeccionar-ne una es desacobla temporalment del seu pare, es porta a l’espai lliure de davant de la taula i la càmera adopta una vista obliqua. La rotació, el pivot i l’acostament actuen sobre la càmera al voltant del model. El retorn restaura el pare, la transformació i el punt de vista anteriors; canviar la mida de finestra adapta l’enquadrament. Els controls són compartits amb el visor de paper, amb instruccions específiques per al relleu, alternatives de teclat i botons d’acostament. No hi ha un canvas o un modal addicionals. Geometries i materials s’alliberen quan es desa la caixa. La preparació i les atribucions es detallen a `assets/desk/reliefs/README.md`.

## Referències per a l’ambient sonor i visual

[Firewood](https://screen.toys/firewood/) i [Splitshift](https://screen.toys/splitshift/) són referències aportades per l’autor. La revisió visual mostra materials irregulars, detalls a diferents distàncies i contrast entre zones de llum i d’ombra. Splitshift carrega PixiJS: una aparença realista també pot combinar imatges i capes amb moviment contingut, sense que cada detall sigui geometria 3D. No s’han reutilitzat els seus recursos.

La propera passada d’ambient pot combinar un fons molt suau d’aire i carrer amb ocells, algun vehicle llunyà i petits cruixits del paper o de les tapes. Cal repartir els sons ocasionals amb pauses, volum i posició variables, sense un bucle curt recognoscible ni activitat permanent. La finestra serà la referència espacial dels sons exteriors; el moviment visual ha d’acompanyar el mateix ambient. Un control de so discret permetrà activar-lo expressament i la lectura reduirà el volum. Les gravacions hauran de ser pròpies o tenir una llicència reutilitzable documentada. La versió 1.10 incorpora el vent, els ocells i el vehicle amb enregistraments locals CC0; els petits sons del paper continuen pendents.


## Iteració 1.10 · 19 de novembre de 2026

- Organització compacta sobre la taula, amb la zona oberta centrada en X −1,5. Grapadora, estoig i papers fora del recorregut. Finestra de 4,9 unitats i interruptor físic sincronitzat amb el control HTML.
- Planta amb UV a totes les fulles, color original de vèrtex, microtextura de nervis/rugositat i petites ràfegues individuals, limitades a 0,035 radians per conservar la separació de la paret.
- Gir de full de 820 ms al voltant de l’eix compartit del llom, sense canvis d’opacitat. La malla temporal mostra dues textures de recto/verso i es destrueix en acabar. La correcció d’arribada compensa el petit angle de la tapa, mantenint la vora interior prop de les anelles. La roda desplaça la vista zenital; les fletxes laterals canvien l’exemple sense perdre-la.
- Maquetes: 192×192 punts d’alçada, PNG512 mostrejat de les malles originals, dos materials i aproximadament 1,7 MB/model. L’extracció segueix una corba d’elevació/transport/baixada; tota la base passa per sobre de la vora abans de sortir de la capsa. Les textures s’alliberen juntament amb materials i geometries.
- Ambient sonor local CC0 i voluntari, amb cinc fragments (~882 KiB). Vent fusionat, entrades espaiades d’ocells i vehicle, panoràmica i volum variables, nivell de lectura reduït i suspensió de pestanya. Sense càrrega inicial d’àudio. Les comprovacions tècniques no substitueixen l’escolta humana pendent.


## Iteració 1.11 · 19 de novembre de 2026

- Restauració explícita de la capa inferior impresa en tornar de Relleu als arxivadors. En iniciar el gir, la imatge següent es posiciona a la mateixa superfície visible; el canvi no espera al final de l’animació ni desencadena descàrregues.
- Tres maquetes en posicions independents dins de la capsa, sense la targeta exterior. Les planes de paper de suport queden fora de l’arbre 3D de Relleu per no crear límits invisibles que descentrin la càmera. Montserrat, Tamariu i Sant Maurici tenen accés directe, i qualsevol base supera el cantell abans de travessar-ne el perímetre.
- Ràfegues exteriors compartides amb retard entre branques i flexió independent de les fulles. El moviment interior conserva la seva amplitud petita prop de la paret.
- `weather.js` genera una textura periòdica de 128² (16 KiB) i la projecta sobre eixos perpendiculars al sol. El hook de materials encadena els shaders de guix, paper i oclusió existents i modula únicament `directLight.color` de la direccional solar. La tinta dels PDF i els focus de sala/lectura no es modifiquen. El cel utilitza la mateixa textura per superposar un canvi suau de núvols.
- Rellotge d’ambient acumulat només en navegació activa, 24 Hz, delta limitat en reprendre i pausa durant obertura, lectura, inspecció, pestanya oculta o moviment reduït. Els núvols poden avançar sense la finestra en pantalla; només la vegetació requereix refrescar les ombres a 4 Hz. No s’afegeixen recursos externs ni passades de render.
