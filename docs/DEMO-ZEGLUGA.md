# Tech demo „Żegluga” (`/demo-sail/`)

Link: https://wjurkowlaniec.github.io/power-and-ash/demo-sail/ (po angielsku: dopisz `?lang=en`).

Poligon głównej rozgrywki: jazda Żaglowozem po różnym terenie. Wojtek (2026-11-10): żegluga ma być realistyczna i dawać dobre czucie, ma być jednym z zajęć, które gracz naprawdę robi i do których chce wracać: szkwały, cień wiatru za budynkami, różny teren pod kołami, przyjemnie, malowniczo, czasem trudno, z umiejętnością do złapania. Do tego intro, w którym wiatr i siły na żaglu są pokazane łagodnie, minimalnie, jak ręcznie rysowane.

![Przez wieś: bramki trasy, cień wiatrowy za domami](img/zegluga/wies.jpg)

## Co jest w demie

- **Mapa 400 × 400 m**: stara szosa (koła mkną, płozy szorują), solnisko (gładko i szybko, ale ślisko: w zakrętach zjeżdża bokiem), wydmy z sypkiego popiołu (koła grzęzną, płozy suną, pod górę i z góry), błotnisty strumień, wieś w ruinie ze żwirem, martwy las, wzgórza, linia słupów wzdłuż drogi. Za krawędzią teren podnosi się w wysokie wydmy.
- **Wiatr, który można czytać**: wieje z zachodu-północnego zachodu, powoli skręca i oddycha. Szkwały i flauty to plamy 12–35 m, które płyną z wiatrem, rosną i gasną. Na popiele szkwał widać jako ciemne, biegnące zmarszczki, a flautę i cień wiatrowy jako gładszy, jaśniejszy popiół. Smugi pyłu lecą z lokalnym wiatrem, więc za domami zwalniają i wirują. Chorągiewki bramek i proporczyk na maszcie pokazują wiatr w swoim miejscu.
- **Cień wiatrowy**: za domem, murem albo lasem wiatr siada na długość do ~10 ich wysokości, a na brzegach cienia szarpie i skręca. Gołe drzewa i kratownice słupów przepuszczają większość wiatru.
- **Trasy na czas**: pętla po solnisku, przez wieś, wydmy, martwy las. Pierwsza bramka włącza zegar, ostatnia go zatrzymuje, rekordy zapisują się w przeglądarce. Strzałka przy żaglowozie wskazuje następną bramkę.
- **Intro „Jak działa wiatr”**: pięć krótkich scen rysowanych ołówkiem na popielatym papierze, linie „drgają” jak w animacji rysowanej ręcznie: wiatr i szkwały, cień za domem, wiatr pozorny, siły na żaglu (siła żagla, ciąg, siła w bok, koła trzymają; łopotanie, w sam raz, przeciągnięcie), przechył (siła w bok wysoko, ciężar, oś obrotu, wychył Wolta). Liczby w scenach liczy ten sam model, którym jeździ żaglowóz. Pokazuje się po starcie, później pod klawiszem **I**.

![Intro: siły na żaglu](img/zegluga/intro-sily.jpg)

## Sterowanie

| Klawisz | Co robi |
|---|---|
| A / D (strzałki) | ster |
| W / S | wybierz / poluzuj szot (wyłącza Q-1) |
| F | Q-1 trymuje szot sam (i luzuje, gdy żaglowóz zaczyna się unosić) |
| Shift | Wolt wychyla się na nawietrzną (trzyma więcej) |
| Spacja | hamulec |
| R | koła ↔ płozy (tylko na postoju, ~2,5 s) |
| C | następna trasa (albo przyciski w panelu trasy) |
| T | trasa od nowa |
| V | siła wiatru: słaby, zwykły, mocny |
| I | intro |
| kółko myszy | zoom |
| H / M | ukryj pomoc / wycisz |

Linki: `?course=lake|village|dunes|forest` zaczyna na trasie, `?go` pomija kartę startową i intro, `?intro` otwiera od razu intro, `?debug` wystawia `window.sail` i `window.view`.

