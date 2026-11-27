# Maquetes 3D de mostra

Tres còpies lleugeres preparades el 19 de novembre de 2026 a partir dels exports 3MF de Relleu Obert aportats per l’autor:

- `agulles-montserrat.glb`: Agulles de Montserrat.
- `tamariu.glb`: badia de Tamariu.
- `sant-maurici.glb`: estany de Sant Maurici.

`agulles-montserrat-preview.glb` és una còpia addicional per a la capsa oberta del racó inicial. `tools/prepare-desk-corner-preview.py` la deriva del GLB anterior amb Blender 5.2 i una decimació a 0,13. Conserva la textura de color i les atribucions del model original; pesa 241.888 bytes. En examinar una maqueta s’utilitza la versió detallada. Aquesta còpia no substitueix els models del manifest ni genera dades geogràfiques noves.

Els originals es conserven sense modificar a `output/desk/relleu/`, fora de Git, i no es distribueixen des d’aquesta portada. `manifest.json` registra el fitxer d’origen, la seva empremta SHA-256, els colors, les fonts cartogràfiques, la mida i l’estratègia de preparació de cada còpia.

## Preparació

`tools/prepare-relief-assets.py` llegeix el model 3MF en flux, respectant els components i les transformacions. Mostreja l’alçada superior de les malles originals en una quadrícula de **192 × 192 cel·les** i, independentment, el color de la superfície real en una imatge de **512 × 512 píxels**. No inventa un terreny nou ni aplica una nova exageració vertical. Els models conserven la proporció horitzontal/vertical de l’export rebut, amb el costat horitzontal més llarg normalitzat a una unitat, la base a Y = 0 i el centre de la base a X = Z = 0.

La superfície té normals compartides i un mapa de color amb UVs i filtratge lineal. Aquest mapa PNG conté els colors sRGB originals mostrejats sobre la maqueta, sense fotografies ni textura inventada, i queda embegut al GLB. Les fronteres de l’aigua, la vegetació i els camins no depenen de les vores dels triangles. Els laterals i la base es mantenen tancats amb un segon material, del color de la base original. Hi ha **dos materials i dues primitives** per model, sense Draco ni dependències addicionals; el navegador els pot carregar amb el `GLTFLoader` ja distribuït al projecte. El manifest registra la resolució geomètrica, la de color, el pes i els triangles exactes de cada còpia.

La revisió actual conté **75.266 triangles per maqueta**: Montserrat ocupa 1.713.060 bytes, Tamariu 1.707.620 i Sant Maurici 1.703.876. El camp `sha256` identifica cada GLB derivat i permet renovar la caché sense confondre’l amb `sourceSHA256`, que identifica el 3MF original. Els tres models s’han verificat amb normals unitàries, índexs i UVs vàlids, mostres de superfície completes i el PNG embegut idèntic al mapa de colors sRGB generat a partir de la font.

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
