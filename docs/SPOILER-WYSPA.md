# SPOILER: finał poziomu „Wyspa”

> **Wojtek, nie czytaj przed zagraniem.** Prosiłeś o zaskoczenie (2026-11-17). Dla agentów i ludzi, którzy przejmują pracę: to jest pełny opis finału [POZIOM-WYSPA.md](POZIOM-WYSPA.md). Nie przenoś tych szczegółów do dokumentów, które Wojtek czyta przed testem (README, DECYZJE.md opisuje tylko, że finał jest w tym pliku).

## Co się dzieje

1. **Przeciążenie.** Przy ok. 70% pobierania terminal sięga po pełną moc, a regulator nie wytrzymuje: **bezpiecznik strzela** (huk, iskry, ciemność, wszystkie światła bunkra gasną, pobieranie staje). Gracz myślał, że już po wszystkim. Postęp się nie cofa.
2. **Dwa wyjścia, oba zawsze dostępne** (brak martwych punktów):
   - **Szybki bezpiecznik**: znany przepis (1 miedź + 1 szkło). Jeśli gracz ma resztki, robi go ręcznie i montuje w regulatorze. Kto zostawił zapas, jest nagrodzony. Sprawdza, czy crafting pod presją jest wygodny.
   - **Wolt jako mostek**: w regulatorze można wpiąć ramię Wolta w miejsce bezpiecznika. Wolt staje się częścią obwodu i ostatnie 30% idzie **przez niego**: jego bateria spada (z jego energii płynie część mocy, a całość go grzeje), obraz traci kolor jak w Hali. Echo lekcji ze Sceny 2: „każda rzecz, którą zasilasz z siebie, to Twoje życie”. Gdy Wolt zejdzie na rezerwę, pobieranie i tak się kończy (próg ustawiony tak, żeby zawsze wystarczyło), a Wolt może potem doczołgać się do kołyski.
3. **Latarnia.** Po pobraniu terminal oddaje sterowanie: na skale **zapala się latarnia nawigacyjna**, pierwszy raz od nocy Popiołu. Kamera powoli oddala się nad wyspą, snop światła obraca się nad szklaną taflą.
4. **Odpowiedź.** Po kilku obrotach na horyzoncie, w kopule Szklarni, **coś odmruguje światłem**: trzy krótkie, przerwa, trzy krótkie. Ktoś tam jest i widział. Q-1 zapisuje sygnał jako nową obserwację („nieznany sygnał świetlny: 1 z 3”). Bez słów, bez dialogu.
5. **Dane misji.** Z terminala do Archiwum trafia fragment mapy misji (rysunek, czytelny od razu): wyspa, Szklarnia i linia z kropek dalej, za kopułę. To pierwszy ślad klucza „Mapa misji” z filaru Kopuła ([FABULA.md](FABULA.md#klucze-do-finału)).
6. Wyciemnienie i karta „Koniec testu · Wyspa” z dziennikiem testu do skopiowania.

## Po co tak

- Finał sprawdza crafting w chwili, gdy gracz go nie planował: czy umie szybko zrobić część z pamięci i z resztek.
- Opcja „Wolt jako mostek” wraca do tematu gry (prąd to życie Wolta) i nie wymaga niczego od gracza poza decyzją.
- Odpowiedź światłem z Kopuły to obietnica świata i ludzi, bez wykładu fabularnego.

## Uwaga: dwa różne przeciążenia (2026-11-17)

Od 2026-11-17 na Wyspie są też klasy kabli: przeciążona linia (za cienki kabel) grzeje się i wybija swoje zabezpieczenie, które E przy szafie załącza bez materiałów. To coś innego niż finał: w finale strzela **bezpiecznik regulatora** i trzeba go zrobić albo zastąpić Woltem. Gracz, który poznał przeciążenie kabla, może spodziewać się kłopotu, ale nie tego, że reset nie pomoże.

## Liczby

- Przeciążenie przy 70% postępu (`OVERLOAD_AT`).
- Wolt jako mostek: kosztuje go ok. 1,2%/s, ale tylko wtedy, gdy prąd naprawdę płynie (cień chmury wstrzymuje i pobieranie, i koszt). Za ok. 27 s pobierania to maks. ok. 33% baterii; przy każdym stanie baterii pobieranie się kończy, bo na rezerwie Wolt dalej przewodzi. Sprawdzone w przeglądarce 2026-11-17.
- Latarnia: obrót 6 s, odpowiedź z Kopuły po 2 obrotach.
