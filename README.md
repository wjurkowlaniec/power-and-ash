# Popiół i Prąd (power-and-ash)

Top-down gra survivalowa w przeglądarce. Automat serwisowy Wolt ciągnie kable przez pustynię popiołu,
żeby z lądowego jachtu Żaglowozu ponownie zasilić stare stacje przesyłowe.

**Zagraj:** https://wjurkowlaniec.github.io/power-and-ash/

- [Plan implementacji i kamienie milowe](docs/PLAN.md)
- [Dokument projektowy](docs/design.html) (research gatunku, koncepcja, zasady kabli, wizualizacje)

## Sterowanie

| Klawisz | Akcja |
|---|---|
| LPM na terenie | idź tam (przytrzymaj: Wolt idzie za kursorem) |
| LPM na obiekcie | podejdź i użyj (złom, beczka, port, fabrykator, ster, Wolt = światło) |
| PPM na obiekcie | menu ze wszystkimi akcjami |
| WASD / strzałki | ruch (przerywa marsz myszą) |
| Shift | bieg |
| E | użyj: weź / wepnij / wypnij kabel, fabrykator, ster |
| E (przytrzymaj) | rozbierz złom albo beczkę |
| L | światło Wolta wł./wył. |
| kółko myszy, + / − | zoom |
| Q (przytrzymaj) | zwiń kabel |
| Alt | panel sieci |
| M | dźwięk wł./wył. |
| H | pomoc |

## Grafika i licencje

Modele są od [Quaterniusa](https://quaternius.com) i [Kaya Lousberga](https://www.kaylousberg.com), wszystkie na licencji CC0. Szczegóły w [CREDITS.md](CREDITS.md).

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
