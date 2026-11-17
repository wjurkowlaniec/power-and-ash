# Poziom „R-2: Pierwszy Żaglowóz” (projekt, ok. 15 min)

**Status: [propozycja 2026-11-17] — czeka na akceptację Wojtka, zanim powstanie kod.**

Prośba Wojtka (2026-11-17, sparafrazowana): zaprojektować prawdziwy poziom na ok. 15 minut, w którym gracz **buduje coś od zera**. Ten dokument to odpowiedź: jeden poziom, który spina trzy rdzenie gry naraz, czyli **prąd i kabel**, **składanie maszyny z części** i **żeglugę**. Osadzony po Scenie 2 (wyjazd z Olszanki z mapą do R-2), w rozdzielni polowej R-2 z [POCZATEK.md](POCZATEK.md#scena-5-rozdzielnia-polowa-i-pierwszy-pojazd-ok-20-min).

Liczby (czasy, moce, metry) to punkt wyjścia do strojenia w testach.

## Jak czytam „od zera”

Decyzja z 2026-11-09 ([FABULA.md](FABULA.md#decyzja-wojtka-2026-11-09)) mówi: **bez craftingu od zera z przepisów, rozwój eksploracyjny**. SWIAT.md mówi zaś: **Żaglowóz budowany od zera przez całą grę** [ustalone]. Łączę to tak:

- „Od zera” = **pierwszy pojazd złożony z niczego**: na starcie poziomu pod wiatą stoi goła rama wózka na klockach. Wszystko inne (koła, pokład, maszt, żagiel, liny, prąd) gracz znajduje, rozbiera, holuje i montuje na miejscu.
- **Bez menu przepisów.** Planem jest **rysunek techniczny** przybity na ścianie wiaty (Wolt rozumie rysunki, pisma ludzi nie). Każda zamontowana część zapełnia się na rysunku. Montaż to fizyczna czynność przy ramie z animacją, a nie klik w okienku.
- To jest pierwszy etap Żaglowozu (etap 0 → 1 z [SWIAT.md: Żaglowóz](SWIAT.md#żaglowóz)) i pierwsze użycie przyjętej zasady „Wolt jest przednim kołem” ([DEMO-ZEGLUGA.md](DEMO-ZEGLUGA.md#wolt-jako-przednie-koło-balast-i-olinowanie-wojtek-2026-11-1011)).

Jeśli Wojtkowi chodziło o coś innego (np. budowę bazy, prawdziwy crafting z surowców), to jest pierwsze pytanie w [Do decyzji](#do-decyzji).

## Miejsce w fabule

Zmiana względem POCZATEK.md: dotychczasowa Scena 5 (wózek gotowy, tylko pusta bateria) i część Sceny 6 (maszt i żagiel na wózku) zlewają się w ten jeden poziom. Scena 6 zaczyna się wtedy od razu na Popielnej Równinie, z Żaglowozem etapu 1. Płozy (rama bojerka) zostają na równinę, jako pierwsza brama metroidvanii.

| Przed | Ten poziom | Po |
|---|---|---|
| Scena 2: mapa z plotera, wyjazd przez bramę. Scena 4 „Odjazd” (droga 4,2 km, na razie karta) | Wolt dociera do R-2 na rezerwie, składa Żaglowóz z gołej ramy, ładuje go, przechodzi symulator Q-1 i wyjeżdża żaglem z kotliny | Scena 6: Popielna Równina, świat otwarty, wydmy wymagają płóz |

## Czego uczy

1. **Prąd jest fizyczny i zależy od świata:** zakurzone panele, chmury, kabel z ograniczoną długością.
2. **Budowa z części:** szukanie, rozbiórka, holowanie ciężkich rzeczy, montaż według rysunku, w dowolnej kolejności.
3. **Zasób, który ma dwa zastosowania:** jeden bęben kabla na ładowanie i na olinowanie. Sprytna trasa kabla zostawia metry na liny.
4. **Żegluga:** wiatr, cień wiatrowy za kontenerami, szot, zwrot. Najpierw w symulatorze w głowie Q-1 (decyzja 2026-11-11), potem naprawdę.

## Mapa kotliny R-2 (ok. 70 × 50 m)

Kotlina jest osłonięta od wiatru. Ubity jest plac rozdzielni i droga. Poza nimi sypki popiół, w którym Wolt grzęźnie (zasada „bez skraju mapy” z 2026-11-11). Wiatr wieje z zachodu, ale na dnie kotliny jest słaby; pełny wiatr zaczyna się na krawędzi, przy wyjeździe na wschód.

```
  N
  ^       wydmy (sypkie, zajawka: płozy)            ~~~~~~~~~~~~~~
          . . . . . . . . . . . . . . . . . . . .   ~ POPIELNA   ~
   [WRAK PRZYCZEPY]   . . . . . . . . . . . . .     ~ RÓWNINA    ~
    w popiele, oś z     .                            ~ (meta)     ~
    kołami, beczka     .        [MASZT ANTENOWY]       ~~~~~~^~~~~~~
    z olejem obok     .          na zawiasie, 9 m             |
          :          +====== płot ==========+                 | droga pod górę,
          :          |  [P1][P2][P3][P4]    |                 | pełny wiatr
          :  dziura  |   panele (kurz)      |                 |
          :<-w płocie|                      |   [STOS PALET]  |
                     |  [SZAFA R-2]  port   |    przy płocie  |
                     |   + bęben 26 m       |                 |
  wjazd z zachodu    |                      |                 |
  (z Olszanki) ====> brama   [KONT. A]  [KONT. B]             |
                     |        okno ^          ^ zamek elektr. |
                     |                                        |
                     |      [WIATA]  rama wózka na klockach ==+==> wyjazd
                     |      plandeka na dachu, rysunek na ścianie
                     +========================================+
                                                         S
```

- **Szafa R-2** z portem i bębnem 26 m kabla, panele P1–P4 (razem 600 W czyste, ok. 90 W zakurzone).
- **Kontener A** (otwarty, okno w ścianie): notatka technika z R-2, dziennik trasy. Okno daje skrót dla kabla.
- **Kontener B** (zamek elektryczny): w środku pakiet balastowy (skrzynia z baterią na szynie) i bloczki.
- **Wiata**: goła rama wózka (burty, widelec dziobowy pod Wolta, gniazdo osi tylnej, pięta masztu), na dachu plandeka, na ścianie rysunek techniczny.
- **Wrak przyczepy** za dziurą w płocie, na skraju sypkiego popiołu: tylna oś z dwoma kołami (zapieczone łożyska), obok cieknąca beczka z olejem.
- **Maszt antenowy** R-2 na zawiasie (9 m), podstawa na czterech śrubach.
- **Stos europalet** (pokład, decyzja Wojtka z 2026-11-06, że pokład ma być z palet i podpór).

## Rysunek techniczny (plan budowy)

Na ścianie wiaty wisi pożółkły rysunek wózka z dorysowanym ołówkiem masztem i trójkątem żagla (technik z R-2 też o tym myślał). Wolt go skanuje (E), a od tej chwili:

- rysunek jest w Archiwum (J) i w rogu ekranu jako mała ikona z polami części: puste pola są szarym konturem, zamontowane wypełniają się kolorem;
- przy ramie widać duch części w jej gnieździe, gdy Wolt podjedzie z pasującą częścią (na ramieniu albo na holu);
- przytrzymanie E montuje część z animacją (ramię podnosi, dopasowuje, iskra lub stuk klucza, dźwięk). Montaż kosztuje trochę baterii Wolta.

| # | Część | Skąd | Mechanika | Czas |
|---|---|---|---|---|
| 1 | **Oś tylna z kołami** | wrak przyczepy | rozbiórka (przytrzymaj E), łożyska zapieczone → olej z beczki (E przy beczce, potem E przy osi), oś za ciężka do ramienia → hol na linie, przez dziurę w płocie, w popiele zarzuca | ~3 min |
| 2 | **Pokład z palet** | stos palet | każda paleta osobno na holu (3 kursy po kilkanaście metrów), montaż jedna po drugiej na burtach | ~1,5 min |
| 3 | **Maszt** | maszt antenowy | odkręcić 4 śruby (przytrzymaj E), zaczepić hol do topu przez linkę, odjechać: maszt kładzie się powoli na zawiasie (pierwsza fizyka „ciągnę coś, co się przewraca”), potem odpiąć z zawiasu i doholować pod wiatę. Długi ładunek: na zakrętach zahacza o płot | ~2,5 min |
| 4 | **Balast** (skrzynia z baterią na szynie) | kontener B | zamek elektryczny: kabel własny Wolta (3 m) już nie sięga, trzeba podać prąd z szafy R-2 kablem z bębna (powtórka lekcji ze Sceny 2, ale teraz z obcego źródła) | ~1,5 min |
| 5 | **Żagiel** | plandeka z dachu wiaty **albo** powłoka balonu meteo | plandeka: ściągnąć ramieniem z dachu (przytrzymaj E), wiata zostaje goła. Balon: jeśli gracz przywiózł powłokę z Olszanki (droga powrotna, gdy wyrzutnia balonów będzie dostępna). Balon jest lżejszy i ciągnie lepiej, plandeka jest ciężka i wolniejsza: powód, żeby kiedyś wrócić | ~1 min |
| 6 | **Olinowanie** | bęben 26 m | 8 m kabla jako liny (szot, wanty, fał). Montaż lina po linie (decyzja „sznurki dokładnie”) | ~1 min |

**Kolejność jest dowolna**, poza dwiema zależnościami ze świata: żagiel wymaga masztu, olinowanie wymaga masztu i żagla. Oś można zamontować w każdej chwili, a dopóki jej nie ma, rama stoi na klockach.

## Prąd: panele, chmury, kabel

1. **Przyjazd na rezerwie.** Wolt wjeżdża z zachodu w szarości, wolno (jak koniec Sceny 4). Pierwsza rzecz: wpiąć kabel własny (3 m) w port szafy. Zakurzone panele dają ok. 90 W, pasek rośnie powoli.
2. **Czyszczenie paneli** ramieniem (przytrzymaj E przy każdym): każdy czysty panel +130 W. Po czterech jest 600 W w pełnym słońcu. Kolor obrazu wraca stopniowo razem z baterią (jak w Hali).
3. **Chmury.** Po niebie płyną cienie chmur (mechanika z dema [„Słońce”](DEMO-SLONCE.md)). Gdy cień siedzi na panelach, moc spada do ok. 25%. Bilans Q-1 pokazuje to linia po linii. Nie jest to przeszkoda, tylko rytm: ładowanie idzie falami, a gracz czuje, że prąd zależy od nieba.
4. **Kabel z bębna (26 m).** Potrzebny dwa razy:
   - do zamka kontenera B (chwilowo, potem można go zwinąć: Q),
   - do ładowania balastu w gotowym wózku.
   Trasa z szafy do wiaty dookoła kontenerów ma ok. 20 m. Trasa przez okno kontenera A ma ok. 14 m. Olinowanie bierze 8 m. **20 + 8 = 28 > 26**, więc ze zwykłą trasą zabraknie 2 m. Rozwiązania (żeby nie było martwego punktu): poprowadzić przez okno (14 + 8 = 22, zapas), **albo** zamontować olinowanie dopiero po naładowaniu i zwinąć kabel ładujący, **albo** dorobić 5 m z drutu z płotu (rozbiórka przęsła). Trzy drogi, każda działa.
5. **Ładowanie balastu**: bateria pojazdu 1,2 kWh, w pełnym słońcu ok. 90 s czasu realnego, w cieniu dłużej. Ładowanie idzie w tle, więc gracz może w tym czasie montować pozostałe części (równoległość = tempo).

Po co ładować, skoro jest wiatr: **na dnie kotliny wiatru prawie nie ma** (cień za kontenerami i zboczem). Z kotliny trzeba wyjechać na silniku w piaście Wolta, który czerpie z balastu. Bez ładunku też się da (Wolt pcha z własnej baterii, wolniej i na granicy), więc nie ma blokady, jest tylko gorsza wersja.

## Symulator Q-1 (pierwsza żegluga)

Gdy ostatnia część jest na miejscu, Wolt wczepia się w dziób jako przednie koło (animacja z dema „Żegluga”, ok. 4,5 s). Zanim ruszy, bateria pierwszy raz „uczy się” żeglugi: obraz przechodzi w chłodny symulator z liniami skanowania ([DEMO-ZEGLUGA.md: Szkolenie](DEMO-ZEGLUGA.md#szkolenie-w-symulatorze-q-1-i-egzamin-wojtek-2026-11-11)).

W poziomie krótsza wersja, ok. 2 min, trzy lekcje i mini-egzamin:

1. **Szot**: ustawić bom na najlepszy kąt i utrzymać 4 s.
2. **Ostro do wiatru i zwrot**: jeden zwrot przez sztag i rozpędzenie.
3. **Balast w szkwale**: przetrzymać podmuch na krawędzi.
4. **Mini-egzamin**: trzy bramki pod wiatr, halsując, bez limitu czasu (porażka = start od początku egzaminu, nic więcej).

Lekcje 4–6 z dema i pełny egzamin zostają na później (np. pierwszy szkwał na równinie). Symulator można pominąć (N), ale wtedy Q-1 mówi przy każdej pierwszej pomyłce jedną linijkę podpowiedzi.

## Wyjazd i zakończenie

1. **Silnikiem z kotliny.** Wolt pcha Żaglowóz drogą na wschód. Żagiel łopocze bez wiatru. Za kontenerami i wiatą widać na ziemi zmarszczki pyłu tylko tam, gdzie dochodzi wiatr.
2. **Krawędź kotliny.** Pierwszy prawdziwy podmuch z zachodu: żagiel się napina, liny trzeszczą, balast trzeba przesunąć. Wiatr od tyłu i z boku, więc łatwo.
3. **Popielna Równina.** Szeroki widok: płaskie, szare pole, wydmy, słupy z drutami, w oddali punkt z dziennika trasy wózka. Meta poziomu to pierwszy słup przy starej drodze, ok. 250 m. Kto zjedzie z nasypu w wydmy, poczuje, że koła grzęzną (zajawka płóz).
4. Kamera się oddala, Żaglowóz jest małą kropką z pomarańczowym trójkątem, wyciemnienie, karta „Scena 6 · Popielna Równina”.

## Rytm (ok. 15 min)

| Minuta | Co robi gracz | Nowe |
|---|---|---|
| 0:00–1:30 | przyjazd na rezerwie, port, czyszczenie paneli | chmury i moc paneli |
| 1:30–2:30 | wiata, rama, skan rysunku; kontener A (notatka, dziennik) | rysunek jako plan budowy |
| 2:30–9:30 | sześć części w dowolnej kolejności, w tym kabel do kontenera B i ładowanie w tle | rozbiórka osi, olej, kładzenie masztu holem, kabel na dwa cele |
| 9:30–10:00 | wczepienie w dziób | Wolt jako przednie koło |
| 10:00–12:00 | symulator Q-1 | szot, zwrot, balast |
| 12:00–15:00 | silnik z kotliny, pierwszy wiatr, równina, meta | prawdziwa żegluga, cień wiatrowy |

Zasada „co 15–30 s coś do zrobienia” (2026-11-08) jest spełniona: w części budowy zawsze jest kilka otwartych celów naraz, a ładowanie biegnie w tle.

## Brak martwych punktów

- Każdy ładunek na holu odczepia Q. Oś, maszt i palety da się zostawić i wrócić.
- Bateria Wolta na postoju się odnawia (0,15%/s) i ma port szafy na stałe pod ręką.
- Kabel zawsze da się zwinąć i poprowadzić od nowa. Za mało metrów: trzy wyjścia (wyżej).
- Maszt przewrócony w złą stronę (na płot) da się podnieść holem z drugiej strony.
- Wywrotka Żaglowozu w symulatorze: restart lekcji. Na żywo: Wolt odczepia się (G), stawia pojazd holem i wczepia z powrotem.

## Fabuła i notatki

- **Notatka technika z R-2** w kontenerze A: rysunek wskaźnika baterii zakreślony na 80% i ikona ognia (bez zmian z POCZATEK.md).
- **Dziennik trasy wózka** w pamięci szafy R-2 (format maszyn, czytelny od razu): ostatni kurs, punkt na równinie, którego nie ma na mapie stacji. To cel Sceny 6.
- **Rysunek techniczny z dorysowanym masztem**: ktoś tu przed Woltem planował żagiel. Nowa notatka w Archiwum, z odręcznym podpisem do odkodowania później.
- **Zajawki metroidvanii**: wydmy za płotem (płozy), drugi zamknięty kontener z innym złączem (analiza protokołu, później), krater po balonie meteo na zboczu (powód, żeby wrócić z powłoką).

## Jak to zbudować w kodzie (plan po akceptacji)

Nowa scena `r2` w grze, według [GRA.md: Jak dodać nową scenę](GRA.md#jak-dodać-nową-scenę). Wspólny silnik już ma prawie wszystko:

| Potrzeba | Skąd |
|---|---|
| jazda, hol, kabel z owijaniem, A*, grzęźnięcie w popiele | `src/sim/drive`, `tow`, `cable`, `path`, `bogDepth` z `src/game/sim/station.ts` |
| fizyka Żaglowozu, wiatr z cieniem za przeszkodami, lekcje | `src/sail/sim/landYacht.ts`, `windField.ts`, `training.ts` |
| cienie chmur i moc paneli | logika z dema „Słońce” (`src/sun`) |
| wczepianie, olinowanie, żagiel | widok z dema „Żegluga” (`src/sail/render`) |

Nowe:

- `src/game/sim/build.ts`: **ogólny montaż według rysunku** (gniazda, zależności, postęp montażu, zdarzenia). Wielokrotnego użytku dla następnych pojazdów i baz. Test w `test/build.test.ts`.
- `src/game/sim/r2.ts`: logika poziomu (panele, chmury, kabel, kontenery, maszt na zawiasie, oś, palety, plandeka, przejście w żeglugę). Test przejścia całego poziomu przez A* jak `test/station.test.ts`.
- `src/game/render/r2View.ts` + `render/r2/*`: kotlina, wiata, animacje montażu część po części (decyzja 2026-11-11: budowanie ma mieć animację).

Proponowane PR-y: (1) logika i test całego poziomu z prostym widokiem, (2) animacje montażu i wygląd kotliny, (3) symulator i wyjazd żaglem, (4) dopieszczenie dźwięku i światła. Każdy idzie na Pages, a scena jest dostępna pod `?scene=r2` i w menu.

## Do decyzji

1. Czy „od zera” to dobrze odczytane: **pierwszy pojazd złożony z części znalezionych na miejscu**, bez przepisów? Czy raczej budowa bazy albo prawdziwy crafting z surowców?
2. Czy łączymy Scenę 5 z budową żagla (pierwszy Żaglowóz już w R-2, płozy dopiero na równinie)?
3. Żagiel z plandeki jako główna droga, a powłoka balonu jako lepsza wersja na powrót: OK?
4. Krótki symulator (3 lekcje + mini-egzamin) w poziomie, reszta później: OK?
