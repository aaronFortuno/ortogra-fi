# ortogra.fi

Portada de **[ortogra.fi](https://ortogra.fi/)**, un espai de recursos oberts per aprendre i ensenyar.

- **Llengua.** [Plec](https://plec.ortogra.fi/) ofereix dictats en català, [Trama](https://trama.ortogra.fi/) ofereix comprensions lectores il·lustrades amb fitxes imprimibles i [Ressò](https://resso.ortogra.fi/) permet practicar la lectura en veu alta amb transcripció al dispositiu. La projecte [Sentit](https://sentit.ortogra.fi/) combina enregistraments amb fitxes i solucionaris.
- **Matemàtiques.** [Fil i Compte](https://filicompte.ortogra.fi/) reuneix problemes i fitxes imprimibles amb solucionaris.
- **Medi.** [Relleu Obert](https://relleu.ortogra.fi/) permet crear maquetes geogràfiques per imprimir en 3D.
- **Utilitats.** [Pentagrama](https://pentagrama.page/) prepara paper pautat per escriure música i [Pauta](https://pauta.ortogra.fi/) crea fulls pautats per practicar cal·ligrafia.

La pàgina inclou tema clar/fosc i un diàleg sobre l’autor i Value for Value. No hi ha comptes. La preferència de tema es desa al dispositiu amb `localStorage`.

## Escriptori beta

[Escriptori beta](https://ortogra.fi/escriptori/) és una prova de navegació en 3D, accessible des de la portada. Les eines de llengua i matemàtiques tenen arxivadors de gruix uniforme amb etiquetes girades. Relleu Obert es presenta com una capsa, i Pentagrama i Pauta com a carpetes. En passar-hi per sobre o enfocar-los amb el teclat, els objectes s’avancen o s’aixequen lleugerament. En obrir-ne un, es trasllada a la taula i la càmera s’hi situa a sobre. Les tapes, els fulls i les anelles són el mateix model 3D; la mostra s’imprimeix sobre el paper i el text HTML es projecta sobre la pàgina corresponent. No s’enfosqueix ni es difumina l’entorn. El retorn i Escape tanquen l’objecte, el tornen al seu lloc i recuperen el punt de vista anterior.

En mòbil, els botons d’àrea canvien el prestatge que es mostra. La vista de lectura enquadra la pàgina de descripció per mantenir-la llegible; el text llarg disposa d’scroll intern. «Projectes» dona accés directe a les vuit eines i també serveix d’alternativa quan WebGL no està disponible. La lectura conserva el diàleg HTML accessible, el focus i els enllaços. Obrir o tornar un objecte dura 2.500 ms en un únic recorregut continu: primer es desenganxa del prestatge, segueix una corba cap a la taula i comença a obrir-se durant l’arribada, sense frenades intermèdies. La càmera segueix el material des del punt de vista inicial fins a la lectura, i el retorn recupera la vista anterior. Les mostres es preparen a la GPU abans d’iniciar el rellotge de l’animació, que comença amb el primer fotograma. Les transicions de la interfície continuen durant 220 ms i es respecta el moviment reduït.

Sis eines mostren fulls complets generats amb els seus exportadors reals: Plec, Trama, Fil i Compte, Sentit, Pauta i Pentagrama. El PDF ocupa gairebé tot el paper, amb els marges propis del document. Trama, Fil i Compte i Sentit presenten la fitxa a l’esquerra i el seu solucionari a la dreta, amb la informació del projecte en una barra inferior. En mòbil s’enquadra la fitxa i la barra dona accés als dos documents. Plec ja inclou les solucions al mateix full; les eines sense solucionari independent conserven la descripció a la pàgina dreta. Un clic sobre qualsevol mostra obre el document ampliat; els botons «Fitxa» i «Solucionari» permeten alternar-los i cada document té el seu canvi de pàgina, zoom i descàrrega PDF. Escape tanca primer aquesta ampliació i després l’arxivador. Els fitxers grans es carreguen en obrir l’objecte. La [procedència de les mostres](assets/desk/samples/README.md) es conserva al costat dels recursos. Ressò i Relleu Obert mostren el resultat de l’eina, sense presentar-lo com un PDF imprimible.

Una llum de lectura més freda s’encén durant l’obertura i s’apaga en tancar. Les imatges impreses conserven els colors del PDF, amb un blanc lleugerament fred i sense reflexos que rentin les lletres; les vores, les tapes i les anelles mantenen els seus materials físics. Aquesta llum també funciona amb el tema fosc i no afegeix cap mapa d’ombres.

La llum de l’habitació segueix la data i l’hora reals. [SunCalc 1.9.0](assets/vendor/suncalc.README.md) calcula l’alçada i l’azimut del sol per a una ubicació de referència a Catalunya, prop de Barcelona (41,39° N, 2,17° E). La finestra està orientada al sud-oest. Canvien la direcció del sol, les ombres, el color i la intensitat de la llum i l’exterior del jardí. Al capvespre s’encén progressivament la llum càlida de sala, amb un plafó al sostre. El tema clar/fosc de la interfície conserva la seva funció, sense substituir el cicle solar. El botó del rellotge al costat dels controls de càmera permet provar una data i una hora de Catalunya i tornar a l’hora actual. La prova manual dura fins que es recarrega la pàgina. El càlcul funciona al dispositiu, amb una ubicació fixa i sense serveis de geolocalització o meteorologia. Es refresca cada minut mentre la pestanya és visible i en tornar-hi.

L’entrada mostra un cercle amb percentatge i fase de càrrega. `assets/desk/loading.json` conserva la mida exacta dels 16 recursos inicials. El progrés de les descàrregues es calcula amb els bytes rebuts, encara que el servidor no enviï `Content-Length`. Els primers passos de preparació ocupen el 0–10%, els recursos el 10–90%, els materials i la compilació el 94%, i el primer dibuix el 98%. El 100% s’assoleix després d’un fotograma complet. És progrés de treball ponderat, no una estimació del temps restant; no avança amb un temporitzador. Si la càrrega falla, el cercle desapareix i es mostra la llista d’eines. Executa `node tools/prepare-desk-loading.cjs` després de canviar models, textures o miniatures inicials.

Els models es preparen amb Blender 5.2 i es distribueixen a `assets/desk/escriptori.glb`. Inclouen tapes fines amb cantells bisellats, frontisses, anelles metàl·liques, fulls i una habitació amb parets, sostre, terra i una finestra oberta a un jardí. Blender calcula l’oclusió ambiental amb 64 mostres, sobre el mapa UV `AmbientUV`, separat de les coordenades de color. Les textures de teixit i de roure de Poly Haven inclouen color, normal OpenGL i rugositat, amb coordenades a escala física. Un HDRI aporta reflexos i llum d’entorn. Aquests recursos són CC0 i es distribueixen localment; les fonts i les transformacions es documenten a `assets/desk/pbr/sources.json`. Three.js 0.180.0 s’inclou localment amb llicència MIT. El fons del jardí s’ha generat amb imagegen, amb el prompt documentat a `assets/desk/README.md`.

Arrossegar gira la mirada des de la posició de la càmera; no orbita al voltant del prestatge. Majúscules + arrossegar o el botó dret desplacen la càmera lateralment i verticalment. La roda acosta o allunya cap al cursor, també damunt dels objectes. Els botons permeten mirar a les quatre direccions, acostar-se i tornar a la vista inicial. En mòbil, un dit gira la mirada i dos dits permeten desplaçar-se i acostar-se. Els gestos no obren accidentalment les fitxes. La càmera té límits dins de l’habitació i les zones clicables segueixen els objectes.

Els arxivadors tenen inclinacions i profunditats diferents; hi ha fulls desalineats, un clip i un llapis sobre la taula. En passar-hi per sobre o enfocar un objecte, un contorn fi en ressalta la silueta. Les branques de la finestra i les fulles de la planta interior es mouen suaument a 24 fotogrames per segon mentre són visibles. L’animació s’atura quan la vegetació queda fora del camp de visió, la pestanya passa a segon pla, hi ha una fitxa oberta o s’activa el moviment reduït. Les ombres es refresquen com a màxim quatre vegades per segon durant aquest moviment. Els botons de mirada duren 420 ms; els gestos directes responen al moviment de la mà.

`escriptori/desk.js` recupera els enllaços i les miniatures de la portada, i les mostres completes d’`assets/desk/samples/catalogue.json`. Si afegeixes un projecte, incorpora la presentació i el tipus d’objecte a `presentation`, el model corresponent a `tools/build-desk-assets.py` i les seves mostres al manifest. El diàleg V4V es reutilitza de la portada. Umami compta l’entrada a l’escriptori, les obertures de fitxa, les ampliacions i descàrregues de mostra i els accessos a l’eina, amb l’identificador públic del projecte.

Per regenerar els models amb Blender, executa `blender --background --factory-startup --python-exit-code 1 --python tools/build-desk-assets.py`. El fitxer editable `output/desk/escriptori.blend` i la imatge d’oclusió queden fora de Git. El GLB inclou els materials de base; `escriptori/materials.js` aplica els mapes PBR i l’HDRI locals. `escriptori/reading.js` projecta les pàgines HTML amb les mateixes coordenades que el model, `escriptori/samples.js` gestiona l’ampliació dels documents, i `escriptori/navigation.js` gestiona la navegació. `escriptori/atmosphere.js` prepara la vegetació exterior i mou les fulles interiors. La [revisió de materials i llum](docs/ESCRIPTORI-RENDER.md) recull prioritats per a les proves següents. `node tools/check-desk.cjs` comprova els tres tipus d’objecte, la lectura a la taula sense fons enfosquit, l’enquadrament, el retorn, la rotació de la mirada, els desplaçaments laterals, el zoom, els límits, el moviment reduït, el teclat, els temes i la vista mòbil.

La prova també inclou gestos tàctils reals de Chrome: arrossegar sobre un arxivador, el gest de pinça i el primer toc després de cada gest. Es pot executar aquesta part per separat amb `node tools/check-desk.cjs --touch`.

`node tools/check-desk.cjs --reading` comprova la pàgina en mòbil i repeteix l’obertura dels tres tipus d’objecte, inclòs el retorn exacte a una vista girada. Desa captures de les pàgines a `tmp/desk/`.

`node tools/check-desk-samples.cjs` comprova el contorn, els fulls més grans, la vista amb fitxa i solucionari, l’ampliació directa, el canvi de document i pàgina, el zoom, la descàrrega del PDF corresponent, el tancament successiu dels diàlegs, els temes, la vista mòbil i la durada més lenta d’obertura i tancament. Les captures i els PDF de comprovació queden a `tmp/desk/`, fora de Git.

`node tools/check-desk-journey.cjs` observa els fotogrames reals del recorregut: el material es manté dins de l’enquadrament, la càmera continua dins de l’habitació, no hi ha aturades intermèdies i el retorn restaura la vista exacta. Cobreix arxivador, capsa i carpeta, una vista inicial girada i acostada, mòbil i tauleta vertical. La instrumentació de prova redueix la resolució del dibuix i de les ombres per poder mostrejar el moviment amb el renderitzador per programari; conserva la geometria, l’enquadrament i els 2.500 ms. `--captures` prepara una seqüència visual del mateix camí alentida a 8 segons només durant aquesta prova. Els registres i les captures queden a `tmp/desk/`.

`node tools/check-desk-environment.cjs` comprova les estacions, la direcció del sol, la zona horària i els canvis d’horari, el pressupost de bytes i el progrés per fragments rebuts. `node tools/check-desk-daylight.cjs` comprova la càrrega real al navegador, el matí, les tardes d’hivern i estiu, la nit, el retorn al rellotge automàtic, els controls en mòbil i la recuperació davant d’un recurs no disponible. Desa captures a `tmp/desk/`.

Les miniatures d’`assets/project-previews/` mostren fragments de les eines i de les previsualitzacions imprimibles. El render de Sant Maurici prové dels exemples de Relleu Obert.

## Analítica

La instància pròpia d’[Umami](https://docs.umami.is/docs/track-events) compta les visites i aquests esdeveniments al domini `ortogra.fi`:

- `obre_projecte`: clic a una fitxa, amb la propietat `projecte` per desglossar els clics.
- `obre_v4v`: obertura del diàleg sobre el projecte.
- `obre_portafoli`: clic a l’enllaç del portafoli.
- `copia_lightning`: còpia confirmada al porta-retalls. L’esdeveniment no inclou el text de l’adreça; seleccionar-la perquè es copiï manualment no es compta.

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
