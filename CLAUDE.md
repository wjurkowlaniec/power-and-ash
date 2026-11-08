# Instrukcje dla agentów (i ludzi, którzy przejmują projekt)

**Popiół i Prąd** (power-and-ash) to gra w przeglądarce (Three.js + TypeScript + Vite) o automacie Wolcie i kwantowej baterii Q-1 w krainie popiołu. Właściciel projektu to Wojtek. Pisze po polsku, a dokumenty i komunikaty piszemy po polsku.

## Najpierw przeczytaj

| Dokument | Co w nim jest |
|---|---|
| [README.md](README.md) | czym jest projekt, linki do gry i dema, komendy |
| [docs/SWIAT.md](docs/SWIAT.md) | świat, fabuła, bateria, notatki, ładowanie, ton i styl; decyzje oznaczone **[ustalone data]** albo **[propozycja]** |
| [docs/POCZATEK.md](docs/POCZATEK.md) | pierwszy rozdział gry scena po scenie (docelowy projekt) |
| [docs/GRA.md](docs/GRA.md) | jak jest zbudowany kod gry (`src/game`), co już działa, różnice względem POCZATEK.md, decyzje dotyczące gry |
| [docs/PLAN.md](docs/PLAN.md) | tech demo „Rozruch” i kamienie milowe silnika |
| [CREDITS.md](CREDITS.md) | licencje modeli (CC0) |

## Stałe zasady

1. **Dokumentacja jest częścią roboty.** Każda decyzja Wojtka (może być sparafrazowana) i każda zmiana w kodzie trafia do repo w tym samym PR: świat i fabuła do SWIAT.md / POCZATEK.md, kod gry do GRA.md, silnik i demo do PLAN.md, sterowanie do README. Nie polegaj na pamięci rozmowy, bo ktoś inny może przejąć pracę.
2. **Zawsze deploy do testów.** Zmiana idzie przez PR, CI musi być zielone (`npm test` + `npm run build`), potem squash-merge do `main`, a workflow publikuje na GitHub Pages: https://wjurkowlaniec.github.io/power-and-ash/ (gra) i `/demo/` (tech demo).
3. **Dwie ścieżki, jeden silnik.** Tech demo to stały poligon do testowania mechanik. Gra powstaje według POCZATEK.md. Wspólny kod (`src/sim`, `src/render`, `src/audio`, `src/i18n.ts`) zmieniaj tak, żeby nie zepsuć drugiej strony; testy obu muszą przechodzić.
4. **Logika bez Three.js, z testami.** Stan i zasady w czystym TS (`src/sim`, `src/game/sim`), widok tylko czyta stan. Nowa mechanika ma test w `test/`.
5. **Teksty w dwóch językach** przez `tr('pl', 'en')`. Polski jest oryginałem.
6. **Kierunek artystyczny:** nastrój jak w Inside (wyblakła mgła, ciemne sylwetki, kolor tylko dla ważnych rzeczy), europejska i słowiańska przyroda, futurystycznie, nie PRL ani PGR, nie Ameryka. Dźwięk to ambient otoczenia w duchu GrassChopper, wszystkie dźwięki własne (proceduralny Web Audio). Gra jest oryginalna: inspiracje mechaniką (The Last Caretaker, Control, Factorio) są w porządku, ale bez kopiowania nazw, postaci, grafiki ani poziomów.
7. **Brak martwych punktów.** Gracz zawsze ma wyjście (odczepienie holu, odłożenie kabla, ładowanie na postoju), a cel jest czytelny.
8. **Porządek w kodzie:** krótkie komentarze „dlaczego”, stałe na górze plików, `localStorage` zawsze w `try/catch`, bez martwego kodu.

## Praktyczne

- `npm run dev`, `npm test`, `npm run build`. `?scene=hall|station` przeskakuje do sceny gry, a `?lang=en` włącza angielski.
- Modele: `tools/pack-models.mjs` pakuje paczki CC0 do `src/assets/models`.
- Zrzuty z Playwright w chmurze: `vite preview` nie działa z headless Chromium (404 na skryptach). Trzeba skopiować `dist/` do `<katalog>/power-and-ash/` i uruchomić `python3 -m http.server`.