## Fizyka (src/sail/sim/landYacht.ts)

Czysty TS, testy w `test/sail.test.ts`.

- **Żagiel**: wiatr pozorny (rzeczywisty minus własna prędkość) trafia w żagiel pod kątem natarcia ustawionym szotem. Siła działa prostopadle do żagla (współczynnik `sailCn`: rośnie do kąta 0,3 rad, potem lekko spada; przy samym zera żagiel łopocze). Do przodu ciągnie tylko `sin(bom)` tej siły, reszta pcha w bok. Na półwietrze żaglowóz jedzie 2–2,5 razy szybciej niż wiatr, jak prawdziwe bojery.
- **Koła i płozy**: opór toczenia zależy od podłoża (koła: asfalt 0,015 g, sypki popiół 0,12 g; płozy odwrotnie), boczna przyczepność ma granicę, za nią żaglowóz zjeżdża bokiem (poślizg). Skręt przednim kołem, ale przy prędkości o zakręcie decyduje przyczepność: ostry skręt przy 15 m/s wypycha na zewnątrz.
- **Zbocza** ciągną w dół.
- **Przechył**: siła w bok działa wysoko (środek żagla), siła odśrodkowa na wysokości środka masy; trzyma ciężar na połowie rozstawu kół. Powyżej 1 nawietrzne koło się unosi (szybko i na krawędzi), za kątem wywrotki żaglowóz kładzie się na bok, a Wolt stawia go po ~3 s. Płozy (szerszy rozstaw) i wychył trzymają więcej. Uderzenie w przeszkodę szybciej niż 9 m/s też przewraca.
- **Q-1 trymuje** szot do najlepszego kąta, a gdy przechył rośnie, luzuje go szybciej, niż wybiera. Ręcznie da się jechać ostrzej (i ryzykowniej).

## Pliki

| Plik | Co robi |
|---|---|
| `src/sail/sim/terrain.ts` | mapa: wysokość, pola podłoży (`surfaceFields`, wspólne dla fizyki i shadera), przeszkody |
| `src/sail/sim/windField.ts` | pole wiatru: wiatr bazowy, szkwały i flauty, cień przeszkód z turbulencją |
| `src/sail/sim/landYacht.ts` | fizyka żaglowozu |
| `src/sail/sim/courses.ts` | trasy, bramki, pomiar czasu |
| `src/sail/sim/sailGame.ts` | całość: mapa, wiatr, żaglowóz, trasa, rekordy, statystyki |
| `src/sail/render/sailView.ts` | scena 3D: teren z shaderem (krawędzie podłoży z pól, szkwały na popiele, cień), smugi pyłu, bramki z chorągiewkami, kamera |
| `src/sail/render/yachtRig.ts` | żaglowóz 3D: wózek z warsztatu, oś z kołami albo płozy, maszt, żagiel z balonu, Wolt na pokładzie |
| `src/sail/intro.ts` | intro rysowane na płótnie 2D |
| `src/sail/rollSound.ts` | szum kół na podłożu, łopot żagla |
| `src/sail/main.ts`, `sail.css`, `demo-sail/index.html` | HUD, sterowanie, strona |

Żaglowóz używa części z demo „Warsztat” (`mastRig`, `runnerRig`, `balloonSailTexture` z `src/craft/render/yachtModels.ts`, model wózka `spacetruck_trailer`) i wspólnego silnika (`Sail`, `woltMonoModel`, `WoltAnimator`, `GroundFx`, `Sound`). W `loadCraftModels` doszedł opcjonalny filtr `only`, żeby to demo ładowało tylko wózek.

## Do sprawdzenia przez Wojtka

- Czy czucie jazdy jest dobre: prędkości (do ~70 km/h), jak łatwo się przewrócić, czy poślizg na solnisku nie jest za mocny.
- Czy szkwały są czytelne na popiele i czy smug pyłu nie jest za dużo.
- Czy mapa 400 m nie jest za mała przy tych prędkościach (łatwo ją powiększyć).
- Czy intro jest w dobrym tonie i czy ma być też w grze, czy tylko w demie.
