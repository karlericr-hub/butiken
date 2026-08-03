# Butiksspelet – Byggspecifikation

Ett webbaserat 2D-isometriskt butiksspel för 8–12-åringar (men roligt även för vuxna).
Du är butiksföreståndare och ska driva och utveckla en butik – och tjäna så mycket pengar
som möjligt utan att gå i konkurs.

---

## 1. Översikt

| | |
|---|---|
| **Genre** | Tempo-/tidshanteringsspel (management) |
| **Målgrupp** | 8–12 år, spelbart även av vuxna |
| **Vy** | 2D isometrisk (butik sedd snett ovanifrån) |
| **Plattform** | Webb, dator med mus. Publiceras på GitHub Pages |
| **Styrning** | Peka-och-klicka: klicka på en station → avataren går dit och agerar |
| **Svårighet** | En enda adaptiv nivå (se avsnitt 6) |
| **Backend** | Ingen. Rent statiskt spel, sparning i `localStorage` |

**Kärnidé:** Föreståndaren kan bara göra en sak i taget och måste fysiskt röra sig
mellan kassa, hyllor och paketdisk. Utmaningen är att hinna med allt.

---

## 2. Teknisk stack & projektstruktur

- **Motor:** Phaser (senaste stabila versionen)
- **Språk:** TypeScript
- **Byggverktyg:** Vite
- **Deploy:** GitHub Actions → GitHub Pages
- **Grafik:** CC0-tillgångar från Kenney.nl (isometriska butiks-, karaktärs- och UI-paket) + egen enhetlig färgpalett
- **Ljud:** CC0-effekter och musik (Kenney audio / freesound)

```
/src
  /scenes        BootScene, PreloadScene, MenuScene, GameScene, EveningScene, GameOverScene
  /systems       EconomySystem, CustomerSystem, InventorySystem, QueueSystem,
                 StaffSystem, UpgradeSystem, ParcelSystem, TimeSystem,
                 DifficultySystem, SaveSystem
  /entities      Manager, Customer, Shelf, Checkout, ParcelDesk, StaffMember
  /config        products.ts, upgrades.ts, customerTypes.ts, balance.ts
  /ui            HUD, EveningPanel, ShopMenu, Tooltip
  /state         GameState.ts  (central speltillstånd)
  /assets        (sprites, atlas, ljud)
main.ts
```

Datadrivet: allt innehåll (varor, uppgraderingar, kundtyper, balanssiffror) ligger i
`/config` så att balansering kan justeras utan att röra logiken.

---

## 3. Spelupplägg

Spelet är uppdelat i **dagar**. Varje dag har två faser:

**A. Öppettid (actionfas, tidsbegränsad)**
Kunder kommer in slumpvis, plockar varor, ställer sig i kö. Spelaren springer runt och:
- tar betalt i kassan
- fyller på tomma hyllor
- tar emot varuleveranser och ställer ut dem
- hanterar paket (om paketombud)

Blir kön för lång lämnar kunderna längst bak → förlorad försäljning + sänkt betyg.

**B. Kvällsfas (planering, ingen tidspress)**
- Dagssammanfattning: intäkter, kostnader, vinst, kunder betjänade/förlorade, betyg
- Betala hyra och löner
- Beställa varor inför nästa dag
- Köpa uppgraderingar

Denna lugna paus mellan hektiska pass är viktig för yngre spelare.

---

## 4. Kärnmekaniker i detalj

**Kunder**
- Spawnar slumpvis under öppettid (takt styrs av DifficultySystem + butiksstorlek)
- Har en inköpslista, går till hyllorna, plockar det som finns
- Ställer sig sedan i kö vid kassan
- Har **tålamod** (nedräkning i kön); vid noll lämnar de utan att köpa
- Humör visas med pratbubbla: nöjd → otålig → arg
- Kundtyper: vanlig, stressad (kort tålamod), stamkund (mer köp, tålmodig), paketkund

**Kö**
- FIFO-kö vid varje kassa
- Max-längd; kunder bakom max lämnar direkt
- Fler/snabbare kassor (uppgradering) kortar kön

