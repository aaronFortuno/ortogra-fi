# Domini ortogra.fi

Aquest repositori correspon a **ortogra.fi**. Plec conserva el seu repositori i el domini **plec.ortogra.fi**: no cal modificar el seu CNAME.

## GitHub Pages

A [Settings → Pages](https://github.com/aaronFortuno/ortogra-fi/settings/pages), origen `Deploy from a branch`, branca `main`, carpeta `/ (root)` i domini personalitzat `ortogra.fi`. El fitxer `CNAME` del repositori conté el mateix domini. Activa `Enforce HTTPS` quan el certificat estigui disponible.

## DNS a Nordweb

Per al domini arrel, configura aquests quatre registres A:

| Tipus | Nom | Valor |
| --- | --- | --- |
| A | @ | 185.199.108.153 |
| A | @ | 185.199.109.153 |
| A | @ | 185.199.110.153 |
| A | @ | 185.199.111.153 |

TTL orientatiu: 3.600 s. Si Nordweb ofereix `ALIAS` o `ANAME`, es pot fer servir un únic registre `@ → aaronfortuno.github.io` en lloc dels A. No combinis aquesta alternativa amb A antics d’un allotjament diferent.

Opcionalment, afegeix `CNAME www → aaronfortuno.github.io.` per a l’entrada `www.ortogra.fi`; GitHub Pages pot redirigir-la al domini principal. Conserva `CNAME plec → aaronfortuno.github.io.` per a Plec. No afegeixis la ruta del repositori al DNS.

Si hi ha registres AAAA al domini arrel, han d’apuntar també a GitHub Pages (`2606:50c0:8000::153`, `2606:50c0:8001::153`, `2606:50c0:8002::153`, `2606:50c0:8003::153`). No canviïs registres de correu ni altres subdominis.

Font: [documentació oficial de dominis personalitzats de GitHub Pages](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site), consultada el 25 d’octubre de 2026. La propagació DNS i el certificat poden trigar. La comprovació pública final la fa l’usuari.
