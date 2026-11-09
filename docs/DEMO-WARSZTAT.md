# Tech demo „Warsztat”: wytwarzanie, ekwipunek, technologie, ulepszenia Wolta

**Adres:** https://wjurkowlaniec.github.io/power-and-ash/demo-craft/ (`?stage=N` otwiera etap N od zera, `?lang=en` po angielsku)

Drugie tech demo, obok „Rozruchu” (`/demo/`). Powstało na prośbę Wojtka z 2026-11-08: „zrób drugie tech demo, skupione na craftingu, rozwoju postaci i tak dalej, żeby można było wszystkie etapy po kolei zobaczyć. Zaszalej.” To poligon systemów, nie fragment fabuły: sprawdzamy, jak się gra małym ekwipunkiem, wózkiem, rozbiórką, narzędziami, siecią z rozgałęźnikami, maszynami, drzewkiem technologii, modułami Wolta i anteną. Co z tego przejdzie do gry, decyduje Wojtek (zob. [Czeka na decyzję](#czeka-na-decyzję)).

## Co jest w demie

| System | Jak działa w demie |
|---|---|
| **Ekwipunek** | Wolt ma **6 miejsc**. Każdy przedmiot ma rozmiar stosu (surowce 20, kabel 40 m, części 5–10, narzędzia i moduły 1). Co się nie zmieści, spada obok Wolta w pakunku, który można podnieść później. |
| **Wózek serwisowy** | Stoi przy warsztacie z zatartymi kołami. Naprawa: 2 łożyska + 2 żelaza. Daje **+12 miejsc** i jest jedynym miejscem na rzeczy **duże (XL)**: panel, turbina, magazyn, kołyska, przetwórnia, maszt. Działa, gdy jest doczepiony do haka (E) albo stoi bliżej niż 3,2 m. Jedzie za Woltem na linie (wspólne `towDrive`), spowalnia go o 15%. |
| **Rozbiórka** | LPM na złomie albo przytrzymane E obok. Złom ma rodzaj, czas, łup, potrzebne narzędzie i **obserwacje** dla Q-1. Duże rzeczy (wrak auta, panel, kontener) rozbiera się w kilku rundach, model osiada z każdą rundą. Zakopany kabel widać dopiero z modułem AI II. |
| **Narzędzia** | Klucz (beczki, kontenery, panele, szafy), przecinarka (wraki aut, latarnie; ciągnie 2,5 Wh/s z Wolta), lutownica (płytki, moduły), miernik (pokazuje przepływ prądu na kablach). |
| **Wytwarzanie** | Panel C. Przepisy „ręczne” (kabel, klucz, rozgałęźnik) wszędzie, „stołowe” tylko przy stole warsztatowym. Stół z prądem pracuje 2× szybciej i nie ciągnie z baterii Wolta. Przycisk ×5 robi serię. |
| **Technologie** | Panel T, drzewko 14 węzłów. Technologia wymaga poprzednich i **obserwacji** (Q-1 musi coś rozebrać i obejrzeć), a potem **obliczeń** w Wh. Q-1 liczy tylko, gdy bateria Wolta ma ponad 50% (nadwyżka), i zużywa wtedy 1,5 Wh/s (moduł AI II: 2× szybciej). To jest wersja z decyzji „rozwój = obserwacje + obliczenia w tle” ([SWIAT.md: Rozwój](SWIAT.md#rozwój-obliczenia-w-tle)), tylko pokazana jako drzewko, żeby dało się ją oglądać i testować. |
| **Sieć** | Każda budowla ma gniazda (rozgałęźnik 4, latarnia i magazyn 2, reszta 1). LPM na maszynie bierze kabel z gniazda, kabel owija się o przeszkody (wspólny `Cable`), LPM na drugiej maszynie wpina. Zużyte metry schodzą z ekwipunku, odcinek maks. 30 m. Bilans każdej sieci (wspólne `solveNetworks`): produkcja, pobór, magazyn. Magazyny biorą nadwyżkę i pokrywają niedobór. Gdy zabraknie prądu, cała sieć gaśnie. Panel N, Alt pokazuje przepływ. |
| **Maszyny** | Stara turbina warsztatu (do naprawy: silnik + 2 łożyska, ≤180 W od wiatru), panel słoneczny (≤400 W od słońca), turbina wiatrowa (≤300 W), latarnia (40 W nocą), magazyn energii (2 kWh), kołyska ładująca (300 W, ładuje Wolta 5 Wh/s przez styki, nigdy indukcyjnie), przetwórnia złomu (500 W, sama rozbiera złom mieszany na surowce), maszt antenowy (200 W). Budowle stawia się z ekwipunku (klik na przedmiot w doku → Postaw), można je rozebrać i zabrać z powrotem. |
| **Doba** | 6 minut na dzień i noc (przycisk „czas ×4 / ×16” przyspiesza). Słońce zasila panele, nocą świecą latarnie i Wolt. |
| **Ulepszenia Wolta** | Panel U. Gniazda modułów: 2 na start, +1 z „Moduły Wolta”, +1 ze „Zdalnego sterowania”. Moduły: reflektor (2× dalsze światło), wzmocnione ramię (rozbiórka −40%), dodatkowe ogniwa (+100 Wh), radio (do masztu), zdalne sterowanie (przełączanie maszyn z panelu sieci), **AI II** (Q-1 „rozpoznaje więcej prądu”: widzi przepływy i zakopane kable, liczy 2× szybciej). Każdy moduł widać na modelu Wolta. |
| **Radio i antena** | Z modułem radiowym i zasilonym masztem Wolt nasłuchuje. Co 20 s łapie kolejny sygnał: automatyczny nadajnik R-2, echo innego prototypu, ludzka mowa (Q-1 jej nie rozumie, zapisuje do korpusu), stary kanał satelitarny. Panel R. |

## Etapy

Lewy panel prowadzi przez wszystko po kolei. Każdy etap ma cele do zrobienia ręcznie i skrót: „dalej” / „pomiń” albo lista otwiera następny etap z placem w stanie, w jakim zostawia go poprzedni (`STAGES[i].setup`). „Za darmo” włącza wytwarzanie i budowę bez kosztów.

1. Rozbiórka ręczna (mały ekwipunek, pierwszy kabel)
2. Narzędzia (skrzynia serwisowa → technologia → klucz → beczka)
3. Wózek (łożyska ze skrzynki → naprawa → doczepienie)
4. Przecinarka i wrak auta
5. Pierwszy prąd (Warsztat → silnik → naprawa starej turbiny → kabel do stołu)
6. Sieć i rozgałęźnik (latarnia)
7. Panel słoneczny
8. Magazyn i kołyska ładująca
9. Ulepszenia Wolta (moduły, AI II, zakopany kabel)
10. Maszyny (turbina wiatrowa, przetwórnia)
11. Antena (moduł radiowy, maszt, pierwszy sygnał)
12. Piaskownica (wszystko odblokowane i za darmo)

## Sterowanie

| Klawisz | Akcja |
|---|---|
| LPM | jedź / użyj (pierwsza dostępna akcja), przytrzymanie na terenie: jedź za kursorem |
| PPM | menu wszystkich akcji (na maszynie: kabel, wł./wył., rozbierz, zwiń kable) |
| WASD, Shift | ruch, bieg |
| E (przytrzymaj) | rozbieraj najbliższy złom; E przy wózku, pakunku, maszynie: jej pierwsza akcja |
| C T U N R | panele: wytwarzanie, technologie, Wolt, sieć, radio |
| I | wózek |
| L | światło |
| Alt | przepływ prądu na kablach |
| Esc | anuluj stawianie, zwiń trzymany kabel, zamknij panel |
| kółko, + / − | zoom |

Klik na przedmiot w doku: postaw (budowle), zamontuj (moduły), przełóż Wolt ↔ wózek, wyrzuć.

## Kod

```
demo-craft/index.html        wejście (szkielet HUD, teksty z main.ts przez tr())
src/craft/data.ts            WSZYSTKIE dane: przedmioty, przepisy, technologie, obserwacje, złom, budowle, moce, sygnały radia
src/craft/sim/inventory.ts   Inventory (sloty i stosy), Pool (Wolt + wózek jako jedno)
src/craft/sim/yard.ts        plac: wymiary, start, budowle stałe, złom, skały
src/craft/sim/craftGame.ts   CraftGame: ruch, rozbiórka, wytwarzanie, badania, moduły, budowa, kable, sieć, magazyny, doba, radio
src/craft/sim/stages.ts      12 etapów: cele i skróty (setup), yardAtStage(i)
src/craft/render/craftModels.ts  ładowanie modeli KayKit z src/assets/craft + modele proceduralne (rozgałęźnik, maszt, kołyska, stół, części, moduły)
src/craft/render/icons.ts    ikony ekwipunku renderowane z modeli 3D przy starcie
src/craft/render/craftView.ts    scena: plac, dzień i noc, Wolt z modułami, wózek, budowle, kable z przepływem, duch stawiania
src/craft/main.ts, craft.css     wejście, mysz i klawisze, HUD i panele
test/craft.test.ts           ekwipunek, rozbiórka, wytwarzanie, badania, sieć z magazynem, wszystkie skróty etapów
```

**Jak dodać rzecz:** przedmiot w `ITEMS`, przepis w `RECIPES` (z `tech`), ewentualnie technologia w `TECHS` (kolumna i wiersz w drzewku), model w `itemModel` / `buildingModel`. Nowa budowla: `BUILD` (rozmiar, gniazda), moc w `CraftGame.solve()`. Test `every recipe and technology refers to things that exist` pilnuje spójności.

W konsoli: `window.game` (stan), `window.view`.

## Modele

Wojtek (2026-11-08): w tym demie żadnych „biednych brył”, wszystko porządnie zamodelowane w kierunku artystycznym gry; jeśli brakuje modeli, powiedzieć, czego szukać. Użyte:

- **KayKit Space Base Bits**: panel słoneczny, turbiny (wirnik się kręci), przyczepka jako wózek (koła się toczą), wiertnica jako przetwórnia, pojemniki jako magazyn energii, lądowisko jako kołyska, moduł-garaż jako warsztat, skrzynie.
- **KayKit Furniture Bits**: stół warsztatowy, regał, szafka. **KayKit City Builder Bits**: wraki aut, kontener na śmieci, latarnie, wieża ciśnień, hydrant.
- Wszystkie trzy paczki są publicznie na GitHubie (`github.com/KayKit-Game-Assets`), więc chmura może je sklonować. `tools/pack-craft-models.mjs` pakuje je do `src/assets/craft/` (0,4 MB), osobno od `src/assets/models/`, żeby gra i „Rozruch” ich nie ładowały. Materiały są wyblakłe i przyciemnione pod popiół.
- W kodzie, ale z fazami i detalami: rozgałęźnik (skrzynka na palu z czterema gniazdami i diodą), maszt kratownicowy 11 m z talerzem i lampą, kołyska z szynami stykowymi i pantografem, osprzęt stołu (imadło, tablica narzędzi, lampa), części do ikon (szpula kabla, płytka, łożysko, silnik, rama, ogniwa, moduł PV, narzędzia, moduły).

**Do znalezienia przez Wojtka** (podmienimy proceduralne): Kenney Survival Kit (narzędzia, stół), Kenney Space Station / Factory Kit (maszyny, konsole), pełny Quaternius Modular Sci-Fi MegaKit, maszt kratownicowy i szpula kabla.

## Czeka na decyzję

- ~~Czy w grze jest crafting od zera~~ **Rozstrzygnięte 2026-11-09:** w grze nie ma craftingu od zera, rozwój jest eksploracyjny. Drzewko do klikania też nie wchodzi. Demo zostaje poligonem, a z niego może przejść ekwipunek z wózkiem, rozbiórka, moduły, sieć i antena ([FABULA.md: Co z demem](FABULA.md#co-z-demem-warsztat)).
- Liczby (moce, czasy, rozmiary stosów, 6 + 12 miejsc) są wymyślone przez agenta, do strojenia.
