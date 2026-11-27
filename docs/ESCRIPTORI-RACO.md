# Racó de treball · 27 de novembre de 2026

La vista principal d’[Escriptori](https://ortogra.fi/escriptori/) segueix el croquis de l’autor: enquadrament proper de la cantonada d’una taula, amb arxivadors parcialment fora del marc i espai per descobrir elements girant el cap. La finestra segueix el costat esquerre del dibuix. La portada ofereix un únic accés; `/escriptori-v2/` redirigeix al principal. L’escena anterior es conserva a `/escriptori/anterior.html`, amb els seus objectes movibles i minijocs.

[Croquis d’enquadrament de l’autor](references/mockup-escriptori.png).

## Mirada fixa

L’ull està a `[-0.52, 1.06, 0.53]` metres. La posició es reafirma a cada render. La mirada inicial té inclinació `-0.46` i gir `-0.22` radians, amb camp de visió vertical de 50°. En mòbil es mira una mica més cap al primer grup. Arrossegar el fons o un material, la roda i les fletxes només giren la mirada; un clic sense arrossegar obre el material. No hi ha trasllat, òrbita al voltant d’un punt ni captura obligatòria del punter.

El gir horitzontal està limitat entre `-1.40` i `1.10` radians i el vertical entre `-1.20` i `0.70`. Els límits deixen descobrir la finestra, els papers de Pauta, la carpeta de Pentagrama, el llum, la nota i la prestatgeria superior des del mateix lloc. «Projectes» dona accés als nou recursos sense haver de trobar-los dins l’escena.

El material s’acosta a la zona de treball, lleugerament a la dreta de la cadira. La mirada s’hi orienta, però l’ull no canvia de lloc. Els exemples reals, el solucionari, les plantilles i les tres maquetes continuen disponibles. La inspecció acosta el paper o el model, també amb càmera fixa.

## Distribució i contacte

- Plec, Trama i Ressò es recolzen entre ells i contra la paret del fons del racó.
- Sentit, Fil i Compte i Món a mà es recolzen cap al costat contrari, amb un subjectallibres metàl·lic en L.
- L’ampit no travessa els arxivadors ni el pot de llapis. La planta reposa sobre seu; el pot és damunt la taula i té l’interior buit.
- Relleu Obert comença amb la capsa oberta i una maqueta real a dins. La primera vista només en mostra una part.
- Pauta es presenta com una pila irregular de fulls impresos; Pentagrama queda més enllà del primer enquadrament. Les seves mostres s’obren amb els mateixos controls que els altres projectes.
- El llapis i la grapadora deixen lliure la zona on arriba el material obert. La grapadora respon amb una pressió del capçal i el so enregistrat existent.

Els dos grups d’arxivadors utilitzen `createBinderShelf`. Els paràmetres opcionals `leanSign` i `right` permeten recolzament cap a la dreta sense alterar els valors per defecte de l’escena anterior. Els veïns es redrecen abans de treure’n un i es tornen a recolzar quan el material ja és fora. Les etiquetes baixen lleugerament al llom perquè el nom sigui llegible amb la part superior fora del marc.

La paret té variació de color i fissures fines. L’oclusió de la llum indirecta reforça la cantonada i la unió amb la taula; les ombres de contacte suaus complementen les ombres direccionals. La fusta conserva els mapes PBR locals, amb marques petites concentrades a la zona de treball. L’escena no utilitza textures remotes.

## Vida i controls físics

Quatre fulles conserven els seus nervis com a part de la mateixa geometria mòbil. La resta de la planta s’agrupa per material. Passar el punter prop de la planta dona un impuls a les fulles properes; el moll amortit i les variacions d’impuls eviten repetir una animació tancada. Es reutilitzen els enregistraments de fregament de fulles.

La mosca alterna repòs i trajectes corbs entre llocs de l’habitació. Acostar-hi el punter la fa fugir. El cos, les ales i les potes són geometria molt petita; no hi ha un motor físic complet ni seguiment del punter enviat a analítica. Durant la consulta d’un material la mosca queda fora de la vista de lectura. Amb moviment reduït s’aturen els moviments ambientals i les reaccions animades.

La finestra gira com una fulla amb frontissa: marc i vidre es mouen junts. Es pot obrir des del vidre o des del botó, i tots dos actualitzen el mateix estat i el filtre de so ambient. L’interruptor de paret i el botó de llum també comparteixen l’estat. El tema clar/fosc pertany a la interfície; la llum de l’escena continua seguint l’hora solar i la llum de taula.

La interfície manté transicions de 220 ms, els botons de mirada duren 420 ms, els acostaments i la finestra 820 ms i els recorreguts dels materials 2.500 ms. El vol de la mosca i el moll de les fulles tenen durades pròpies. La pestanya oculta atura el render ambiental; el so conserva els esvaïments de focus de l’escena anterior.

## Càrrega i rendiment

La capsa inicial utilitza `agulles-montserrat-preview.glb`, derivat del model real amb una decimació a 0,13. Pesa 241.888 bytes i conserva els colors i les fonts geogràfiques. Els models detallats es carreguen quan s’obre la capsa. La previsualització de Pauta reutilitza un full real del banc.

`assets/desk/corner-loading.json` compta els models i les textures d’arrencada de la nova vista. `tools/prepare-desk-loading.cjs` genera tant aquest índex com el de l’escena arxivada. El cercle de càrrega, els missatges humans i la preparació prioritària de l’ambient es mantenen.

La densitat de píxels es limita a 1,6 i es manté un únic mapa d’ombres de 2.048 px. Les superfícies estàtiques i la part estàtica de la planta s’agrupen. La pols es mou al shader. L’ambient es redibuixa aproximadament a 24 Hz i les animacions utilitzen la freqüència de pantalla. Els comptadors del header continuen sent locals i no bloquegen la GPU.

La comprovació local del 27 de novembre registra 248 crides de dibuix, 103.734 triangles i 22 textures en la vista inicial de 1.440 × 960; en mòbil de 390 × 844, 125 crides, 61.647 triangles i 16 textures. Són comptadors de l’escena, no una garantia d’FPS en qualsevol dispositiu.

## Fitxers i verificació

El motor conserva el directori `escriptori-v2/` per reutilitzar els mòduls del prototip; el punt d’entrada és `escriptori/index.html`. `room.js` construeix el racó, `seated-look.js` fixa l’ull, `scene.js` coordina els materials i `life.js` gestiona fulles i mosca. La portada i el V4V es mantenen compartits. El croquis de l’autor guia l’enquadrament, no es tracta com una textura de l’escena.

```text
node tools/serve.cjs
node tools/check.cjs
node tools/check-desk-corner.cjs
node tools/check-desk-materials.cjs
```

La comprovació nova cobreix contacte amb la mosca i les fulles, finestra, interruptor i grapadora físics, punt fix durant gestos i recorreguts, els nou recursos, mostres i maquetes, tema, V4V, mòbil i fallada de càrrega. Les proves específiques de l’escena anterior apunten a `anterior.html`. Les captures es desen a `output/desk-corner/`. No es comprova el desplegament remot.

## Analítica

La vista principal envia `v4_*`, amb `interficie: escriptori-raco` i etiqueta `escriptori-raco`. L’escena arxivada conserva `v2_*`; les dades històriques no es reetiqueten. Es compten les accions dels materials, les entrades als projectes, els controls i els gestos complets de mirada. No s’envien trajectes del punter, posicions de la mosca ni impactes de les fulles. La portada conserva `obre_escriptori`, amb un únic enllaç. L’analítica no es carrega en local ni en navegadors amb `navigator.webdriver`.
