# Materials de superfície

Recursos de [Poly Haven](https://polyhaven.com/), distribuïts amb [CC0](https://polyhaven.com/license). Es carreguen des del repositori; el web no contacta amb Poly Haven en temps d’execució.

| Material | Autor | Fitxers locals |
| --- | --- | --- |
| [Book Pattern](https://polyhaven.com/a/book_pattern) | Rob Tuytel | `book-color.webp`, `book-normal.webp`, `book-rough.webp` |
| [Oak Veneer 03](https://polyhaven.com/a/oak_veneer_03) | Jenelle van Heerden | `oak-color.webp`, `oak-normal.webp`, `oak-rough.webp` |
| [Studio Small 09](https://polyhaven.com/a/studio_small_09) | Sergej Majboroda | `studio.hdr` |

[sources.json](sources.json) especifica els URL de cada original, les seves sumes MD5 i les transformacions. El color del teixit s’ha convertit en una màscara neutra per conservar els colors per àrea. Els mapes normals mantenen les dades OpenGL amb compressió WebP sense pèrdua; els mapes de rugositat no es tracten com a color sRGB. El color del roure utilitza sRGB. L’HDRI RGBE no s’ha modificat.

L’escaneig d’enquadernació cobreix 0,3 m i el del roure, 1 × 2 m. Blender prepara les UV amb 6,5 unitats del model per metre. Al navegador, els tres mapes de la tela es repeteixen 1,28 vegades per tram de 0,3 m per representar un teixit d’enquadernació més fi. La màscara de color conserva el tint de cada coberta i la rugositat limita els reflexos entre els fils. El roure allarga la veta seguint la peça. El mapa d’oclusió de Blender utilitza un canal UV separat.
