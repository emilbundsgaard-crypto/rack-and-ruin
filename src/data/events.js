// Random events. Some are pure modifiers with a duration, some stop the game
// and ask you a question. Weight is relative; minTier gates the big ones.
//
// mods (active for `days` game-days):
//   coolMult powerSupplyMult waterSupplyMult priceMult gridCostMult
//   wearMult computeMult uptimePenalty

export const EVENTS = [
  {
    id: 'heatwave', name: 'Heatwave', weight: 10, minTier: 0, days: 3.5, tone: 'bad',
    when: (s, d) => d.unitsTotal > 0,
    mods: { coolMult: 0.7 },
    text: 'Thirty-six degrees outside and the condensers are giving up. Cooling capacity is down 30% for a few days.',
  },
  {
    id: 'coldsnap', name: 'Cold snap', weight: 7, minTier: 1, days: 3, tone: 'good',
    when: (s, d) => d.unitsTotal > 0,
    mods: { coolMult: 1.35 },
    text: 'Freezing air outside means the economisers do the work for free. +35% cooling.',
  },
  {
    id: 'gridsag', name: 'Grid brownout', weight: 8, minTier: 1, days: 1.6, tone: 'bad',
    when: (s, d) => d.gridUsed > 0,
    mods: { powerSupplyMult: 0.62 },
    text: 'The utility is shedding load across the region. Your grid feed is cut to 62% until it clears.',
  },
  {
    id: 'pricespike', name: 'Spot price spike', weight: 9, minTier: 0, days: 2.5, tone: 'bad',
    when: (s, d) => d.gridUsed > 0,
    mods: { gridCostMult: 1.85 },
    text: 'Wholesale electricity has gone vertical. Grid power costs 1.85\u00d7 as much this week.',
  },
  {
    id: 'pricecrash', name: 'Negative spot prices', weight: 5, minTier: 2, days: 2, tone: 'good',
    when: (s, d) => d.gridUsed > 0,
    mods: { gridCostMult: 0.25 },
    text: 'Too much wind on the network. Electricity is almost free for two days.',
  },
  {
    id: 'drought', name: 'Drought restrictions', weight: 7, minTier: 2, days: 5, tone: 'bad',
    when: (s, d) => d.waterDemand > 0,
    mods: { waterSupplyMult: 0.55 },
    text: 'The municipality has cut non-domestic abstraction. Water supply down 45%.',
  },
  {
    id: 'watermain', name: 'Water main break', weight: 5, minTier: 1, days: 1.5, tone: 'bad',
    when: (s, d) => d.waterDemand > 0,
    mods: { waterSupplyMult: 0.42 },
    text: 'A contractor put a digger through the feeder. Water is down to a trickle while they dig it back up.',
  },
  {
    id: 'demand', name: 'Compute crunch', weight: 8, minTier: 1, days: 4, tone: 'good',
    when: (s, d) => d.computeSellable > 0,
    mods: { priceMult: 1.6 },
    text: 'Everyone wants capacity at once. Contract rates are up 60%.',
  },
  {
    id: 'glut', name: 'Capacity glut', weight: 6, minTier: 2, days: 4, tone: 'bad',
    when: (s, d) => s.contracts.active.length > 0,
    mods: { priceMult: 0.7 },
    text: 'Three competitors lit up new halls this month. Rates are down 30%.',
  },
  {
    id: 'dust', name: 'Filter contamination', weight: 6, minTier: 1, days: 4, tone: 'bad',
    when: (s, d) => d.unitsTotal > 0,
    mods: { wearMult: 1.8, coolMult: 0.9 },
    text: 'Construction dust in the intakes. Hardware wears 80% faster until the filters are swapped.',
  },
  {
    id: 'firmware', name: 'Firmware regression', weight: 6, minTier: 2, days: 2.5, tone: 'bad',
    when: (s, d) => d.computeTotal > 0,
    mods: { computeMult: 0.82 },
    text: 'A vendor firmware update tanked performance. 18% of your compute is gone until it is rolled back.',
  },
  {
    id: 'optimise', name: 'Kernel breakthrough', weight: 5, minTier: 3, days: 5, tone: 'good',
    when: (s, d) => d.computeTotal > 0,
    mods: { computeMult: 1.3 },
    text: 'One of your engineers rewrote the hot loop. +30% compute while it holds.',
  },
  {
    id: 'audit', name: 'Regulatory inspection', weight: 5, minTier: 3, days: 3, tone: 'neutral',
    when: (s, d) => d.unitsTotal > 0,
    mods: {},
    inspect: true,
    text: 'An inspector is on site for three days. Keep temperatures under control or expect a fine.',
  },

  // ------------------------------------------------------------- decisions
  {
    id: 'poach', name: 'Talent poaching', weight: 6, minTier: 2, tone: 'neutral', choice: true,
    when: (s) => (s.staff.tech || 0) >= 2,
    text: 'A competitor is offering your senior technicians 40% more. They are waiting for your answer.',
    options: [
      { label: 'Match the offer', hint: 'Costs 6 days of total salary', effect: 'poach_pay' },
      { label: 'Let them walk', hint: 'Lose 2 technicians', effect: 'poach_lose' },
    ],
  },
  {
    id: 'ransom', name: 'Ransomware', weight: 6, minTier: 3, tone: 'bad', choice: true,
    when: (s, d) => d.computeTotal > 0 && s.money > 0,
    text: 'Something is encrypting your management plane. There is a countdown and a wallet address.',
    options: [
      { label: 'Pay quietly', hint: 'Costs 4% of your cash', effect: 'ransom_pay' },
      { label: 'Rebuild from backup', hint: '2 days at 45% output, −6 reputation', effect: 'ransom_rebuild' },
    ],
  },
  {
    id: 'vc', name: 'Investment offer', weight: 5, minTier: 2, tone: 'good', choice: true,
    when: (s, d) => d.revenue > 0,
    text: 'A fund wants in. They will wire you a serious cheque against a slice of future revenue.',
    options: [
      { label: 'Take the money', hint: 'Big cash injection, −12% contract pay for 20 days', effect: 'vc_take' },
      { label: 'Stay independent', hint: '+8 reputation', effect: 'vc_decline' },
    ],
  },
  {
    id: 'recall', name: 'Hardware recall', weight: 5, minTier: 3, tone: 'bad', choice: true,
    when: (s, d) => d.unitsTotal >= 8,
    text: 'The vendor has recalled a batch of boards. Yours are in it.',
    options: [
      { label: 'Return them now', hint: 'Lose 12% of installed units, get 70% of value back', effect: 'recall_return' },
      { label: 'Keep running them', hint: 'Wear doubles for 8 days', effect: 'recall_keep' },
    ],
  },
  {
    id: 'bigclient', name: 'Anchor tenant', weight: 4, minTier: 4, tone: 'good', choice: true,
    when: (s, d) => d.computeSellable > 0,
    text: 'A hyperscaler wants to pre-buy capacity for a year, at a discount, paid up front.',
    options: [
      { label: 'Sign it', hint: 'Large lump sum, −18% contract pay for 30 days', effect: 'anchor_sign' },
      { label: 'Decline', hint: '+14 reputation, they respect the discipline', effect: 'anchor_decline' },
    ],
  },
  {
    id: 'grant', name: 'Research grant', weight: 5, minTier: 3, tone: 'good', choice: true,
    when: (s, d) => d.computeTotal > 0,
    text: 'A public programme will fund efficiency work if you commit compute to their benchmark.',
    options: [
      { label: 'Commit 15% of compute', hint: '10 days of heavy research income', effect: 'grant_take' },
      { label: 'Politely decline', hint: 'Nothing changes', effect: 'grant_decline' },
    ],
  },
  // ----------------------------------------------------------- Ashbrook
  // The town notices. These only exist once your footprint has actually taken
  // something from it, and they get louder the less of it is left.
  {
    id: 'townnoise', name: 'Noise complaint', weight: 7, minTier: 1, days: 3, tone: 'bad',
    when: (s) => (s.town?.damage || 0) >= 0.12,
    mods: { upkeepMult: 1.15 },
    text: 'Mill Lane has been to the council about the transformer hum. Acoustic screening is going up, and it is on your bill.',
  },
  {
    id: 'townwater', name: 'Abstraction challenge', weight: 6, minTier: 2, days: 4, tone: 'bad',
    when: (s, d) => (s.town?.damage || 0) >= 0.25 && d.waterDemand > 0,
    mods: { waterSupplyMult: 0.7 },
    text: 'The angling club has forced a review of your licence. Abstraction is capped at 70% while it runs.',
  },
  {
    id: 'townpress', name: 'A reporter is asking', weight: 5, minTier: 3, days: 3, tone: 'bad',
    when: (s) => (s.town?.damage || 0) >= 0.5,
    mods: { repMult: 0.8 },
    text: 'A national paper has sent someone to photograph the empty terraces with your fence in the background.',
  },
  {
    id: 'townsell', name: 'Compulsory purchase', weight: 5, minTier: 4, tone: 'neutral', choice: true,
    // Only worth offering while there is still room to expand into.
    when: (s) => (s.town?.damage || 0) >= 0.62 && (s.expand?.h || 0) <= 6,
    text: 'The last families on Mill Lane want out, and the council will not stand in the way. You can buy the row.',
    options: [
      { label: 'Buy the street', hint: 'Costs 8 days of income, +2 rows of floor', effect: 'town_buy' },
      { label: 'Leave them to it', hint: '+10 reputation', effect: 'town_leave' },
    ],
  },
  {
    id: 'fire', name: 'Battery fire', weight: 3, minTier: 4, tone: 'bad', choice: true,
    when: (s, d) => (d.counts.rideSeconds || 0) > 0,
    text: 'A UPS string has gone thermal. Suppression has fired. Something is going to be lost.',
    options: [
      { label: 'Emergency shutdown', hint: '1.5 days offline, hardware safe', effect: 'fire_shutdown' },
      { label: 'Isolate and keep running', hint: 'Damage 8% of units, stay online', effect: 'fire_isolate' },
    ],
  },
  // ==================================================================== more
  //
  // Twenty-four more, written to the same severity as the originals: the
  // worst modifier here is no worse than the worst that was already in, and
  // every one of them still arrives through the ramp rather than all at once.
  {
    id: 'humid', name: 'Humid spell', weight: 8, minTier: 0, days: 3, tone: 'bad',
    when: (s, d) => d.unitsTotal > 0,
    mods: { coolMult: 0.85 },
    text: 'Warm wet air off the Irish Sea. The evaporative stages are barely doing anything. −15% cooling.',
  },
  {
    id: 'clearnight', name: 'Clear nights', weight: 7, minTier: 0, days: 4, tone: 'good',
    when: (s, d) => d.unitsTotal > 0,
    mods: { coolMult: 1.18 },
    text: 'A settled high and cold nights. The free-cooling hours run to nearly dawn. +18% cooling.',
  },
  {
    id: 'dustfilter', name: 'Filters blocked', weight: 6, minTier: 1, days: 2.5, tone: 'bad',
    when: (s, d) => d.unitsTotal > 0,
    mods: { coolMult: 0.88, upkeepMult: 1.06 },
    text: 'Pollen season, and nobody changed the panel filters. Airflow is down until somebody does.',
  },
  {
    id: 'windy', name: 'Named storm', weight: 6, minTier: 2, days: 2, tone: 'good',
    when: (s, d) => d.ownSupply > 0,
    mods: { powerSupplyMult: 1.2, coolMult: 1.1 },
    text: 'Storm Bronwen is sitting over the county. Everything with a blade on it is earning its keep.',
  },
  {
    id: 'gridcurtail', name: 'Curtailment notice', weight: 6, minTier: 3, days: 2.2, tone: 'bad',
    when: (s, d) => d.gridUsed > 0,
    mods: { powerSupplyMult: 0.78 },
    text: 'The network operator has issued a curtailment notice for large loads in the region. You are the large load.',
  },
  {
    id: 'cheapgas', name: 'Gas glut', weight: 5, minTier: 2, days: 4, tone: 'good',
    when: (s, d) => d.fuelCost > 0,
    mods: { fuelMult: 0.55 },
    text: 'A mild winter across Europe and full storage. Fuel is cheap for as long as that lasts.',
  },
  {
    id: 'fuelspike', name: 'Fuel on allocation', weight: 5, minTier: 2, days: 3.5, tone: 'bad',
    when: (s, d) => d.fuelCost > 0,
    mods: { fuelMult: 1.7 },
    text: 'The supplier has moved everyone to allocation. What you can get costs 70% more.',
  },
  {
    id: 'mainsburst', name: 'Water main burst', weight: 6, minTier: 2, days: 2, tone: 'bad',
    when: (s, d) => d.waterDemand > 0,
    mods: { waterSupplyMult: 0.6 },
    text: 'A Victorian main has gone under the ring road. Pressure is down across the whole district.',
  },
  {
    id: 'wetweek', name: 'A very wet week', weight: 6, minTier: 1, days: 4, tone: 'good',
    when: (s, d) => d.waterDemand > 0,
    mods: { waterSupplyMult: 1.25, coolMult: 1.08 },
    text: 'Four inches in six days. The river is up, the harvesting tanks are full, and the air is cold.',
  },
  {
    id: 'fancurve', name: 'Broken fan curve', weight: 7, minTier: 2, days: 3, tone: 'bad',
    when: (s, d) => d.unitsTotal > 0,
    mods: { computeMult: 0.9, wearMult: 1.15 },
    text: 'A vendor update shipped with a broken fan curve. Everything runs hotter and slower until it is rolled back.',
  },
  {
    id: 'kernelfix', name: 'Scheduler patch', weight: 6, minTier: 2, days: 5, tone: 'good',
    when: (s, d) => d.unitsTotal > 0,
    mods: { computeMult: 1.12 },
    text: 'Somebody upstream fixed the scheduler. The same machines are doing 12% more work for nothing.',
  },
  {
    id: 'batchbad', name: 'Bad silicon batch', weight: 5, minTier: 3, days: 6, tone: 'bad',
    when: (s, d) => d.unitsTotal > 20,
    mods: { wearMult: 1.4 },
    text: 'A whole shipment came off a line with a marginal process corner. They will not last as long as they should.',
  },
  {
    id: 'coolant', name: 'Coolant contract', weight: 5, minTier: 4, days: 6, tone: 'good',
    when: (s, d) => d.coolCap > 0,
    mods: { coolMult: 1.15, waterCostMult: 0.8 },
    text: 'A three-year supply deal signed at the bottom of the market. The plant runs better and cheaper.',
  },
  {
    id: 'auditlow', name: 'Efficiency audit', weight: 6, minTier: 3, days: 7, tone: 'good',
    when: (s, d) => d.unitsTotal > 0,
    mods: { upkeepMult: 0.85 },
    text: 'The consultants found nine things. Six of them were true and four of them were free.',
  },
  {
    id: 'insurance', name: 'Premium review', weight: 6, minTier: 3, days: 8, tone: 'bad',
    when: (s, d) => d.unitsTotal > 0,
    mods: { upkeepMult: 1.14 },
    text: 'The underwriters have looked at what is on the floor and repriced accordingly.',
  },
  {
    id: 'demandsurge', name: 'Capacity crunch', weight: 7, minTier: 3, days: 4, tone: 'good',
    when: (s, d) => d.computeSellable > 0,
    mods: { priceMult: 1.22 },
    text: 'Everyone wants compute this quarter and nobody has any. New contracts are paying 22% over.',
  },
  {
    id: 'demandslump', name: 'Capacity glut', weight: 6, minTier: 3, days: 5, tone: 'bad',
    when: (s, d) => d.computeSellable > 0,
    mods: { priceMult: 0.84 },
    text: 'Three new campuses came online in the same month. Nobody is paying list this quarter.',
  },
  {
    id: 'reference', name: 'A good reference', weight: 6, minTier: 2, days: 6, tone: 'good',
    when: (s) => (s.reputation || 0) > 4,
    mods: { repMult: 1.35, offerSize: 1.12 },
    text: 'A customer said something kind in public, and the kind of people who read that are now calling.',
  },
  {
    id: 'outage', name: 'A visible outage', weight: 5, minTier: 3, days: 4, tone: 'bad',
    when: (s, d) => d.contractDemand > 0,
    mods: { repMult: 0.75 },
    text: 'Forty minutes, in the middle of a weekday, and it made a trade paper. Everyone saw it.',
  },
  {
    id: 'strike', name: 'Contractors walk out', weight: 4, minTier: 4, days: 3, tone: 'bad',
    when: (s, d) => d.brokenTotal > 0,
    mods: { repairMult: 0.5, upkeepMult: 1.08 },
    text: 'The maintenance contractor is in dispute. Nothing gets fixed this week that is not on fire.',
  },

  // ---- decisions
  {
    id: 'earlyaccess', name: 'Early access silicon', weight: 4, minTier: 3, tone: 'neutral', choice: true,
    when: (s, d) => d.unitsTotal > 10,
    text: 'A vendor will give you the next generation six months early, on the understanding that you find the faults.',
    options: [
      { label: 'Take the boards', hint: '30 days of research income, wear up 25% for 12 days', effect: 'early_take' },
      { label: 'Wait for retail', hint: 'Nothing changes', effect: 'early_decline' },
    ],
  },
  {
    id: 'licence', name: 'Abstraction renewal', weight: 4, minTier: 4, tone: 'neutral', choice: true,
    when: (s, d) => d.waterDemand > 0 && (s.town?.damage || 0) >= 0.2,
    text: 'Your water licence is up. The regulator will renew it quietly, or hold a hearing you would win slowly.',
    options: [
      { label: 'Settle it quietly', hint: 'Costs 5 days of income, −6 reputation', effect: 'licence_settle' },
      { label: 'Go to the hearing', hint: '12 days at 70% water, +10 reputation', effect: 'licence_fight' },
    ],
  },
  {
    id: 'heatdeal', name: 'The district heat scheme', weight: 4, minTier: 5, tone: 'good', choice: true,
    when: (s, d) => d.heatLoad > 0 && (s.town?.damage || 0) >= 0.35,
    text: 'The council will take your waste heat for what is left of the housing stock, if you pay for the pipe.',
    options: [
      { label: 'Pay for the pipe', hint: 'Costs 10 days of income, +16 reputation', effect: 'heat_build' },
      { label: 'Not this year', hint: 'Nothing changes', effect: 'heat_decline' },
    ],
  },
  {
    id: 'poach2', name: 'The whole night shift', weight: 3, minTier: 5, tone: 'bad', choice: true,
    when: (s) => (s.staff?.tech || 0) >= 4,
    text: 'A campus two counties over has offered the entire night shift a move, together, with a bonus.',
    options: [
      { label: 'Beat the offer', hint: 'Costs 12 days of total salary', effect: 'poach2_pay' },
      { label: 'Rebuild the shift', hint: 'Lose half your technicians, +30 days of reduced wages', effect: 'poach2_lose' },
    ],
  },

  // ======================================== another forty-eight, same discipline
  // Weather, the grid, the market, the people, the town and — new — the
  // shareholders. Nothing here is harsher than what was already in: the worst
  // modifier below is no worse than the worst above it, and every one of them
  // still arrives through the ramp rather than all at once.
  {
    id: 'fog', name: 'Freezing fog', weight: 7, minTier: 1, days: 3, tone: 'good',
    when: (s, d) => d.unitsTotal > 0,
    mods: { coolMult: 1.14 },
    text: 'Three days of it sitting in the valley. The economisers have never had it so easy.',
  },
  {
    id: 'sandstorm', name: 'Dust event', weight: 5, minTier: 2, days: 2.5, tone: 'bad',
    when: (s, d) => d.unitsTotal > 0,
    mods: { coolMult: 0.86, wearMult: 1.12 },
    text: 'Saharan dust as far north as here. Every filter on site is grey by Tuesday.',
  },
  {
    id: 'thunder', name: 'Lightning strike', weight: 5, minTier: 2, days: 1.4, tone: 'bad',
    when: (s, d) => d.gridUsed > 0,
    mods: { powerSupplyMult: 0.7 },
    text: 'It hit the incomer. The protection worked, which is why there is still a site.',
  },
  {
    id: 'mildwinter', name: 'Mild winter', weight: 6, minTier: 2, days: 6, tone: 'good',
    when: (s, d) => d.unitsTotal > 0,
    mods: { coolMult: 1.1, gridCostMult: 0.92 },
    text: 'Nobody is heating anything. Power is cheap and the air is still cold enough.',
  },
  {
    id: 'latefrost', name: 'Late frost', weight: 6, minTier: 1, days: 2.5, tone: 'good',
    when: (s, d) => d.unitsTotal > 0,
    mods: { coolMult: 1.16 },
    text: 'April, and the fields are white. Free cooling into May.',
  },
  {
    id: 'gridupgrade', name: 'Network reinforcement', weight: 5, minTier: 3, days: 5, tone: 'good',
    when: (s, d) => d.gridUsed > 0,
    mods: { powerSupplyMult: 1.15 },
    text: 'They finally uprated the feeder. Fifteen per cent more, for the price of a consultation.',
  },
  {
    id: 'gridfault', name: 'Feeder fault', weight: 6, minTier: 2, days: 2, tone: 'bad',
    when: (s, d) => d.gridUsed > 0,
    mods: { powerSupplyMult: 0.68 },
    text: 'A cable joint gave up under the ring road. You are on the other feeder until Thursday.',
  },
  {
    id: 'tariff', name: 'Tariff renegotiated', weight: 5, minTier: 3, days: 8, tone: 'good',
    when: (s, d) => d.gridUsed > 0,
    mods: { gridCostMult: 0.8 },
    text: 'Two years of consumption data, and a supplier who wanted to keep you.',
  },
  {
    id: 'levy', name: 'Capacity levy', weight: 6, minTier: 3, days: 7, tone: 'bad',
    when: (s, d) => d.gridUsed > 0,
    mods: { gridCostMult: 1.3 },
    text: 'A new charge on large loads, applied to the largest load in the county.',
  },
  {
    id: 'carbon', name: 'Carbon price rise', weight: 5, minTier: 4, days: 9, tone: 'bad',
    when: (s, d) => d.fuelCost > 0,
    mods: { fuelMult: 1.45, upkeepMult: 1.05 },
    text: 'The floor price moved. Everything that burns costs more this year than last.',
  },
  {
    id: 'rebate', name: 'Efficiency rebate', weight: 5, minTier: 3, days: 6, tone: 'good',
    when: (s, d) => d.unitsTotal > 0,
    mods: { upkeepMult: 0.88 },
    text: 'A scheme you qualified for by accident, having done the work for other reasons.',
  },
  {
    id: 'recall2', name: 'Coolant recall', weight: 4, minTier: 4, days: 4, tone: 'bad',
    when: (s, d) => d.coolCap > 0,
    mods: { coolMult: 0.82 },
    text: 'A batch with the wrong additive. Every loop on site is being flushed in turn.',
  },
  {
    id: 'leak', name: 'Loop leak', weight: 6, minTier: 3, days: 3, tone: 'bad',
    when: (s, d) => d.waterDemand > 0,
    mods: { waterSupplyMult: 0.72, coolMult: 0.92 },
    text: 'Somewhere under the floor. They will find it by elimination, slowly.',
  },
  {
    id: 'pump', name: 'Pump failure', weight: 6, minTier: 2, days: 2.5, tone: 'bad',
    when: (s, d) => d.coolCap > 0,
    mods: { coolMult: 0.78 },
    text: 'The duty pump went and the standby is doing the work of two.',
  },
  {
    id: 'commissioning', name: 'Plant commissioned', weight: 5, minTier: 3, days: 4, tone: 'good',
    when: (s, d) => d.coolCap > 0,
    mods: { coolMult: 1.2 },
    text: 'The new plant is finally signed off and running at design capacity.',
  },
  {
    id: 'balance', name: 'Loop rebalanced', weight: 6, minTier: 2, days: 5, tone: 'good',
    when: (s, d) => d.coolCap > 0,
    mods: { coolMult: 1.12, coolDrawMult: 0.94 },
    text: 'Somebody spent a week with a clipboard and every valve on site.',
  },
  {
    id: 'licence2', name: 'Licence tightened', weight: 5, minTier: 4, days: 8, tone: 'bad',
    when: (s, d) => d.waterDemand > 0,
    mods: { waterSupplyMult: 0.8 },
    text: 'A revised abstraction limit, effective immediately, pending the appeal.',
  },
  {
    id: 'reservoir', name: 'Reservoir full', weight: 5, minTier: 2, days: 6, tone: 'good',
    when: (s, d) => d.waterDemand > 0,
    mods: { waterSupplyMult: 1.3, waterCostMult: 0.85 },
    text: 'A wet spring and a full catchment. Nobody is talking about hosepipes.',
  },
  {
    id: 'memleak', name: 'Memory regression', weight: 6, minTier: 2, days: 3, tone: 'bad',
    when: (s, d) => d.unitsTotal > 0,
    mods: { computeMult: 0.88 },
    text: 'A release that leaks. It is being rolled back across the estate a rack at a time.',
  },
  {
    id: 'compiler', name: 'New toolchain', weight: 6, minTier: 3, days: 6, tone: 'good',
    when: (s, d) => d.unitsTotal > 0,
    mods: { computeMult: 1.14 },
    text: 'Same silicon, better code out of it. Free performance, which is the best kind.',
  },
  {
    id: 'driver', name: 'Driver certification', weight: 5, minTier: 3, days: 4, tone: 'good',
    when: (s, d) => d.unitsTotal > 0,
    mods: { computeMult: 1.09, wearMult: 0.94 },
    text: 'The vendor finally certified the configuration you have been running for a year.',
  },
  {
    id: 'thermalpaste', name: 'Thermal degradation', weight: 5, minTier: 4, days: 7, tone: 'bad',
    when: (s, d) => d.unitsTotal > 30,
    mods: { heatMult: 1.12, wearMult: 1.15 },
    text: 'Compound dries out. Every heatsink on the floor is five years old at once.',
  },
  {
    id: 'refurb', name: 'Refurbishment programme', weight: 5, minTier: 4, days: 8, tone: 'good',
    when: (s, d) => d.unitsTotal > 30,
    mods: { wearMult: 0.8, repairMult: 1.2 },
    text: 'A rolling programme, a rack a night, and the failure rate halves.',
  },
  {
    id: 'shortage', name: 'Component shortage', weight: 6, minTier: 3, days: 9, tone: 'bad',
    when: (s, d) => d.unitsTotal > 0,
    mods: { hwCostMult: 1.35 },
    text: 'Allocation again. Everything is twelve weeks out and dearer than it was.',
  },
  {
    id: 'glutparts', name: 'Component glut', weight: 5, minTier: 3, days: 7, tone: 'good',
    when: (s, d) => d.unitsTotal > 0,
    mods: { hwCostMult: 0.78 },
    text: 'Somebody else cancelled an enormous order and the channel is full.',
  },
  {
    id: 'steel', name: 'Construction inflation', weight: 5, minTier: 4, days: 10, tone: 'bad',
    when: (s, d) => d.unitsTotal > 0,
    mods: { buildCostMult: 1.3 },
    text: 'Steel, copper and concrete all at once. Everything on the floor costs more to put there.',
  },
  {
    id: 'contractorglut', name: 'Contractors available', weight: 5, minTier: 4, days: 8, tone: 'good',
    when: (s, d) => d.unitsTotal > 0,
    mods: { buildCostMult: 0.8 },
    text: 'A big job up the road finished early. Everyone is looking for work this quarter.',
  },
  {
    id: 'cyber', name: 'Attempted intrusion', weight: 6, minTier: 4, days: 3, tone: 'bad',
    when: (s, d) => d.unitsTotal > 0,
    mods: { upkeepMult: 1.12, uptimePenalty: 0.004 },
    text: 'They got as far as the jump host. The week after is all forensics and no sleep.',
  },
  {
    id: 'cert', name: 'Certification achieved', weight: 5, minTier: 4, days: 10, tone: 'good',
    when: (s, d) => d.contractDemand > 0,
    mods: { repMult: 1.3, priceMult: 1.06 },
    text: 'The audit passed first time. It opens doors that were not previously doors.',
  },
  {
    id: 'litigation', name: 'Legal dispute', weight: 4, minTier: 5, days: 8, tone: 'bad',
    when: (s, d) => d.contractDemand > 0,
    mods: { repMult: 0.78, upkeepMult: 1.08 },
    text: 'A customer says the SLA means something else. Both readings are defensible.',
  },
  {
    id: 'award', name: 'Industry award', weight: 5, minTier: 4, days: 7, tone: 'good',
    when: (s, d) => (s.reputation || 0) > 20,
    mods: { repMult: 1.4 },
    text: 'A trophy in reception and three enquiries in the week after.',
  },
  {
    id: 'poaching', name: 'Salary inflation', weight: 6, minTier: 4, days: 9, tone: 'bad',
    when: (s, d) => (s.staff?.tech || 0) > 2,
    mods: { upkeepMult: 1.18 },
    text: 'The market moved. Everyone on site now knows what they are worth elsewhere.',
  },
  {
    id: 'graduates', name: 'Graduate intake', weight: 5, minTier: 3, days: 8, tone: 'good',
    when: (s, d) => (s.staff?.tech || 0) > 0,
    mods: { repairMult: 1.25, upkeepMult: 1.04 },
    text: 'Six of them, keen, and cheaper than the people they are standing next to.',
  },
  {
    id: 'flu', name: 'Winter illness', weight: 6, minTier: 2, days: 4, tone: 'bad',
    when: (s, d) => (s.staff?.tech || 0) > 1,
    mods: { repairMult: 0.7 },
    text: 'Half the shift is off. The other half is working doubles and will be off next week.',
  },
  {
    id: 'roadworks', name: 'Access road closed', weight: 5, minTier: 2, days: 5, tone: 'bad',
    when: (s, d) => Object.keys(s.tiles || {}).length > 3,
    mods: { upkeepMult: 1.1, repairMult: 0.85 },
    text: 'Six weeks of resurfacing. Every delivery now comes the long way round.',
  },
  {
    id: 'railfreight', name: 'Rail siding opened', weight: 4, minTier: 5, days: 10, tone: 'good',
    when: (s, d) => Object.keys(s.tiles || {}).length > 8,
    mods: { buildCostMult: 0.9, upkeepMult: 0.95 },
    text: 'The old siding is back in use. Plant arrives by train and nobody sees a lorry.',
  },
  {
    id: 'townmeeting', name: 'Public meeting', weight: 6, minTier: 2, days: 4, tone: 'bad',
    when: (s, d) => (s.town?.damage || 0) >= 0.18,
    mods: { repMult: 0.85, upkeepMult: 1.06 },
    text: 'Four hundred people in the leisure centre, and none of them there to say well done.',
  },
  {
    id: 'townjobs', name: 'Recruitment drive', weight: 5, minTier: 3, days: 8, tone: 'good',
    when: (s, d) => (s.town?.damage || 0) >= 0.1,
    mods: { upkeepMult: 0.93, repMult: 1.15 },
    text: 'Two hundred jobs advertised locally. It is the first good news in the paper for a year.',
  },
  {
    id: 'townschool', name: 'School sponsorship', weight: 5, minTier: 4, days: 9, tone: 'good',
    when: (s, d) => (s.town?.damage || 0) >= 0.3,
    mods: { repMult: 1.25 },
    text: 'You are paying for the sixth form now. It is cheaper than the alternative and it helps.',
  },
  {
    id: 'townwater2', name: 'Standpipes', weight: 5, minTier: 4, days: 5, tone: 'bad',
    when: (s, d) => (s.town?.damage || 0) >= 0.45,
    mods: { waterSupplyMult: 0.78, repMult: 0.8 },
    text: 'The town is on standpipes and your towers are not. Photographs are taken.',
  },
  {
    id: 'townpower', name: 'Rota disconnections', weight: 5, minTier: 5, days: 4, tone: 'bad',
    when: (s, d) => (s.town?.damage || 0) >= 0.55,
    mods: { powerSupplyMult: 0.85, repMult: 0.75 },
    text: 'Domestic supply is being rotated. Yours is firm, and everyone knows which is which.',
  },
  {
    id: 'townenquiry', name: 'Public inquiry', weight: 4, minTier: 5, days: 12, tone: 'bad',
    when: (s, d) => (s.town?.damage || 0) >= 0.65,
    mods: { upkeepMult: 1.15, repMult: 0.7 },
    text: 'Sixteen weeks of it. The transcript runs to nine thousand pages and changes nothing.',
  },
  {
    id: 'townhospice', name: 'The hospice closes', weight: 4, minTier: 6, days: 6, tone: 'bad',
    when: (s, d) => (s.town?.damage || 0) >= 0.75,
    mods: { repMult: 0.68 },
    text: 'It ran on donations from people who have gone. The building is available, if you want it.',
  },
  {
    id: 'townlast', name: 'The last pub', weight: 4, minTier: 6, days: 6, tone: 'bad',
    when: (s, d) => (s.town?.damage || 0) >= 0.85,
    mods: { repMult: 0.7, upkeepMult: 1.05 },
    text: 'It called last orders on a Sunday to eleven people, four of whom worked for you.',
  },
  {
    id: 'index', name: 'Added to the index', weight: 4, minTier: 6, days: 10, tone: 'good',
    when: (s, d) => (s.ipo?.floated) === true,
    mods: { priceMult: 1.12, repMult: 1.2 },
    text: 'Tracker funds have to hold you now, whatever they think of the valley.',
  },
  {
    id: 'downgrade', name: 'Credit downgrade', weight: 4, minTier: 6, days: 9, tone: 'bad',
    when: (s, d) => (s.ipo?.floated) === true,
    mods: { upkeepMult: 1.14, priceMult: 0.92 },
    text: 'One notch, on an outlook the analysts called concentrated. They are not wrong.',
  },
  {
    id: 'buyback', name: 'Buyback pressure', weight: 4, minTier: 6, days: 8, tone: 'bad',
    when: (s, d) => (s.ipo?.floated) === true,
    mods: { upkeepMult: 1.1 },
    text: 'An activist holder with 4% and a letter. The letter is published before you read it.',
  },
  {
    id: 'analyst', name: 'Analyst upgrade', weight: 4, minTier: 6, days: 7, tone: 'good',
    when: (s, d) => (s.ipo?.floated) === true,
    mods: { priceMult: 1.1, repMult: 1.15 },
    text: 'A note with the word structural in it. The phone rings for a fortnight.',
  },

  // ---- and another forty-eight: weather, silicon, the market, the law,
  // the town, and what happens once there are shareholders and an orbit.
  {
    id: 'brownout2', name: 'Voltage dip', weight: 6, minTier: 2, days: 1.2, tone: 'bad',
    when: (s, d) => d.gridUsed > 0,
    mods: { powerSupplyMult: 0.8 },
    text: 'Half a second, and every power supply on the floor had an opinion about it.',
  },
  {
    id: 'gust', name: 'Gale warning', weight: 6, minTier: 2, days: 2, tone: 'good',
    when: (s, d) => d.ownSupply > 0,
    mods: { powerSupplyMult: 1.18 },
    text: 'Everything with a blade on it is at rated output and staying there.',
  },
  {
    id: 'calm', name: 'Anticyclonic gloom', weight: 6, minTier: 2, days: 4, tone: 'bad',
    when: (s, d) => d.ownSupply > 0,
    mods: { powerSupplyMult: 0.75, coolMult: 0.94 },
    text: 'No wind, no sun, and warm with it. The worst week of the year for a renewable estate.',
  },
  {
    id: 'snow', name: 'Heavy snow', weight: 5, minTier: 2, days: 3, tone: 'good',
    when: (s, d) => d.unitsTotal > 0,
    mods: { coolMult: 1.2, upkeepMult: 1.06 },
    text: 'Free cooling, and a car park nobody can get into.',
  },
  {
    id: 'heat2', name: 'Record temperature', weight: 6, minTier: 3, days: 3, tone: 'bad',
    when: (s, d) => d.unitsTotal > 0,
    mods: { coolMult: 0.66, wearMult: 1.2 },
    text: 'Forty-one degrees. The design brief said thirty-five and it said that recently.',
  },
  {
    id: 'rainfail', name: 'Failed monsoon', weight: 4, minTier: 4, days: 9, tone: 'bad',
    when: (s, d) => d.waterDemand > 0,
    mods: { waterSupplyMult: 0.7 },
    text: 'The catchment did not fill. Everything downstream of that is now your problem.',
  },
  {
    id: 'spill', name: 'Discharge exceedance', weight: 5, minTier: 4, days: 5, tone: 'bad',
    when: (s, d) => d.waterDemand > 0,
    mods: { upkeepMult: 1.14, repMult: 0.85 },
    text: 'Four degrees over the consent for eleven hours. It was reported by a fisherman.',
  },
  {
    id: 'newmain', name: 'Main relaid', weight: 5, minTier: 3, days: 6, tone: 'good',
    when: (s, d) => d.waterDemand > 0,
    mods: { waterSupplyMult: 1.2, waterCostMult: 0.92 },
    text: 'Ninety years of cast iron replaced. The pressure has not been this good since the war.',
  },
  {
    id: 'bugbounty', name: 'Vulnerability disclosed', weight: 5, minTier: 3, days: 3, tone: 'bad',
    when: (s, d) => d.unitsTotal > 0,
    mods: { upkeepMult: 1.1, computeMult: 0.95 },
    text: 'Responsible, coordinated, and still a fortnight of patching at reduced throughput.',
  },
  {
    id: 'mitigation', name: 'Mitigation removed', weight: 5, minTier: 4, days: 5, tone: 'good',
    when: (s, d) => d.unitsTotal > 0,
    mods: { computeMult: 1.16 },
    text: 'A microcode workaround from four years ago, finally no longer needed.',
  },
  {
    id: 'yield', name: 'Yield improvement', weight: 5, minTier: 3, days: 7, tone: 'good',
    when: (s, d) => d.unitsTotal > 0,
    mods: { hwCostMult: 0.85 },
    text: 'The fab got better at it. Everyone downstream gets the benefit.',
  },
  {
    id: 'fablost', name: 'Fab offline', weight: 4, minTier: 4, days: 8, tone: 'bad',
    when: (s, d) => d.unitsTotal > 0,
    mods: { hwCostMult: 1.5 },
    text: 'An earthquake nine thousand miles away and a twelve-week hole in the channel.',
  },
  {
    id: 'tapeout', name: 'Tape-out slips', weight: 4, minTier: 5, days: 10, tone: 'bad',
    when: (s, d) => d.unitsTotal > 40,
    mods: { computeMult: 0.94, hwCostMult: 1.15 },
    text: 'The next generation is a quarter late and the current one has gone up in price.',
  },
  {
    id: 'oversupply', name: 'Compute oversupply', weight: 6, minTier: 4, days: 6, tone: 'bad',
    when: (s, d) => d.computeSellable > 0,
    mods: { priceMult: 0.78 },
    text: 'Three campuses came online in a month. Nobody is paying list for anything.',
  },
  {
    id: 'scarce', name: 'Compute scarcity', weight: 6, minTier: 4, days: 5, tone: 'good',
    when: (s, d) => d.computeSellable > 0,
    mods: { priceMult: 1.3 },
    text: 'Everyone wants it, nobody has it, and you have a floor full.',
  },
  {
    id: 'longdeal', name: 'Framework signed', weight: 5, minTier: 4, days: 12, tone: 'good',
    when: (s, d) => d.contractDemand > 0,
    mods: { priceMult: 1.12, offerSize: 1.2 },
    text: 'Four years, indexed, with a volume commitment on their side for once.',
  },
  {
    id: 'churn', name: 'Customer churn', weight: 5, minTier: 4, days: 7, tone: 'bad',
    when: (s, d) => d.contractDemand > 0,
    mods: { offerSize: 0.82, repMult: 0.9 },
    text: 'Two of the big ones went in-house. They will be back, but not this year.',
  },
  {
    id: 'regulate', name: 'Efficiency regulation', weight: 5, minTier: 5, days: 14, tone: 'bad',
    when: (s, d) => d.unitsTotal > 0,
    mods: { upkeepMult: 1.16 },
    text: 'A mandated reporting standard, an auditor, and a number you would rather not publish.',
  },
  {
    id: 'exempt', name: 'Strategic exemption', weight: 4, minTier: 6, days: 12, tone: 'good',
    when: (s, d) => d.unitsTotal > 0,
    mods: { gridCostMult: 0.8, upkeepMult: 0.94 },
    text: 'Designated critical infrastructure, which turns out to come with a tariff.',
  },
  {
    id: 'grant2', name: 'Capital grant', weight: 5, minTier: 4, days: 10, tone: 'good',
    when: (s, d) => Object.keys(s.tiles || {}).length > 5,
    mods: { buildCostMult: 0.78 },
    text: 'Regional development money, on condition the jobs are local. They are.',
  },
  {
    id: 'planning', name: 'Planning refused', weight: 4, minTier: 5, days: 9, tone: 'bad',
    when: (s, d) => Object.keys(s.tiles || {}).length > 5,
    mods: { buildCostMult: 1.35 },
    text: 'Refused on landscape grounds. The appeal will win and take eleven months.',
  },
  {
    id: 'protest', name: 'Site occupation', weight: 4, minTier: 5, days: 4, tone: 'bad',
    when: (s, d) => (s.town?.damage || 0) >= 0.4,
    mods: { upkeepMult: 1.12, repMult: 0.8 },
    text: 'Nineteen people and a tripod across the access road. It is on the regional news.',
  },
  {
    id: 'goodwill', name: 'Community fund', weight: 5, minTier: 4, days: 10, tone: 'good',
    when: (s, d) => (s.town?.damage || 0) >= 0.15,
    mods: { repMult: 1.3 },
    text: 'A percentage of revenue, paid to a trust, spent on things you do not choose.',
  },
  {
    id: 'archaeology', name: 'Archaeology on site', weight: 4, minTier: 4, days: 6, tone: 'bad',
    when: (s, d) => Object.keys(s.tiles || {}).length > 5,
    mods: { buildCostMult: 1.2, upkeepMult: 1.04 },
    text: 'A Roman field boundary under Hall C. Six weeks and a paper nobody will read.',
  },
  {
    id: 'apprentice', name: 'Apprenticeship scheme', weight: 5, minTier: 3, days: 12, tone: 'good',
    when: (s, d) => (s.staff?.tech || 0) > 0,
    mods: { repairMult: 1.3, upkeepMult: 0.96, repMult: 1.1 },
    text: 'Twelve places, four years, and they stay because there is nowhere else to go.',
  },
  {
    id: 'strike2', name: 'National dispute', weight: 4, minTier: 5, days: 5, tone: 'bad',
    when: (s, d) => (s.staff?.tech || 0) > 3,
    mods: { repairMult: 0.55, upkeepMult: 1.1 },
    text: 'Not your dispute, and entirely your problem for a fortnight.',
  },
  {
    id: 'keyperson', name: 'Chief engineer leaves', weight: 4, minTier: 4, days: 8, tone: 'bad',
    when: (s, d) => (s.staff?.tech || 0) > 2,
    mods: { repairMult: 0.72, uptimePenalty: 0.003 },
    text: 'Thirty years of how this place actually works, walked out with a cardboard box.',
  },
  {
    id: 'handover', name: 'Documented handover', weight: 5, minTier: 4, days: 10, tone: 'good',
    when: (s, d) => (s.staff?.tech || 0) > 2,
    mods: { repairMult: 1.22, uptimeBonus: 0.004 },
    text: 'Somebody wrote it all down before they left. It has never happened before.',
  },
  {
    id: 'insurance2', name: 'Claim settled', weight: 4, minTier: 4, days: 6, tone: 'good',
    when: (s, d) => d.unitsTotal > 0,
    mods: { upkeepMult: 0.9 },
    text: 'Eighteen months of loss adjusters, and they paid in full.',
  },
  {
    id: 'audit2', name: 'Failed audit', weight: 4, minTier: 5, days: 7, tone: 'bad',
    when: (s, d) => d.contractDemand > 0,
    mods: { repMult: 0.8, penaltyMult: 1.2 },
    text: 'Four non-conformities, two of them major. The remediation plan is nine pages.',
  },
  {
    id: 'patent', name: 'Patent granted', weight: 4, minTier: 5, days: 14, tone: 'good',
    when: (s, d) => d.unitsTotal > 0,
    mods: { priceMult: 1.1, hwCostMult: 0.94 },
    text: 'Something your lab did four years ago is now something everybody has to license.',
  },
  {
    id: 'licensing', name: 'Licensing income', weight: 4, minTier: 6, days: 16, tone: 'good',
    when: (s, d) => d.unitsTotal > 0,
    mods: { upkeepMult: 0.88 },
    text: 'Three competitors pay you to use it. It arrives quarterly and nobody has to do anything.',
  },
  {
    id: 'breach2', name: 'Data incident', weight: 3, minTier: 5, days: 6, tone: 'bad',
    when: (s, d) => d.contractDemand > 0,
    mods: { repMult: 0.65, penaltyMult: 1.3 },
    text: 'Nothing left the building. Saying so convincingly takes four months.',
  },
  {
    id: 'quantum3', name: 'Cryptographic migration', weight: 4, minTier: 6, days: 11, tone: 'bad',
    when: (s, d) => d.unitsTotal > 0,
    mods: { computeMult: 0.9, upkeepMult: 1.12 },
    text: 'Everything re-keyed to something that will hold. It is not optional and it is not quick.',
  },
  {
    id: 'standard', name: 'Standard adopted', weight: 4, minTier: 6, days: 13, tone: 'good',
    when: (s, d) => d.contractDemand > 0,
    mods: { priceMult: 1.14, offerSize: 1.15 },
    text: 'Your way of doing it became the way of doing it, largely by being first.',
  },
  {
    id: 'orbitdebris', name: 'Debris conjunction', weight: 3, minTier: 7, days: 3, tone: 'bad',
    when: (s, d) => (s.facility || 0) >= 14,
    mods: { computeMult: 0.88, uptimePenalty: 0.004 },
    text: 'A manoeuvre, and four hours of the fleet pointing the wrong way.',
  },
  {
    id: 'solarflare', name: 'Solar event', weight: 4, minTier: 6, days: 2.5, tone: 'bad',
    when: (s, d) => (s.facility || 0) >= 12,
    mods: { computeMult: 0.82, powerSupplyMult: 0.88 },
    text: 'X-class. Everything unshielded is throwing corrected errors and some uncorrected ones.',
  },
  {
    id: 'launchwin', name: 'Launch window', weight: 4, minTier: 7, days: 8, tone: 'good',
    when: (s, d) => (s.facility || 0) >= 14,
    mods: { computeMult: 1.18 },
    text: 'Everything that was waiting on the pad is up, and up is where it works.',
  },
  {
    id: 'tetherfault', name: 'Tether inspection', weight: 3, minTier: 7, days: 5, tone: 'bad',
    when: (s, d) => (s.facility || 0) >= 14,
    mods: { computeMult: 0.85, upkeepMult: 1.1 },
    text: 'A strain reading that is probably the sensor. Probably is not good enough at that length.',
  },
  {
    id: 'sovereignty', name: 'Sovereignty requirement', weight: 4, minTier: 6, days: 12, tone: 'bad',
    when: (s, d) => d.contractDemand > 0,
    mods: { offerSize: 0.85, upkeepMult: 1.08 },
    text: 'Certain workloads must stay inside certain borders. Yours span several.',
  },
  {
    id: 'bidwar', name: 'Competitive tender', weight: 5, minTier: 5, days: 6, tone: 'good',
    when: (s, d) => d.computeSellable > 0,
    mods: { priceMult: 1.16, repMult: 1.1 },
    text: 'Two of them wanted the same capacity in the same week. You let them find out.',
  },
  {
    id: 'lossleader', name: 'Undercut', weight: 5, minTier: 5, days: 7, tone: 'bad',
    when: (s, d) => d.computeSellable > 0,
    mods: { priceMult: 0.82 },
    text: 'Somebody is selling below cost to buy the market. It works, for a while, for them.',
  },
  {
    id: 'dividendcut', name: 'Dividend questioned', weight: 3, minTier: 6, days: 8, tone: 'bad',
    when: (s, d) => (s.ipo?.floated) === true,
    mods: { repMult: 0.85, upkeepMult: 1.06 },
    text: 'The cover ratio slipped and the note that followed used the word unsustainable.',
  },
  {
    id: 'placing', name: 'Secondary placing', weight: 3, minTier: 7, days: 9, tone: 'good',
    when: (s, d) => (s.ipo?.floated) === true,
    mods: { priceMult: 1.08, upkeepMult: 0.95 },
    text: 'More stock, more holders, and a register that is no longer four people.',
  },
  {
    id: 'shortseller', name: 'Short attack', weight: 3, minTier: 7, days: 6, tone: 'bad',
    when: (s, d) => (s.ipo?.floated) === true,
    mods: { repMult: 0.7, priceMult: 0.9 },
    text: 'A forty-page report, mostly wrong and entirely damaging.',
  },
  {
    id: 'inclusion2', name: 'Sovereign wealth stake', weight: 3, minTier: 8, days: 14, tone: 'good',
    when: (s, d) => (s.ipo?.floated) === true,
    mods: { priceMult: 1.2, repMult: 1.25 },
    text: 'Nine per cent, held patiently, by somebody who intends to be there in fifty years.',
  },
  {
    id: 'townghost', name: 'The last resident', weight: 3, minTier: 8, days: 8, tone: 'bad',
    when: (s, d) => (s.town?.damage || 0) >= 0.95,
    mods: { repMult: 0.6 },
    text: 'There is one address still occupied. A journalist has found it.',
  },
  {
    id: 'memorial', name: 'A memorial is proposed', weight: 3, minTier: 8, days: 10, tone: 'neutral',
    when: (s, d) => (s.town?.damage || 0) >= 0.9,
    mods: { repMult: 1.1, upkeepMult: 1.03 },
    text: 'For what was here. You are asked to fund it, and the wording is being argued about.',
  },
];


export const EVENTS_BY_ID = Object.fromEntries(EVENTS.map((e) => [e.id, e]));