**Kassa**
- Spelaren klickar på kassan när en kund väntar → betalning tar X sekunder
- Kontantkassa är långsam; **kortterminal** kortar tiden; **självutcheckning** låter kunder betala själva

**Lager & påfyllning**
- Varje vara har hyllkapacitet och aktuellt lager
- Tomma hyllor → kunder kan inte köpa varan → missad försäljning
- Beställ varor i kvällsfasen → leverans anländer under nästa dag → spelaren klickar för att ställa ut den

**Paketombud** (uppgradering)
- Paket anländer i pulsar; kunder kommer för att hämta/lämna
- Enkelt hanteringsmoment vid paketdisken
- Ger stadig grundintäkt men tar tid från kassan

**Personal** (uppgradering)
- Anställda sköter automatiskt en station (kassör eller påfyllare)
- Kostar dagslön → fast kostnad som pressar ekonomin

---

## 5. Progression & uppgraderingar

Låses upp i takt med butikens intäkter. Ungefärlig ordning och effekt:

| Uppgradering | Effekt | Kostnad (relativ) |
|---|---|---|
| Kortterminal | Snabbare betalning | Låg |
| Fler varutyper | Högre försäljning, mer att sköta | Låg–medel |
| Bättre hyllor | Snabbare påfyllning, större kapacitet | Medel |
| Anställd (kassör/påfyllare) | Automatiserar en station, dagslön | Medel |
| Paketombud | Regelbunden intäkt + hantering | Medel |
| Reklam/marknadsföring | Tillfälligt ökat kundflöde | Medel |
| Kyldisk / kaffehörna | Ny varukategori, mer intäkt | Medel–hög |
| Självutcheckning | Kunder betalar själva | Hög |
| Expandera butiken | Fler kunder + mer hyllplats | Hög |
| Stamkundsprogram | Fler återkommande kunder | Hög |

Uppgraderingar kan ha beroenden (`requires`) så att spelet öppnar sig gradvis.

---

## 6. Adaptiv svårighetsgrad

En enda nivå som osynligt anpassar sig, så att både barn och vuxna hålls i flow.

**Två lager:**

1. **Strukturell svårighet (av sig själv):** Butikens tillväxt är svårighetskurvan.
   Fler varor, personal, paket och expansion gör spelet mer krävande. Vuxna växer
   snabbt och möter snart en stor, hektisk butik; barn stannar längre i en liten,
   lugn affär.

2. **Adaptivt gummiband (löpande finjustering):** Systemet läser hur spelaren klarar
   sig och justerar mjukt. Håll justeringarna små och gradvisa så det aldrig känns som fusk.

**Signaler att mäta (glidande medel):**
- genomsnittlig kölängd
- andel förlorade kunder
- kassatrend (växer/krymper saldot)
- tomma-hyllor-tid
- spelarens idle-tid

**Justering:**
```
om spelaren KÄMPAR (lång kö, förlorade kunder, sjunkande saldo):
    ↓ kundtakt något
    ↑ kundtålamod något
    visa vänlig hint ("Glöm inte fylla på mjölken!")

om spelaren HAR DET FÖR LÄTT (kort kö, växande saldo, få förluster):
    ↑ kundtakt
    fler krävande kunder (stressade)
    enstaka "rusning" som utmaning
```

Alla trösklar och steg ligger i `config/balance.ts`.

---

## 7. Ekonomimodell

**Intäkter:** varuförsäljning, paketombud, stamkunder.
**Rörliga kostnader:** inköp av varor.
**Fasta kostnader (per dag/vecka):** hyra, el, löner.

**Konkurs:** Om saldot är negativt för länge → varning → game over. För att vara snäll
mot yngre spelare: en tydlig varningsdag och ett litet buffert-lån-erbjudande innan
konkurs, samt ett **butiksbetyg** som mjukare feedback vid tapp (istället för direkt straff).

---

## 8. Grafik & ljud

