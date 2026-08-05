# Grafik – tredjepartsassets

Spelets figurer, möbler och props är gjorda av **Kenney** (https://kenney.nl)
och licensierade under **CC0 1.0 Universal** (public domain). De får användas
fritt i både privata och kommersiella projekt, ingen attribution krävs – den
här filen finns ändå med som tack och spårbarhet.

## Använda paket

| Fil(er) i `char/`            | Paket                | Innehåll                    |
| ---------------------------- | -------------------- | --------------------------- |
| `*_idle.png`, `*_walk0-7.png`| Toon Characters 1    | Figurer med gångramar       |

| Fil(er) i `furniture/`       | Paket                | Innehåll                    |
| ---------------------------- | -------------------- | --------------------------- |
| `floor.png`                  | Furniture Kit        | Golv                        |
| `shelf.png`                  | Furniture Kit        | Bokhylla (butikshylla)      |
| `counter.png`                | Furniture Kit        | Diskbänk (kassa/paketdisk)  |
| `desk.png`                   | Furniture Kit        | Skrivbord                   |
| `register.png`               | Furniture Kit        | Skärm (kassaapparat)        |
| `box.png`, `boxOpen.png`     | Furniture Kit        | Kartonger (paket/leverans)  |
| `plant.png`                  | Furniture Kit        | Krukväxt                    |

| Fil                          | Paket                | Innehåll                    |
| ---------------------------- | -------------------- | --------------------------- |
| `coin.png`                   | Jumper Pack          | Guldmynt (myntregn)         |

De ursprungliga paketens `License.txt` finns bevarade som
`LICENSE_tooncharacters.txt` och `LICENSE_furniturekit.txt`.

## Programgenererad grafik

Skuggan under figurer, den fyrgradiga humör-smileyn (mood0–mood3) och
leveranspallen ritas fortfarande programmatiskt i `src/scenes/BootScene.ts` –
de har ingen ren motsvarighet i biblioteket och den fyrgradiga HappyOrNot-
skalan bärs tydligast av en egen färgkodad smiley.
