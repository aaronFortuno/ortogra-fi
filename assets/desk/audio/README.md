# Ambient exterior de l’escriptori

Cinc fragments d’enregistraments de camp reals, preparats el 19 de novembre de 2026. Tots els fitxers són **CC0 1.0**, segons la llicència comprovada a la pàgina concreta de cada enregistrament. No s’hi han afegit veus, música ni cap capa sintetitzada.

| Fitxer | Contingut | Durada descodificada | Canals | Pes |
| --- | --- | ---: | ---: | ---: |
| `wind-leaves.mp3` | Vent entre fulles | 32 s | Estèreo | 513.008 B |
| `birds-park-a.mp3` | Primera frase d’ocells de parc | 7,4 s | Mono | 89.857 B |
| `birds-park-b.mp3` | Una altra frase del mateix parc | 7,4 s | Mono | 89.856 B |
| `birds-garden.mp3` | Ocells de jardí | 7,4 s | Mono | 89.839 B |
| `distant-car.mp3` | Pas d’un cotxe enregistrat a uns 20 m | 10 s | Mono | 120.855 B |

**Total dels cinc MP3: 903.415 bytes, aproximadament 882 KiB.** Tots a 44.100 Hz; vent a 128 kbit/s, fragments puntuals a 96 kbit/s.

## Fonts i llicències

- **ecfike**, [Wind and Leaves.wav](https://freesound.org/people/ecfike/sounds/183496/): vent entre arbres de fulla ampla. Fragment 200–232 s per a `wind-leaves`.
- **ValentinPetiteau**, [ocells en un parc europeu](https://freesound.org/people/ValentinPetiteau/sounds/563547/): enregistrament de matí en un parc francès amb Zoom H5. Fragments 16–22,7 s i 24,5–31,2 s per als dos `birds-park`.
- **WhisperingEarth**, [ocells d’un jardí tranquil](https://freesound.org/people/WhisperingEarth/sounds/798842/): enregistrament natural de primavera. Fragment 4,3–11 s per a `birds-garden`.
- **TSP-Talk**, [pas d’un vehicle en una zona residencial](https://freesound.org/people/TSP-Talk/sounds/846301/): cotxe en asfalt humit, enregistrat des d’una finestra a uns 20 m de la carretera. Fragment 2–11,5 s per a `distant-car`.

Llicència dels quatre enregistraments: [CC0 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/) — [text legal](https://creativecommons.org/publicdomain/zero/1.0/legalcode). Els crèdits es conserven per facilitar-ne la traçabilitat, tot i que CC0 no exigeix atribució.

S’han fet servir els **previews MP3 HQ públics** que les mateixes pàgines de Freesound ofereixen per compartir. No són els WAV originals. Les URL exactes del preview i les empremtes SHA-256 dels fitxers rebuts consten a `manifest.json`. No s’ha utilitzat cap compte ni s’ha accedit a cap descàrrega autenticada. A la web, aquests cinc recursos se serveixen des del repositori; no cal contactar amb Freesound per reproduir-los.

## Preparació i comprovació

Retall, remescla a mono dels sons puntuals, filtres suaus per reduir rumble i soroll de fons, ajust de guany constant i rampes d’entrada/sortida. Sense compressor, limitador, porta de soroll, canvi de velocitat ni eliminació generativa de soroll. Els punts exactes, filtres i guanys consten al manifest.

- Vent: passaalt de 110 Hz i passabaix de 6 kHz; rampes de 180 ms als extrems. Per mantenir una base contínua, el motor pot superposar 2,5 s dels dos extrems en comptes d’un reinici sec.
- Ocells: reducció de freqüències greus de fons; 250 ms de silenci inicial i 450 ms finals, a més de les rampes aplicades a l’enregistrament.
- Vehicle: passaalt de 60 Hz i passabaix de 3,2 kHz; rampes de 800 ms i 1 s, amb 250 ms de silenci a cada extrem. El filtratge reforça una perspectiva discreta i llunyana.

Els cinc MP3 s’han tornat a descodificar amb FFmpeg 7.1. S’han comprovat durada, nombre de mostres, dades finites, component contínua, pics, RMS i marges de silenci dels sons puntuals. Pics entre −15,30 i −8,48 dBFS, sense mostres saturades. S’han revisat envolupants i espectrogrames per seleccionar els fragments.

**L’escolta humana definitiva continua pendent.** La descripció dels autors i la inspecció de l’espectre no substitueixen una escolta per descartar qualsevol conversa de fons o valorar el resultat dins l’escena. El manifest ho indica explícitament; no dona aquests fragments per validats auditivament.

`duration` al manifest és la durada real després de descodificar el MP3 i retirar el farciment del còdec; no la durada aproximada del contenidor. `measurements.decodedRmsDbFS` i `decodedPeakDbFS` es mesuren sobre el resultat distribuït.
