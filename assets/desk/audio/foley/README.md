# Sons dels objectes de taula

Set fragments d'enregistraments reals substitueixen els efectes sintetitzats. Són mono, MP3 de 96 kbit/s, i sumen 55.168 bytes. Es carreguen després d'activar l'àudio, fora del pressupost inicial dels recursos visuals. El silenci, la pausa de pestanya i l'AudioContext continuen compartits amb l'ambient exterior; aquests efectes interiors no passen pel filtre de la finestra.

| Fragment | Font CC0 | Retall de la font |
| --- | --- | --- |
| `stapler.mp3` | [simone_ds · stapler.wav](https://freesound.org/people/simone_ds/sounds/366080/) | 0,27–0,85 s |
| `paper-crumple.mp3` | [Anthousai · paper - crumple 02.wav](https://freesound.org/people/Anthousai/sounds/398897/) | 0,08–1,22 s |
| `paper-roll.mp3` | La mateixa gravació de paper | 0,50–0,92 s |
| `page-turn.mp3` | [OwlStorm · Page Turn (1)](https://freesound.org/people/OwlStorm/sounds/151220/) | 0–0,55 s |
| `paper-move.mp3` | La mateixa gravació de canvi de pàgina | 0,05–0,34 s |
| `table-tap.mp3` | [zembacraftworks · Tap on Wooden Table](https://freesound.org/people/zembacraftworks/sounds/427393/) | 0,10–0,50 s |
| `pen-drop.mp3` | [ervintracks · Pencil Drop](https://freesound.org/people/ervintracks/sounds/567435/) | 0–0,70 s |

Les cinc pàgines identifiquen les gravacions com a [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/). S'han utilitzat els previews MP3 HQ públics, sense autenticació. El manifest conserva les URL, autors, hashes dels previews, retalls, guanys, durades descodificades i hashes dels fitxers distribuïts. En reproduir-los no es contacta amb Freesound.

Preparació amb `tools/prepare-desk-foley.py`, executat amb Blender: remescla mono, passaalt de 65 Hz, guany constant limitat pel pic, entrada de 4 ms i sortida de 25 ms. Sense canvi de velocitat, compressor ni cap capa sintetitzada. Els pics descodificats queden entre −11,44 i −10,09 dBFS. El reproductor afegeix un guany discret segons l'acció; el paper enregistrat també s'utilitza a volum baix per al frec de fulles i estoig. No es presenta com una gravació específica de cada material.

`tools/check-desk-tactile.cjs` verifica integritat, descodificació i ús de mostres d'àudio, amb zero oscil·ladors. La valoració auditiva del resultat integrat correspon a la revisió de l'autor; les mesures numèriques no certifiquen per si soles la qualitat percebuda.
