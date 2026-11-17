# Poziom „Wyspa” (test craftingu, ok. 15 min)

**Status: [przyjęte 2026-11-17] — Wojtek wybrał wyspę i dał zielone światło. Finał ma go zaskoczyć („dla mnie to też będzie granie”), więc jego szczegóły są w osobnym pliku [SPOILER-WYSPA.md](SPOILER-WYSPA.md), którego Wojtek nie czyta przed zagraniem. Tutaj jest wszystko poza finałem.**

## Po co ten poziom

Prośba Wojtka (2026-11-17, sparafrazowana): zrobić prawdziwy poziom na ok. 15 minut, który **sprawdzi, czy crafting i robienie przedmiotów są wygodne i fajne**. Nie musi to być składanie Żaglowozu. Przykład w duchu The Last Caretaker: docierasz na miejsce i musisz coś odpalić, żeby coś innego zadziałało. Panele słoneczne są uszkodzone i niepodłączone. Naprawa nie wystarcza, trzeba zbudować więcej, odpalić, wejść do bazy, a w bazie jest komputer, z którego trzeba pobrać dane. Komputer potrzebuje dużo prądu.

To jest **test**: po zagraniu Wojtek decyduje, ile craftingu wchodzi do gry. Decyzja z 2026-11-09 („bez craftingu od zera, rozwój eksploracyjny”) jest punktem wyjścia, więc przepisy nie są dane z góry: **Q-1 uczy się ich z rzeczy, które Wolt rozbierze albo obejrzy**. Kształt pętli, czyli zbierz, zrób, zamontuj, zasil, jest za to pełnym craftingiem do oceny.

