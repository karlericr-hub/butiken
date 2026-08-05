# Butiken 🛒

Ett webbaserat 2D-isometriskt butiksspel för 8–12-åringar (och vuxna!).
Du är butiksföreståndare: ta betalt i kassan, fyll på hyllorna, hantera
leveranser och paket – och bygg ut butiken utan att gå i konkurs.

Byggt med [Phaser](https://phaser.io), TypeScript och Vite enligt
[byggspecifikationen](Butiksspelet_Byggspecifikation.md).

## Spela

- **Klicka på kassan** för att ställa dig där och ta betalt
- **Klicka på en hylla** för att fylla på från lagret
- **Klicka på golvet** för att gå dit
- På kvällen: se dagens resultat, **beställ varor** och **köp uppgraderingar**
- Sparas automatiskt varje kväll – fortsätt där du slutade

## Utveckling

```bash
npm install
npm run dev      # dev-server
npm run build    # typkontroll + produktionsbygge till dist/
npm run preview  # kör det byggda spelet lokalt
```

Allt spelinnehåll (varor, uppgraderingar, balanssiffror) ligger i
`src/config/` och kan justeras utan att röra spellogiken.

## Grafik

Figurer, möbler och props är CC0-assets från [Kenney](https://kenney.nl)
(Toon Characters 1, Furniture Kit, Jumper Pack). Bilderna ligger i
`public/assets/kenney/` och kopplas till spelets texturnycklar via
manifestet `src/config/assets.ts`. Figurerna animeras med gångramar. Ett
fåtal enkla texturer (skugga, humör-smileys, leveranspall) genereras
fortfarande programmatiskt i `src/scenes/BootScene.ts`. Se
`public/assets/kenney/CREDITS.md` för fullständig attribution.

## Deploy

GitHub Actions bygger och deployar `dist/` till GitHub Pages vid push
till `main` (kräver att Pages är aktiverat med "GitHub Actions" som
källa under Settings → Pages).
