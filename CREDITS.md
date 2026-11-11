# Credits

Models used in the game. All are CC0 1.0 (public domain), so crediting is not required, but we credit the authors gladly.

| Pack | Author | Licence | Used for |
|---|---|---|---|
| [Stylized Nature MegaKit](https://quaternius.itch.io/stylized-nature-megakit) (Standard) | [Quaternius](https://quaternius.com) | CC0 1.0 | rocks, pebbles, dead trees, dry grass |
| [Modular Sci-Fi MegaKit](https://quaternius.itch.io/modular-sci-fi-megakit) (Standard) | [Quaternius](https://quaternius.com) | CC0 1.0 | crates, station props |
| [Downtown City MegaKit](https://quaternius.itch.io/downtown-city-megakit) (Standard) | [Quaternius](https://quaternius.com) | CC0 1.0 | ruined buildings beyond the map, bollards, AC unit |
| [KayKit Space Base Bits](https://github.com/KayKit-Game-Assets/KayKit-Space-Base-Bits-1.0) | [Kay Lousberg](https://www.kaylousberg.com) | CC0 1.0 | crafting demo: solar panel, wind turbines, cart, recycler, energy store, cradle, workshop |
| [KayKit Furniture Bits](https://github.com/KayKit-Game-Assets/KayKit-Furniture-Bits-1.0) | [Kay Lousberg](https://www.kaylousberg.com) | CC0 1.0 | crafting demo: workbench, shelf, cabinet; game Scene 2: chair, couch, cabinet, lamp, rug |
| [KayKit City Builder Bits](https://github.com/KayKit-Game-Assets/KayKit-City-Builder-Bits-1.0) | [Kay Lousberg](https://www.kaylousberg.com) | CC0 1.0 | crafting demo: car wrecks, dumpster, street lights, water tower |
| [KayKit Halloween Bits](https://github.com/KayKit-Game-Assets/KayKit-Halloween-Bits-1.0) | [Kay Lousberg](https://www.kaylousberg.com) | CC0 1.0 | game Scene 2: iron fence, spruce trees, flagstones, bench |
| [KayKit Prototype Bits](https://github.com/KayKit-Game-Assets/KayKit-Prototype-Bits-1.0) | [Kay Lousberg](https://www.kaylousberg.com) | CC0 1.0 | game Scene 2: pallet, barrel, boxes, cans |
| [KayKit Resource Bits](https://kaylousberg.itch.io/resource-bits) 1.0 | [Kay Lousberg](https://www.kaylousberg.com) | CC0 1.0 | scrap piles, copper/iron nuggets, barrels, pallets |

The models in `src/assets/models/` are converted copies. `tools/pack-models.mjs` keeps only the base colour texture, resizes it to 256 px WebP, simplifies the heavy meshes and compresses them with meshopt. The crafting demo's models are in `src/assets/craft/` (`tools/pack-craft-models.mjs`); Scene 2 of the game reuses some of them and adds its own in `src/assets/station/` (`tools/pack-station-models.mjs`). In the game, every material is also partly desaturated toward ash (`src/render/assets.ts`).

Everything else (Wolt, the land yacht, the station, the sail and its "Zefir" advert, the sound) is made procedurally in code.
