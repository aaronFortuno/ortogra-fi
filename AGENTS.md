# ortogra.fi

Portada estàtica i lleugera del projecte paraigua. HTML, CSS i JavaScript sense compilació ni dependències de producció. Mantén una única portada, el diàleg V4V i una navegació senzilla. No afegeixis targetes de projectes inexistents.

- Verifica els canvis en local, també en mòbil i amb tema fosc. La comprovació del desplegament remot la fa l’usuari.
- El servidor local és `node tools/serve.cjs` (port 4187). La prova de navegador és `node tools/check.cjs` amb Playwright disponible.
- La marca reutilitzable viu a `assets/brand/`. Si la canvies, actualitza també la integració a Plec quan s’hagi demanat.
- Transicions de la interfície: 220 ms. A petició de l’autor, l’escriptori 3D obre i tanca cada objecte en un únic recorregut continu de 2.500 ms, amb la càmera seguint-lo i la tapa obrint-se durant l’arribada. Evita pauses o frenades intermèdies. Els botons de mirada duren 420 ms. Respecta les preferències de moviment reduït.
- No incorporis secrets, analítica o serveis externs sense un encàrrec explícit.