Pierwsza wersja tego dokumentu (składanie Żaglowozu z gołej ramy w R-2) i druga (ten sam test craftingu w R-2) jest odłożona na później, skrót jest na końcu, w sekcji [Odłożone](#odłożone-pierwszy-żaglowóz-z-gołej-ramy).

Liczby (moce, czasy, ilości) to punkt wyjścia do strojenia w testach.

## Pętla w jednym zdaniu

**Prąd otwiera drzwi, za drzwiami jest warsztat, warsztat robi części na więcej prądu, a więcej prądu otwiera dane.** Każdy etap daje narzędzie do następnego. To ten sam łańcuch co w The Last Caretaker (zasil, otwórz, zbuduj, zasil więcej), tylko nasz: kable owijają się o przeszkody, prąd zależy od chmur, Wolt wszystko ładuje przez fizyczne połączenie.

## Miejsce

**Wyspa Pomiarowa na Szklanym Zalewie** ([SWIAT.md: Szklany Zalew](SWIAT.md#szklany-zalew)). Jezioro zastygło w noc Popiołu w taflę szkła, a z tafli wystaje skalista wysepka z małą stacją pomiarową misji: rząd paneli (to najlepsze miejsce na słońce w grze), szafa z regulatorem, kontenery i półzakopany bunkier z zamkiem elektrycznym. W bunkrze jest stół warsztatowy i **terminal misji**. Na najwyższej skale stoi martwa latarnia nawigacyjna, a daleko na tafli majaczy kopuła Szklarni.

Wolt przypływa Żaglowozem po szkle i zostaje przy przystani na rezerwie (Żaglowóz stoi jako tło, bez jazdy). Poziom jest testem, więc włącza się go osobno: `?scene=wyspa` i pozycja w menu. Docelowe miejsce w fabule ustalimy po teście (wyspa pasuje do filaru „Kopuła”).

**Skraj mapy** (zasada 2026-11-11): zamiast ściany wyspę otacza pas szklanego żwiru i odłamków, w którym koło Wolta traci przyczepność i buksuje (ta sama mechanika co sypki popiół w Scenie 2, inna tekstura i dźwięk). Powrót zawsze działa.

```
  N
  ^          tafla szkła (odłamki, żwir: grzęźnięcie)
       [ZŁOMOWISKO]                  [LATARNIA]  na skale, martwa
       wraki paneli, latarenka,          |
       beczka z olejem, kupki            |
            :                            |
     +==== skała ========================+
     |  P1   P2   P3   [P4]   (wolny placyk na 2 panele)
     |  ok   szyba złącze pusty    panele na stelażach, kable zerwane
     |    \   |    /
     |   [REGULATOR / SZAFA]   spalony bezpiecznik, port Wolta
     |         :
     |   [KONT. A]     [KONT. B]   A: skrzynia serwisowa, notatka
     |                             B: przewrócony, akumulatory
     |   [BUNKIER]  zamek elektryczny, wyrwany zawias
     |    stół, terminal, kołyska, martwe akumulatory stacji
     |                              [WRAK ŁODZI]  akumulatory, miedź
     +== przystań ==+
        [ŻAGLOWÓZ]   tu wysiada Wolt
                                  S
```

## Sterowanie i UX craftingu (to testujemy)

Bierzemy to, co już działa w demie [„Warsztat”](DEMO-WARSZTAT.md) (`src/craft`): ekwipunek ze stosami, rozbiórka, przepisy ręczne i stołowe, sieć z bilansem. Zmieniamy tylko to, co ma być sprawdzone w grze:

| Element | Jak działa | Co sprawdzamy |
|---|---|---|
| **Ekwipunek** | 6 miejsc na Wolcie, stosy jak w „Warsztacie” (surowce po 20, kabel 40 m, części 5–10). Duże rzeczy (rama panelu, panel, akumulator) tylko na **sankach na holu** (do 4 sztuk, bo magazyn potrzebuje czterech akumulatorów naraz). Drzwi bunkra mają 3 m, żeby sanki przejechały. | czy 6 miejsc daje przyjemne decyzje, czy tylko irytuje |
| **Rozbiórka** | przytrzymaj E albo LPM przy złomie. Najechanie myszą mówi, co to jest i co da (decyzja 2026-11-08). | tempo i czytelność łupu |
| **Nauka przepisów** | pierwsza rozbiórka albo skan zepsutej rzeczy daje obserwację, Q-1 liczy ją 5–15 s w tle, tylko z nadwyżką prądu, i dopisuje przepis. Bez drzewka. | czy gracz rozumie, skąd się bierze przepis |
| **Naprawa w miejscu** | przy zepsutej rzeczy przytrzymaj E: jeśli Wolt ma materiały i zna przepis, robi część i od razu ją montuje (jedna czynność, animacja ramienia). Bez otwierania menu. | **wariant A** |
| **Panel wytwarzania** | C otwiera listę znanych przepisów. Brakujący materiał świeci na czerwono, z ikoną miejsca, w którym Wolt go widział. Seria ×5. | **wariant B** |
| **Ręcznie a przy stole** | ręcznie: wszędzie, wolno (np. 4 s), z baterii Wolta. Przy stole w bazie: 2× szybciej, z sieci, i tylko tam rzeczy duże (rama panelu, magazyn). | czy stół jest wyraźną nagrodą |
| **Montaż budowli** | nowy panel albo magazyn stawia się z holu na wolny stelaż lub podłogę (duch w miejscu, przytrzymaj E), z animacją. | czy stawianie jest wygodne |

A i B działają razem (wybór agenta, Wojtek nie wskazał). Do porównania osobno: `?craft=a` (tylko naprawa w miejscu, C wyłączone) i `?craft=b` (tylko panel C, naprawa w miejscu wymaga gotowej części). Test pokaże, czy menu C jest w ogóle potrzebne.

## Przepisy (8)

Surowce jak w PLAN.md (M5): **miedź, plastik, żelazo, szkło**, plus **olej** jako materiał zużywalny (rdza, SWIAT.md). Części z rozbiórki: **ogniwo PV**, **akumulator**, **szyba panelu**.

| Przepis | Skład | Gdzie | Uczy się z | Do czego |
|---|---|---|---|---|
| Kabel 5 m | 1 miedź + 1 plastik | ręcznie | znany od początku (Scena 2) | połączenia |
| Złącze panelu | 1 miedź + 1 plastik | ręcznie | skan złącza P3 | P3, nowe panele |
| Bezpiecznik | 1 miedź + 1 szkło | ręcznie | skan regulatora | regulator |
| Rozgałęźnik | 2 miedź + 1 plastik + 1 żelazo | ręcznie | rozbiórka latarni | łączenie paneli w jedną linię |
| Sworzeń | 1 żelazo | ręcznie | skan zawiasu | drzwi bunkra (+ 1 olej) |
| Rama panelu | 3 żelazo | stół | rozbiórka wraku panelu | nowy panel |
| Panel słoneczny | rama + 2 ogniwa PV + szyba + złącze | stół | rozbiórka wraku panelu | +150 W |
| Magazyn energii | 4 akumulatory + 2 żelazo + 5 m kabla | stół | skan akumulatorów stacji w bunkrze | bufor 0,4 kWh, oddaje do 600 W |

## Etapy i rytm

| Minuta | Etap | Co robi gracz | Wynik |
|---|---|---|---|
| 0:00–1:00 | **Przyjazd** (Q-1 ma 22%) | Wolt zjeżdża z Żaglowozu na przystań na rezerwie, wpina kabel własny w port szafy: cisza, lampka gaśnie. Panele nie są podłączone. Skan regulatora: spalony bezpiecznik, pierwsza obserwacja | cel: „prąd z paneli” |
| 1:00–5:00 | **Panele** | P1 sprawny, ale ma zerwany kabel (kabel do rozgałęźnika, metry liczone od odległości). P2 ma pękniętą szybę: zamiana na szybę z wraku panelu na złomowisku. P3 ma spalone złącze: skan, przepis, złącze. P4 to pusty stelaż (na później). Rozgałęźnik (sześć gniazd, 3 m kabla do szafy) zbiera P1–P3 w jedną linię do regulatora, bezpiecznik w regulatorze. Kable owijają się o stelaże i kontenery | 3 × 150 W = **450 W** w słońcu, Wolt się ładuje, kolor obrazu wraca |
| 5:00–7:00 | **Drzwi bunkra** | Zamek elektryczny dostaje prąd kablem z szafy, ale drzwi stoją: wyrwany zawias. Skan, sworzeń z żelaza, olej z beczki. Przytrzymaj E: drzwi się otwierają | wejście do bazy |
| 7:00–8:30 | **Baza** | Stół warsztatowy (zasila go linia z paneli), terminal misji: ekran budzi się i odmawia, wymaga **900 W przez 90 s** do pobrania dziennika. Pod ścianą martwe akumulatory stacji (skan, przepis na magazyn). Kołyska w bunkrze ładuje Wolta | cel: „więcej prądu” i licznik W na terminalu |
| 8:30–13:00 | **Więcej prądu** | Dwie drogi, można łączyć: **(a) panele** — na stole ramy z żelaza, ogniwa i szyby z wraków, złącza; P4 na pustym stelażu i dwa nowe na wolnym placu. 450 → 900 W w pełnym słońcu. **(b) magazyn** — 4 akumulatory z wraku łodzi i kontenera B (ciężkie, jadą na oponie), na stole magazyn, ładuje się z nadwyżki i przykrywa cień chmur. Najprościej: 1 nowy panel + magazyn | ≥ 900 W na terminalu |
| 13:00–15:00 | **Pobieranie i finał** | Wolt wpina ramię w terminal. Pasek 90 s. Przechodzi chmura: panele spadają do 25%. Z magazynem pobieranie idzie dalej, bez niego **staje (nie cofa się)** i rusza, gdy wyjdzie słońce. Dalej: [niespodzianka](SPOILER-WYSPA.md) | dane misji |

Zasada „co 15–30 s coś do zrobienia” (2026-11-08): w środkowej części zawsze jest kilka celów naraz, a Q-1 liczy przepisy w tle.

## Prąd w liczbach

| Źródło / odbiór | Moc |
|---|---|
| panel czysty, pełne słońce | 150 W |
| panel w cieniu chmury | 40 W (ok. 25%) |
| magazyn energii | 0,4 kWh (czas gry płynie ×40), oddaje do 600 W, startuje w połowie (stare akumulatory coś trzymają) |
| stół warsztatowy (gdy pracuje) | 200 W |
| zamek bunkra | 50 W |
| terminal (pobieranie) | 900 W przez 90 s |
| Wolt w kołysce bunkra | do 150 W |

Cienie chmur przesuwają się po placu z wiatrem (logika z dema [„Słońce”](DEMO-SLONCE.md)). Panel „Sieć” pokazuje bilans linia po linii (decyzja 2026-11-08), a terminal ma własny wskaźnik „mam / potrzebuję”.

## Surowce: ile jest, ile trzeba

Najkrótsza droga (3 naprawy, drzwi, 1 nowy panel, magazyn) potrzebuje ok. **10 miedzi, 8 plastiku, 7 żelaza, 1 szkła, 1 oleju, 2 ogniw PV, 2 szyb z wraków (P2 i nowy panel) i 4 akumulatorów** (licząc 10 m kabla ze skrzyni na start). Na placu leży ok. 30% więcej każdego surowca, żeby żadna pomyłka (np. zmarnowany kabel) nie zamykała drogi.

| Źródło | Daje |
|---|---|
| złomowisko: 2 wraki paneli | po 2 ogniwa, 1 szyba, 2 żelaza |
| złomowisko: kupki złomu (×5) | razem ok. 7 miedzi, 8 plastiku, 3 żelaza |
| złomowisko: latarnia | 2 miedź, 1 szkło, 1 żelazo |
| złomowisko: beczka | 2 olej, 1 żelazo |
| wrak łodzi przy przystani | 2 akumulatory, 2 miedź, 2 plastik, 1 szkło |
| kontener B (przewrócony) | 2 akumulatory, 2 żelazo |
| skrzynia serwisowa w kontenerze A | 10 m kabla (starter), 2 miedź, 1 plastik |

## Brak martwych punktów

- Bateria Wolta na postoju się odnawia, a port szafy jest zawsze pod ręką.
- Każdy kabel da się zwinąć (Q) i odzyskać metry. Hol zawsze odczepia Q.
- Surowców jest więcej, niż trzeba, a zrobione części można rozebrać z powrotem (z małą stratą).
- Pobieranie przy braku prądu staje, a nie cofa się.
- Q-1 liczy przepisy tylko z nadwyżką, ale nawet na samym regulatorze nadwyżka jest, więc nauka nigdy nie stoi na stałe.

## Fabuła i notatki

- **Notatka technika** w kontenerze A: rysunek trzech paneli połączonych w jedną linię przez skrzynkę z czterema gniazdami (rozgałęźnik), czyli wskazówka do pierwszego etapu.
- **Kartka na drzwiach bunkra**: rysunek zawiasu z kropelką oleju, czyli wskazówka do drzwi bez czytania pisma.
- **Terminal**: dane misji w formacie maszyn (co dokładnie, jest w [SPOILER-WYSPA.md](SPOILER-WYSPA.md)).
- **Zajawki**: zamknięta szafa w bunkrze z innym złączem (analiza protokołu później), kopuła Szklarni na horyzoncie.

## Co mierzymy w teście

Do oceny przez Wojtka po zagraniu:

1. Czy naprawa w miejscu (A) jest przyjemniejsza niż panel C (B), i czy C jest w ogóle potrzebny.
2. Czy 6 miejsc w ekwipunku daje decyzje, czy tylko bieganie w tę i z powrotem.
3. Czy nauka przepisów z obserwacji jest czytelna (czy gracz wie, czemu nagle umie zrobić złącze).
4. Czy stół warsztatowy jest odczuwalną nagrodą za wejście do bazy.
5. Czy finał (ze spoilera) był zaskoczeniem i czy dobrze sprawdza crafting pod presją.
6. Czy dwie drogi do 900 W (panele i magazyn) są zrozumiałe i czy chmury robią dobre napięcie, a nie irytację.
7. Czy 15 minut to dobry czas.

Pomoc w ocenie: poziom zapisuje w przeglądarce (`localStorage`, w `try/catch`) prosty dziennik testu: czas każdego etapu, liczbę otwarć panelu C, liczbę napraw w miejscu, przepełnienia ekwipunku, kursy z holem. Na końcu poziom pokazuje go jako kartkę do skopiowania.

## Jak to zbudować w kodzie

Nowa scena gry `wyspa` według [GRA.md: Jak dodać nową scenę](GRA.md#jak-dodać-nową-scenę). Wspólne kawałki:

| Potrzeba | Skąd |
|---|---|
| ekwipunek, przepisy, rozbiórka, sieć z magazynami | `src/craft/sim/inventory.ts`, `src/craft/data.ts`, `solveNetworks` (do wydzielenia do wspólnego silnika, żeby demo „Warsztat” dalej działało) |
| jazda, hol, kabel z owijaniem, A*, grzęźnięcie | `src/sim/drive`, `tow`, `cable`, `path`, `bogDepth` |
| cienie chmur i moc paneli | logika z dema „Słońce” (`src/sun`) |
| modele paneli, stołu, akumulatorów, wraków | KayKit z `src/assets/craft` |

Nowe pliki: `src/game/sim/island.ts` (logika poziomu, czysty TS), `test/island.test.ts` (przejście obiema drogami przez A*, jak `test/station.test.ts`), `src/game/render/islandView.ts`, `src/game/scenes/island.ts`. Stan wdrożenia jest w [GRA.md](GRA.md).

Kolejność: (1) logika poziomu z testem i grywalny widok, (2) animacje naprawy i wygląd wyspy, (3) dopieszczenie finału i dziennika testu. Każdy krok idzie na Pages.

## Decyzje Wojtka (2026-11-17)

1. Miejsce: **wyspa** (Szklany Zalew).
2. Finał: „zaskocz mnie, dla mnie to też będzie granie”. Szczegóły w [SPOILER-WYSPA.md](SPOILER-WYSPA.md).
3. Oba warianty UX naraz: bez odpowiedzi, agent wybrał oba naraz plus przełącznik `?craft=a|b`.

## Odłożone: pierwszy Żaglowóz z gołej ramy

Pierwsza wersja z 2026-11-17: w R-2 pod wiatą stoi goła rama wózka, a Wolt składa z niej Żaglowóz według rysunku technicznego (oś z wraku, pokład z europalet, maszt antenowy położony holem, balast, żagiel z plandeki albo balonu, liny z kabla), ładuje go i wyjeżdża żaglem na Popielną Równinę po krótkim symulatorze Q-1. Wojtek: nie musi to być składanie Żaglowozu. Pomysł zostaje do wykorzystania przy przejściu od wózka do Żaglowozu (POCZATEK.md, Scena 6).
