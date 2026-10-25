# Marca ortogra.fi

El símbol és una «o» amb un accent: una forma tipogràfica senzilla que remet a l’ortografia. La «o» és verda i l’accent comparteix el color càlid del punt de `ortogra.fi` i de la marca Plec.

- Verd: `#234d43`; accent: `#b84f34`; paper: `#f8f6ef`.
- Tema fosc: verd clar `#b9d8c6`; accent `#eea087`.
- `symbol.svg` no té fons i té un llenç de 48 × 48. Mida recomanada: almenys 20 px.
- `logo.svg` inclou el nom, amb Georgia i alternatives serif del sistema. Per a una marca que s’adapti al tema, combina el símbol SVG en línia amb el nom com a text.
- Mantén la proporció, l’accent separat i un espai lliure mínim equivalent a un quart del símbol.
- Al peu d’altres projectes: «Un projecte d’[símbol] ortogra.fi», tot el conjunt de marca enllaçat a `https://ortogra.fi/`.

Exemple adaptable al color del text:

```html
<a href="https://ortogra.fi/" aria-label="ortogra.fi">
  <svg viewBox="0 0 48 48" width="22" height="22" fill="none" stroke-linecap="round" aria-hidden="true">
    <circle cx="22" cy="28" r="14" stroke="currentColor" stroke-width="5.5" />
    <path d="m27 9 7-6" stroke="var(--accent, #b84f34)" stroke-width="4.5" />
  </svg>
  <span>ortogra.fi</span>
</a>
```

Llicència MIT, com el projecte.
