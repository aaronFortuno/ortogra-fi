# SunCalc 1.9.0

Autoria: Vladimir Agafonkin. [Repositori i versió d’origen](https://github.com/mourner/suncalc/tree/v1.9.0), [codi original](https://raw.githubusercontent.com/mourner/suncalc/v1.9.0/suncalc.js) i [llicència BSD-2-Clause](suncalc.LICENSE).

La còpia local `suncalc.js` conserva el càlcul original. L’única adaptació és substituir l’embolcall UMD per `export default SunCalc`, per importar-la com a mòdul al navegador. No hi ha cap petició a serveis externs en temps d’execució.

Atenció a la versió: en 1.9.0, `getPosition` retorna radians i l’azimut es mesura des del sud cap a l’oest. Aquesta convenció està documentada al [README d’aquesta versió](https://github.com/mourner/suncalc/blob/v1.9.0/README.md#sun-position). `escriptori/solar.js` converteix les unitats per a l’escena i defineix la ubicació i l’orientació de la finestra.
