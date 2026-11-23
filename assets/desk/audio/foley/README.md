# Sons dels objectes de taula

Dinou fragments d'enregistraments reals, mono i MP3 de 96 kbit/s, sumen 155.073 bytes. Es carreguen quan hi ha una interacció sonora amb l'àudio activat, fora del pressupost inicial dels recursos visuals. El silenci, la pausa de pestanya i l'AudioContext continuen compartits amb l'ambient exterior; aquests efectes interiors no passen pel filtre de la finestra.

| Fragment | Font CC0 | Retall de la font |
| --- | --- | --- |
| `stapler.mp3` | [simone_ds · stapler.wav](https://freesound.org/people/simone_ds/sounds/366080/) | 0,27–0,85 s |
| `paper-crumple.mp3` | [Anthousai · paper - crumple 02.wav](https://freesound.org/people/Anthousai/sounds/398897/) | 0,08–1,22 s |
| `paper-roll.mp3` | La mateixa gravació de paper | 0,50–0,92 s |
| `page-turn.mp3` | [OwlStorm · Page Turn (1)](https://freesound.org/people/OwlStorm/sounds/151220/) | 0–0,55 s |
| `table-tap.mp3` | [zembacraftworks · Tap on Wooden Table](https://freesound.org/people/zembacraftworks/sounds/427393/) | 0,10–0,50 s |
| `pencil-drop.mp3`, `pencil-tap.mp3` | [ervintracks · Pencil Drop](https://freesound.org/people/ervintracks/sounds/567435/) | 0–0,70 i 0–0,18 s |
| `pen-drop.mp3`, `pen-drop-2.mp3` | [krb21 · tossing pen down.WAV](https://freesound.org/people/krb21/sounds/118618/) | 3,65–4,36 i 14,55–15,25 s |
| `plastic-tap.mp3`, `tape-set.mp3` | La mateixa gravació de boli | 7,72–8,08 i 5,45–6,05 s |
| `paper-move.mp3`, `paper-move-2.mp3` | [Kingofgamers_cz · Paper slide](https://freesound.org/people/Kingofgamers_cz/sounds/352914/) | 0,03–0,58 i 0,35–0,94 s |
| `paper-lift.mp3` | La gravació de canvi de pàgina d'OwlStorm | 0–0,50 s |
| `leaf-brush.mp3`, `leaf-brush-2.mp3` | [Anthousai · shaking a small quince tree](https://freesound.org/people/Anthousai/sounds/399246/) | 0,30–0,98 i 3,25–3,96 s |
| `cloth-rustle.mp3`, `cloth-rustle-2.mp3` | [IENBA · Soft Fabric Rustle](https://freesound.org/people/IENBA/sounds/850705/) | 1,65–2,55 i 6,45–7,12 s |
| `cup-set.mp3` | [Jamitch2 · Ceramic_Mug_Cup.wav](https://freesound.org/people/Jamitch2/sounds/344704/) | 0,14–0,78 s |

Les deu pàgines identifiquen les gravacions com a [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/). S'han utilitzat els previews MP3 HQ públics, sense autenticació. El manifest conserva les URL, autors, hashes dels previews, retalls, filtres, guanys, durades descodificades i hashes dels fitxers distribuïts. En reproduir-los no es contacta amb Freesound.

Preparació amb `tools/prepare-desk-foley.py`, executat amb Blender: remescla mono, passaalt de 65 Hz i guany constant limitat pel pic. Els fregadissos tenen entrades/sortides de 35/70 ms; els cops, de 4/25 ms. Un passabaix de 4,8 kHz suavitza el fullatge i un de 6 kHz tracta paper i teixit. Sense canvi de velocitat, compressor ni cap capa sintetitzada. Els pics descodificats queden entre −13,88 i −8,60 dBFS abans del guany de reproducció.

`object-sounds.js` separa el material acústic del tipus físic: un boli i un llapis continuen compartint el cos allargat, però reprodueixen gravacions diferents. Paper pla, bola de paper, carpeta, fulles, teixit i ceràmica tenen rutes pròpies. El rotllo de cinta reutilitza un altre cop del boli filtrat a 2,2 kHz; els objectes metàl·lics i les grapes/clip conserven un contacte amb la taula a intensitats diferents. Aquestes dues últimes aproximacions no són enregistraments dels objectes exactes.

Els objectes rígids no produeixen un cop en aixecar-se o mentre viatgen per l'aire. Paper i teixit sí que freguen. Les variants alternen sense repetir immediatament la mateixa i el guany varia un ±6 %, sense alterar el to. El fullatge té una sola veu simultània i un interval mínim de 550 ms. La resta també limita les repeticions, amb un màxim global de vuit veus. Silenciar o ocultar la pàgina cancel·la les veus i les peticions pendents; si la càrrega inicial triga més de 250 ms, es descarta aquell gest per evitar un so deslligat de l'acció.

`tools/check-desk-tactile.cjs` verifica integritat, descodificació i identitat de les mostres reproduïdes, materials dels objectes reals, gestos sense cop, alternança del fullatge i aturada de veus, amb zero oscil·ladors. Inclou ordinador i 320 px en fosc amb moviment reduït. La valoració auditiva del resultat integrat correspon a la revisió de l'autor; les mesures numèriques no certifiquen per si soles la qualitat percebuda.
