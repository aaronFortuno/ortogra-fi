# Materials, llum i moviment de l’escriptori

Revisió acotada del 18 de novembre de 2026. L’escena continua sent un GLB preparat amb Blender i renderitzat amb Three.js 0.180.0, amb recursos locals. Les propostes pendents són hipòtesis per comparar visualment en local; no són millores de rendiment ja mesurades.

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

Una llum direccional més freda s’encén en obrir i s’apaga en tancar, sense mapa d’ombres addicional. La cara impresa utilitza `MeshBasicMaterial` amb blanc `#fbfdff` i `toneMapped: false`: preserva la tinta del PDF i evita que la llum o els reflexos rentin les lletres. Les vores mantenen el material físic. Aquests fulls fins no reben autoombres que puguin deixar ratlles sobre el text; continuen projectant ombra sobre el suport. Les tapes, el paper de base i les anelles mantenen els materials físics. És una decisió de llegibilitat per al document, mentre la resta de l’objecte continua responent a la llum.

## Cicle solar

La llum directa ja segueix el sol amb SunCalc 1.9.0: referència 41,39° N / 2,17° E, finestra al sud-oest i un refresc per minut amb la pestanya visible. Les ombres de la finestra provenen de la mateixa geometria i del mapa d’ombres existent. El jardí, l’ambient i la llum de sala s’interpolen segons l’alçada del sol. El plafó de sostre es crea a `escriptori/daylight.js`; no requereix una nova exportació de Blender; a la nit incorpora un mapa d’ombres de 2.048², desactivat quan no intervé la llum artificial. La llum de lectura continua protegint la llegibilitat del document.

El càlcul astronòmic dona la posició del sol; el color i les intensitats interiors són decisions visuals. L’HDRI d’estudi continua aportant els reflexos de base, amb intensitat variable; la meteorologia i els núvols no es consulten. El control de data/hora permet comparar condicions amb la mateixa càmera. La prova manual no es desa entre visites. Les convencions angulars i la llicència de la versió emprada es documenten a [`assets/vendor/suncalc.README.md`](../assets/vendor/suncalc.README.md).

## Recorregut continu dels objectes

`escriptori/journey.js` calcula un únic camí de Bézier de quart grau. Els primers controls mantenen el material alineat amb el prestatge fins que n’ha sortit. La inclinació es produeix després de separar-se de la balda i la tapa s’obre durant l’arribada. Una sola acceleració i desacceleració envolta tot el recorregut de 2.500 ms.

La càmera es desplaça respecte del centre del material en moviment, centrant-hi progressivament la mirada i apropant-se a la vista de lectura. El canvi del centre d’atenció cap als fulls acompanya l’obertura. El camí es manté sota el sostre i s’avalua a l’inrevés per al retorn. Les textures es pugen i els programes de materials es compilen abans del moviment. Un dibuix de preparació i una tanca GPU asíncrona completen també les passades d’ombres abans del primer fotograma en moviment; el temps comença al primer fotograma. La prova de trajectòria mesura l’enquadrament, la continuïtat i la restauració de la càmera des de diferents vistes inicials.

## Parets i ombres

Les parets tenen gra d’arrebossat procedural en coordenades de món, amb mostreig triplanar: la mida dels porus no depèn dels retalls UV del GLB. La textura de 512² es genera localment, sense cap descàrrega. El color i la rugositat varien molt lleument; el relleu es manté discret per evitar soroll a distància. El roure conserva els mapes PBR amb rugositat 1 i menys reflex d’entorn; el metall té rugositat 0,3. La intensitat del mapa d’oclusió precalculat s’ha ajustat sense tornar a coure el GLB.

La llum artificial nocturna és un focus interior ample amb atenuació per distància, en lloc d’una direccional que projectava ombres físicament inadequades de la paret lateral. El mapa d’ombres nocturn s’activa només quan intervé aquesta llum. La llum solar conserva el seu mapa i té el biaix ajustat per recuperar contacte sense autoombres a la tinta. El refresc limitat a 4 Hz també s’aplica a la nit mentre es mou la vegetació interior; durant una animació d’objecte les ombres es refresquen amb la geometria.

`contact-shadows.js` afegeix una malla de gradients estrets als encaixos reals dels mobles i petjades petites calculades a partir dels vèrtexs inferiors de cada objecte. Les petjades es retallen als suports i es retiren progressivament quan el material s’aixeca, gira o surt de la balda; no queda una taca immòbil quan se l’emporta la càmera. És una aproximació local d’oclusió, separada de les ombres projectades per les fonts de llum, sense postprocessament per fotograma.

L’escena continua utilitzant il·luminació directa en temps real, reflexos d’entorn i oclusió precalculada. No és un traçat de raigs en temps real ni una simulació completa de llum indirecta. Una futura comparació de llum indirecta precalculada per a parets i mobles estàtics es pot fer sense aplicar-la als objectes mòbils. Cal jutjar qualsevol increment de cost amb la vista de prestatge i la lectura propera.

## Com comparar

Guardar captures amb la mateixa càmera, tema i mida: prestatge, finestra, arxivador obert, carpeta i capsa. Canviar una variable cada vegada. Revisar la llegibilitat del paper, el contacte dels objectes i les ombres en moviment abans de conservar el canvi. Les comprovacions es fan en local; l’autor valida el desplegament remot.


## Referències per a l’ambient sonor i visual

[Firewood](https://screen.toys/firewood/) i [Splitshift](https://screen.toys/splitshift/) són referències aportades per l’autor. La revisió visual mostra materials irregulars, detalls a diferents distàncies i contrast entre zones de llum i d’ombra. Splitshift carrega PixiJS: una aparença realista també pot combinar imatges i capes amb moviment contingut, sense que cada detall sigui geometria 3D. No s’han reutilitzat els seus recursos.

La propera passada d’ambient pot combinar un fons molt suau d’aire i carrer amb ocells, algun vehicle llunyà i petits cruixits del paper o de les tapes. Cal repartir els sons ocasionals amb pauses, volum i posició variables, sense un bucle curt recognoscible ni activitat permanent. La finestra serà la referència espacial dels sons exteriors; el moviment visual ha d’acompanyar el mateix ambient. Un control de so discret permetrà activar-lo expressament i la lectura reduirà el volum. Les gravacions hauran de ser pròpies o tenir una llicència reutilitzable documentada. Aquest ambient sonor encara no forma part d’aquesta versió.