- **Stil:** Isometrisk, ljus och mysig, enhetlig färgpalett. Rena former, tydliga ikoner.
- **Tillgångar:** Kenney.nl (CC0) för butiksinredning, hyllor, karaktärer, mat/varor, UI.
- **Animation:** Phaser tweens för gång, plockande, kassaljus, myntregn.
- **Känsla ("juice"):** myntljud + partiklar vid varje köp, plingande kassa, glada
  pratbubblor. Detta gör spelet tillfredsställande.
- **Ljud:** lugn bakgrundsmusik, "cha-ching" vid försäljning, diskret larm vid tom hylla.
- **Prestanda:** texture-atlas + object-pooling för kunder (håller det smidigt vid kö).

---

## 9. UI/UX

- **HUD (alltid synlig):** pengar, dag/tid, butiksbetyg, aktuell kö.
- **Kvällspanel:** sammanfattning + knappar för beställning och uppgraderingar.
- **Tooltips** som förklarar varje uppgradering.
- Stora, tydliga knappar och ikoner (barnvänligt), men snygg och stilren layout.
- Minimalt med text – förlita dig på ikoner, färg och humörsbubblor.

---

## 10. Arkitektur – datamodeller (exempel)

```typescript
interface Product {
  id: string;
  name: string;
  category: 'basvara' | 'kyld' | 'godis' | 'frukt' | 'paket';
  buyPrice: number;        // inköpspris per enhet
  sellPrice: number;       // försäljningspris per enhet
  shelfCapacity: number;   // max på hyllan
  currentStock: number;
  unlockLevel: number;
}

interface Upgrade {
  id: string;
  name: string;
  description: string;
  cost: number;
  requires?: string[];
  apply: (state: GameState) => void;
}

interface Customer {
  id: string;
  type: 'vanlig' | 'stressad' | 'stamkund' | 'paket';
  patience: number;        // sekunder i kö innan de lämnar
  shoppingList: { productId: string; qty: number }[];
  state: 'browsing' | 'queuing' | 'paying' | 'leaving';
  mood: 'happy' | 'impatient' | 'angry';
}

interface GameState {
  day: number;
  money: number;
  rating: number;          // butiksbetyg 0–100
  products: Product[];
  upgrades: string[];      // köpta uppgraderingar
  staff: StaffMember[];
  isParcelAgent: boolean;
  difficulty: {            // löpande adaptiva värden
    spawnRate: number;
    patienceModifier: number;
  };
  stats: {
    servedToday: number;
    lostToday: number;
    revenueToday: number;
    costsToday: number;
  };
}
```

---

## 11. Sparning

- Serialisera `GameState` till JSON i `localStorage`.
- Autospara i slutet av varje dag (kvällsfasen).
- "Fortsätt"-knapp i menyn om ett sparat spel finns.
- (Valfritt senare: online-topplista via en gratistjänst.)

---

## 12. Utvecklingsplan i faser

1. **MVP** – en butiksscen, 1–2 varor, kunder spawnar, manuell kassa, pengaräknare. Bevisa kärnloopen.
2. **Lager** – påfyllning, beställning, leverans.
3. **Kö** – kundtålamod, kunder som lämnar.
4. **Dagscykel** – öppettid + kvällssammanfattning + fasta kostnader.
5. **Uppgraderingar** – system + kortterminal först.
6. **Utbyggnad** – personal, paketombud, expansion.
7. **Polish** – grafik, ljud, partiklar, animationer.
8. **Adaptiv svårighet** – DifficultySystem + balansering.
9. **Sparning + deploy** – localStorage + GitHub Actions-pipeline.

Varje fas ska ge ett spelbart resultat.

---

## 13. Publicering (GitHub Pages)

- Vite-config: sätt `base: '/<reponamn>/'`.
- GitHub Actions-workflow: bygg med Vite → deploya `dist/` till GitHub Pages.
- Manuell eller push-triggad release (samma mönster som dina tidigare projekt).

---

## 14. Framtida idéer

- Säsonger/högtider med extra kundtryck och specialvaror.
- Fler butikstyper att låsa upp (blomsteraffär, godisbutik…).
- Enkla "händelser" (elavbrott, rusning, leveransförsening).
- Topplista online.
