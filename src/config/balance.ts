export const BALANCE = {
  startMoney: 200,

  managerSpeed: 230, // px/s
  customerSpeed: 120, // px/s

  spawnIntervalMinMs: 3500,
  spawnIntervalMaxMs: 7000,
  shoppingListMin: 1,
  shoppingListMax: 3,

  pickTimeMs: 900,
  payTimeMs: 2400,
  restockTimeMs: 1500,

  maxQueueLength: 5,

  patienceMinS: 16,
  patienceMaxS: 26,

  ratingGainPerSale: 0.5,
  ratingLossPerLostCustomer: 2,

  dayDurationMs: 120_000,
  openHour: 8,
  closeHour: 20,
  /** Hur långt in på dagen leveransen anländer (andel av öppettiden). */
  deliveryArrivalFraction: 0.15,
  unloadTimeMs: 1400,
  /** Kunder som är kvar så här länge efter stängning skickas hem. */
  closingGraceMs: 40_000,

  /** Effekter av uppgraderingar. */
  cardPayTimeMultiplier: 0.55,
  /** Daglig hyra för kortterminalen (dras varje kväll när den ägs). */
  cardTerminalDailyFee: 20,
  /** Större hyllor: varje hylla delas i så här många separata lådor. */
  shelfBoxCount: 2,
  adSpawnBoost: 1.6,
  biggerShopSpawnMultiplier: 1.35,
  biggerShopQueueBonus: 2,

  /** Personal. */
  cashierWage: 60,
  restockerWage: 50,
  staffRestockCheckMs: 1500,

  /** Lager: grundplats och hur mycket varje utbyggnad ("Extra lagerutrymme") ger. */
  baseStorageCapacity: 40,
  storageExpansionAmount: 30,
  /** Hur många lagerutbyggnader som får köpas. */
  maxStorageExpansions: 6,

  /** Kassor: hur många det får finnas totalt (huvudkassan inräknad). */
  maxCheckouts: 3,

  /**
   * Personalens raster. Alla anställda (kassörer och påfyllare) tar två raster
   * per dag – en kort och en lång – då de lämnar sin station. Tiderna anges som
   * andel av öppettiden; varje anställd förskjuts med `staffBreakStaggerMs` så
   * att flera inte går på rast exakt samtidigt.
   */
  staffShortBreakAtFraction: 0.3,
  staffLongBreakAtFraction: 0.62,
  staffShortBreakMs: 8000,
  staffLongBreakMs: 15_000,
  staffBreakStaggerMs: 4500,

  /** Paketombud. */
  parcelFee: 18,
  parcelSpawnMinMs: 22_000,
  parcelSpawnMaxMs: 38_000,
  parcelHandleTimeMs: 1300,
  parcelQueueMax: 4,

  /** Adaptiv svårighet: mjuka justeringar varje kväll. */
  difficulty: {
    sampleIntervalMs: 2000,
    /** Spelaren KÄMPAR: över dessa trösklar lättar spelet. */
    strugglingLostShare: 0.35,
    strugglingQueueAvg: 3.5,
    /** Spelaren HAR DET LÄTT: under dessa trösklar (och med vinst) skärps spelet. */
    cruisingLostShare: 0.1,
    cruisingQueueAvg: 1.2,
    /** Hög andel tid med tomma hyllor ger en påfyllningshint. */
    emptyShelfHintShare: 0.3,
    spawnStep: 0.1,
    patienceStep: 0.08,
    spawnRateMin: 0.6,
    spawnRateMax: 2.2,
    patienceModMin: 0.8,
    patienceModMax: 1.5,
  },

  rentPerDay: 80,
  emergencyLoanAmount: 300,
  /** Antal kvällar i rad med negativt saldo innan konkurs. */
  maxDebtEvenings: 3,
};
