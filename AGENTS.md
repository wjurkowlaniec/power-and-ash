# AGENTS.md

Instrukcje dla agentów AI (i ludzi), którzy przejmują pracę nad **Popiół i Prąd**.

Pełne zasady pracy są w [CLAUDE.md](CLAUDE.md) i obowiązują każdego agenta, nie tylko Claude. Najkrótsza wersja:

1. **Najpierw czytaj dokumenty, nie zgaduj.** [README.md](README.md) → [docs/DECYZJE.md](docs/DECYZJE.md) (co ustalił Wojtek i kiedy) → [docs/ARCHITEKTURA.md](docs/ARCHITEKTURA.md) (repo, silnik, demo, build, deploy) → [docs/GRA.md](docs/GRA.md) (kod gry i stan scen), [docs/DEMO-WARSZTAT.md](docs/DEMO-WARSZTAT.md) (demo „Warsztat”) → [docs/SWIAT.md](docs/SWIAT.md), [docs/POCZATEK.md](docs/POCZATEK.md) i [docs/FABULA.md](docs/FABULA.md) (świat, fabuła, drzewko decyzji).
2. **Każda decyzja i myśl Wojtka trafia do repo**, może być sparafrazowana: wpis w [docs/DECYZJE.md](docs/DECYZJE.md) i w dokumencie, którego dotyczy. Pamięć rozmowy nie wystarcza.
3. **Każdy PR aktualizuje dokumentację, której dotyczy** (kod, architektura, sterowanie, świat).
4. **Każda zmiana idzie na GitHub Pages do testu:** PR, zielone CI (`npm test`, `npm run build`), squash-merge do `main`, deploy rusza sam.
5. **Logika bez Three.js i z testami, teksty przez `tr('pl', 'en')`**, wspólny silnik nie może zepsuć ani gry, ani tech demo.
6. Dokumenty, commity i PR-y po polsku, komentarze w kodzie po angielsku.
7. **Zgłoszenia testerów są w GitHub Issues** (etykiety `bug`, `pomysł`, `do-decyzji`, formularze w `.github/ISSUE_TEMPLATE/`). Poprawka błędu idzie w PR z `Fixes #numer`; pomysł trafia do dokumentów dopiero po decyzji Wojtka. Linki dla testerów utrzymuj w README, w sekcji „Jak testować” (nowa wersja albo scena na Pages = nowy wiersz).
