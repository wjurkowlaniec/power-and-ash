# Credits

Models used in the game. All are CC0 1.0 (public domain), so crediting is not required, but we credit the authors gladly.

| Pack | Author | Licence | Used for |
|---|---|---|---|
| [Stylized Nature MegaKit](https://quaternius.itch.io/stylized-nature-megakit) (Standard) | [Quaternius](https://quaternius.com) | CC0 1.0 | rocks, pebbles, dead trees, dry grass |
| [Modular Sci-Fi MegaKit](https://quaternius.itch.io/modular-sci-fi-megakit) (Standard) | [Quaternius](https://quaternius.com) | CC0 1.0 | crates, station props |
| [Downtown City MegaKit](https://quaternius.itch.io/downtown-city-megakit) (Standard) | [Quaternius](https://quaternius.com) | CC0 1.0 | ruined buildings beyond the map, bollards, AC unit |
| [KayKit Resource Bits](https://kaylousberg.itch.io/resource-bits) 1.0 | [Kay Lousberg](https://www.kaylousberg.com) | CC0 1.0 | scrap piles, copper/iron nuggets, barrels, pallets |

The models in `src/assets/models/` are converted copies. `tools/pack-models.mjs` keeps only the base colour texture, resizes it to 256 px WebP, simplifies the heavy meshes and compresses them with meshopt. In the game, every material is also partly desaturated toward ash (`src/render/assets.ts`).

Everything else (Wolt, the land yacht, the station, the sail and its "Zefir" advert, the sound) is made procedurally in code.
