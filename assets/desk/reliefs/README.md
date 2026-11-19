# Maquetes 3D de mostra

Tres còpies lleugeres preparades el 19 de novembre de 2026 a partir dels exports 3MF de Relleu Obert aportats per l’autor:

- `agulles-montserrat.glb`: Agulles de Montserrat.
- `tamariu.glb`: badia de Tamariu.
- `sant-maurici.glb`: estany de Sant Maurici.

Els originals es conserven sense modificar a `output/desk/relleu/`, fora de Git, i no es distribueixen des d’aquesta portada. `manifest.json` registra el fitxer d’origen, la seva empremta SHA-256, els colors, les fonts cartogràfiques, la mida i l’estratègia de preparació de cada còpia.

## Preparació

`tools/prepare-relief-assets.py` llegeix el model 3MF en flux, respectant els components i les transformacions. Mostreja l’alçada superior i el material visible de les malles originals en una quadrícula de **128 × 128 cel·les**. No inventa un terreny nou ni aplica una nova exageració vertical. Els models conserven la proporció horitzontal/vertical de l’export rebut, amb el costat horitzontal més llarg normalitzat a una unitat, la base a Y = 0 i el centre de la base a X = Z = 0.

La superfície té normals compartides, les quatre famílies de color dels originals i laterals/base tancats. Són GLB estàndard, sense Draco, textures o dependències addicionals, amb uns 34.000 triangles i menys d’un megabyte per maqueta. El navegador els pot carregar amb el `GLTFLoader` ja distribuït al projecte.

**Són mostres de visualització:** el mostreig simplifica la vegetació, els camins estrets, les construccions petites i qualsevol detall inferior a una cel·la. La superfície superior no reprodueix la topologia d’un pont, túnel o voladís; no serveix com a substitut de l’export imprimible. Per obtenir els fitxers de fabricació i tots els detalls cal anar a [Relleu Obert](https://relleu.ortogra.fi/).

Per regenerar-los:

```text
blender --background --factory-startup --threads 4 --python-exit-code 1 --python tools/prepare-relief-assets.py
```

L’opció `-- --render` desa també una escena `.blend` i una captura de comprovació per model a `output/desk/relleu/preview-work/`, fora de Git. El preparador dirigeix els temporals de Blender a aquesta carpeta. Els fitxers de visualització es generen després de comprovar que no falta cap mostra de superfície i que la malla reconstruïda és vàlida.

## Fonts i atribució

Les tres maquetes provenen de **Relleu Obert**, amb terreny **ICGC MET5 — Institut Cartogràfic i Geològic de Catalunya**, segons les metadades dels exports. [Servei d’elevacions ICGC](https://geoserveis.icgc.cat/icc_mdt/wcs/service).

La cartografia d’aigua, boscos, camins i altres capes manté **© OpenStreetMap contributors**, amb distribució de dades a través d’OpenFreeMap; dades sota **ODbL**. [Atribució i llicència d’OpenStreetMap](https://www.openstreetmap.org/copyright).

Sant Maurici inclou la capa de sòl nu d’**ESA WorldCover 2021 v200**, amb llicència **CC BY 4.0**, segons l’export original. [Citació de WorldCover](https://doi.org/10.5281/zenodo.7254221).

Montserrat també incorpora la intervenció de **Roca Foradada — Open Place Models contributors**, amb elevacions **© Institut Cartogràfic i Geològic de Catalunya**, sota **CC BY 4.0**, segons les metadades del 3MF. La còpia de visualització conserva el relleu superior; la perforació inferior i els altres voladissos no es conserven amb aquesta estratègia de mostreig.

Les metadades de les construccions de Tamariu indiquen **Dirección General del Catastro · INSPIRE BU**, amb la [llicència de reutilització enllaçada a l’export original](https://www.catastro.hacienda.gob.es/webinspire/documentos/Licencia.pdf). Montserrat identifica també el **Referencial Topogràfic Territorial de l’ICGC**, sota **CC BY 4.0**. Aquests camps específics es mantenen al manifest.

Aquestes atribucions acompanyen els models i no queden substituïdes per la llicència MIT del codi de la portada. El manifest conserva les fonts específiques de cada mostra, sense redistribuir tota la configuració interna dels exports.
