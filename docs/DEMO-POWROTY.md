# Tech demo „Powroty”

**Grywalne:** https://wjurkowlaniec.github.io/power-and-ash/demo-returns/

**Po co (Wojtek, 2026-11-11):** poziom albo demo, które pokaże, jak wygląda spójny świat gry. Ma nie być ciężko ani zbyt skomplikowanie: **komunikacja obrazem zamiast opisanej, sztywnej mechaniki, a gracz sam odkrywa, co dana rzecz znaczy.** Pierwszy szkic był w widoku z boku i Wojtek go odrzucił: **cała gra ma rzut izometryczny**, więc demo jest w silniku gry, z tą samą kamerą co reszta.

W świecie demo nie ma żadnego napisu. Tekst jest tylko na karcie startowej (sterowanie).

## Co się robi

| Klawisz | Co robi |
|---|---|
| WASD / strzałki | jazda |
| E / spacja | działanie (podpięcie kabla, sen); **przytrzymanie przy zimowisku = dłuższy sen** |
| M | dźwięk |

Na telefonie są przyciski na ekranie.

1. Wolt budzi się przy zimowisku (po lewej). Linia słupów prowadzi w prawo do domu na palach.
2. Przy ostatnim słupie wisi zerwany kabel (pulsujący pierścień). E go podpina: zapala się lampa i okno.
3. Przy zimowisku E usypia. Każda kreska to rok, przytrzymanie dodaje kolejne.
4. Po przebudzeniu warto wrócić do domu i zobaczyć, co się zmieniło.

## Co jest do odkrycia (zdradza wszystko)

| Znak | Co znaczy | Skąd w dokumentach |
|---|---|---|
| Światło w oknie | ktoś tam żyje; trzy dalekie okna na wzgórzach gasną same z latami | [SWIAT.md: Spoiwa](SWIAT.md#spoiwa-pomysły-które-sklejają-to-co-już-jest-propozycja-agenta-2026-11-11-na-pytanie-wojtka-jakieś-jeszcze-pomysły-tak-by-było-spójnie) |
| Akord w tle | jeden ton na każde żywe światło; gdy okno gaśnie, ton znika | radio i milknące głosy |
| Rdzewiejący kabel | po 9 latach bez opieki znów pęka | utrzymanie, rdza |
| Kreski na kamieniu przy zimowisku | lata, które minęły | hibernacja, freeze |
| Dary pod zimowiskiem | ludzie pamiętają; im dłuższy sen, tym mniej darów | raport po śnie jako rzeczy |
| Ten sam kadr przy domu | kamera zawsze staje tak samo, więc widać różnicę: dziecko rośnie, ktoś siada na ławce, ławka pustoszeje | ten sam kadr |
| Ludzie chowają się, potem zostają, potem wychodzą naprzeciw i machają | pamięć osady o Wolcie | domostwa i mikrokult |
| Rysunek dziecka, znak, piktogram na ścianie | pokolenia; legenda się upraszcza | symbol Wolta |
| Jeleń | podejdzie, jeśli postać przy nim spokojnie; rośnie mu poroże, siwieje, zostaje po nim poroże w trawie | jeleń jako zegar |
| Trawa wokół lampy, wydeptana ścieżka | skutki, które zostają | długofalowe skutki |
| Iskry z każdego światła płyną w stronę urwiska, popiół leci stamtąd, a gdy poświata pulsuje, światła przygasają | **tajemnica (propozycja):** coś za urwiskiem wciąż pije prąd ze świata (Q-2) | jedna tajemnica |

## Liczby (propozycja, `TUNE` w `src/returns/sim/returns.ts`)

- kabel wytrzymuje 9 lat; sen to 0,55 s na rok, najwyżej 40 lat naraz,
- pamięć osady: +0,45 za naprawę, +0,2 za odwiedziny przy świetle, −0,02 na rok,
- symbol: rysunek po pierwszej naprawie, znak po 10 latach pamięci, piktogram po 22,
- po 10 latach ciemności dorośli zaczynają odchodzić; światło wydłuża życie, ciemność skraca,
- jeleń żyje 15 lat; dalekie okna gasną w latach 9, 19 i 33.

## Kod

- `src/returns/sim/returns.ts`: cała logika bez Three.js (rok po roku, ludzie, jeleń, pamięć, sen). Testy: `test/returns.test.ts`.
- `src/returns/render/returnsView.ts`: scena o zmierzchu, kamera ortograficzna pod tym samym kątem co gra; Wolt to wspólny monocykl z `src/render/wolt.ts`.
- `src/returns/main.ts`: karta startowa, sterowanie, sen (ciemność i kreski), akord.
- `?lang=en` przełącza język karty startowej.

## Czego nie ma i co do sprawdzenia

- Ludzie, jeleń, dom i zimowisko są złożone z prostych brył jako ciemne sylwetki. Wojtek woli gotowe modele niż prymitywy, więc to miejsce do podmiany.
- Wolt nie zmienia tu ciała, więc pomysł „symbol pamięta stare ciało” nie jest pokazany.
- Do oceny Wojtka: czy znaki da się odczytać bez podpowiedzi, czy tempo snu jest dobre, czy tajemnica jest czytelna, a nie zbyt oczywista.
