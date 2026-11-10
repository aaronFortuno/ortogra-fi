# ortogra.fi

Portada de **[ortogra.fi](https://ortogra.fi/)**, un espai de recursos oberts per aprendre i ensenyar.

- **Llengua.** [Plec](https://plec.ortogra.fi/) ofereix dictats en català i [Trama](https://trama.ortogra.fi/) ofereix comprensions lectores il·lustrades amb fitxes imprimibles.
- **Matemàtiques.** [Fil i Compte](https://filicompte.ortogra.fi/) reuneix problemes i fitxes imprimibles amb solucionaris.
- **Medi.** [Relleu Obert](https://relleu.ortogra.fi/) permet crear maquetes geogràfiques per imprimir en 3D.
- **Utilitats.** [Pentagrama](https://pentagrama.page/) prepara paper pautat per escriure música i [Pauta](https://pauta.ortogra.fi/) crea fulls pautats per practicar cal·ligrafia.

La pàgina inclou tema clar/fosc i un diàleg sobre l’autor i Value for Value. No hi ha comptes. La preferència de tema es desa al dispositiu amb `localStorage`.

Les miniatures d’`assets/project-previews/` mostren fragments de les previsualitzacions imprimibles. El render de Sant Maurici prové dels exemples de Relleu Obert.

## Analítica

[Umami](https://docs.umami.is/docs/track-events) compta les visites i aquests esdeveniments al domini `ortogra.fi`:

- `obre_projecte`: clic a una fitxa, amb la propietat `projecte` per desglossar els clics.
- `obre_v4v`: obertura del diàleg sobre el projecte.
- `obre_portafoli`: clic a l’enllaç del portafoli.
- `copia_lightning`: còpia confirmada al porta-retalls. L’esdeveniment no inclou el text de l’adreça; seleccionar-la perquè es copiï manualment no es compta.

## Desenvolupament

HTML, CSS i JavaScript estàtics; no cal compilar ni instal·lar dependències per servir el web. Amb Node.js:

```sh
node tools/serve.cjs
```

Obre `http://127.0.0.1:4187/`. El header i el footer ocupen files fixes de la pantalla; només el contingut central fa scroll si cal. Les transicions duren 220 ms, amb respecte pel moviment reduït.

Per executar la prova local de navegador, instal·la les dependències de desenvolupament (`npm install`) i executa `npm run check` amb Chrome instal·lat i el servidor actiu. Cobreix amplades de 320 a 1.440 px, scroll intern, diàleg, retorn del focus, recursos locals i persistència del tema. Les captures es desen a `tmp/`, fora de Git.

## Marca compartida

- [Símbol SVG](assets/brand/symbol.svg): una «o» i un accent, per representar la llengua escrita. Dissenyat per funcionar també com a favicon i identificador a peus de pàgina.
- [Logotip SVG](assets/brand/logo.svg): símbol i nom complet.
- [Guia breu d’ús](assets/brand/README.md): colors, mida mínima i versió adaptable a temes.

Plec incorpora el mateix símbol i un enllaç al web pare al seu peu. Els recursos es mantenen locals a cada projecte per evitar dependències de xarxa per mostrar la marca.

## Publicació

Repositori: [aaronFortuno/ortogra-fi](https://github.com/aaronFortuno/ortogra-fi). GitHub Pages serveix `main` des de l’arrel. `.nojekyll` evita transformacions; `CNAME` conté `ortogra.fi`. La configuració del domini a Pages també s’ha de mantenir al repositori de GitHub.

Consulta [la configuració DNS](docs/DOMINI.md). Les comprovacions es fan en local; l’usuari valida el desplegament remot.

## Crèdits i llicències

Codi i marca sota [MIT](LICENSE). Icones de [Lucide](https://lucide.dev/), amb la seva [llicència](assets/icons/LICENSE). Fotografia, QR i dades públiques de V4V reutilitzats de Plec/Pentagrama a petició de l’autor, sense modificar les dades d’aportació. L’adreça Lightning és pública i no és una credencial.
