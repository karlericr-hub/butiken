export const BALANCE = {
  startMoney: 200,

  managerSpeed: 230, // px/s
  customerSpeed: 120, // px/s

  spawnIntervalMinMs: 3500,
  spawnIntervalMaxMs: 7000,
  shoppingListMin: 1,
  shoppingListMax: 3,

  pickTimeMs: 900,
  payTimeMs: 1600,
  restockTimeMs: 900,

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

  rentPerDay: 80,
  emergencyLoanAmount: 300,
  /** Antal kvällar i rad med negativt saldo innan konkurs. */
  maxDebtEvenings: 3,
};
