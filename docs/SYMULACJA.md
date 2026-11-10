# Symulacja czasu gracza i pokoleń ludzi **[propozycja 2026-11-10, na prośbę Wojtka]**

**Interaktywnie:** [artefakt](https://claude.ai/artifact/B94yNTp53YP2DS8NPbrWui), kopia w repo: [symulacja.html](symulacja.html) (na Pages pod `/docs/symulacja.html`). Źródło artefaktu: `/mnt/project-files/symulacja/symulacja.html`. Przy zmianie liczb aktualizuj oba i ten plik.

**Prośba Wojtka (2026-11-10, sparafrazowane):** symulacja balansu od strony grania: ile procent czasu na budowanie, czekanie, zwiedzanie, interakcje, zagadki i kminę, jak to rozłożyć na oś gracza, z rozgałęzieniem (gracz wkręcił się w crafting albo czekanie, a wystarczyłoby, że zrobi troszeczkę i pójdzie dalej). Statystyki i rozplanowanie szczegółowe przyjdą później. Do tego cykl ludzi, który zaczyna się od ich pierwszego pojawienia się, z prostą historią życia i genealogią jako danymi do budowania interakcji.

Wszystkie liczby poniżej to propozycja do strojenia, a nie ustalenie.

## 1. Sześć rodzajów zajęć i docelowe proporcje

„Czekanie i sen” liczy **realne minuty gracza** (przygotowanie do freeze, raport po przebudzeniu, przewijanie nocy), a nie lata świata. Freeze kosztuje minuty, a zabiera lata.

| Zajęcie | Co to jest | Udział (fabuła) | Sufit nagrody |
|---|---|---|---|
| Eksploracja i jazda | odkrywanie, trasy żaglowozem, teren, pogoda | ok. 32% | ×2,0 |
| Ludzie i misje | rozmowy, słownik, dostawy, naprawy dla domostw, radio | ok. 17% | ×2,0 |
| Utrzymanie | rdza, oliwienie, kable, objazd sieci, energia | ok. 15% | ×1,5 |
| Budowa i adaptacja | bazy, przeróbki znalezisk, żaglowóz, linie (bez craftingu od zera) | ok. 14% | ×1,6 |
| Zagadki i kmina | jak przejechać, jak zasilić, notatki, odkodowywanie | ok. 15% | ×1,6 |
| Czekanie i sen | freeze, raport, noc, obliczenia w tle | ok. 7% | ×1,5 |

Wzorcowy gracz: ok. **44 h fabuły** (akty 1–5) i ok. 12 h gry po fabule.

Zasady:

1. **Rdzeń to ruch i ludzie:** eksploracja z ludźmi to ok. połowa czasu.
2. **Każde zajęcie ma sufit nagrody** (kolumna wyżej, jako wielokrotność normy opcjonalnej). Ponad sufitem gracz może dalej grać, ale to już „piaskownica”: gra łagodnie wypycha dalej, nie zabrania. Przykłady: magazyn pełny, a kolejny plan wymaga części z nowego obszaru; zyski snu się nasyciły i antena budzi wezwaniem z radia; korpus pisma za mały, potrzeba nowych notatek.
3. **Czekanie nigdy nie dominuje** (sufit ×1,5, zgodnie z decyzją, że inkrementalność to dodatek). Śpioch zyskuje lata świata, nie godziny gry.
4. **Minimum wystarcza:** gracz „przelotny”, który robi tylko to, co konieczne, i trochę więcej, kończy fabułę w ok. 28 h.
5. **Rytm sesji:** 15–30 s jazdy między rzeczami, co 10–20 min coś nowego, co godzinę mały cel.

## 2. Akty w czasie

| Akt | Konieczne h | Opcjonalne h | Lata świata (wzorcowo) | Akcent |
|---|---|---|---|---|
| 1 Przebudzenie | 2,5 | 2,5 | 1 | kmina, utrzymanie (energia), mało ludzi |
| 2 Ludzie | 4 | 4 | 1 | ludzie i słownik |
| 3 Sieć | 5,5 | 6 | 3 | budowa linii, utrzymanie |
| 4 Kopuła | 5,5 | 6 | 3 | budowa, pierwszy dłuższy sen |
| 5 Zorza | 4,5 | 4 | 3 | kmina (laboratorium, pismo) |
| Po fabule | 0 | 12+ | 25+ | sieć, domostwa, pokolenia |

Model: godziny zajęcia w akcie = konieczne × udział + opcjonalne × udział × min(styl gracza, sufit). Nadwyżka ponad sufit liczy się jako piaskownica (35% wartości). Lata świata w akcie = lata wzorcowe × max(0,8; mnożnik czekania^0,8).

## 3. Style gry i gałęzie

Styl można ustawić osobno w każdym akcie. To jest gałąź: ten sam gracz może przelecieć Przebudzenie, wkręcić się w budowę w Sieci i znowu pójść dalej.

| Styl | Mnożniki (eks / lud / utr / bud / kmi / cze) |
|---|---|
| Wzorcowy | 1 / 1 / 1 / 1 / 1 / 1 |
| Wędrowiec | 1,8 / 0,8 / 0,7 / 0,6 / 1 / 0,7 |
| Majsterkowicz | 0,7 / 0,6 / 1,5 / 3 / 1 / 1 |
| Śpioch (ciułacz) | 0,7 / 0,5 / 0,8 / 1,3 / 0,8 / 3 |
| Opiekun | 1 / 2 / 1,2 / 0,8 / 0,8 / 0,6 |
| Przelotny | 0,3 / 0,3 / 0,25 / 0,25 / 0,3 / 0,25 |

Wyniki modelu (ludzie: średnia z 20 ziaren, 5 osad):

| Scenariusz | Fabuła h | Czekanie | Lata fabuły | Lata razem | Żywi na końcu | Puste osady | Mikrokult |
|---|---|---|---|---|---|---|---|
| Wzorcowy | 44,5 | 7% | 11 | 36 | 66 | 0,1 | 0,8 |
| Przelotny | 28,3 | 7% | 9 | 29 | 67 | 0,1 | 0,3 |
| Wkręcił się w budowę w Sieci, potem dalej | 45,1 | 7% | 11 | 36 | 63 | 0,1 | 0,7 |
| Majsterkowicz od początku | 45,9 | 7% | 11 | 36 | 62 | 0,1 | 0,5 |
| Wkręcił się w czekanie po Kopule | 43,9 | 10% | 15 | 75 | 29 | 0,7 | 0 |
| Śpioch od drugiej zimy | 41,7 | 12% | 25 | 85 | 18 | 1,2 | 0 |
| Wędrowiec | 46,8 | 5% | 9 | 29 | 67 | 0,1 | 1,0 |
| Opiekun ludzi | 47,2 | 5% | 9 | 29 | 71 | 0 | 2,5 |

Wnioski: wkręcenie się w budowę kosztuje tylko godzinę (sufit działa), a wkręcenie się w czekanie kosztuje ludzi i osady, czyli dokładnie to, co mówi [Zakończenie bez ludzi](SWIAT.md#pomysł-w-rozważaniu-zakończenie-bez-ludzi-do-decyzji-wojtek-2026-11-09). Mikrokult rodzi się tam, gdzie Wolt wraca często, a nie tam, gdzie gracz gra najdłużej.

## 4. Pokolenia ludzi

**Zegar pokoleń osady rusza w chwili, gdy osada pojawia się w grze** (pierwszy kontakt), a nie od początku gry. Tak odczytałem „cykl ludzi zaczyna się od momentu ich pierwszego powstania”. Wcześniejsze pokolenia generują się wtedy jako przeszłość: dziadkowie z datami śmierci, znani tylko z opowieści. Dzięki temu świat nie musi liczyć ludzi, których gracz jeszcze nie spotkał.

Osady w modelu i pierwszy kontakt: Dom na palach (Zatopiona Wieś, akt 1), Szkoła (akt 2), Rozdzielnia (akt 3), Kopuła (akt 4), Klasztor (akt 5). Każda ma rody, role, typowe prośby i początkowy stosunek do Wolta (Szkoła ciekawość, Rozdzielnia chciwość, Klasztor strach, Kopuła nadzieja, Dom na palach nieufność).

Przy kontakcie: 2–4 rodziny (para 24–52 lat, ich rodzice już zmarli, 0–4 dzieci), czasem najstarszy mieszkaniec. Potem rok po roku:

- **Wizyty Wolta** wynikają z godzin „Ludzie i misje” w każdym akcie (ok. 1,6 wizyty na godzinę), losowo między znane osady. Wizyta to konkretna pomoc (naprawa pompy, światło w klasie, zasilenie Szklarni).
- **Śmierci:** ryzyko zależne od wieku, złe zimy (ok. 18% lat), pomoc Wolta obniża ryzyko na 3 lata, a **ukryte wyczerpywanie** rośnie z każdym rokiem (część zgonów to „nikt nie wie”). To miejsce na odpowiedź, dlaczego ludzi ubywa.
- **Pary i narodziny:** płodność spada z latami. Gdy brak partnera w osadzie, ktoś przenosi się z innej osady. Samotni czasem „odchodzą w popiół”.
- **Pamięć o Wolcie:** pamięć zbiorowa osady rośnie z wizytami i maleje z czasem. Dziecko dziedziczy stosunek po rodzicach i po pamięci osady. Osoba pamięta Wolta: osobiście, z opowieści rodziców, z legendy i znaku na ścianie, albo wcale.
- **Symbol Wolta:** rysunek dziecka, potem znak na drzwiach (ok. 18 lat dobrej pamięci), potem piktogram (ok. 40 lat). Status osady: mikrokult, przychylni, obojętni, nieufni, opustoszała.

## 5. Dane do interakcji (JSON)

Artefakt ma przycisk „Kopiuj JSON”. Kształt:

- **osada:** `k`, `n`, `gdzie`, `kontakt` (rok startu zegara), `wizyty[]`, `pamiec` (0..1), `symbol` (0–3), `status`, `zywi`, `kron[]` (`rok`, `typ`: kontakt, wizyta, narodziny, smierc, odejscie, symbol, koniec; `opis`).
- **osoba:** `id`, `imie`, `rod`, `plec`, `ur`, `zm`, `przyczyna`, `osada`, `rola`, `rodzice[]`, `partner`, `dzieci[]`, `cechy[]`, `spotkania[]` (lata, gdy widziała Wolta), `pamiec`, `stosunek` (-1..1), `wydarzenia[]`.

Z tego później wynikają kwestie dialogowe („mama mówiła, że naprawiłeś nam pompę”), dary przy drzwiach, prośby przez radio i to, kogo Wolt już nie zastanie.

## Otwarte

- Czy liczby godzin i proporcje pasują Wojtkowi (szczególnie 44 h fabuły i ok. 7% czekania).
- Czy zegar pokoleń od pierwszego kontaktu to dobre odczytanie.
- Ile osad i domostw ma być w grze naprawdę (model ma 5).
