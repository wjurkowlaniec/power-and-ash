# Początek gry: od przebudzenia do pierwszej zimy

Dokument opisuje szczegółowo pierwsze godziny gry, scena po scenie. Ogólny świat i fabuła są w [SWIAT.md](SWIAT.md), a zasady kabla i obecny poziom testowy w [PLAN.md](PLAN.md).

Liczby (czasy, koszty, pojemności) to punkt wyjścia do strojenia w testach, a nie ustalenia.

## Założenia startu

- **Miejsce:** Stacja Pomiarowa „Olszanka”, polowa placówka misji badawczej, na skraju doliny z zalanym zbiornikiem. Dookoła łąki i olszyny przykryte cienką warstwą popiołu, jak szarym szronem. Na horyzoncie wieża kościoła wystająca z wody (Zatopiona Wieś).
- **Pora:** połowa jesieni. Do pierwszych mrozów zostaje ok. **20 dni gry**. To jest główny zegar pierwszego rozdziału, choć gracz nie musi o tym od razu wiedzieć.
- **Doba:** ok. 24 min realnych (ok. 15 min dnia, ok. 9 min nocy). Jesienią noce się wydłużają, czyli dzień po dniu jest coraz mniej słońca.
- **Wolt wie tyle co gracz:** nic. Pamięć wyzerowana, brak mapy, brak celu. Wszystko wychodzi z otoczenia.

## Scena 0. Ciemność (ok. 1 min)

Czarny ekran. Wiatr, skrzypienie blachy, kapanie wody. Co kilka sekund głuchy, niski puls, jak bicie serca przez ścianę. To bateria i to jest gracz: Wolt budzi się jako ogniwo zamknięte w komorze testowej, bez ciała.

Puls się wzmacnia, w ciemności pojawia się bladozielona kropka (jedyny kolor na ekranie). Szum obrazu, jak w starej kamerze. Bateria sięga przez kabel diagnostyczny do jedynej maszyny podpiętej do stanowiska: pustego automatu serwisowego na jednym kole, który stoi w kołysce. Obraz to widok z jego kamery, na **4% jego własnej rezerwy**. To pierwsze zdalne sterowanie w grze, choć gracz jeszcze tego nie wie.

Bez napisów i bez logo. Tytuł gry pojawia się dopiero w Scenie 3, gdy zapada pierwsza noc (decyzja Wojtka 2026-11-09, wcześniej był w Scenie 5).

## Scena 1. Hala pomiarowa (samouczek ruchu, ok. 5 min)

![Hala pomiarowa: bateria w komorze testowej, Wolt w martwej kołysce](img/koncepty/hala.jpg)

