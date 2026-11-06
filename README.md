# Popiół i Prąd (power-and-ash)

Top-down gra survivalowa w przeglądarce. Automat serwisowy Wolt ciągnie kable przez pustynię popiołu,
żeby z lądowego jachtu Żaglowozu ponownie zasilić stare stacje przesyłowe.

**Zagraj:** https://wjurkowlaniec.github.io/power-and-ash/

- [Plan implementacji i kamienie milowe](docs/PLAN.md)
- [Dokument projektowy](docs/design.html) (research gatunku, koncepcja, zasady kabli, wizualizacje)

## Sterowanie (M2)

| Klawisz | Akcja |
|---|---|
| WASD / strzałki | ruch |
| Shift | bieg |
| E | weź kabel z portu / wepnij / wypnij |
| Q (przytrzymaj) | zwiń kabel |
| Alt | panel sieci |
| M | dźwięk wł./wył. |
| H | pomoc |

## Rozwój

```bash
npm install
npm run dev          # localhost
npm test             # testy logiki (Vitest)
npm run build        # dist/ pod GitHub Pages
npm run build:single # dist-single/index.html, jeden samodzielny plik
```

Struktura:

- `src/sim/` to logika gry w czystym TypeScripcie (siatka, kabel, sieć, stan gry), bez Three.js.
- `src/render/` to scena Three.js, która czyta stan gry.
- `src/audio/` to proceduralny dźwięk w Web Audio.
- `test/` to testy logiki.
