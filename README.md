# ortogra.fi

Portada de **[ortogra.fi](https://ortogra.fi/)**, un espai de recursos oberts per aprendre i ensenyar.

- **Llengua.** [Plec](https://plec.ortogra.fi/) ofereix dictats en català, [Trama](https://trama.ortogra.fi/) ofereix comprensions lectores il·lustrades amb fitxes imprimibles i [Ressò](https://resso.ortogra.fi/) permet practicar la lectura en veu alta amb transcripció al dispositiu. La projecte [Sentit](https://sentit.ortogra.fi/) combina enregistraments amb fitxes i solucionaris.
- **Matemàtiques.** [Fil i Compte](https://filicompte.ortogra.fi/) reuneix problemes i fitxes imprimibles amb solucionaris.
- **Medi.** [Relleu Obert](https://relleu.ortogra.fi/) permet crear maquetes geogràfiques per imprimir en 3D.
- **Utilitats.** [Pentagrama](https://pentagrama.page/) prepara paper pautat per escriure música i [Pauta](https://pauta.ortogra.fi/) crea fulls pautats per practicar cal·ligrafia.

La pàgina inclou tema clar/fosc i un diàleg sobre l’autor i Value for Value. No hi ha comptes. La preferència de tema es desa al dispositiu amb `localStorage`.

## Escriptori beta

[Escriptori beta](https://ortogra.fi/escriptori/) és una prova de navegació en 3D, accessible des de la portada. La vista inicial d’ordinador centra la zona de treball i reuneix els lloms de Llengua, Matemàtiques, la capsa de Medi i les carpetes d’Utilitats. En mòbil comença per Llengua. Les àrees permeten passar a Matemàtiques, Medi i Utilitats, amb el mateix control en ordinador i mòbil. Els arxivadors estan recolzats sobre la taula, entre separadors de fusta collats a la paret. Les etiquetes girades incorporen els logotips del catàleg, paper envellit i una cantonada lleugerament desenganxada. Relleu Obert es presenta com una capsa, i Pentagrama i Pauta com a carpetes. Els objectes s’avancen en passar-hi per sobre o enfocar-los amb el teclat. En obrir-ne un, es trasllada a la taula i la càmera el segueix durant un únic recorregut de 2.500 ms, sense pauses intermèdies. El retorn recupera el punt de vista anterior. Les transicions de la interfície duren 220 ms i es respecta el moviment reduït.

Cada eina presenta **tres exemples reals**, començant pel central. Les cantonades s’aixequen en passar-hi per sobre i permeten avançar o retrocedir un exemple. Cada full gira completament sobre el llom/anelles, amb un lleuger flex i els dos costats impresos, sense esvair-se ni separar-se de l’arxivador; els botons i les fletxes del teclat ofereixen la mateixa navegació. Trama, Fil i Compte i Sentit mostren la fitxa i el solucionari corresponent. Plec presenta el mateix dictat en dos formats de plec, Pauta i Pentagrama mostren dues plantilles per exemple, i Ressò mostra lectures reals. La caixa de Relleu Obert conté tres maquetes 3D de mostra —Montserrat, Tamariu i Sant Maurici—, preparades a partir dels 3MF de l’autor. Es veuen juntes dins de la capsa i cadascuna es pot examinar directament, també amb els botons amb el seu nom. La descripció i l’accés al projecte queden sempre en un quadre fora del material, amb text de mida normal.

Un clic sobre un full **acosta la càmera perpendicularment al paper**, dins de la mateixa escena. La roda desplaça el document verticalment i es pot arrossegar en una pantalla tàctil. El punter, sense arrossegar, no mou la pàgina. Les fletxes de la barra o del teclat canvien de mostra sense abandonar la vista ampliada; amunt/avall desplacen el full. Un clic o Escape torna a l’arxivador obert; un segon Escape el desa. La descàrrega conserva el PDF complet original quan l’eina l’ofereix. Els sis fulls de l’eina es carreguen en obrir-la i s’alliberen de la GPU en tancar-la, per evitar acumular totes les textures. La [procedència de les mostres](assets/desk/samples/README.md) acompanya els recursos.

En mòbil s’enquadra el primer full; el quadre informatiu dona accés als dos costats. Els botons d’àrea canvien el prestatge visible. «Projectes» dona accés directe a les vuit eines, també quan WebGL no està disponible. El diàleg HTML manté el focus i els enllaços accessibles; la informació llarga té desplaçament intern.

Una llum de lectura més freda s’encén durant l’obertura i s’apaga en tancar. Les imatges impreses conserven els colors del PDF, amb un blanc lleugerament fred i sense reflexos que rentin les lletres; les vores, les tapes i les anelles mantenen els seus materials físics. Aquesta llum també funciona amb el tema fosc i no afegeix cap mapa d’ombres. Les dues capes impreses es restauren en passar de Relleu als arxivadors: el full de sota és visible abans de començar el gir i totes les imatges ja estan carregades en obrir l’eina.

La llum de l’habitació segueix la data i l’hora reals. [SunCalc 1.9.0](assets/vendor/suncalc.README.md) calcula l’alçada i l’azimut del sol per a una ubicació de referència a Catalunya, prop de Barcelona (41,39° N, 2,17° E). La finestra està orientada al sud-oest. Canvien la direcció del sol, les ombres, el color i la intensitat de la llum i l’exterior del jardí. Al capvespre s’encén progressivament la llum càlida de sala, amb un plafó al sostre. El tema clar/fosc de la interfície conserva la seva funció, sense substituir el cicle solar. El botó del rellotge al costat dels controls de càmera permet provar una data i una hora de Catalunya i tornar a l’hora actual. La prova manual dura fins que es recarrega la pàgina. El càlcul funciona al dispositiu, amb una ubicació fixa i sense serveis de geolocalització o meteorologia. Es refresca cada minut mentre la pestanya és visible i en tornar-hi.

L’entrada mostra un cercle amb percentatge i fase de càrrega. `assets/desk/loading.json` conserva la mida exacta dels 16 recursos inicials. El progrés de les descàrregues es calcula amb els bytes rebuts, encara que el servidor no enviï `Content-Length`. Els primers passos de preparació ocupen el 0–10%, els recursos el 10–90%, els materials i la compilació el 94%, i el primer dibuix el 98%. El 100% s’assoleix després d’un fotograma complet. És progrés de treball ponderat, no una estimació del temps restant; no avança amb un temporitzador. Si la càrrega falla, el cercle desapareix i es mostra la llista d’eines. Executa `node tools/prepare-desk-loading.cjs` després de canviar models, textures o miniatures inicials.

Els models es preparen amb Blender 5.2 i es distribueixen a `assets/desk/escriptori.glb`. Inclouen tapes fines amb cantells bisellats, frontisses, anelles metàl·liques, fulls i una habitació amb parets, sostre, terra i una finestra oberta a un jardí. Blender calcula l’oclusió ambiental amb 64 mostres, sobre el mapa UV `AmbientUV`, separat de les coordenades de color. Les textures de teixit i de roure de Poly Haven inclouen color, normal OpenGL i rugositat, amb coordenades a escala física. Un HDRI aporta reflexos i llum d’entorn. Aquests recursos són CC0 i es distribueixen localment; les fonts i les transformacions es documenten a `assets/desk/pbr/sources.json`. Three.js 0.180.0 s’inclou localment amb llicència MIT. El fons del jardí s’ha generat amb imagegen, amb el prompt documentat a `assets/desk/README.md`.

Arrossegar gira la mirada des de la posició de la càmera; no orbita al voltant del prestatge. Majúscules + arrossegar o el botó dret desplacen la càmera lateralment i verticalment. La roda acosta o allunya cap al cursor, també damunt dels objectes. Els botons permeten mirar a les quatre direccions, acostar-se i tornar a la vista inicial. En mòbil, un dit gira la mirada i dos dits permeten desplaçar-se i acostar-se. Els gestos no obren accidentalment les fitxes. La càmera té límits dins de l’habitació i les zones clicables segueixen els objectes.

Els arxivadors tenen inclinacions i profunditats diferents. Hi ha papers desalineats amb una cantonada aixecada, una grapadora, un rotllo de cinta adhesiva, un estoig obert i bolígrafs. La planta conserva 26 fulles corbades amb nervis, UVs i variacions de verd; una microtextura aporta irregularitat i brillantor cerosa. Algunes fulles responen a petites ràfegues espaiades i independents, en comptes d’oscil·lar totes alhora. La finestra és més ampla, i la grapadora, els papers i l’estoig queden als laterals, fora de la zona d’obertura. En passar-hi per sobre o enfocar un objecte, un contorn fi en ressalta la silueta. Les branques de la finestra responen a ràfegues compartides amb petits retards, amb un moviment més marcat dels pecíols i les fulles. Les fulles interiors mantenen la seva oscil·lació discreta. La vegetació s’actualitza fins a 24 vegades per segon. Amb sol directe les ombres segueixen les branques fins i tot quan només se’n veu la projecció. La cadència de les ombres ambientals és de fins a 8 Hz. El moviment ambiental es pausa durant la lectura, amb la pestanya oculta o si es prefereix moviment reduït. Els botons de mirada duren 420 ms; els gestos directes responen al moviment de la mà.

Una màscara procedural de núvols, projectada en coordenades de món, atenua només la llum directa del sol: les vores suaus d’ombra travessen parets, taula i objectes, i el cel de la finestra canvia lleugerament. No altera l’hora solar ni el llum de sala. Continua quan la finestra queda fora de camp si hi ha sol, i es congela durant la lectura, les transicions d’objecte, la pestanya oculta i el moviment reduït. El rellotge d’ambient només avança quan l’escena és activa, sense salts de fase en tornar-hi. No hi ha nous recursos remots, passades de postprocessament ni mapes d’ombres.

Els arxivadors es recolzen cap a l’esquerra amb una inclinació progressiva: el primer contra el separador i els següents contra la part alta de l’anterior. La forma carregada dels lloms, tapes i plecs es calcula en preparar l’escena i es relaxa en obrir-los. La col·locació utilitza la geometria real amb un petit marge de separació; no requereix una simulació física contínua. Els lloms tenen zones clicables amb la seva silueta per poder seleccionar-los encara que estiguin molt junts. Les mesures i la comprovació específica `node tools/check-desk-binders.cjs` consten a [Materials, llum i moviment](docs/ESCRIPTORI-RENDER.md).

La sala conserva el cicle solar automàtic. L’interruptor de la paret, al costat de la finestra, i el botó amb bombeta estan sincronitzats i permeten apagar o encendre la llum independentment de l’hora i del tema de la interfície. La tria manual es manté durant la visita; «Automàtica», als ajustos del rellotge, restaura el seguiment solar. La llum de suport de lectura també s’apaga quan es força l’apagat de la sala, mentre la tinta dels PDF manté la seva llegibilitat. El fons dels organitzadors rep menys llum indirecta segons l’obertura i els objectes que la tapen; retirar un arxivador modifica aquesta oclusió.

Les tres maquetes disponibles són les Agulles de Montserrat, Tamariu i l’estany de Sant Maurici. En agafar-ne una, la base s’aixeca per sobre de la vora abans de desplaçar-se a la part lliure de la taula. El retorn desfà el mateix camí, sense travessar les parets de la capsa, i la càmera acompanya la peça. Arrossegar gira i pivota la vista, la roda o els botons acosten/allunyen, i el botó d’enquadrament recupera la vista inicial. Clic o Escape retorna la peça a la caixa i restaura la càmera. Els GLB, de 75.266 triangles i aproximadament 1,7 MB cadascun, es carreguen només en obrir Relleu Obert. Són còpies de visualització mostrejades sobre els 3MF reals: conserven alçada superior, proporcions i colors, amb una malla de 192×192 i una textura de color de 512×512 mostrejada de les malles originals. El color té filtratge lineal i mipmaps; només hi ha dos materials per maqueta. Els detalls petits i els voladissos estan simplificats. Els originals no s’han modificat ni es distribueixen al portal. La [procedència i preparació dels models](assets/desk/reliefs/README.md) documenta fonts, llicències i límits.

Pots tocar o arrossegar els fulls solts i el material de taula. Fregar el potus o els bolígrafs de l’estoig els fa bellugar. Deixar anar un objecte més enllà del cantell el fa caure. «Recull els objectes de terra» els torna al lloc.

Els estris es poden deixar sobre els fulls i els fulls sobre altres estris. Els papers solts es corben suaument al voltant dels suports i les vores lliures baixen cap a la taula. En retirar un suport es recalculen els objectes que hi reposaven. Cancel·lar un arrossegament deixa l’objecte a l’última posició assolida. És una aproximació de contacte per a aquesta taula; no simula plecs permanents, bolcades ni l’equilibri d’apilaments arbitraris. `node tools/check-desk-support.cjs` comprova recolzaments, flexió, retirada de suports i cancel·lació, també a 320 px amb tema fosc. Reutilitza les malles existents, sense afegir triangles ni textures.

L’ambient exterior sona fluix per defecte. Si el navegador demana un gest, comença amb el primer clic o tecla. L’altaveu de la capçalera recorda el silenci entre visites. El vent entre fulles és continu, amb entrades espaiades d’ocells, pati i vehicles. El pati utilitza una gravació de canalla jugant en un parc. Tant les veus com els ocells entren de dia. La finestra regula l’ambient exterior. Obrir i tancar arxivadors conserva el nivell del pati, i cada gir de full hi afegeix un frec breu. La reproducció se suspèn en amagar la pestanya. «Mira la finestra» enquadra el vidre i la maneta. Tocar-los obre la fulla cap endins, deixa passar més aguts i fa moure una mica més el potos. Els sis MP3 ocupen 1.040.260 bytes. Les [fonts i la preparació de l’ambient](assets/desk/audio/README.md) acompanyen els àudios.

Els girs de full i l’extracció d’una maqueta duren 820 ms per poder seguir el moviment físic; la interfície manté els 220 ms, l’obertura completa 2.500 ms i els botons de mirada 420 ms. Totes aquestes animacions respecten el moviment reduït.

`escriptori/desk.js` recupera els enllaços i les miniatures de la portada, i les mostres completes d’`assets/desk/samples/examples.json`. Si afegeixes un projecte, incorpora la presentació i el tipus d’objecte a `presentation`, el model corresponent a `tools/build-desk-assets.py` i les seves mostres al manifest. El diàleg V4V es reutilitza de la portada. Umami compta l’entrada a l’escriptori, les obertures de fitxa, les ampliacions i descàrregues de mostra i els accessos a l’eina, amb l’identificador públic del projecte.

Per regenerar els models amb Blender, executa `blender --background --factory-startup --python-exit-code 1 --python tools/build-desk-assets.py`. El fitxer editable `output/desk/escriptori.blend` i la imatge d’oclusió queden fora de Git. El GLB inclou els materials de base; `escriptori/materials.js` aplica els mapes PBR i l’HDRI locals. `escriptori/reading.js` construeix els fulls, els gestos de cantonada i les zones interactives; `escriptori/paper-view.js` gestiona la càmera zenital i `escriptori/samples.js` coordina els controls, i `escriptori/navigation.js` gestiona la navegació. `escriptori/atmosphere.js` prepara la vegetació exterior i mou les fulles interiors. La [revisió de materials i llum](docs/ESCRIPTORI-RENDER.md) documenta els materials, les ombres i els límits del render actual. `node tools/check-desk.cjs` comprova els tres tipus d’objecte, la lectura a la taula sense fons enfosquit, l’enquadrament, el retorn, la rotació de la mirada, els desplaçaments laterals, el zoom, els límits, el moviment reduït, el teclat, els temes i la vista mòbil.

La prova també inclou gestos tàctils reals de Chrome: arrossegar sobre un arxivador, el gest de pinça i el primer toc després de cada gest. Es pot executar aquesta part per separat amb `node tools/check-desk.cjs --touch`.

`node tools/check-desk.cjs --reading` comprova la pàgina en mòbil i repeteix l’obertura dels tres tipus d’objecte, inclòs el retorn exacte a una vista girada. Desa captures de les pàgines a `tmp/desk/`.

`node tools/check-desk-samples.cjs` comprova els 24 exemples i els seus fitxers, les cantonades deformables, el canvi conjunt de fulls, la informació externa de 16 px, la càmera perpendicular al paper i el retorn exacte. Inclou desplaçament amb roda i arrossegament tàctil, clic i Escape, mòbil i tema fosc. Per a Relleu comprova la geometria real de dos materials i la textura de 512 px, la rotació, el pivot, l’acostament i el retorn de la peça. Les captures queden a `tmp/desk/`, fora de Git.

`node tools/check-desk-journey.cjs` observa els fotogrames reals del recorregut: el material es manté dins de l’enquadrament, la càmera continua dins de l’habitació, no hi ha aturades intermèdies i el retorn restaura la vista exacta. Cobreix arxivador, capsa i carpeta, una vista inicial girada i acostada, mòbil i tauleta vertical. La instrumentació de prova redueix la resolució del dibuix, de les imatges de paper i de les ombres per poder mostrejar el moviment amb el renderitzador per programari; conserva la geometria, l’enquadrament i els 2.500 ms. `--captures` prepara una seqüència visual del mateix camí alentida a 8 segons només durant aquesta prova. Els registres i les captures queden a `tmp/desk/`.

`node tools/check-desk-environment.cjs` comprova les estacions, la direcció del sol, la zona horària i els canvis d’horari, el pressupost de bytes i el progrés per fragments rebuts. `node tools/check-desk-daylight.cjs` comprova la càrrega real al navegador, el matí, les tardes d’hivern i estiu, la nit, el retorn al rellotge automàtic, els controls en mòbil i la recuperació davant d’un recurs no disponible. Desa captures a `tmp/desk/`.

`node tools/check-desk-revision.cjs` comprova la regressió del full gris després d’obrir Relleu, que la superfície impresa sigui la primera intersecció visible durant el gir, les tres maquetes dins dels límits de la capsa, la sortida i el retorn de cadascuna i el moviment/pausa de l’exterior. Inclou mòbil de 320 px en tema fosc; `--full` conserva la resolució real per a les captures.

`node tools/check-desk-living.cjs` comprova l’activació del so, la preferència de silenci i la descodificació dels sis àudios, pausa/retorn de pestanya, sincronització de l’interruptor físic, girs complets i opacs en els dos sentits, ancoratge al llom, canvi de mostra amb la càmera ampliada i alçada de la base de la maqueta durant la sortida de la capsa.

Les miniatures d’`assets/project-previews/` mostren fragments de les eines i de les previsualitzacions imprimibles. El render de Sant Maurici prové dels exemples de Relleu Obert.

## Analítica

La instància pròpia d’[Umami](https://docs.umami.is/docs/track-events) compta les visites i aquests esdeveniments al domini `ortogra.fi`:

- `obre_projecte`: clic a una fitxa, amb la propietat `projecte` per desglossar els clics.
- `obre_v4v`: obertura del diàleg sobre el projecte.
- `obre_portafoli`: clic a l’enllaç del portafoli.
- `copia_lightning`: còpia confirmada al porta-retalls. L’esdeveniment no inclou el text de l’adreça; seleccionar-la perquè es copiï manualment no es compta.

L’escriptori utilitza esdeveniments amb prefix **`v2_`**, la propietat `interficie: escriptori` i l’etiqueta de seguiment `escriptori-v2`. La portada clàssica conserva els noms anteriors. Les visites es distingeixen també pel camí `/escriptori/`; aquesta separació s’aplica a les dades noves, sense reetiquetar l’històric.

| Esdeveniment de l’escriptori | Acció i dades |
| --- | --- |
| `v2_obre_fitxa`, `v2_tanca_fitxa` | Obre o desa el material; identificador del projecte. |
| `v2_obre_projecte` | Accés a l’eina des de la fitxa o la llista; projecte i origen. |
| `v2_amplia_mostra`, `v2_passa_mostra`, `v2_descarrega_mostra` | Consulta dels exemples i PDF; projecte i número de mostra quan correspon. |
| `v2_tria_area`, `v2_obre_llista` | Navegació per àrees i obertura de la llista. |
| `v2_mou_camara` | Un esdeveniment en acabar un arrossegament, una pinça, una sèrie de roda o un botó; tipus de gest. |
| `v2_mou_objecte`, `v2_recull_objectes` | Arrossegament manual acceptat o recollida d’estris; tipus/nom de l’objecte o quantitat. |
| `v2_so_ambient`, `v2_finestra`, `v2_canvia_tema` | Estat escollit per l’usuari. |
| `v2_llum_sala`, `v2_llum_solar` | Canvi manual o retorn al mode automàtic; sense desar la data introduïda. |
| `v2_obre_v4v`, `v2_obre_portafoli`, `v2_copia_lightning` | Les accions del quadre compartit, diferenciades de la portada. |

No es compten els moviments de hover, cada fotograma, ni els desplaçaments automàtics per fer lloc. El codi de l’escriptori no carrega el tracker en local ni en navegadors identificats amb `navigator.webdriver`; les accions també comproven aquest límit. El tracker manté `data-domains="ortogra.fi"`, segons la [configuració d’Umami](https://docs.umami.is/docs/tracker-configuration). Les proves bloquegen totes les peticions externes i validen els noms amb un receptor simulat local (`node tools/check-desk-analytics.cjs`); no envien esdeveniments al servei real. Això evita comptar les nostres proves, sense garantir que qualsevol altra visita a producció sigui humana.

## Desenvolupament

HTML, CSS i JavaScript estàtics; no cal compilar ni instal·lar dependències per servir el web. Amb Node.js:

```sh
node tools/serve.cjs
```

Obre `http://127.0.0.1:4187/`. El header i el footer ocupen files fixes de la pantalla; només el contingut central fa scroll si cal. Les transicions duren 220 ms, amb respecte pel moviment reduït.

Per executar la prova local de navegador, instal·la les dependències de desenvolupament (`npm install`) i executa `npm run check` amb Chrome instal·lat i el servidor actiu. Cobreix amplades de 320 a 1.440 px, scroll intern, diàleg, retorn del focus, recursos locals i persistència del tema. Les captures es desen a `tmp/`, fora de Git.

## Marca compartida

- [Símbol SVG](assets/brand/symbol.svg): una «o» i un accent, per representar la llengua escrita. Dissenyat per funcionar també com a favicon i identificador a peus de pàgina.
- [Logotip SVG](assets/brand/logo.svg): símbol i nom complet.
- [Guia breu d’ús](assets/brand/README.md): colors, mida mínima i versió adaptable a temes.

Plec incorpora el mateix símbol i un enllaç al web pare al seu peu. Els recursos es mantenen locals a cada projecte per evitar dependències de xarxa per mostrar la marca.

## Publicació

Repositori: [aaronFortuno/ortogra-fi](https://github.com/aaronFortuno/ortogra-fi). GitHub Pages serveix `main` des de l’arrel. `.nojekyll` evita transformacions; `CNAME` conté `ortogra.fi`. La configuració del domini a Pages també s’ha de mantenir al repositori de GitHub.

Consulta [la configuració DNS](docs/DOMINI.md). Les comprovacions es fan en local; l’usuari valida el desplegament remot.

## Crèdits i llicències

Codi i marca sota [MIT](LICENSE). Materials de [Poly Haven](https://polyhaven.com/license) sota CC0, amb [fonts i autors](assets/desk/pbr/sources.json). [SunCalc 1.9.0](assets/vendor/suncalc.README.md), de Vladimir Agafonkin, sota [BSD-2-Clause](assets/vendor/suncalc.LICENSE). Icones de [Lucide](https://lucide.dev/), amb la seva [llicència](assets/icons/LICENSE). Fotografia, QR i dades públiques de V4V reutilitzats de Plec/Pentagrama a petició de l’autor, sense modificar les dades d’aportació. L’adreça Lightning és pública i no és una credencial.