Pusty automat (ciało etapu 1, **monocykl**, patrz [SWIAT.md, Ciała i transfer](SWIAT.md#ciała-i-transfer)) stoi w kołysce serwisowej w hali stacji. Kołyska jest martwa. Obraz jest ziarnisty i czarno-biały, ruch powolny: bateria steruje ciałem zdalnie, po kablu, a ciało ma tylko resztkę własnej energii.

**Czego uczy:** ruch, rozglądanie się, interakcja (`E`), pasek energii i, po cichu, zdalne sterowanie: kabel diagnostyczny ogranicza, jak daleko ciało może odjechać od komory.

1. Ciało zjeżdża z kołyski i chwiejnie łapie równowagę na kole. Każdy metr kosztuje energię, a pasek widocznie spada (z 4% do ok. 2% w ciągu tej sceny). Presja jest delikatna, ale czytelna.
2. Pulsujące światło prowadzi do **stanowiska testowego**: przeszklona komora z ramieniem i kablami, w niej bateria (prototyp Q-1, oznaczenie na obudowie wytarte, czytelne tylko „Q-1” i znak misji: stylizowana zorza).
3. Komora jest zamknięta. Obok wisi ręczna dźwignia awaryjna. Pierwsza prosta zagadka: dźwignia ma za mało siły, więc trzeba ją podważyć rurą leżącą przy ścianie. Ciało ma od początku **ramię chwytne** i to nim bierze rurę (pierwszy przedmiot).
4. Ciało bierze baterię i wkłada ją w kasetę swojej ramy. Bateria przestaje sterować z zewnątrz i jest teraz w środku, na stałe. **Kluczowy moment gry:** dźwięk się otwiera, obraz nabiera koloru (wciąż wyblakłego), ruch staje się płynny. Pojawia się HUD: energia, temperatura, wilgotność.
5. Na ekranie stanowiska wyświetla się na sekundę log, ale dla baterii to tylko ciąg znaków i liczba „4411”. Obraz gaśnie. To pierwszy fragment fabuły. Obok stanowiska leży wydruk **raportu z testu 4411**. Wolt go skanuje, ale tekst jest nieczytelny: to pierwsza notatka w Archiwum i pierwsza zagadka, którą rozwiąże dopiero odkodowanie pisma (patrz [SWIAT.md, Notatki i archiwum](SWIAT.md#notatki-i-archiwum)).

**Stan po scenie:** bateria daje energię, ale ma ograniczoną moc chwilową (np. 200 W). Wolt może pracować, lecz nie zasili całej stacji.

## Scena 2. Martwa stacja (energia, kabel, złom, ok. 15 min)

![Stacja Pomiarowa Olszanka o zmierzchu, w dali wieża kościoła Zatopionej Wsi](img/koncepty/stacja.jpg)

Stacja ma kilka pomieszczeń: hala pomiarowa, warsztat z fabrykatorem, maszynownia (akumulatory stacji, rozdzielnia), magazyn, dyżurka z oknem na dolinę. Na zewnątrz podwórze z masztem pomiarowym, małą turbiną wiatrową na szczycie, wyrzutnią balonów meteo i szopą.

Wszystko jest bez prądu. Drzwi do warsztatu mają elektryczny zamek.

**Czego uczy:** Wolt jako źródło prądu, porty, kabel, koszt energii, rozbiórka złomu, fabrykator.

1. Na drzwiach warsztatu wisi **kartka technika**. Tekstu nie da się przeczytać, ale na dole jest szkic: drzwi, port po lewej i strzałka od wtyczki. To pierwsza notatka-wskazówka: zamiast okienka samouczka gracz dostaje rysunek od człowieka, który tu pracował. (Po odkodowaniu kartka powie: „Zamek padł znowu. Jak nie ma prądu, wepnij się w port po lewej…”.) Przy drzwiach jest port. Wolt ma w ciele **krótki kabel własny (3 m)**, którym może się wpiąć w port i oddać trochę energii. Drzwi się otwierają, a pasek Wolta spada. Lekcja: każda rzecz, którą zasilasz z siebie, to Twoje życie.
2. W warsztacie stoi **fabrykator**, ale potrzebuje więcej mocy niż Wolt może dać. Prowadzi to do celu: uruchomić turbinę na maszcie.
3. **Pierwsze holowanie:** złom z podwórza jest za ciężki, żeby nosić go w ramieniu. Wolt doczepia do haka starą oponę i ciągnie na niej części jak na sankach. Monocykl zwalnia, ładunek zarzuca na zakrętach, a w popiele zostaje ślad. Lekcja: ciężar i lina zmieniają jazdę tak samo jak kabel.
4. Na tej samej kartce jest drugi rysunek: łożysko i regał z zaznaczoną drugą półką (tam leży smar). Turbina stoi, bo **łożysko się zatarło** i łopata jest pęknięta. Pierwsza naprawa (samouczek maintenance): rozebrać złom na podwórzu (stara stacja meteo, przewrócony płot, skrzynki pomiarowe), zdobyć żelazo i smar, wymienić łożysko na szczycie masztu (wspinaczka po drabince, wiatr kołysze kamerą).
5. Turbina rusza, ale prąd z masztu trzeba doprowadzić do maszynowni. Kabel z nawijaka: pierwsze metry robi się w fabrykatorze… którego jeszcze nie da się zasilić. Rozwiązanie: w magazynie jest **szpula starego kabla, 12 m**, za krótka do maszynowni prostą drogą (ok. 15 m), ale wystarcza, jeśli poprowadzić kabel przez okno dyżurki. Pierwsza zagadka kablowa z owijaniem o przeszkody.
6. **Pierwsze świadome zdalne sterowanie:** przejście do maszynowni blokuje przewrócona szafa. Wolt wpina kabel w panel suwnicy w hali i steruje nią zdalnie, a jego ciało stoi w tym czasie bezczynnie przy panelu. Suwnica podnosi szafę. Prosta lekcja: możesz przejąć maszynę, ale zostawiasz wtedy własne ciało.
7. Maszynownia ożywa, światła w stacji zapalają się po kolei z charakterystycznym brzęczeniem. Fabrykator działa. Od teraz da się robić kabel (5 m = 1 miedź + 1 plastik, jak w poziomie „Rozruch”).
8. Stacja staje się **pierwszą bazą**: Wolt ładuje się w kołysce, a fabrykator działa tylko gdy wieje (akumulatory stacji są zdegradowane i trzymają mało).

**Fabuła w tej scenie:** w dyżurce jest tablica z kartkami (rysunki dzieci? zdjęcia zespołu?), kubek, kurtka na krześle. Ludzie stąd wyszli w pośpiechu. W szufladzie leży **notatka służbowa** z podpisem i pieczątką, na razie nieczytelna. Po odkodowaniu okaże się, że kierowniczka stacji odmawia w niej przeniesienia Q-1 do laboratorium (pierwszy ślad wątku „Spór o Q-2”). Na półce stoją **książki** (podręcznik meteorologii, instrukcje), czyli pierwszy duży zastrzyk tekstu do korpusu. Na mapie ściennej ktoś zakreślił markerem siedem punktów połączonych linią (Sieć Siedmiu Stacji) i jeden punkt w górach, przekreślony.

## Scena 3. Pierwsza noc (temperatura, wilgoć, mikroboty, ok. 9 min)

Pierwsza noc przychodzi niezależnie od postępu, zwykle w trakcie Sceny 2 albo tuż po niej.

**Czego uczy:** temperatura i wilgotność Wolta, lampa, pierwsze zagrożenie.

1. **Zapada pierwsza noc i tu pojawia się tytuł gry** (Wojtek 2026-11-09). Słońce chowa się za wzgórzem, lampa Wolta zapala się sama, kamera na chwilę się oddala nad stacją, a w ciszy i mgle wyłania się napis „Popiół i Prąd”. Robi się ciemno i zimno. Na łąkę wchodzi mgła znad zbiornika. Wilgotność Wolta rośnie (osiada rosa), a gdy przekroczy próg, ruchy robią się szarpane i pojawiają się iskry.
2. Wolt może **się zgrzać** (przytrzymanie klawisza): suszy się, ale pali energię. Albo schować się w stacji przy maszynowni, gdzie jest ciepło. Gracz uczy się, że noc na zewnątrz jest droga.
3. **Mikroboty:** na kablu z turbiny pojawiają się małe, migające punkciki, jak świetliki. Przyczepiają się do kabla i podjadają prąd, a fabrykator zwalnia. Światło lampy Wolta je płoszy (rozpierzchają się z cichym szczebiotem). Na tym etapie są niegroźne, raczej zagadkowe i trochę piękne.
4. Rano kabel ma w kilku miejscach nadgryzioną izolację. Pierwszy znak, że kable się zużywają.

## Scena 4. Odjazd (za mało prądu, ok. 15 min)

**[ustalone kierunkowo 2026-11-07, pomysł Wojtka]** Stacja ma prąd, Wolt jest naładowany, ale sam monocykl daleko nie zajedzie. Ta scena ma pokazać, że świat jest duży, a ciało za słabe.

**Czego uczy:** zasięg i zużycie energii w ruchu, teren, decyzja, co zabrać.

1. Po uruchomieniu maszynowni ekran w dyżurce na chwilę łapie sygnał: **Echo** (pierwsza umiejętność baterii) wskazuje kierunek za wzgórzem. Na mapie ściennej ten sam punkt jest zakreślony: „R-2, rozdzielnia polowa”.
2. Wolt ładuje się do pełna w kołysce. Pasek zasięgu pokazuje, że wystarczy na „mniej więcej tam”, bez zapasu.
3. **Co zabrać:** opona z częściami za hakiem daje zapas kabla i złomu, ale wyraźnie zjada prąd i spowalnia. Bez niej Wolt dojedzie szybciej, ale na miejscu będzie miał mniej. Pierwszy kompromis między ładunkiem a zasięgiem.
4. **Droga jest ciężka:** polna droga przechodzi w popiół, potem w podjazd. Koło buksuje na sypkim, monocykl chwieje się na nierównym, a pod górę pasek leci szybko. Wiatr w twarz też kosztuje.
5. Na grzbiecie wzgórza widać drugą lokację w kotlinie, a za nią szeroką, szarą równinę (pierwszy widok na open world). Zjazd w dół to chwila oddechu: monocykl odzyskuje trochę energii hamowaniem.
6. Wolt dociera do rozdzielni **na rezerwie**: obraz znowu traci kolor, a ruchy zwalniają jak w Scenie 1. Ostatnie metry to czołganie się z kołem w popiele.

**Powrót:** jeśli gracz zawróci w połowie, dojedzie do stacji. Jeśli padnie po drodze, bateria stawia ciało w trybie awaryjnym (patrz śmierć w [SWIAT.md](SWIAT.md#bateria-q-1)), a karą jest stracony czas.

## Scena 5. Rozdzielnia polowa i pierwszy pojazd (ok. 20 min)

Rozdzielnia polowa R-2 stoi w kotlinie: kontenery, ogrodzenie, rząd paneli słonecznych (600 W, zakurzonych), mała szafa sterownicza. Pod wiatą stoi **wózek serwisowy misji**.

**Wózek serwisowy (pojazd etap 0):** same kółeczka i mała platforma. Cztery niskie koła z silnikami w piastach, płaska rama z blachy ryflowanej, gniazdo dokowania dla koła monocyklu i złącze magistrali. Bateria wózka jest pusta. Wygląda jak coś, czym technik woził skrzynki między stacjami.

**Czego uczy:** pierwszy pojazd, dokowanie, ładowanie z obcego źródła kablem 20 m (to jest dokładnie mechanika obecnego poziomu „Rozruch”).

1. Wolt najpierw musi przeżyć: na rezerwie wpina się kablem własnym (3 m) w szafę rozdzielni. Panele są zakurzone i dają mało, więc ramieniem trzeba je oczyścić z popiołu. Pasek powoli rośnie.
2. Wózek stoi za daleko od szafy. Kabla jest za mało, więc trzeba go zrobić z tego, co Wolt przywiózł na oponie albo rozbierze na miejscu (złom, fabrykator przenośny w kontenerze). Jeśli gracz zostawił oponę w stacji, ta część trwa dłużej.
3. **Dokowanie:** Wolt wjeżdża monocyklem na platformę, a koło wskakuje w gniazdo i zatrzaskuje się. Albo doczepia wózek do haka i ciągnie go jak przyczepkę, ale wtedy wózek jest tylko ładunkiem, a nie napędem. Gracz szybko odkrywa, że po zadokowaniu bateria steruje wózkiem jak swoim ciałem.
4. **Podłączenie i ładowanie:** kabel z szafy rozdzielni do portu wózka. Trasa wokół kontenerów ma ok. 18 m, a prosto się nie da. Bateria wózka ładuje się powoli (w czasie gry: popołudnie), a w tym czasie Wolt rozbiera złom w okolicy.
5. W kontenerze leży notatka technika z R-2 (nieczytelna, ale z rysunkiem wskaźnika baterii zakreślonego na 80% i ikonką ognia; po odkodowaniu: „wózek ciągnie w lewo, nie ładuj go powyżej 80%, bo grzeje się pakiet”). Dziennik trasy wózka jest w pamięci wózka, w formacie maszyn, więc bateria go rozumie: ostatni kurs, punkt na równinie, którego nie ma na mapie stacji.
6. **Odjazd:** z naładowanym wózkiem Wolt wyjeżdża z kotliny. Kamera się oddala, a przed nim jest **Popielna Równina**: płaska, szara, z wydmami popiołu, słupami i resztkami dróg. Od tego momentu świat jest otwarty.

**Stan po scenie:** Wolt ma pojazd, który jedzie dalej i szybciej, wozi ładunek i ma własną baterię. Ale wózek jest na kółkach: grzęźnie w sypkim popiele, a na wydmach trzeba szukać twardego podłoża. To pierwsza brama metroidvanii (płozy, a potem żagiel).

## Scena 6. Popielna Równina (otwarcie świata, ok. 30 min i dalej)

Echo prowadzi dalej, do punktu z dziennika wózka, ale świat jest od teraz otwarty. Gracz może wracać do stacji, jeździć po równinie, zbierać złom i rozbudowywać pojazd.

Na równinie i w dolinie:

- **Ślad z dziennika wózka:** kolejny punkt misji na równinie, czyli trop fabularny (szczegóły do ustalenia).
- **Rozbudowa pojazdu:** z wózka powstaje pierwszy Żaglowóz. Maszt z rury albo anteny stacji, żagiel z **powłoki balonu meteo** ze stacji (powód, żeby wrócić), płozy na sypki popiół w miejsce kół albo obok nich. To dawna Scena „Szopa i bojerek” przeniesiona na później: rama bojerka może leżeć na równinie jako źródło płóz.
- **Wiatrak** na wzgórzu nad doliną: stary, drewniany, z prądnicą dobudowaną przez misję. Druga baza do adaptacji, ale prądnica ma inny standard złącza. Pierwsza **analiza protokołu**: Wolt musi spędzić noc, „ucząc się” złącza, zanim zbuduje przejściówkę.
- **Przystanek** z wiatą przy starej drodze, gdzie leży czyjś plecak: konserwy, latarka, zeszyt z rysunkami. Rysunki pokazują ludzi schodzących pod ziemię i robota bardzo podobnego do Wolta. Podpisy są odręczne i na razie nieczytelne. Odszumią się dopiero po odkodowaniu odręcznego pisma (wątek „Dzieci ze Szkoły”).

## Scena 7. Pierwszy człowiek (ok. dzień 6–10 gry)

![Zatopiona Wieś: pomost, człowiek w łodzi, wieża kościoła we mgle](img/koncepty/wies.jpg)

Na brzegu zbiornika Wolt znajduje ślady: odciski butów w popiele, jeszcze ciepłe ognisko, rozwieszone sieci rybackie.

1. Kiedy podjedzie bliżej, widzi postać w masce i płaszczu. Człowiek mówi coś, ale gracz słyszy tylko **szum z pojedynczymi tonami**. Napisy to rząd znaków, które się trzęsą.
2. Człowiek się boi. Rzuca kamieniem albo celuje z prowizorycznej włóczni i ucieka łodzią w stronę wieży kościoła.
3. Jeśli Wolt nie podejdzie zbyt szybko i nie zaświeci lampą w twarz, człowiek przed ucieczką zostawia na pomoście **przedmiot**: rozładowaną latarkę. To pierwsza „prośba” w języku gestów.
4. Gdy Wolt naładuje latarkę (z siebie albo w stacji) i zostawi ją w tym samym miejscu, następnego dnia czeka tam odpowiedź: zawiniątko z miedzianym drutem i wyrysowaną mapką. Pierwsza wymiana. Do słownika wpada pierwsze słowo: „światło”.

Od tego momentu ludzie stają się częścią gry. Zatopiona Wieś ma bunkier w schronie pod szkołą, a do niego trzeba będzie dotrzeć, ale wózek nie jedzie po wodzie, a w wodzie i wilgoci Wolt rdzewieje. Pierwsza brama metroidvanii jest widoczna, zanim da się przez nią przejść.

## Scena 8. Pierwsza zima (koniec pierwszego rozdziału, ok. dzień 15–20)

Od ok. 15. dnia przychodzą przymrozki. Rano na kablach jest szron, akumulatory stacji tracą pojemność, a Wolt na zewnątrz w nocy wychładza się szybko.

Gracz dostaje jasny sygnał (zamarznięta kałuża, sypiący się szron, bateria pulsuje nerwowo): **zimy jeszcze nie przetrwasz**.

Opcje zimowiska:

- **Stacja Olszanka:** znana, bezpieczna, ale akumulatory stacji przez zimę padną i trzeba je będzie wiosną wymienić.
- **Schron pod szkołą** w Zatopionej Wsi, jeśli gracz zdążył nawiązać kontakt z ludźmi i zdobyć powłokę na wilgoć. Lepsza nagroda: ludzie przez zimę dbają o Twój sprzęt, a Ty o ich światło. Po przebudzeniu słownik jest dłuższy, bo Wolt „słyszał” ich przez sen.

Przed snem gracz wybiera **długość hibernacji** (patrz SWIAT.md). Przy pierwszej zimie dostępne jest tylko „do wiosny”, żeby nie zgubić się na start. Dłuższe opcje pojawiają się, gdy gracz ma coś, co produkuje przez lata.

Hibernacja to krótka sekwencja: ekran gaśnie, puls baterii zwalnia, za oknem sypie śnieg, potem topnieje. Wiosna: ten sam kadr, ale zieleń przebija się przez popiół, kabel jest pokryty mchem, a na pomoście stoi ktoś nowy.

## Co gracz ma po pierwszym rozdziale

- Bazy: Stacja Olszanka (turbina, fabrykator, kołyska ładowania), rozdzielnia polowa R-2 (panele 600 W) i być może wiatrak.
- Pojazd: wózek serwisowy z R-2 (etap 0), a jeśli gracz zdążył, rozbudowany o maszt, żagiel z balonu i płozy (etap 1).
- Wolt: bateria z Echem w ciele monocyklu z dodatkami (ramię od startu, hak holowniczy, nawijak, lampa), kabel własny 3 m, grzanie. Pierwsze zdalne sterowanie po kablu (dźwig, suwnica).
- Pierwsze słowa w słowniku i pierwszy kontakt z ludźmi.
- Kilka nieczytelnych notatek i pierwsze książki w Archiwum (raport z testu 4411, kartka technika, notatka służbowa, zeszyt z rysunkami). Korpus rośnie, a pierwszy próg odkodowania (liczby, jednostki, znaki ostrzegawcze) może wpaść jeszcze przed zimą.
- Wiedza: kable się zużywają, noc jest droga, wilgoć szkodzi, mikroboty ciągną do prądu.

## Jak to się ma do obecnego prototypu

| Obecny prototyp | Miejsce w docelowej grze |
|---|---|
| Poziom testowy „Rozruch” (złom, fabrykator, kabel 20 m, ładowanie, odjazd) | Scena 5: rozdzielnia polowa R-2, ładowanie wózka serwisowego i odjazd na równinę |
| Żaglowóz z gotowym fabrykatorem | późniejszy etap Żaglowozu (etap 2–3), nie start |
| Wiatr i żagiel z logo „Zefir” | system wiatru od Sceny 6 (pierwszy żagiel na wózku); logo „Zefir” na żaglu z etapu 2 (prawdziwe płótno z reklamą znalezione w Zatopionej Wsi) |

Proponowana kolejność budowy: najpierw Scena 1–3 w stacji (najmniej nowych systemów, dużo klimatu), potem Scena 4–5 (odjazd, rozdzielnia, wózek, czyli w dużej mierze istniejący „Rozruch”), a na końcu żagiel i wiatr.
