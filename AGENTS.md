# ortogra.fi

Portada estàtica i lleugera del projecte paraigua. HTML, CSS i JavaScript sense compilació ni dependències de producció. Mantén una única portada, el diàleg V4V i una navegació senzilla. No afegeixis targetes de projectes inexistents.

- Verifica els canvis en local, també en mòbil i amb tema fosc. La comprovació del desplegament remot la fa l’usuari.
- El servidor local és `node tools/serve.cjs` (port 4187). La prova de navegador és `node tools/check.cjs` amb Playwright disponible.
- La marca reutilitzable viu a `assets/brand/`. Si la canvies, actualitza també la integració a Plec quan s’hagi demanat.
- Moviments i transicions: 220 ms; respecta les preferències de moviment reduït.
- No incorporis secrets, analítica o serveis externs sense un encàrrec explícit.
