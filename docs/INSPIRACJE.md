# Inspiracje: podobne gry i co z nich bierzemy

Analiza gier, które są blisko „Popiołu i Prądu” mechaniką, nastrojem albo tematem (energia, kable, budowa, utrzymanie pojazdu, samotna podróż przez pustkowie). Zamówienie Wojtka z 2026-11-17: zebrać podobne gry, sprawdzić, co w nich działa, i wybrać, co przenieść do nas.

**Zasada [ustalone 2026-11-06, przypomniane 2026-11-17]:** bierzemy mechaniki, rytmy i lekcje projektowe, nigdy nazw, postaci, grafiki, muzyki, poziomów ani wyglądu. Każdy wniosek niżej jest przetłumaczony na nasz świat (Wolt, Q-1, kabel, Żaglowóz, bunkry, hibernacja). Wszystko w tym dokumencie to **[propozycja]** agenta, dopóki Wojtek czegoś nie przyjmie; przyjęte rzeczy przenosimy do [DECYZJE.md](DECYZJE.md) i dokumentu, którego dotyczą.

**Decyzje Wojtka z 2026-11-17** (szczegóły w [Do decyzji](#do-decyzji)): wniosek 1 **odrzucony**, wnioski 2, 4 i 10 **przyjęte i zrobione**.

**Skąd wiedza:** opisy gier, recenzje i ogólnie znana wiedza o gatunku (lista źródeł na końcu). Agent nie grał w te gry w tej sesji, więc szczegóły liczbowe (np. ile energii zużywa akcja) są celowo pominięte. Patrz [Dane z dekompilacji](#dane-z-dekompilacji-i-własne-analizy-wojtka).

## Spis

1. [Najważniejsze wnioski](#najważniejsze-wnioski-top-12)
2. [Tabela: gra, co bierzemy, gdzie u nas](#tabela-zbiorcza)
3. [Gry, które Wojtek już wskazał](#gry-które-wojtek-już-wskazał)
4. [Energia, kable i sieć](#energia-kable-i-sieć)
5. [Pojazd jako baza i podróż](#pojazd-jako-baza-i-podróż)
6. [Samotność, cisza, opowieść bez słów](#samotność-cisza-opowieść-bez-słów)
7. [Odbudowa świata, czas i ludzie](#odbudowa-świata-czas-i-ludzie)
8. [Czego unikać](#czego-unikać)
9. [Dane z dekompilacji i własne analizy Wojtka](#dane-z-dekompilacji-i-własne-analizy-wojtka)
10. [Do decyzji](#do-decyzji)
11. [Źródła](#źródła)

## Najważniejsze wnioski (top 12)

Uporządkowane od tego, co daje najwięcej przy najmniejszym koszcie.

1. **[ODRZUCONE 2026-11-17: „brak prądu to brak prądu, urządzenia się wyłączają”]** ~~**Brak prądu spowalnia, a nie wyłącza** (Factorio, Oxygen Not Included).~~ Gdy sieć ma za mało mocy, urządzenia pracują wolniej proporcjonalnie do zasilenia, lampa przygasa, fabrykator zwalnia. Wolt przy prawie pustej baterii jedzie ospale, zamiast stanąć. To czytelne, uczciwe i pasuje do zasady „brak martwych punktów”. Gdzie: `src/sim` (sieć), [RUCH-I-ANIMACJA.md](RUCH-I-ANIMACJA.md).
2. **[PRZYJĘTE 2026-11-17, zrobione na Wyspie: [POZIOM-WYSPA.md](POZIOM-WYSPA.md#klasy-kabli-i-przeciążenie-decyzja-2026-11-17); grubsze kable będzie można później fabrykować]** **Przeciążenie przewodu jako zagadka** (Oxygen Not Included, Satisfactory). Kabel ma przepustowość; za duży odbiór grzeje przewód, iskrzy, a w końcu przepala bezpiecznik, który trzeba ręcznie załączyć. Transformator ze Sceny 2 dostaje sens: łączy linię grubą z cienką. Gdzie: [SWIAT.md: Ładowanie](SWIAT.md#ładowanie-zawsze-przez-fizyczne-połączenie), [PLAN.md](PLAN.md).
3. **Panel „skąd i dokąd płynie prąd”** (Factorio). Mamy już bilans linia po linii (decyzja 2026-11-08). Dołożyć krótki wykres z ostatnich minut (produkcja vs zużycie vs akumulatory), żeby gracz widział noc i szkwały, a nie tylko chwilę. Na karcie bazy, nie w stałym HUD.
4. **[PRZYJĘTE 2026-11-17, zrobione w demie „Żegluga”: [DEMO-ZEGLUGA.md](DEMO-ZEGLUGA.md#zużycie-i-objawy-przed-awarią-decyzja-2026-11-17)]** **Pojazd jako dom, który się psuje po swojemu** (Pacific Drive, The Last Caretaker). Żaglowóz ma mieć charakter: konkretne usterki z objawami (piszczy łożysko, łopocze rozdarty żagiel), a nie pasek „stan 63%”. Mamy już tabelę części zużywalnych; brakuje **objawów słyszalnych i widocznych** przed awarią. Gdzie: [SWIAT.md: Żaglowóz](SWIAT.md#żaglowóz).
5. **Wyprawa i powrót jako rytm** (The Last Caretaker, Pacific Drive, Subnautica). Każde wyjście ma cel, ryzyko (prąd, pogoda, zmrok) i decyzję „jeszcze trochę czy wracam”. Baza i Żaglowóz to miejsca odpoczynku i porządkowania łupów. Mamy to w zasadzie „pętla wraca do bazy”; trzeba pilnować, żeby powrót był przyjemny (światło, ciepło, dźwięk ładowania), a nie tylko konieczny.
6. **Uczenie się przez skanowanie fragmentów** (Subnautica). Nie dostajesz przepisu z drzewka, tylko znajdujesz kawałki rzeczy i analizujesz je. To dokładnie nasz system „Obliczenia w tle”. Lekcja: pokazywać postęp jako „2 z 3 próbek”, żeby gracz wiedział, że ma szukać jeszcze jednej. Gdzie: [SWIAT.md: Rozwój](SWIAT.md#rozwój-obliczenia-w-tle).
7. **Postęp przez wiedzę, nie tylko przez sprzęt** (Outer Wilds). Część barier znika, gdy gracz *zrozumie*, a nie gdy coś zbuduje: rozkład wiatru w dolinie, godzina, o której mikroboty śpią, notatka-rysunek z drogą. Pasuje do Wolta, który nie czyta pisma i uczy się świata. Gdzie: [FABULA.md](FABULA.md), notatki.
8. **Podróż jako rozgrywka, nie przerwa** (Death Stranding, Sable). Teren czyta się wzrokiem: gdzie popiół sypki, gdzie ubity, gdzie woda. Trasa jest decyzją, a postawione przez gracza rzeczy (drogi, słupy, porty ładowania) zostają w świecie i skracają następne przejazdy. To wzmacnia „robot pomocnik robi drogę” z [POMYSLY.md](POMYSLY.md).
9. **Kolor tylko dla tego, z czym można coś zrobić** (Inside, Limbo). Już przyjęte. Dopisać regułę testową: na każdym zrzucie ekranu gracz w 2 sekundy wskazuje, co jest interaktywne. Jeśli nie, coś jest za szare albo za kolorowe.
10. **[PRZYJĘTE 2026-11-17, zrobione na Wyspie i we wspólnym `src/render/juice.ts`: [POZIOM-WYSPA.md](POZIOM-WYSPA.md#soczyste-drobne-akcje-decyzja-2026-11-17)]** **Mała akcja, duża satysfakcja** (GrassChopper, gry inkrementalne). Proste czynności (rozbiórka złomu, wpięcie wtyczki, napięcie kabla) muszą być „soczyste”: krótki dźwięk, drgnięcie, iskra, licznik. To tani sposób, żeby powtarzalne rzeczy nie nudziły.
11. **Odbudowa, która widać w krajobrazie** (Terra Nil). Najlepsza nagroda to świat, który się zmienia: zieleń przez popiół, światło w oknie bunkra, ptaki wracające nad zalew. Mamy to w [Długofalowych skutkach](SWIAT.md#długofalowe-skutki-propozycja-2026-11-09-na-prośbę-wojtka); Terra Nil dodaje pomysł, że na końcu **rozbiera się własną infrastrukturę** i zostawia czystą przyrodę. Możliwe zakończenie albo „Gra po fabule”.
12. **Ludzie oceniają cię po skutkach, nie po dialogach** (Frostpunk). Bunkry mają nastrój (nadzieja, strach), który zmienia się od tego, co Wolt robi z prądem: dał światło na zimę, zabrał wodę elektrowni. Pokazane cicho, przez zachowanie ludzi, nie przez paski.

## Tabela zbiorcza

| Gra | Dlaczego blisko | Co bierzemy | Gdzie u nas |
|---|---|---|---|
| The Last Caretaker | robot, bateria, złom, łódź jako baza | energia jako wszystko, wyprawa i powrót, pojazd do rozbudowy | Wolt, Żaglowóz, bazy |
| Factorio | widok z góry, sieć, bilans | brak prądu spowalnia, wykres mocy, alarmy, plany „duchy” | sieć, karta bazy, robot pomocnik |
| Inside / Limbo | nastrój, brak tekstu | kolor dla interakcji, opowieść tłem, rytm napięcia i ciszy | styl, sceny |
| GrassChopper | ambient, inkrementalność | soczyste drobne akcje, ulepszenia widoczne od razu | rozbiórka, ulepszenia Wolta |
| Control | archiwum notatek | już przyjęte; dodatkowo notatki jako wskazówki do zagadek | notatki |
| Oxygen Not Included | przewody, transformatory, baterie | przepustowość kabla, przeciążenie, transformator jako łącznik | sieć, Scena 2 |
| Satisfactory | duża sieć, bezpieczniki | bezpiecznik do ręcznego załączenia, akumulatory jako bufor | bazy, linie |
| Subnautica | fragmenty, pojazdy, biomy | skanowanie fragmentów, sprzęt otwiera obszary, baza z energią | obliczenia w tle, metroidvania |
| Pacific Drive | samochód jako baza | usterki z objawami, garaż jako bezpieczne miejsce, mapa wyprawy | Żaglowóz, hala |
| Dredge | łódź, dzień i noc, ładownia | ładownia-układanka, noc jako ryzyko, krótkie wyprawy | ekwipunek, wózek, noc |
| Death Stranding | dostawy przez pustkowie | czytanie terenu, ładunek ma środek ciężkości, trwała infrastruktura | dostawy, drogi, porty |
| Sable | spokojna eksploracja | podróż dla przyjemności, punkty widokowe, bez walki | mapa świata |
| Outer Wilds | wiedza jako klucz | dziennik odkryć, bariery do zrozumienia | notatki, FABULA |
| Sailwind | realistyczne żeglowanie | nawigacja bez znacznika, wiatr do wyczucia | Żegluga, analizator wiatru |
| The Long Dark | samotność, zima, pora roku | zima jako wróg, schronienia, cicha opowieść | hibernacja, zimowisko |
| Frostpunk | generator, społeczność | nastrój ludzi zależny od energii | bunkry |
| Terra Nil | gra o odbudowie | przyroda wraca dzięki technice, potem rozbiórka własnych budowli | długofalowe skutki, koniec gry |

## Gry, które Wojtek już wskazał

### The Last Caretaker (Channel37, wczesny dostęp od 2025-11)

**Czym jest:** survival-crafting z perspektywy maszyny na zalanej Ziemi. Grasz automatem, który zbiera złom, żyje z własnej baterii i pływa łodzią, która jest jednocześnie bazą. Energia napędza prawie wszystko, a pewnych akcji nie da się powtarzać bez końca, bo kończy się prąd.

**Co działa (według recenzji):**
- Energia jako jedyna prawdziwa waluta: ruch, narzędzia, przetwarzanie, wszystko kosztuje z jednej puli. Proste zasady, które dają złożone decyzje.
- Pętla „wyprawa po złom, powrót na łódź, przetworzenie, ulepszenie łodzi, dalsza wyprawa”.
- Nastrój „przytulnie i samotnie” jednocześnie: bezpieczna baza wśród wrogiego pustkowia.
- Żegluga jako coś, na co się czeka, a nie przerywnik.

**Co krytykują:** słaba walka, nierówne wprowadzenie (jedni piszą, że samouczek jest sprawny, inni, że gra nic nie tłumaczy), optymalizacja.

**Co przenosimy:**
- Mamy już to samo jądro (Wolt z baterią, złom, Żaglowóz jako ruchoma baza), więc lekcja jest głównie obronna: **nie dodawać walki jako filaru**. Nasze zagrożenia to środowisko, mikroboty i zwierzęta, a obrona to światło, izolacja, pora przejazdu. Zostańmy przy tym.
- **Wprowadzenie przez „symulator w głowie”** (decyzja 2026-11-11) rozwiązuje problem nierównego samouczka. Trzymać się tej formy dla każdej nowej umiejętności.
- **Jedna pula energii, wiele odbiorców.** Bilans linia po linii pokazuje, gdzie ucieka prąd; dbać, żeby każda nowa mechanika miała swój wiersz w bilansie.
- **Przytulna baza:** kołyska ładowania w hali i na Żaglowozie ma dawać wyraźną ulgę (cieplejsze światło, ciszej, buczenie ładowania).

### Factorio (Wube Software)

**Czym jest:** budowa fabryki z góry na siatce, z siecią prądu, taśmami i robotami.

**Co działa:**
- **Brak prądu jako płynna degradacja.** Przy niedoborze maszyny pracują wolniej, a gracz widzi „zasilenie 63%”. Nikt nie traci gry od razu, ale problem jest oczywisty.
- **Panel elektryczny** z wykresem produkcji i zużycia po typach odbiorców, w kilku skalach czasu.
- **Alarmy z ikoną na krawędzi ekranu** (brak paliwa, zniszczony słup, brak materiału).
- **Plany jako „duchy”:** stawiasz półprzezroczysty plan, a roboty budowlane go realizują.
- Siatka i czytelne zasięgi (słup pokazuje, co obejmuje).

**Co przenosimy:**
- ~~Płynna degradacja w sieci i w Wolcie (wniosek 1).~~ Odrzucone 2026-11-17: brak prądu wyłącza urządzenia.
- Wykres na karcie bazy (wniosek 3), nie w stałym HUD, bo HUD ma być pusty jak w Inside.
- **Duchy dla robota pomocnika:** gracz rysuje trasę kabla albo drogi jako półprzezroczysty ślad, pomocnik ją wykonuje (pomysł z [POMYSLY.md](POMYSLY.md)). To naturalny interfejs zlecania.
- Alarmy dopiero po zbudowaniu anteny (już w [SWIAT.md: Bazy](SWIAT.md#bazy)); wyglądać mają jak cichy sygnał na krawędzi ekranu, nie jak wyskakujące okno.

**Czego nie bierzemy:** skali i optymalizacji fabryki jako celu. U nas automatyzacja jest późnym dodatkiem, nie rdzeniem.

### Inside i Limbo (Playdead)

**Czym są:** krótkie gry przygodowe bez słowa tekstu, z historią opowiadaną obrazem, światłem i dźwiękiem.

**Co działa:**
- Kolor i światło prowadzą wzrok do tego, co ważne.
- Zagadki wynikają z otoczenia i fizyki, nie z menu.
- Rytm: długa cisza, nagłe napięcie, znowu cisza. Gracz nigdy nie czyta instrukcji.
- Kamera jako narrator: oddala się, żeby pokazać skalę, przybliża w ważnych chwilach.

**Co przenosimy:**
- Już przyjęte: paleta i ton. Dodatkowo **reguła 2 sekund** (wniosek 9) jako test każdej nowej sceny.
- **Kamera opowiada.** Przy ważnych odkryciach (pierwszy widok doliny za bramą, poświata za oknem maszynowni) kamera na chwilę się oddala, bez przejmowania sterowania na dłużej niż kilka sekund.
- **Zagadki z fizyki kabla i wiatru,** nie z dialogów.

### GrassChopper (zapowiedź na Steam, demo)

**Czym jest:** inkrementalna gra akcji: koszenie zarośli kosą, monety, ulepszenia, które pozwalają ścinać więcej. Wojtek wskazał ją jako wzór gęstego ambientu otoczenia.

**Co działa (z opisu i dema):** prosta, powtarzalna czynność, która jest przyjemna sama w sobie; ulepszenie natychmiast widać i czuć; dźwięk otoczenia buduje miejsce.

**Co przenosimy:**
- Ambient już przyjęty (proceduralny Web Audio).
- **Soczystość drobnych akcji** (wniosek 10): rozbiórka złomu w kilku krokach z różnymi dźwiękami, wtyczka z wyraźnym „klik”, kabel, który brzęczy, gdy płynie prąd.
- **Ulepszenie odczuwalne od razu:** nowa lampa widocznie rozjaśnia mgłę, nowy nawijak szybciej zwija kabel. Bez niewidocznych +5%.
- Pasuje do naszej inkrementalności „jako dodatku” (decyzja 2026-11-10): satysfakcja z małych kroków, ale nie gra o liczbach.

### Control (Remedy)

Już przyjęte jako wzór archiwum notatek i prześwitu w dachu. Dodatkowa lekcja: notatki w Control często są **wskazówką do zagadki w tym samym pomieszczeniu**. U nas notatka-rysunek (Wolt nie czyta pisma) powinna niemal zawsze dotyczyć czegoś, co gracz zaraz może sprawdzić.

## Energia, kable i sieć

### Oxygen Not Included (Klei)

**Co działa:** przewody mają limit mocy (zwykły, gruby, przewodzący). Przeciążony przewód się uszkadza i trzeba go naprawić. Transformatory łączą sieć grubą z cienką. Baterie wygładzają szczyty, ale mają upływ.

**Co przenosimy:**
- **Klasy kabla:** cienki kabel z nawijaka (lekki, mało mocy), gruby kabel linii (ciężki, trzeba go holować, dużo mocy). Wybór kabla to decyzja logistyczna, a nie tylko długość.
- **Przeciążenie widoczne zanim zaszkodzi:** kabel jaśnieje, brzęczy wyżej, potem iskrzy (pasuje do „kolor tylko dla ważnych rzeczy”: napięty kabel już świeci miedzią).
- **Transformator jako łącznik klas** (sens dla Sceny 2 i stacji transformatorowej w Lesie Słupów).
- **Upływ akumulatorów** jako powód, żeby przed hibernacją nie liczyć tylko na baterie (spina się z „zyski się nasycają, straty nie”).

### Satisfactory (Coffee Stain)

**Co działa:** gdy pobór przekroczy moc, cała sieć się wyłącza (bezpiecznik) i trzeba ją ręcznie przywrócić; akumulatory chronią przed tym na chwilę.

**Co przenosimy:** **bezpiecznik w szafce** jako drobna, fizyczna interakcja (Wolt podjeżdża i przełącza dźwignię). Po decyzjach z 2026-11-17: przy niedoborze odbiorniki się wyłączają (bez spowalniania), a zabezpieczenie linii wybija przy przeciążeniu kabla (za dużo mocy przez za cienki przewód) i Wolt załącza je przy szafie. Tak działa Wyspa.

### Subnautica (Unknown Worlds)

**Co działa:**
- **Skaner fragmentów:** plan maszyny zdobywasz, skanując kilka rozbitych egzemplarzy.
- Nowy sprzęt (głębokościomierz pojazdu, lepsza bateria) otwiera nowe strefy: metroidvania bez ścian.
- Baza ma bilans energii (słońce zależne od głębokości, reaktory), a wyprawy wracają do bazy.
- Strach z nieznanego, nie z walki.

**Co przenosimy:**
- Postęp analizy jako „2 z 3 próbek” (wniosek 6).
- **Bariery terenowe zamiast ścian:** już robimy (sypki popiół, decyzja 2026-11-11). Każdy obszar ma jedną barierę, którą otwiera konkretne ulepszenie (płozy na wydmy, grzałki na mróz, osuszacz na mokradła). Warto to zebrać w tabeli w [FABULA.md](FABULA.md).
- **Słońce zależne od miejsca:** w lesie i w dolinie mniej, na Szklanym Zalewie dużo. Już mamy cienie chmur w demie „Słońce”, łatwo rozszerzyć na teren.

## Pojazd jako baza i podróż

### Pacific Drive (Ironwood Studios)

**Czym jest:** samotne wyprawy samochodem przez niebezpieczną strefę; auto jest bazą, schronieniem i projektem do rozbudowy, a garaż to bezpieczny dom.

**Co działa:**
- Samochód ma „dziwactwa”: usterki z osobowością, które trzeba zdiagnozować po objawach.
- Garaż jako miejsce spokoju i porządkowania łupów po napiętej wyprawie.
- Mapa wyprawy z wyborem trasy i ryzykiem.

**Co krytykują:** naprawy potrafią być żmudne i powtarzalne, zarządzanie ekwipunkiem bywa uciążliwe.

**Co przenosimy:**
- **Usterka z objawem przed awarią** (wniosek 4): dźwięk, drganie, zachowanie przy jeździe. Karta stanu z rysunkiem technicznym (już w SWIAT.md) służy do potwierdzenia, a nie do odkrycia.
- **Hala stacji i kołyska jako „garaż”.**
- **Lekcja obronna:** naprawa ma być krótka i fizyczna (podjedź, wymień, klik), a rzadka. Zużycie ma tworzyć decyzje przed wyprawą, a nie obowiązki po każdej.

### Dredge (Black Salt Games)

**Czym jest:** łódź rybacka, krótkie wyprawy, ładownia jako układanka z kształtów, noc niebezpieczna.

**Co działa:** ładownia-układanka sprawia, że każdy łup to mała decyzja; noc zmienia tę samą mapę w miejsce ryzyka; ulepszenia łodzi wprost otwierają dalsze wody.

**Co przenosimy:**
- **Ładownia wózka i Żaglowozu jako siatka z kształtami** (demo „Warsztat” ma już ekwipunek i wózek; sprawdzić, czy siatka nie byłaby ciekawsza od listy).
- **Noc zmienia teren:** mikroboty, mniej słońca, więcej wiatru. Już w tabeli doby; Dredge pokazuje, że to wystarcza jako główne napięcie bez walki.

### Death Stranding (Kojima Productions)

**Czym jest:** dostawy przez puste krainy; teren, równowaga ładunku i trasa to rdzeń gry, a postawiona infrastruktura (drogi, liny, mosty) zostaje i pomaga innym.

**Co działa:**
- Czytanie terenu: nachylenie, rzeki, skały.
- Ładunek ma wagę i środek ciężkości; źle zapakowany przewraca.
- Budowanie dróg i łączenie miejsc w sieć jako cel i nagroda.
- Cisza i muzyka tylko w kluczowych chwilach podróży.

**Co przenosimy:**
- **Dostawy dla bunkrów jako podróż**, nie jako znacznik na mapie. Już mamy dostawę w słońcu (demo „Słońce”).
- **Ładunek wpływa na jazdę:** cięższy wózek gorzej przyspiesza, ładunek wysoko zwiększa przechył Żaglowozu. Pasuje do balastu (decyzja 2026-11-11).
- **Drogi z robotem pomocnikiem:** ubita droga przez popiół zostaje na lata (do zużycia przy hibernacji).
- **Muzyka tylko w chwilach odkrycia** (np. pierwszy widok zalewu), poza tym ambient.

### Sable (Shedworks)

**Co działa:** eksploracja na ślizgaczu bez walki, spokojna, z przyjemnością samej jazdy; punkty widokowe i wspinaczka do nich; świat mówi kształtem.

**Co przenosimy:** **punkty widokowe** (wzgórze z wiatrakiem, wieża radiolinii), z których widać następne cele. Pasuje do metroidvanii „coś widać, ale nie da się wejść” (decyzja 2026-11-09).

### Sailwind (Raw Lion Workshop)

**Co działa:** realistyczne żeglowanie bez znacznika celu; nawigacja z mapy, kompasu i gwiazd; wiatr trzeba wyczuć.

**Co przenosimy:** potwierdza nasz pomysł **analizatora wiatru w dwóch stopniach** (2026-11-11): najpierw żegluga na czuja, potem narzędzia. Dodatkowo: nawigacja z rysunkowych map z plotera i punktów orientacyjnych zamiast strzałki na HUD.

## Samotność, cisza, opowieść bez słów

### Outer Wilds (Mobius Digital)

**Co działa:** jedyną prawdziwą nagrodą jest wiedza. Dziennik pokazuje powiązania między odkryciami i pytania bez odpowiedzi.

**Co przenosimy:**
- **Dziennik Q-1 jako mapa powiązań,** nie lista zadań: „stacja R-2” połączona z „mapa z plotera” i „ślad opony w popiele”. Wolt, który nie czyta pisma, i tak może składać obrazy.
- **Bariery do zrozumienia** (wniosek 7).

### The Long Dark (Hinterland)

**Co działa:** zima i pogoda jako główny przeciwnik; schronienia jako cenne miejsca; samotność bez słów; powolne tempo.

**Co przenosimy:** zimowisko jako najcenniejsze miejsce w obszarze (już w hibernacji). Zamieć pyłowa i śnieżna jako sytuacja „szukaj schronienia teraz”, nie walka.

### Journey (thatgamecompany)

**Co działa:** wiatr i piasek jako ruch i muzyka; cel stale widoczny na horyzoncie.

**Co przenosimy:** **stały znak na horyzoncie** dla całej gry (np. góry nad Cerkwiskami albo poświata), który przypomina, dokąd się zmierza, bez znacznika.

## Odbudowa świata, czas i ludzie

### Terra Nil (Free Lives)

**Czym jest:** „odwrotny city builder”: technika oczyszcza ziemię i przywraca ekosystemy, a na końcu rozbierasz własne budowle i zostawiasz przyrodę.

**Co przenosimy:**
- Najlepsza nagroda to **zmiana krajobrazu** (wniosek 11).
- **Rozbiórka własnej sieci na końcu** jako możliwe zamknięcie łuku (por. [Ironia losu](SWIAT.md#ironia-losu-propozycja-na-podstawie-luźnych-myśli-wojtka-2026-11-08-nie-dosłownie)): robot, który odbudował świat, zabiera swoje kable i zostawia ludziom czystą ziemię. Do decyzji.
- Potwierdza kierunek „restoration” z [POMYSLY.md](POMYSLY.md).

### Frostpunk (11 bit studios)

**Co działa:** generator w środku miasta; każda decyzja energetyczna ma koszt społeczny; ludzie reagują nadzieją i niezadowoleniem.

**Co przenosimy:** **nastrój bunkrów zależny od prądu** (wniosek 12), ale bez pasków na ekranie: ludzie wychodzą na powierzchnię, gdy jest światło, zamykają włazy, gdy Wolt zabrał im elektrownię. Spina się z pokoleniami ([SYMULACJA.md](SYMULACJA.md)).

### Wnioski o czasie i hibernacji

Gry z czekaniem (inkrementalne, Frostpunk, The Long Dark) uczą, że czekanie jest ciekawe tylko wtedy, gdy przed nim podejmujesz decyzję, a po nim widzisz skutek. To już jest w [Inkrementalność i zamrożenie](SWIAT.md#inkrementalność-i-zamrożenie-na-lata-ustalone-2026-11-10-balans-to-propozycja); te gry tylko to potwierdzają.

## Czego unikać

Lekcje z krytyki tych gier:

- **Walka jako filar.** Najczęstszy zarzut wobec The Last Caretaker. Nasze zagrożenia zostają środowiskowe.
- **Żmudne naprawy.** Pacific Drive: zużycie ma tworzyć decyzje, a nie obowiązki. Naprawa krótka, rzadka, fizyczna.
- **Niewytłumaczone systemy.** Survival-crafting często rzuca gracza bez wyjaśnień. U nas: symulator w głowie i notatki-rysunki.
- **Liczby zamiast świata.** Gry inkrementalne łatwo zamieniają się w arkusz. U nas inkrementalność jest dodatkiem (decyzja 2026-11-10), a skutki widać w krajobrazie.
- **Zarządzanie ekwipunkiem dla samego zarządzania.** Ładownia-układanka tylko, jeśli każdy wybór coś znaczy.
- **Fabryka jako cel sam w sobie.** Automatyzacja późno i w służbie świata, nie optymalizacji.
- **Kopiowanie wyglądu.** Żadnych rozpoznawalnych sylwetek, kolorystyki ani lokacji z tych gier.

## Dane z dekompilacji i własne analizy Wojtka

Wojtek zaproponował, że może dać własne analizy albo dane z dekompilacji (np. The Last Caretaker). **Przydałyby się**, ale tylko do strojenia, nie do kopiowania:

- **Tak:** liczby i proporcje (ile energii zużywa ruch vs narzędzie vs przetwarzanie, pojemność baterii, tempo ładowania, czas wyprawy do czasu w bazie, rytm zużycia części). Nasze moce na stacji (turbina 1200 W, maszynownia 250 W, fabrykator 600 W) są wymyślone i czekają na potwierdzenie, więc porównanie z działającą grą pomogłoby je ustawić.
- **Tak:** struktura systemów (jakie stany ma pojazd, jakie zdarzenia wywołują usterki), opisana własnymi słowami.
- **Nie:** kod, modele, tekstury, dźwięki, teksty, nazwy ani układ poziomów. Do repo trafia tylko własne podsumowanie, bez wklejania zdekompilowanych fragmentów.

Najwygodniejsza forma: notatka Wojtka albo tabela z liczbami w tym pliku, w sekcji poniżej.

### Notatki Wojtka

*(puste: miejsce na analizy i dane Wojtka)*

## Do decyzji

- ~~Które z 12 wniosków wchodzą do pracy i w jakiej kolejności. Propozycja agenta na start: 1, 2, 4, 10.~~ **Odpowiedź Wojtka (2026-11-17):**
  - **1 (płynna degradacja): odrzucone.** „Brak prądu to brak prądu, urządzenia się wyłączają.”
  - **2 (klasy kabli i przeciążenie z transformatorem): tak.** Grubsze kable będzie można później fabrykować (crafting). Zrobione na Wyspie.
  - **4 (usterki Żaglowozu z objawem): tak.** Usterki widać i słychać, zanim coś się zepsuje. Zrobione w demie „Żegluga”.
  - **10 (soczyste drobne akcje): tak.** Dźwięk, błysk, drgnięcie przy naprawie, wpięciu kabla, craftingu. Zrobione na Wyspie (wspólny moduł `src/render/juice.ts`).
- ~~Czy bezpiecznik do ręcznego załączenia wchodzi obok płynnej degradacji.~~ Wchodzi zabezpieczenie linii do ręcznego załączenia przy przeciążeniu kabla (degradacja odrzucona).
- Czy ładownia ma być siatką z kształtami (Dredge) czy zostaje listą.
- Czy rozbiórka własnej sieci na końcu (Terra Nil) to kandydat na zakończenie.
- Czy dodać stały znak na horyzoncie dla całej gry.

## Źródła

- The Last Caretaker: [jak działa survival-crafting (allthings.how)](https://allthings.how/the-last-caretaker-how-survival-crafting-works-on-a-flooded-earth/), [wrażenia z gry (Gamereactor)](https://www.gamereactor.eu/the-last-caretaker-gameplay-impressions-ive-never-been-so-cosy-and-so-lonely-1592453/), [recenzja wczesnego dostępu (Gamer Social Club)](https://gamersocialclub.ca/2025/11/04/the-last-caretaker-early-access-review), [zapowiedź (Thumb Culture)](https://www.thumbculture.co.uk/the-last-caretaker-pc-early-access-preview), [recenzja (GamingHQ)](https://gaminghq.eu/2026/02/11/the-last-caretaker-review).
- GrassChopper: [strona na Steam](https://store.steampowered.com/app/4533250), [Deku Deals](https://www.dekudeals.com/items/grasschopper).
- Pozostałe gry: ogólnie znane mechaniki i opinie o nich; przed przyjęciem konkretnej liczby albo szczegółu warto je sprawdzić w grze.
