# Fitxes de mostra de l’escriptori

Instantànies preparades el 18 de novembre de 2026 a partir dels projectes de l’autor. Són sortides reals dels generadors, amb els camps d’alumne buits, i no captures dels controls de la interfície. Es distribueixen localment perquè la visita a l’escriptori no depengui d’altres webs.

| Fitxer | Procedència i contingut | Pàgines |
| --- | --- | --- |
| `plec.pdf` | [Plec](https://plec.ortogra.fi/), impressió d’un dictat de 24 mots amb el configurador català. | 1 |
| `trama.pdf` | [Trama](https://trama.ortogra.fi/), exportador PDF, lectura catalana L001 «El cartell de la plaça», amb preguntes. | 2 |
| `trama-solucionari.pdf` | El solucionari de la mateixa lectura L001, amb respostes orientatives i evidències marcades al text. | 2 |
| `fil-i-compte.pdf` | [Fil i Compte](https://filicompte.ortogra.fi/), impressió de quatre problemes amb espai de resolució. | 2 |
| `fil-i-compte-solucionari.pdf` | Resolució dels mateixos problemes P0001, P0003, P0005 i P0009; conserva el codi de full 11K04-TS2P. | 2 |
| `sentit.pdf` | [Sentit](https://sentit.ortogra.fi/), fitxa imprimible S002 «Preparem una capsa de records». | 2 |
| `sentit-solucionari.pdf` | Solucionari de S002, amb les sis respostes i la transcripció vinculada. | 2 |
| `pauta.pdf` | [Pauta](https://pauta.ortogra.fi/), exportador PDF, full pautat amb marge. | 1 |
| `pentagrama.pdf` | [Pentagrama](https://pentagrama.page/), impressió de paper de música en blanc. | 1 |

Els PDF conserven la composició original. Les versions `*-1.webp` i `*-2.webp` són les pàgines completes renderitzades amb Poppler i comprimides a WebP, amb 2.200 píxels al costat llarg i qualitat 92. `catalogue.json` conserva l’índex de la primera mostra. El navegador utilitza `examples.json`, descrit més avall, amb el títol, la imatge, el PDF i el tipus de cada full. Per substituir una mostra, actualitza el PDF, les pàgines renderitzades i el manifest junts; comprova totes les pàgines i que el solucionari correspongui a la fitxa abans de publicar-les. Plec inclou les solucions al propi full; Pauta i Pentagrama no necessiten solucionari.

Les mostres conserven els drets i les atribucions dels projectes d’origen; no es requalifiquen amb la llicència del codi d’aquesta portada. Els textos i les preguntes de Trama són [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), amb atribució a Trama conservada al peu. Les il·lustracions de Trama i Sentit són recursos originals generats per a cada projecte; la llicència dels textos de Trama no s’estén a les il·lustracions. Consulta els crèdits i les llicències de cada web per reutilitzar-ne el contingut. El codi de Pauta i Pentagrama és GPL-3.0; els seus fulls exportats no incorporen el codi del generador.

## Tres exemples per eina

`examples.json` és el manifest de les mostres navegables de l’escriptori. Cada eina té tres entrades, cadascuna amb un títol i dos fulls a `pages`. L’escriptori comença a l’entrada central (índex 1). Les rutes `image` i `pdf` són relatives a aquesta carpeta. `role: answers` identifica un solucionari; `sample` identifica una captura d’un recurs sense PDF. La imatge mostra la primera pàgina del PDF associat, mentre que la descàrrega conserva el document complet. No s’han creat tres entrades amb pàgines consecutives d’una única fitxa.

Mostres addicionals preparades i revisades el 18 de novembre de 2026:

| Eina | Exemple anterior | Exemple central | Exemple següent |
| --- | --- | --- | --- |
| Plec | Dictat de 16 mots | Dictat de 24 mots | Dictat de 12 mots |
| Trama | «El banc moll» | «El cartell de la plaça» | «El rastre de plata» |
| Fil i Compte | P0002, P0004, P0006, P0008 | P0001, P0003, P0005, P0009 | P0010, P0011, P0012, P0013 |
| Sentit | S008 «La foto que faltava» | S002 «Preparem una capsa de records» | S001 «El senyal de la ràdio» |
| Pauta | Simple ampla i estreta | Doble i quàdruple | Simple i quàdruple horitzontals |
| Pentagrama | 12 pentagrames i 10 agrupats de dos en dos | 9 pentagrames i 8 amb clau de sol | 8 amb clau de fa i 6 amb espai per a anotacions |
| Ressò | «La capsa dels sons» i «El paraigua blau» | «El pont de les granotes» i «Una ombra a la plaça» | «La drecera del camí vell» i «On va l’aigua del pati?» |
| Relleu Obert | Tamariu i Cap de Creus | Sant Maurici i Montserrat | Delta de l’Ebre i volcans del Croscat i Santa Margarida |

Plec presenta el mateix dictat de cada entrada en els dos formats reals, terços i quart de full; els dos documents conserven el mateix codi i llista de mots. Trama, Fil i Compte i Sentit presenten una fitxa i el seu solucionari corresponent. Les noves fitxes s’han exportat amb els generadors de cada aplicació, amb els camps d’alumne buits; els PDF de Sentit S001 i S008 corresponen a activitats amb àudio disponible, sense l’avís de preparació. Les sis plantilles de Pauta i les sis de Pentagrama són sortides dels seus motors originals, sense text explicatiu afegit als fulls.

Ressò no genera fitxes PDF. Les sis imatges són captures dels textos reals de `lectura-en-veu-alta/texts/ca.js`, a través de la seva interfície local: títol, curs, comptador de mots i paràgrafs conserven el contingut i la tipografia de l’eina; s’han retirat els controls de micròfon, seguiment i revisió per mostrar només la lectura. No són fulls que l’eina ofereixi per descarregar.

Les sis imatges de Relleu Obert són els renders reals `public/examples/*.webp` del seu catàleg local. No s’han generat models ni s’han inventat fitxes de treball per a aquesta mostra. Les dades geogràfiques i cartogràfiques mantenen les atribucions del projecte d’origen; vegeu [Relleu Obert](https://relleu.ortogra.fi/) i el seu document `SOURCES.md`.

Verificació: 24 exemples, 48 imatges referenciades, 36 PDF diferents (incloent els ja existents). S’ha comprovat l’existència i descodificació de totes les imatges, la integritat i paginació dels PDF, la correspondència dels codis de Plec i dels identificadors de Fil i Compte entre documents, i la composició visual dels dos costats de totes les entrades. Les imatges derivades dels nous PDF tenen 2.200 píxels al costat llarg, WebP qualitat 90; les captures de Ressò tenen 1.556 píxels d’amplada i els renders de Relleu conserven la resolució original disponible. La càrrega de l’escriptori utilitza aquestes imatges locals, no el web de cada eina.


Actualització del 19 de novembre: la caixa de Relleu Obert ara mostra [maquetes 3D](../reliefs/README.md) derivades dels 3MF de l’autor. Les sis imatges de renders d’aquest banc es conserven com a recursos de procedència, però la vista interactiva de la caixa utilitza els GLB i el seu manifest.

## Món a mà · 27 de novembre de 2026

Tres exemples exportats del generador local de [Món a mà](https://monama.ortogra.fi/), versió 0.1.43. Es conserva el document complet a cada PDF; l’escriptori presenta els seus dos primers fulls, amb els codis i la composició originals. Són apunts, no parelles de fitxa i solucionari.

| PDF | Material | Pàgines |
| --- | --- | --- |
| `mon-a-ma-m001.pdf` | M001 · El planeta Terra, amb il·lustracions | 7 |
| `mon-a-ma-m002.pdf` | M002 · Les coordenades geogràfiques, amb il·lustracions | 4 |
| `mon-a-ma-m003.pdf` | M003 · Els mapes i els plànols geogràfics, amb l’opció «Mostra les il·lustracions» desactivada | 3 |

Les imatges dels PDF s’han limitat a 1.400 px al costat llarg i comprimit en JPEG qualitat 90 sobre el fons blanc de la impressió. El text continua sent vectorial. Les sis previsualitzacions són renders de Poppler de 2.200 px, convertits a WebP qualitat 90. La miniatura de la portada és un retall del primer full de M001. S’han revisat els 14 fulls exportats; els materials i les seves atribucions continuen corresponent a Món a mà.
