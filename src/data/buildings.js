// Anything you can place on the floor grid.
//
// Categories drive the build menu tabs:
//   compute | power | cooling | water | support
//
// Coverage fields:
//   radius       – Chebyshev tile radius the machine serves
//   powerCap     – kW of distribution capacity offered to racks in radius (PDU)
//   coolCap      – kW of heat a cooling unit can remove, before efficiency
//   water        – litres/second consumed per kW of heat actually removed
//   supplyKW     – kW of electricity produced
//   supplyWater  – litres/second of water produced
//   draw         – kW the machine itself consumes
//   upkeep       – $/day fixed running cost
//   fuel         – $/kWh burned on top of upkeep (generators)

export const BUILDINGS = [
  // ---------------------------------------------------------------- compute
  {
    id: 'rack', name: 'Open frame rack', glyph: 'rack', tag: 'FRAME', h: 32, cat: 'compute', cost: 1_200, slots: 8,
    draw: 0.03, upkeep: 2, color: '#3f7dd6',
    desc: 'Two posts and a prayer. Holds eight units.',
  },
  {
    id: 'rack2', name: 'Enclosed rack', glyph: 'rack', tag: 'RACK', h: 36, cat: 'compute', cost: 14_000, slots: 18,
    draw: 0.06, upkeep: 9, color: '#4f95e8', req: 'rnd_rack2',
    desc: 'Doors, blanking panels and a sane airflow path.',
  },
  {
    id: 'rack3', name: 'High-density cabinet', glyph: 'rack', tag: 'CABINET', h: 40, cat: 'compute', cost: 260_000, slots: 34,
    draw: 0.14, upkeep: 55, color: '#63aef7', req: 'rnd_rack3',
    desc: 'Rear-door heat exchanger, deep enough for GPU sleds.',
  },
  {
    id: 'rack4', name: 'Immersion tank', glyph: 'tank', tag: 'IMMERSE', h: 16, cat: 'compute', cost: 9_500_000, slots: 56,
    draw: 0.6, upkeep: 900, color: '#7fd0ff', req: 'rnd_rack4',
    coolSelf: 0.45,
    desc: 'Dielectric bath. Removes 45% of its own heat and never rattles.',
  },
  {
    id: 'rack5', name: 'Cryo vault', glyph: 'cryo', tag: 'VAULT', h: 44, cat: 'compute', cost: 1_400_000_000, slots: 84,
    draw: 6, upkeep: 90_000, color: '#a8e5ff', req: 'rnd_rack5',
    coolSelf: 0.7,
    desc: 'Sealed, sub-ambient and slightly terrifying to stand next to.',
  },

  // ------------------------------------------------------------------ power
  {
    id: 'pdu', name: 'Power strip', glyph: 'plug', tag: 'STRIP', h: 12, cat: 'power', cost: 400, radius: 2, powerCap: 30,
    draw: 0.02, upkeep: 1, color: '#d8a13a',
    desc: 'Eight sockets on a cable. Spreads 30 kW over two tiles.',
  },
  {
    id: 'pdu2', name: 'Rack PDU', glyph: 'plug', tag: 'PDU', h: 16, cat: 'power', cost: 6_500, radius: 3, powerCap: 400,
    draw: 0.05, upkeep: 6, color: '#e8b44a', req: 'rnd_pdu2',
    desc: 'Metered, switched, and it will not melt at 40 amps.',
  },
  {
    id: 'pdu3', name: 'Busway tap', glyph: 'busbar', tag: 'BUSWAY', h: 22, cat: 'power', cost: 140_000, radius: 4, powerCap: 8_000,
    draw: 0.3, upkeep: 90, color: '#f5c95f', req: 'rnd_pdu3',
    desc: 'Overhead busway. Add taps wherever a row grows.',
  },
  {
    id: 'pdu4', name: 'Substation bay', glyph: 'transformer', tag: 'SUBSTN', h: 28, cat: 'power', cost: 6_800_000, radius: 6, powerCap: 120_000,
    draw: 3, upkeep: 3_400, color: '#ffd980', req: 'rnd_pdu4',
    desc: 'Medium voltage in, three-phase out, humming all night.',
  },
  {
    id: 'pdu5', name: 'HVDC spine', glyph: 'transformer', tag: 'HVDC', h: 34, cat: 'power', cost: 900_000_000, radius: 9, powerCap: 2_000_000,
    draw: 30, upkeep: 400_000, color: '#ffe9b0', req: 'rnd_pdu5',
    desc: 'One conversion step instead of four. The efficiency is the point.',
  },
  {
    id: 'ups', name: 'UPS cabinet', glyph: 'battery', tag: 'UPS', h: 24, cat: 'power', cost: 22_000, ride: 12, draw: 0.4,
    upkeep: 40, color: '#c98b2f', req: 'rnd_ups',
    desc: 'Rides through 12 seconds of grid loss. Stack them for longer.',
  },
  {
    id: 'genset', name: 'Diesel genset', glyph: 'engine', tag: 'GENSET', h: 22, cat: 'power', cost: 48_000, supplyKW: 220,
    upkeep: 60, fuel: 0.32, color: '#a8632c', req: 'rnd_genset', heatOut: 6,
    desc: 'Starts in nine seconds, costs a fortune per kWh, saves the quarter.',
  },
  {
    id: 'solar', name: 'Solar array', glyph: 'sun', tag: 'SOLAR', h: 7, cat: 'power', cost: 130_000, supplyKW: 160,
    upkeep: 25, color: '#4a7fc0', req: 'rnd_solar', solar: true,
    desc: 'Free power between sunrise and sunset. Nothing at 03:00.',
  },
  {
    id: 'wind', name: 'Wind turbine', glyph: 'turbine', tag: 'WIND', h: 52, cat: 'power', cost: 1_100_000, supplyKW: 900,
    upkeep: 320, color: '#7fa8c8', req: 'rnd_wind', wind: true,
    desc: 'Output rides the weather. Averages well, spikes badly.',
  },
  {
    id: 'turbine', name: 'Gas turbine', glyph: 'flame', tag: 'TURBINE', h: 30, cat: 'power', cost: 9_200_000, supplyKW: 9_000,
    upkeep: 4_200, fuel: 0.11, color: '#c0703a', req: 'rnd_turbine', heatOut: 90,
    desc: 'Combined cycle when you bolt a heat recovery unit on the back.',
  },
  {
    id: 'smr', name: 'Small modular reactor', glyph: 'atom', tag: 'REACTOR', h: 38, cat: 'power', cost: 2_400_000_000, supplyKW: 260_000,
    upkeep: 1_100_000, color: '#5fd0a8', req: 'rnd_smr', heatOut: 900,
    desc: '260 MW behind the fence, refuelled once a decade.',
  },
  {
    id: 'fusion', name: 'Fusion tokamak', glyph: 'star', tag: 'FUSION', h: 46, cat: 'power', cost: 900_000_000_000, supplyKW: 6_000_000,
    upkeep: 90_000_000, color: '#9ff0d8', req: 'rnd_fusion', heatOut: 12_000,
    desc: 'Twenty years away, as always. You got there first.',
  },

  // ---------------------------------------------------------------- cooling
  {
    id: 'fan', name: 'Box fan', glyph: 'fan', tag: 'FAN', h: 11, cat: 'cooling', cost: 250, radius: 2, coolCap: 3.5,
    draw: 0.12, upkeep: 1, color: '#3fb98a',
    desc: 'Moves hot air somewhere else. Somewhere else is also the room.',
  },
  {
    id: 'split', name: 'Split AC unit', glyph: 'fan', tag: 'AC UNIT', h: 16, cat: 'cooling', cost: 5_200, radius: 3, coolCap: 22,
    draw: 0.9, water: 0.012, upkeep: 8, color: '#45c99a', req: 'rnd_split',
    desc: 'A real compressor with a condenser hanging off the wall.',
  },
  {
    id: 'crac', name: 'CRAC unit', glyph: 'coil', tag: 'CRAC', h: 26, cat: 'cooling', cost: 95_000, radius: 4, coolCap: 190,
    draw: 6.5, water: 0.028, upkeep: 120, color: '#4fdca8', req: 'rnd_crac',
    desc: 'Computer room air conditioning, blowing into a raised floor.',
  },
  {
    id: 'chiller', name: 'Chilled water plant', glyph: 'coil', tag: 'CHILLER', h: 30, cat: 'cooling', cost: 2_100_000, radius: 5,
    coolCap: 1_800, draw: 42, water: 0.045, upkeep: 2_600, color: '#5fe8c0', req: 'rnd_chiller',
    desc: 'Chillers, pumps and a loop that runs the whole hall.',
  },
  {
    id: 'freecool', name: 'Free-cooling gallery', glyph: 'louvre', tag: 'ECON', h: 24, cat: 'cooling', cost: 46_000_000, radius: 6,
    coolCap: 17_000, draw: 190, water: 0.020, upkeep: 34_000, color: '#7ff0d0', req: 'rnd_freecool',
    ambient: true,
    desc: 'Louvres and economisers. Nearly free when the night is cold.',
  },
  {
    id: 'adiabatic', name: 'Adiabatic tower', glyph: 'cooltower', tag: 'ADIABAT', h: 40, cat: 'cooling', cost: 700_000_000, radius: 7,
    coolCap: 150_000, draw: 1_100, water: 0.058, upkeep: 480_000, color: '#8ff8dc', req: 'rnd_adiabatic',
    desc: 'Evaporative cooling at scale. Drinks a river, cools a campus.',
  },
  {
    id: 'cryo', name: 'Cryogenic loop', glyph: 'snow', tag: 'CRYO', h: 34, cat: 'cooling', cost: 90_000_000_000, radius: 9,
    coolCap: 2_600_000, draw: 14_000, water: 0.014, upkeep: 22_000_000, color: '#b0ffe8', req: 'rnd_cryo',
    desc: 'Two-phase coolant near its triple point. Sub-ambient everywhere.',
  },

  // ------------------------------------------------------------------ water
  {
    id: 'tank', name: 'Water tank', glyph: 'barrel', tag: 'TANK', h: 20, cat: 'water', cost: 900, supplyWater: 0.06,
    upkeep: 2, color: '#3b7fd0',
    desc: 'A tank somebody refills. Small, dumb, reliable.',
  },
  {
    id: 'mains', name: 'Mains connection', glyph: 'tap', tag: 'MAINS', h: 9, cat: 'water', cost: 18_000, supplyWater: 0.85,
    upkeep: 30, waterCost: 2.2, color: '#4390e0', req: 'rnd_mains',
    desc: 'Municipal supply, metered, and the first thing cut in a drought.',
  },
  {
    id: 'well', name: 'Borehole well', glyph: 'well', tag: 'WELL', h: 14, cat: 'water', cost: 320_000, supplyWater: 9,
    upkeep: 260, draw: 2.4, waterCost: 0.4, color: '#3a78bb', req: 'rnd_well',
    desc: 'Your own aquifer tap. Cheap water, slow recharge.',
  },
  {
    id: 'tower', name: 'Cooling tower', glyph: 'cooltower', tag: 'TOWER', h: 38, cat: 'water', cost: 4_200_000, supplyWater: 80,
    upkeep: 5_800, draw: 26, waterCost: 0.9, color: '#4f9fee', req: 'rnd_tower',
    desc: 'Recirculates the loop. Loses a fraction to the sky as steam.',
  },
  {
    id: 'recycler', name: 'Greywater recycler', glyph: 'recycle', tag: 'RECYCLE', h: 26, cat: 'water', cost: 120_000_000, supplyWater: 1_400,
    upkeep: 190_000, draw: 320, waterCost: 0.15, color: '#63b4ff', req: 'rnd_recycler',
    desc: 'Filters and returns 92% of the loop. The regulator loves it.',
  },
  {
    id: 'desal', name: 'Desalination skid', glyph: 'wave', tag: 'DESAL', h: 28, cat: 'water', cost: 22_000_000_000, supplyWater: 34_000,
    upkeep: 26_000_000, draw: 9_000, waterCost: 0.05, color: '#8cd0ff', req: 'rnd_desal',
    desc: 'The sea is right there and it is not getting any smaller.',
  },

  // ---------------------------------------------------------------- support
  {
    id: 'switch', name: 'Top-of-rack switch', glyph: 'switch', tag: 'SWITCH', h: 13, cat: 'support', cost: 900, net: 12,
    draw: 0.25, upkeep: 6, color: '#8f6fd8',
    desc: 'Twelve gigabits of switching for the row.',
  },
  {
    id: 'switch2', name: 'Aggregation switch', glyph: 'switch', tag: 'AGGREG', h: 17, cat: 'support', cost: 180_000, net: 700,
    draw: 2.2, upkeep: 190, color: '#a07fe8', req: 'rnd_switch2',
    desc: 'Spine layer. Now the racks can actually talk to each other.',
  },
  {
    id: 'switch3', name: 'Optical spine', glyph: 'fibre', tag: 'OPTICAL', h: 21, cat: 'support', cost: 24_000_000, net: 45_000,
    draw: 30, upkeep: 21_000, color: '#b494f5', req: 'rnd_switch3',
    desc: 'Coherent optics between halls, at wire speed.',
  },
  {
    id: 'switch4', name: 'Transit landing', glyph: 'globe', tag: 'TRANSIT', h: 27, cat: 'support', cost: 9_000_000_000, net: 3_000_000,
    draw: 600, upkeep: 6_500_000, color: '#c8adff', req: 'rnd_switch4',
    desc: 'Your own subsea landing station. Peering is now free.',
  },
  {
    id: 'office', name: 'Office', glyph: 'desk', tag: 'OFFICE', h: 22, cat: 'support', cost: 26_000, staff: 4,
    draw: 0.8, upkeep: 45, color: '#c9c2b0', req: 'rnd_office',
    desc: 'Desks, a kettle and room for four more people on payroll.',
  },
  {
    id: 'workshop', name: 'Repair workshop', glyph: 'wrench', tag: 'REPAIR', h: 22, cat: 'support', cost: 74_000, repair: 0.55,
    draw: 1.2, upkeep: 130, color: '#b09a72', req: 'rnd_workshop',
    desc: '+55% repair throughput for the whole site.',
  },
  {
    id: 'noc', name: 'Operations centre', glyph: 'screen', tag: 'NOC', h: 24, cat: 'support', cost: 1_600_000, uptime: 0.035,
    draw: 6, upkeep: 2_800, color: '#d0b878', req: 'rnd_noc',
    desc: 'Eyes on glass. Catches faults before the customer does.',
  },
  {
    id: 'security', name: 'Security post', glyph: 'shield', tag: 'SECURE', h: 20, cat: 'support', cost: 420_000, security: 0.3,
    draw: 2, upkeep: 900, color: '#9aa0aa', req: 'rnd_security',
    desc: 'Mantrap, cameras and somebody who reads the badge logs.',
  },
  {
    id: 'lab', name: 'Research lab', glyph: 'flask', tag: 'LAB', h: 24, cat: 'support', cost: 3_800_000, research: 2.2,
    draw: 14, upkeep: 9_500, color: '#e07fa8', req: 'rnd_lab',
    desc: '+2.2 research points per day, on top of your engineers.',
  },
  {
    id: 'sales', name: 'Sales floor', glyph: 'tag', tag: 'SALES', h: 22, cat: 'support', cost: 12_000_000, contract: 1,
    draw: 5, upkeep: 26_000, color: '#e8a05f', req: 'rnd_salesfloor',
    desc: 'One more offer on the board, and better ones.',
  },
  // ================================================================ additions
  //
  // A second option beside most of the ladder rather than a longer ladder.
  // The rule each of these had to meet: it must be worse than its neighbour
  // at something. A building that is strictly better is not a choice, it is
  // a delay before the obvious purchase.

  // ---------------------------------------------------------------- compute
  {
    id: 'rackw', name: 'Wall-mount bracket', glyph: 'rack', tag: 'WALL', h: 20, cat: 'compute', cost: 380, slots: 4,
    draw: 0.01, upkeep: 1, color: '#356ec0', req: 'rnd_wallmount',
    desc: 'Four units screwed to the brickwork. For when the floor is the thing you have run out of.',
  },
  {
    id: 'rack2h', name: 'Half-height cabinet', glyph: 'rack', tag: 'HALF', h: 24, cat: 'compute', cost: 7_400, slots: 11,
    draw: 0.04, upkeep: 5, color: '#4787d4', req: 'rnd_rack2',
    desc: 'Cheaper per slot than the full enclosed rack, and it fits under a low ceiling.',
  },
  {
    id: 'rack3o', name: 'Open-frame hot aisle', glyph: 'rack', tag: 'AISLE', h: 38, cat: 'compute', cost: 190_000, slots: 40,
    draw: 0.1, upkeep: 44, color: '#58a2ea', req: 'rnd_hotaisle',
    desc: 'More slots than the sealed cabinet and none of the containment. Cool it properly or do not use it.',
  },
  {
    id: 'rack4s', name: 'Single-phase bath', glyph: 'tank', tag: 'BATH', h: 14, cat: 'compute', cost: 4_800_000, slots: 44,
    draw: 0.35, upkeep: 520, color: '#6fc4f4', req: 'rnd_rack4',
    coolSelf: 0.3,
    desc: 'Half the price of the full immersion tank and two thirds of the heat it takes off you.',
  },
  {
    id: 'rack6', name: 'Sealed pod', glyph: 'tank', tag: 'POD', h: 46, cat: 'compute', cost: 22_000_000_000, slots: 132,
    draw: 14, upkeep: 1_400_000, color: '#c8f2ff', req: 'rnd_rack6',
    coolSelf: 0.55,
    desc: 'A room inside the room, with its own atmosphere. The most slots anything will ever give you.',
  },

  // ------------------------------------------------------------------ power
  {
    id: 'pdu1b', name: 'Extension reel', glyph: 'plug', tag: 'REEL', h: 10, cat: 'power', cost: 120, radius: 1, powerCap: 11,
    draw: 0.01, upkeep: 1, color: '#c08f32',
    desc: 'Exactly as bad an idea as it looks, and it is what you can afford on day one.',
  },
  {
    id: 'pdu2b', name: 'Three-phase drop', glyph: 'plug', tag: '3-PHASE', h: 18, cat: 'power', cost: 24_000, radius: 2, powerCap: 900,
    draw: 0.08, upkeep: 14, color: '#e0ac44', req: 'rnd_threephase',
    desc: 'Twice the capacity of a rack PDU over a shorter reach. Feeds a dense row, not a floor.',
  },
  {
    id: 'pdu3b', name: 'Overhead bus loop', glyph: 'busbar', tag: 'LOOP', h: 24, cat: 'power', cost: 340_000, radius: 6, powerCap: 6_200,
    draw: 0.5, upkeep: 210, color: '#efbf52', req: 'rnd_busloop',
    desc: 'Less capacity than a busway tap and half the floor again in reach. Buy it for the shape of the room.',
  },
  {
    id: 'battery', name: 'Battery wall', glyph: 'battery', tag: 'BESS', h: 20, cat: 'power', cost: 1_900_000, ride: 220,
    draw: 1.4, upkeep: 1_900, color: '#f0c86a', req: 'rnd_bess',
    desc: 'Lithium iron phosphate by the tonne. Rides out a long cut, and one day it will be recycled.',
  },
  {
    id: 'flywheel', name: 'Flywheel store', glyph: 'battery', tag: 'FLYWHL', h: 18, cat: 'power', cost: 420_000, ride: 35,
    draw: 2.2, upkeep: 700, color: '#e6bb58', req: 'rnd_flywheel',
    desc: 'Thirty-five seconds of spinning steel. Long enough for the generators, and it never degrades.',
  },
  {
    id: 'hydro', name: 'Run-of-river turbine', glyph: 'wave', tag: 'HYDRO', h: 22, cat: 'power', cost: 38_000_000, supplyKW: 2_400,
    upkeep: 28_000, color: '#e9c46a', req: 'rnd_hydro',
    desc: 'The weir was there before you were. Steady, quiet, and the anglers will never forgive you.',
  },
  {
    id: 'geo', name: 'Geothermal well', glyph: 'well', tag: 'GEO', h: 16, cat: 'power', cost: 240_000_000, supplyKW: 9_800,
    upkeep: 150_000, draw: 40, color: '#f2d07a', req: 'rnd_geo',
    desc: 'Four kilometres down to something that has been hot since before there was a valley.',
  },
  {
    id: 'biogas', name: 'Biogas engine', glyph: 'flame', tag: 'BIOGAS', h: 20, cat: 'power', cost: 6_400_000, supplyKW: 900,
    upkeep: 9_000, fuel: 0.06, heatOut: 260, color: '#e0b84e', req: 'rnd_biogas',
    desc: 'Runs on what the county was paying to bury. Cheaper fuel than the turbine and a great deal more of it.',
  },
  {
    id: 'gridtie', name: 'Second grid feed', glyph: 'transformer', tag: 'FEED 2', h: 30, cat: 'power', cost: 2_800_000_000, supplyKW: 260_000,
    upkeep: 3_400_000, color: '#ffd98f', req: 'rnd_gridtie',
    desc: 'A separate connection from a separate substation, which is the only thing that survives the first one failing.',
  },
  {
    id: 'fission', name: 'Pressurised water plant', glyph: 'reactor', tag: 'PWR', h: 42, cat: 'power', cost: 180_000_000_000, supplyKW: 3_200_000,
    upkeep: 420_000_000, heatOut: 900_000, color: '#ffe6b0', req: 'rnd_fission',
    desc: 'Full scale, not modular. Twelve years of planning inquiry compressed into a purchase order.',
  },

  // ---------------------------------------------------------------- cooling
  {
    id: 'ducted', name: 'Ducted extract', glyph: 'louvre', tag: 'DUCT', h: 14, cat: 'cooling', cost: 1_100, radius: 3, coolCap: 9,
    draw: 0.35, upkeep: 3, color: '#3fc493', req: 'rnd_ducting',
    desc: 'Takes the hot air outside instead of around. Three times the fan for four times the reach.',
  },
  {
    id: 'inrow', name: 'In-row cooler', glyph: 'coil', tag: 'IN-ROW', h: 22, cat: 'cooling', cost: 34_000, radius: 2, coolCap: 120,
    draw: 3.4, water: 0.021, upkeep: 60, color: '#4ad0a0', req: 'rnd_inrow',
    desc: 'Sits in the row and takes the heat where it is made. Short reach, and nothing is wasted.',
  },
  {
    id: 'rdhx', name: 'Rear-door exchanger', glyph: 'coil', tag: 'RDHX', h: 28, cat: 'cooling', cost: 460_000, radius: 3, coolCap: 620,
    draw: 9, water: 0.031, upkeep: 520, color: '#54dcb0', req: 'rnd_rdhx',
    desc: 'A radiator on the back of the cabinet. Passive where it can be, and it never fights the room.',
  },
  {
    id: 'dryair', name: 'Dry cooler bank', glyph: 'louvre', tag: 'DRY', h: 26, cat: 'cooling', cost: 9_800_000, radius: 5, coolCap: 5_200,
    draw: 140, upkeep: 12_000, color: '#6ae6c0', req: 'rnd_dryair',
    ambient: true,
    desc: 'No water at all. Worse than the chiller on a hot afternoon and free of the abstraction licence.',
  },
  {
    id: 'absorb', name: 'Absorption chiller', glyph: 'coil', tag: 'ABSORB', h: 32, cat: 'cooling', cost: 120_000_000, radius: 6,
    coolCap: 42_000, draw: 90, water: 0.049, upkeep: 88_000, color: '#7aeecc', req: 'rnd_absorb',
    desc: 'Runs on the generators’ waste heat rather than on electricity. Almost no draw, and it wants a lot of water.',
  },
  {
    id: 'seawater', name: 'Seawater loop', glyph: 'wave', tag: 'SEA', h: 30, cat: 'cooling', cost: 3_400_000_000, radius: 8,
    coolCap: 620_000, draw: 5_200, water: 0.004, upkeep: 2_100_000, color: '#9af4de', req: 'rnd_seawater',
    desc: 'Pipe it in cold, put it back four degrees warmer, and answer for the four degrees every year.',
  },
  {
    id: 'heatoff', name: 'District heat offtake', glyph: 'coil', tag: 'OFFTAKE', h: 24, cat: 'cooling', cost: 640_000_000, radius: 7,
    coolCap: 95_000, draw: 700, water: 0.006, upkeep: 260_000, color: '#88f0d4', req: 'rnd_heatoff',
    desc: 'Sells the heat to the city instead of throwing it at the sky. There is less city every year to sell it to.',
  },
  {
    id: 'cryo2', name: 'Dilution stage', glyph: 'snow', tag: 'MILLIK', h: 38, cat: 'cooling', cost: 700_000_000_000, radius: 10,
    coolCap: 9_400_000, draw: 42_000, water: 0.010, upkeep: 90_000_000, color: '#d0fff4', req: 'rnd_cryo2',
    desc: 'Millikelvin at the die and a plant room the size of the old foundry. Nothing else will cool what comes next.',
  },

  // ------------------------------------------------------------------ water
  {
    id: 'bowser', name: 'Water bowser', glyph: 'barrel', tag: 'BOWSER', h: 18, cat: 'water', cost: 3_200, supplyWater: 0.3,
    upkeep: 22, waterCost: 4.5, color: '#3570bb',
    desc: 'A tanker on a standing order. Dear per litre and it arrives whatever the mains is doing.',
  },
  {
    id: 'rain', name: 'Rainwater harvesting', glyph: 'recycle', tag: 'RAIN', h: 16, cat: 'water', cost: 46_000, supplyWater: 1.4,
    upkeep: 90, waterCost: 0.05, color: '#4a97e6', req: 'rnd_rain',
    desc: 'The roof is large and the weather is Derbyshire. Nearly free, and it does what the weather does.',
  },
  {
    id: 'river', name: 'River abstraction', glyph: 'wave', tag: 'ABSTRACT', h: 20, cat: 'water', cost: 1_800_000, supplyWater: 26,
    upkeep: 3_400, draw: 6, waterCost: 0.22, color: '#4588cc', req: 'rnd_abstract',
    desc: 'A licence, a screen and a pump. Everything downstream of it is somebody else’s problem.',
  },
  {
    id: 'aquifer', name: 'Deep aquifer array', glyph: 'well', tag: 'DEEP', h: 16, cat: 'water', cost: 62_000_000, supplyWater: 420,
    upkeep: 74_000, draw: 110, waterCost: 0.18, color: '#3f84c4', req: 'rnd_aquifer',
    desc: 'Nine boreholes into water that fell as rain before the Romans. It does not come back.',
  },
  {
    id: 'zld', name: 'Zero liquid discharge', glyph: 'recycle', tag: 'ZLD', h: 30, cat: 'water', cost: 2_600_000_000, supplyWater: 9_800,
    upkeep: 2_900_000, draw: 2_400, waterCost: 0.02, color: '#74c0ff', req: 'rnd_zld',
    desc: 'Nothing leaves the site but steam and salt. The salt is a different department’s problem.',
  },
  {
    id: 'pipeline', name: 'Transfer pipeline', glyph: 'tap', tag: 'PIPE', h: 12, cat: 'water', cost: 46_000_000_000, supplyWater: 78_000,
    upkeep: 54_000_000, draw: 14_000, waterCost: 0.04, color: '#a0dcff', req: 'rnd_pipeline',
    desc: 'Ninety kilometres from a reservoir in another catchment, which is a sentence three inquiries were held about.',
  },

  // ---------------------------------------------------------------- support
  {
    id: 'patch', name: 'Patch panel', glyph: 'switch', tag: 'PATCH', h: 11, cat: 'support', cost: 260, net: 4,
    draw: 0.05, upkeep: 2, color: '#7d60c4',
    desc: 'Four gigabits and a great deal of cable tidying. It is what you have before you have a switch.',
  },
  {
    id: 'switch1b', name: 'Stacked edge switch', glyph: 'switch', tag: 'STACK', h: 15, cat: 'support', cost: 22_000, net: 90,
    draw: 0.9, upkeep: 34, color: '#9878e0', req: 'rnd_stack',
    desc: 'Four top-of-rack switches behaving as one. Cheaper per gigabit than the aggregation layer and no cleverer.',
  },
  {
    id: 'peering', name: 'Peering room', glyph: 'globe', tag: 'PEER', h: 19, cat: 'support', cost: 2_400_000, net: 6_400,
    draw: 9, upkeep: 4_200, color: '#ab88ee', req: 'rnd_peering',
    desc: 'Meet the carriers in a locked cage and stop paying transit to reach the next county.',
  },
  {
    id: 'canteen', name: 'Canteen', glyph: 'desk', tag: 'MESS', h: 20, cat: 'support', cost: 96_000, staff: 6, uptime: 0.008,
    draw: 3, upkeep: 340, color: '#cfc6b2', req: 'rnd_canteen',
    desc: 'Six more on payroll and a reason for the night shift to stay until the end of it.',
  },
  {
    id: 'store', name: 'Spares store', glyph: 'wrench', tag: 'SPARES', h: 20, cat: 'support', cost: 310_000, repair: 0.9,
    draw: 0.6, upkeep: 380, color: '#a8926c', req: 'rnd_spares',
    desc: 'A rack of everything that fails. Repairs stop waiting on a courier from Leeds.',
  },
  {
    id: 'robot', name: 'Robotic swap cell', glyph: 'wrench', tag: 'ROBOT', h: 24, cat: 'support', cost: 78_000_000, repair: 6.5,
    draw: 42, upkeep: 190_000, color: '#c0a882', req: 'rnd_robot',
    desc: 'It pulls the dead sled and racks the new one at four in the morning without being asked twice.',
  },
  {
    id: 'noc2', name: 'Global operations floor', glyph: 'screen', tag: 'GNOC', h: 28, cat: 'support', cost: 260_000_000, uptime: 0.014,
    draw: 60, upkeep: 640_000, color: '#e0cc90', req: 'rnd_noc2',
    desc: 'Follow-the-sun, three shifts, and nobody on it has ever seen the site in daylight.',
  },
  {
    id: 'fire', name: 'Suppression plant', glyph: 'shield', tag: 'FM200', h: 22, cat: 'support', cost: 1_400_000, security: 0.22, uptime: 0.006,
    draw: 1.1, upkeep: 3_100, color: '#8f96a2', req: 'rnd_fire',
    desc: 'Inert gas, very fast valves, and the only system here you hope never reports in.',
  },
  {
    id: 'lab2', name: 'Materials laboratory', glyph: 'flask', tag: 'MATLAB', h: 26, cat: 'support', cost: 420_000_000, research: 34,
    draw: 220, upkeep: 1_100_000, color: '#ea94ba', req: 'rnd_lab2',
    desc: 'Where the next coolant comes from. Fifteen times the output of the research lab and rather more than fifteen times the bill.',
  },
  {
    id: 'legal', name: 'Planning office', glyph: 'tag', tag: 'LEGAL', h: 22, cat: 'support', cost: 46_000_000, contract: 1, uptime: 0.004,
    draw: 6, upkeep: 120_000, color: '#eab07a', req: 'rnd_legal',
    desc: 'Four people whose entire job is the abstraction licence, the grid queue and the inquiry. They pay for themselves.',
  },
  {
    id: 'academy', name: 'Training academy', glyph: 'desk', tag: 'ACADEMY', h: 24, cat: 'support', cost: 8_800_000, staff: 14, repair: 1.4,
    draw: 12, upkeep: 42_000, color: '#d8cfb8', req: 'rnd_academy',
    desc: 'Grows its own technicians, which is the only way to get them once the city stops having any.',
  },

  // ================================================================ the rest
  //
  // Ninety-two more, taking the list to three times what it was. The shape is
  // the same as before — nothing here is strictly better than its neighbour,
  // because a building that is strictly better is not a choice — but it now
  // runs from a forty-pound four-way adaptor to a rectenna field you can see
  // from the motorway, because the sites these go in are ten times the floor
  // they used to be and draw power in gigawatts.

  // ---- compute: twenty more cabinets, and the ladder run out to the new machines.
  {
    id: 'rackshelf', name: 'Shelving unit', glyph: 'rack', tag: 'SHELF', h: 18, cat: 'compute', cost: 180, slots: 3, draw: 0.01, upkeep: 1, color: '#2f63b0',
    desc: 'A steel shelf from a catalogue. Three machines and no pretence of airflow.',
  },
  {
    id: 'rack1b', name: 'Two-post relay rack', glyph: 'rack', tag: '2POST', h: 30, cat: 'compute', cost: 700, slots: 6, draw: 0.02, upkeep: 1, color: '#3a6fbc', req: 'rnd_wallmount',
    desc: 'Open on every side, which is the cheapest cooling there is and the worst security.',
  },
  {
    id: 'rack2s', name: 'Soundproofed cabinet', glyph: 'rack', tag: 'QUIET', h: 34, cat: 'compute', cost: 26_000, slots: 14, draw: 0.09, upkeep: 14, color: '#4d8ad6', req: 'rnd_quietrack',
    desc: 'Lined and sealed. Fewer slots for the same floor, and the office next door stops complaining.',
  },
  {
    id: 'rack2w', name: 'Wide cabinet', glyph: 'rack', tag: 'WIDE', h: 36, cat: 'compute', cost: 38_000, slots: 24, draw: 0.08, upkeep: 16, color: '#5290dc', req: 'rnd_widerack',
    desc: 'Eight hundred millimetres across. More slots per tile than anything at its price, and it eats floor.',
  },
  {
    id: 'rack3c', name: 'Contained cold aisle', glyph: 'rack', tag: 'COLD', h: 40, cat: 'compute', cost: 420_000, slots: 46, draw: 0.2, upkeep: 80, color: '#68b2f8', req: 'rnd_coldaisle',
    desc: 'A sealed corridor of cabinets. The most slots you can cool with air alone.',
  },
  {
    id: 'rack3l', name: 'Liquid-ready cabinet', glyph: 'rack', tag: 'MANIFOLD', h: 40, cat: 'compute', cost: 610_000, slots: 38, draw: 0.22, coolSelf: 0.15, upkeep: 110, color: '#6fb8fa', req: 'rnd_manifold',
    desc: 'Manifolds top and bottom. Takes 15% of its own heat off you before the room sees it.',
  },
  {
    id: 'rack4t', name: 'Twin immersion bath', glyph: 'tank', tag: '2BATH', h: 16, cat: 'compute', cost: 14_000_000, slots: 74, draw: 0.9, coolSelf: 0.45, upkeep: 1_600, color: '#82ccff', req: 'rnd_twinbath',
    desc: 'Two tanks sharing a pump skid. Twice the machines, one set of plumbing.',
  },
  {
    id: 'rack4d', name: 'Dielectric column', glyph: 'tank', tag: 'COLUMN', h: 30, cat: 'compute', cost: 26_000_000, slots: 92, draw: 1.4, coolSelf: 0.5, upkeep: 3_100, color: '#8ed4ff', req: 'rnd_column',
    desc: 'Vertical, and drained from the bottom. Servicing it is an event with a rota and a checklist.',
  },
  {
    id: 'rack5b', name: 'Cryo vault, twin', glyph: 'rack', tag: '2VAULT', h: 44, cat: 'compute', cost: 2_600_000_000, slots: 124, draw: 10, coolSelf: 0.7, upkeep: 180_000, color: '#b8e9ff', req: 'rnd_twinvault',
    desc: 'Two vaults on one cold head. The compressor is louder than the machines it is silencing.',
  },
  {
    id: 'rack6b', name: 'Sealed pod, stacked', glyph: 'rack', tag: '2POD', h: 52, cat: 'compute', cost: 44_000_000_000_000, slots: 196, draw: 26, coolSelf: 0.58, upkeep: 3_400_000, color: '#d4f6ff', req: 'rnd_stackpod',
    desc: 'Pods on pods. The lower ones are serviced from underneath, by people with certificates.',
  },
  {
    id: 'rack7', name: 'Modular hall unit', glyph: 'rack', tag: 'MODULE', h: 48, cat: 'compute', cost: 900_000_000_000_000, slots: 280, draw: 60, coolSelf: 0.6, upkeep: 42_000_000, color: '#c0f0ff', req: 'rnd_modular',
    desc: 'A datacentre in a shipping container, craned into place and commissioned in a week.',
  },
  {
    id: 'rack7b', name: 'Modular hall, quad', glyph: 'rack', tag: '4MOD', h: 48, cat: 'compute', cost: 1_400_000_000_000_000, slots: 420, draw: 92, coolSelf: 0.62, upkeep: 74_000_000, color: '#caf4ff', req: 'rnd_quadmod',
    desc: 'Four modules back to back around a shared plant spine. It arrives on nine lorries.',
  },
  {
    id: 'rack8', name: 'Vacuum enclosure', glyph: 'tank', tag: 'VACUUM', h: 50, cat: 'compute', cost: 18_000_000_000_000_000, slots: 600, draw: 180, coolSelf: 0.72, upkeep: 520_000_000, color: '#dcf9ff', req: 'rnd_vacuumrack',
    desc: 'Pumped down to almost nothing. No air means no convection and no dust, and a door you cannot just open.',
  },
  {
    id: 'rack8b', name: 'Vacuum enclosure, deep', glyph: 'tank', tag: 'DEEPVAC', h: 54, cat: 'compute', cost: 26_000_000_000_000_000, slots: 780, draw: 260, coolSelf: 0.75, upkeep: 840_000_000, color: '#e4fbff', req: 'rnd_deepvac',
    desc: 'Deeper, colder, and rated to hold for a fortnight if the pumps stop. They have not stopped.',
  },
  {
    id: 'rack9', name: 'Superconducting frame bay', glyph: 'rack', tag: 'SCBAY', h: 56, cat: 'compute', cost: 400_000_000_000_000_000, slots: 1_100, draw: 600, coolSelf: 0.8, upkeep: 9_000_000_000, color: '#eefdff', req: 'rnd_scbay',
    desc: 'The bay is the cryostat. Everything in it floats a degree above absolute nothing.',
  },
  {
    id: 'rack9b', name: 'Superconducting hall', glyph: 'rack', tag: 'SCHALL', h: 58, cat: 'compute', cost: 620_000_000_000_000_000, slots: 1_600, draw: 900, coolSelf: 0.82, upkeep: 14_000_000_000, color: '#f4feff', req: 'rnd_schall',
    desc: 'A hall built as one cryostat. There is no room temperature anywhere inside it.',
  },
  {
    id: 'rack10', name: 'Orbital docking frame', glyph: 'rack', tag: 'DOCK', h: 44, cat: 'compute', cost: 9_000_000_000_000_000_000, slots: 2_400, draw: 1_400, coolSelf: 0.55, upkeep: 180_000_000_000, color: '#ffffff', req: 'rnd_dockframe',
    desc: 'Holds what comes back down and what is about to go up. Most of the fleet is never in it.',
  },
  {
    id: 'rack10b', name: 'Tether anchor bay', glyph: 'rack', tag: 'ANCHOR', h: 60, cat: 'compute', cost: 14_000_000_000_000_000_000, slots: 3_200, draw: 2_200, coolSelf: 0.58, upkeep: 290_000_000_000, color: '#ffffff', req: 'rnd_anchor',
    desc: 'The ground end of the ribbon. It is the heaviest thing anybody has ever bolted to bedrock.',
  },
  {
    id: 'rack11', name: 'Substrate cradle', glyph: 'rack', tag: 'CRADLE', h: 40, cat: 'compute', cost: 120_000_000_000_000_000_000, slots: 4_600, draw: 3_000, coolSelf: 0.85, upkeep: 1_900_000_000_000, color: '#ffffff', req: 'rnd_cradle',
    desc: 'It holds something that changes shape. The cradle is the only part with a fixed specification.',
  },
  {
    id: 'rack11b', name: 'The last frame', glyph: 'rack', tag: 'LAST', h: 62, cat: 'compute', cost: 600_000_000_000_000_000_000, slots: 6_800, draw: 4_800, coolSelf: 0.9, upkeep: 9_000_000_000_000, color: '#ffffff', req: 'rnd_lastframe',
    desc: 'Nothing goes in it that anybody has a word for. It is a shelf, at the end of all the shelves.',
  },


  // ---- power: distribution, storage and generation for the new scale.
  {
    id: 'pdu0', name: 'Four-way adaptor', glyph: 'plug', tag: 'ADAPTOR', h: 8, cat: 'power', cost: 40, radius: 1, powerCap: 4, draw: 0.005, upkeep: 1, color: '#b07d28',
    desc: 'Fused, just about. It is what the cupboard came with.',
  },
  {
    id: 'pdu1c', name: 'Metered strip', glyph: 'plug', tag: 'METER', h: 13, cat: 'power', cost: 1_100, radius: 2, powerCap: 52, draw: 0.03, upkeep: 2, color: '#c89234', req: 'rnd_metering',
    desc: 'Tells you what each socket is drawing, which is the first step to it being less.',
  },
  {
    id: 'pdu2c', name: 'Floor box', glyph: 'plug', tag: 'FLOORBOX', h: 14, cat: 'power', cost: 9_400, radius: 3, powerCap: 260, draw: 0.04, upkeep: 8, color: '#dca63e', req: 'rnd_floorbox',
    desc: 'Under the raised floor and out of the way. Modest capacity, and nothing to trip over.',
  },
  {
    id: 'pdu2d', name: 'Switched PDU bank', glyph: 'plug', tag: 'SWBANK', h: 20, cat: 'power', cost: 44_000, radius: 3, powerCap: 1_400, draw: 0.12, upkeep: 26, color: '#e6b048', req: 'rnd_swbank',
    desc: 'Every outlet can be cut from a screen, which is worth more at three in the morning than it sounds.',
  },
  {
    id: 'pdu3c', name: 'Busway riser', glyph: 'plug', tag: 'RISER', h: 26, cat: 'power', cost: 220_000, radius: 5, powerCap: 4_600, draw: 0.35, upkeep: 140, color: '#f0bc56', req: 'rnd_riser',
    desc: 'Vertical, feeding four rows from one tap point.',
  },
  {
    id: 'pdu3d', name: 'Ring main unit', glyph: 'plug', tag: 'RING', h: 24, cat: 'power', cost: 620_000, radius: 5, powerCap: 14_000, draw: 0.6, upkeep: 320, color: '#f4c464', req: 'rnd_ringmain',
    desc: 'A loop rather than a spur, so one fault does not take a row with it.',
  },
  {
    id: 'pdu4b', name: 'Unit substation', glyph: 'plug', tag: 'UNITSUB', h: 30, cat: 'power', cost: 14_000_000, radius: 7, powerCap: 280_000, draw: 5, upkeep: 7_200, color: '#ffd070', req: 'rnd_unitsub',
    desc: 'Transformer, switchgear and a fence, delivered as one object.',
  },
  {
    id: 'pdu4c', name: 'Primary switchroom', glyph: 'plug', tag: 'PRIMARY', h: 32, cat: 'power', cost: 62_000_000, radius: 8, powerCap: 900_000, draw: 14, upkeep: 26_000, color: '#ffd884', req: 'rnd_primary',
    desc: 'Where the site meets the network. Two engineers have keys and neither of them is you.',
  },
  {
    id: 'pdu5b', name: 'HVDC ring', glyph: 'plug', tag: 'HVDCRING', h: 36, cat: 'power', cost: 3_400_000_000, radius: 11, powerCap: 6_000_000, draw: 90, upkeep: 1_400_000, color: '#ffe49c', req: 'rnd_hvdcring',
    desc: 'Direct current all the way round the campus. Fewer conversions, fewer losses, far more copper.',
  },
  {
    id: 'pdu6', name: 'Transmission tie', glyph: 'plug', tag: 'TIE', h: 40, cat: 'power', cost: 90_000_000_000, radius: 14, powerCap: 40_000_000, draw: 600, upkeep: 32_000_000, color: '#fff0c0', req: 'rnd_transtie',
    desc: 'Four hundred kilovolts, straight off the national network, into a yard you own.',
  },
  {
    id: 'pdu7', name: 'Continental interconnect', glyph: 'plug', tag: 'INTERCON', h: 44, cat: 'power', cost: 2_600_000_000_000, radius: 18, powerCap: 300_000_000, draw: 4_200, upkeep: 900_000_000, color: '#fff6d8', req: 'rnd_intercon',
    desc: 'Power from three countries, dispatched to whichever hall is awake.',
  },
  {
    id: 'ups2', name: 'UPS room', glyph: 'battery', tag: 'UPSROOM', h: 22, cat: 'power', cost: 86_000, ride: 90, draw: 0.9, upkeep: 260, color: '#e8bb52', req: 'rnd_upsroom',
    desc: 'A room of batteries and a floor rated for them. Ninety seconds is a long time.',
  },
  {
    id: 'battery2', name: 'Grid battery yard', glyph: 'battery', tag: 'YARD', h: 22, cat: 'power', cost: 64_000_000, ride: 1_800, draw: 22, upkeep: 94_000, color: '#f2ca6a', req: 'rnd_batteryyard',
    desc: 'Half an hour of the whole site, in containers, in a compound with its own fire plan.',
  },
  {
    id: 'hydrostore', name: 'Pumped storage tie', glyph: 'battery', tag: 'PUMPED', h: 34, cat: 'power', cost: 1_900_000_000, ride: 14_000, draw: 140, upkeep: 2_600_000, color: '#f8d484', req: 'rnd_pumped',
    desc: 'A reservoir up the valley and a turbine hall under it. Four hours, whenever you want them.',
  },
  {
    id: 'flow', name: 'Flow battery hall', glyph: 'battery', tag: 'FLOW', h: 26, cat: 'power', cost: 420_000_000, ride: 5_200, draw: 60, upkeep: 640_000, color: '#f5cf78', req: 'rnd_flow',
    desc: 'Tanks of electrolyte. It degrades so slowly that nobody has established how slowly.',
  },
  {
    id: 'inertia', name: 'Synchronous condenser', glyph: 'battery', tag: 'INERTIA', h: 28, cat: 'power', cost: 120_000_000, ride: 140, draw: 190, upkeep: 210_000, color: '#eec468', req: 'rnd_inertia',
    desc: 'Spinning mass that holds the frequency up. The network pays you for having it.',
  },
  {
    id: 'solar2', name: 'Solar canopy', glyph: 'transformer', tag: 'CANOPY', h: 12, cat: 'power', cost: 2_400_000, supplyKW: 420, upkeep: 6_800, color: '#efc25c', req: 'rnd_canopy',
    desc: 'Over the car park, which nobody was using for anything else.',
  },
  {
    id: 'wind2', name: 'Offshore share', glyph: 'transformer', tag: 'OFFSHORE', h: 34, cat: 'power', cost: 140_000_000, supplyKW: 26_000, upkeep: 520_000, color: '#f0c65e', req: 'rnd_offshore',
    desc: 'A slice of somebody else’s array, contracted for fifteen years.',
  },
  {
    id: 'tidal', name: 'Tidal lagoon share', glyph: 'transformer', tag: 'TIDAL', h: 26, cat: 'power', cost: 680_000_000, supplyKW: 94_000, upkeep: 3_100_000, color: '#f2cb6a', req: 'rnd_tidal',
    desc: 'Predictable to the minute for the next century, which no other renewable manages.',
  },
  {
    id: 'smr2', name: 'Modular reactor, quad', glyph: 'reactor', tag: '4SMR', h: 40, cat: 'power', cost: 42_000_000_000, supplyKW: 1_400_000, heatOut: 420_000, upkeep: 140_000_000, color: '#ffe0a0', req: 'rnd_smr2',
    desc: 'Four units in one containment. The refuelling outage is staggered so the site never notices.',
  },
  {
    id: 'fusion2', name: 'Tokamak, second unit', glyph: 'reactor', tag: '2TOK', h: 46, cat: 'power', cost: 4_200_000_000_000, supplyKW: 42_000_000, heatOut: 6_000_000, upkeep: 9_000_000_000, color: '#fff2c8', req: 'rnd_fusion2',
    desc: 'The second one was easier. Everything after the first one is.',
  },
  {
    id: 'fusion3', name: 'Fusion park', glyph: 'reactor', tag: 'PARK', h: 48, cat: 'power', cost: 90_000_000_000_000, supplyKW: 400_000_000, heatOut: 48_000_000, upkeep: 120_000_000_000, color: '#fff8e0', req: 'rnd_fusionpark',
    desc: 'Six machines and a tritium plant. The valley has a new skyline and a new economy.',
  },
  {
    id: 'antimatter', name: 'Annihilation cell', glyph: 'reactor', tag: 'AM', h: 42, cat: 'power', cost: 6_000_000_000_000_000, supplyKW: 9_000_000_000, heatOut: 700_000_000, upkeep: 900_000_000_000, color: '#fffdf0', req: 'rnd_annihilation',
    desc: 'Milligrams at a time, and the containment is the entire expense.',
  },
  {
    id: 'starlift', name: 'Orbital collector tie', glyph: 'transformer', tag: 'COLLECT', h: 38, cat: 'power', cost: 200_000_000_000_000_000, supplyKW: 300_000_000_000, upkeep: 20_000_000_000_000, color: '#ffffff', req: 'rnd_collector',
    desc: 'It never sets up there. The rectenna field is visible from the motorway.',
  },


  // ---- cooling: fifteen more, from a desk fan to a radiator above the sky.
  {
    id: 'deskfan', name: 'Desk fan', glyph: 'fan', tag: 'DESK', h: 9, cat: 'cooling', cost: 45, radius: 1, coolCap: 1.1, draw: 0.05, upkeep: 1, color: '#37ab80',
    desc: 'Somebody brought it in from home. It is doing its best.',
  },
  {
    id: 'extract', name: 'Wall extractor', glyph: 'fan', tag: 'EXTRACT', h: 12, cat: 'cooling', cost: 420, radius: 2, coolCap: 5, draw: 0.18, upkeep: 2, color: '#3bb488', req: 'rnd_extractor',
    desc: 'A hole in the wall and a fan in the hole. Free when it is cold out and useless when it is not.',
  },
  {
    id: 'portable', name: 'Portable AC', glyph: 'fan', tag: 'PORTABLE', h: 15, cat: 'cooling', cost: 2_100, radius: 2, coolCap: 13, draw: 0.62, water: 0.008, upkeep: 5, color: '#41c092', req: 'rnd_portable',
    desc: 'On castors, with a hose out the window. Nobody is proud of it.',
  },
  {
    id: 'split2', name: 'Split AC, three-phase', glyph: 'fan', tag: '3PHAC', h: 18, cat: 'cooling', cost: 14_000, radius: 3, coolCap: 58, draw: 2.1, water: 0.016, upkeep: 18, color: '#47cb9c', req: 'rnd_split2',
    desc: 'A proper outdoor unit on a frame. Four times the room for three times the bill.',
  },
  {
    id: 'crac2', name: 'CRAC, high sensible', glyph: 'coil', tag: 'HISENS', h: 26, cat: 'cooling', cost: 180_000, radius: 4, coolCap: 420, draw: 13, water: 0.024, upkeep: 260, color: '#4fd4a4', req: 'rnd_crac2',
    desc: 'Tuned to move heat rather than wring out water, which is what a server room actually needs.',
  },
  {
    id: 'crah', name: 'CRAH unit', glyph: 'coil', tag: 'CRAH', h: 26, cat: 'cooling', cost: 260_000, radius: 4, coolCap: 640, draw: 8, water: 0.03, upkeep: 380, color: '#55dcac', req: 'rnd_crah',
    desc: 'Chilled water rather than a compressor. It needs a plant behind it and it repays that.',
  },
  {
    id: 'chiller2', name: 'Chiller, centrifugal', glyph: 'coil', tag: 'CENTRIF', h: 32, cat: 'cooling', cost: 6_400_000, radius: 5, coolCap: 5_600, draw: 112, water: 0.04, upkeep: 8_200, color: '#5fe4b8', req: 'rnd_chiller2',
    desc: 'Magnetic bearings and nothing touching. Quiet, efficient and appalling to repair.',
  },
  {
    id: 'chiller3', name: 'Chiller farm', glyph: 'coil', tag: 'FARM', h: 32, cat: 'cooling', cost: 34_000_000, radius: 6, coolCap: 24_000, draw: 470, water: 0.042, upkeep: 42_000, color: '#66ecc0', req: 'rnd_chiller3',
    desc: 'Eight machines on a common header, sequenced so only what is needed is running.',
  },
  {
    id: 'freecool2', name: 'Indirect economiser', glyph: 'louvre', tag: 'INDIRECT', h: 26, cat: 'cooling', cost: 120_000_000, radius: 6, coolCap: 42_000, draw: 390, water: 0.012, upkeep: 88_000, color: '#72f2c8', req: 'rnd_indirect', ambient: true,
    desc: 'A wheel between two air streams. The outside air never touches the hall.',
  },
  {
    id: 'adiabatic2', name: 'Adiabatic bank', glyph: 'cooltower', tag: 'ADBANK', h: 40, cat: 'cooling', cost: 1_600_000_000, radius: 8, coolCap: 320_000, draw: 2_400, water: 0.05, upkeep: 1_100_000, color: '#84f8d4', req: 'rnd_adbank',
    desc: 'A row of towers and a pond. On a dry August you watch the pond.',
  },
  {
    id: 'pcm', name: 'Thermal store', glyph: 'coil', tag: 'STORE', h: 24, cat: 'cooling', cost: 260_000_000, radius: 5, coolCap: 68_000, draw: 140, water: 0.008, upkeep: 190_000, color: '#7af4cc', req: 'rnd_pcm',
    desc: 'Freezes at night when power is cheap and melts through the afternoon when it is not.',
  },
  {
    id: 'deepwater', name: 'Deep water intake', glyph: 'coil', tag: 'DEEP', h: 28, cat: 'cooling', cost: 9_000_000_000, radius: 9, coolCap: 1_400_000, draw: 9_000, water: 0.003, upkeep: 4_800_000, color: '#90fade', req: 'rnd_deepwater', ambient: true,
    desc: 'Four degrees all year at the bottom of the lake, and a licence that took six years.',
  },
  {
    id: 'cryo3', name: 'Dilution cascade', glyph: 'snow', tag: 'CASCADE', h: 40, cat: 'cooling', cost: 4_000_000_000_000, radius: 11, coolCap: 42_000_000, draw: 160_000, water: 0.008, upkeep: 420_000_000, color: '#dcfff6', req: 'rnd_cascade',
    desc: 'Stages within stages. The last one is colder than anywhere else in the solar system.',
  },
  {
    id: 'radiator', name: 'Orbital radiator tie', glyph: 'louvre', tag: 'RADIATE', h: 36, cat: 'cooling', cost: 120_000_000_000_000, radius: 14, coolCap: 900_000_000, draw: 1_400_000, upkeep: 14_000_000_000, color: '#ffffff', req: 'rnd_radiator', ambient: true,
    desc: 'Throws the heat at the sky properly, from above the sky.',
  },
  {
    id: 'heatsink', name: 'Bedrock heat sink', glyph: 'coil', tag: 'BEDROCK', h: 20, cat: 'cooling', cost: 600_000_000_000, radius: 10, coolCap: 6_400_000, draw: 42_000, water: 0.002, upkeep: 90_000_000, color: '#c8fff0', req: 'rnd_bedrock', ambient: true,
    desc: 'Nine hundred boreholes into rock that has not moved since the Carboniferous.',
  },

  // ---- water: twelve more, from a barrel to capsules coming down from orbit.
  {
    id: 'butt', name: 'Water butt', glyph: 'barrel', tag: 'BUTT', h: 14, cat: 'water', cost: 140, supplyWater: 0.02, upkeep: 1, color: '#2f6aad',
    desc: 'Off the roof, into a barrel. It is free and it is not very much.',
  },
  {
    id: 'mains2', name: 'Second mains feed', glyph: 'tap', tag: 'MAINS2', h: 10, cat: 'water', cost: 62_000, supplyWater: 3.2, waterCost: 2.4, upkeep: 90, color: '#3f88d4', req: 'rnd_mains2',
    desc: 'A separate main from a separate direction, for the week the first one is dug up.',
  },
  {
    id: 'well2', name: 'Well field', glyph: 'well', tag: 'FIELD', h: 14, cat: 'water', cost: 1_200_000, supplyWater: 34, draw: 9, waterCost: 0.36, upkeep: 900, color: '#3d7fc4', req: 'rnd_wellfield',
    desc: 'Six boreholes on a manifold, pumped in rotation so none of them runs dry.',
  },
  {
    id: 'tower2', name: 'Tower bank', glyph: 'cooltower', tag: 'TOWERS', h: 38, cat: 'water', cost: 18_000_000, supplyWater: 340, draw: 98, waterCost: 0.8, upkeep: 24_000, color: '#529ff0', req: 'rnd_towerbank',
    desc: 'Six cells and a plume you can see from the bypass.',
  },
  {
    id: 'recycler2', name: 'Membrane plant', glyph: 'recycle', tag: 'MEMBRANE', h: 26, cat: 'water', cost: 420_000_000, supplyWater: 4_600, draw: 920, waterCost: 0.12, upkeep: 620_000, color: '#6ab8ff', req: 'rnd_membraneplant',
    desc: 'Reverse osmosis at scale. Ninety-six per cent comes back and the rest is brine.',
  },
  {
    id: 'atmospheric', name: 'Atmospheric extractor', glyph: 'wave', tag: 'ATMOS', h: 22, cat: 'water', cost: 9_400_000_000, supplyWater: 18_000, draw: 6_200, waterCost: 0.09, upkeep: 12_000_000, color: '#7cc4ff', req: 'rnd_atmos',
    desc: 'Condenses it straight out of the air. Absurd anywhere it rains, and it no longer rains here.',
  },
  {
    id: 'desal2', name: 'Desalination plant', glyph: 'wave', tag: 'DESAL2', h: 30, cat: 'water', cost: 140_000_000_000, supplyWater: 220_000, draw: 54_000, waterCost: 0.04, upkeep: 180_000_000, color: '#98d6ff', req: 'rnd_desal2',
    desc: 'A proper plant, not a skid. It supplies the town as well, which was the condition.',
  },
  {
    id: 'glacier', name: 'Glacial meltwater tie', glyph: 'wave', tag: 'GLACIAL', h: 24, cat: 'water', cost: 2_600_000_000_000, supplyWater: 1_400_000, draw: 190_000, waterCost: 0.02, upkeep: 2_400_000_000, color: '#b4e4ff', req: 'rnd_glacial',
    desc: 'Piped from a catchment that is shrinking measurably every year you use it.',
  },
  {
    id: 'synth', name: 'Synthesis plant', glyph: 'wave', tag: 'SYNTH', h: 28, cat: 'water', cost: 90_000_000_000_000, supplyWater: 9_000_000, draw: 2_400_000, waterCost: 0.01, upkeep: 64_000_000_000, color: '#d0f0ff', req: 'rnd_synth',
    desc: 'Hydrogen and oxygen, made into water on purpose, because it is cheaper than moving it.',
  },
  {
    id: 'closed', name: 'Closed cycle hall', glyph: 'recycle', tag: 'CLOSED', h: 20, cat: 'water', cost: 600_000_000_000, supplyWater: 64_000, draw: 14_000, waterCost: 0.005, upkeep: 900_000_000, color: '#a8dcff', req: 'rnd_closedcycle',
    desc: 'Nothing leaves. The same water has been round this loop nine thousand times.',
  },
  {
    id: 'cometary', name: 'Volatile delivery', glyph: 'wave', tag: 'VOLATILE', h: 32, cat: 'water', cost: 9_000_000_000_000_000, supplyWater: 90_000_000, draw: 19_000_000, waterCost: 0.002, upkeep: 1_400_000_000_000, color: '#ffffff', req: 'rnd_volatile',
    desc: 'It comes down in shielded capsules. The insurance took longer than the engineering.',
  },
  {
    id: 'recyc3', name: 'Total recovery loop', glyph: 'recycle', tag: 'TOTAL', h: 26, cat: 'water', cost: 40_000_000_000_000, supplyWater: 2_600_000, draw: 420_000, waterCost: 0.003, upkeep: 48_000_000_000, color: '#c0eaff', req: 'rnd_totalloop',
    desc: 'Every molecule accounted for, including the ones in the air the staff breathe out.',
  },

  // ---- support: network, people, repair, security and the long view.
  {
    id: 'cable', name: 'Cable tray run', glyph: 'switch', tag: 'TRAY', h: 10, cat: 'support', cost: 120, net: 2, draw: 0.02, upkeep: 1, color: '#6f56b8',
    desc: 'Not a switch. It is what stops the switches being a fire.',
  },
  {
    id: 'switch1c', name: 'Managed edge switch', glyph: 'switch', tag: 'MANAGED', h: 14, cat: 'support', cost: 4_200, net: 26, draw: 0.4, upkeep: 12, color: '#8a6ad4', req: 'rnd_managed',
    desc: 'Twenty-six gigabits and a console port somebody will eventually need.',
  },
  {
    id: 'switch2b', name: 'Leaf pair', glyph: 'switch', tag: 'LEAF', h: 17, cat: 'support', cost: 64_000, net: 320, draw: 1.4, upkeep: 76, color: '#9874e0', req: 'rnd_leafpair',
    desc: 'Two of them, so a reboot is a Tuesday and not an outage.',
  },
  {
    id: 'switch3b', name: 'DWDM terminal', glyph: 'fibre', tag: 'DWDM', h: 20, cat: 'support', cost: 4_800_000, net: 12_000, draw: 14, upkeep: 6_400, color: '#a884ec', req: 'rnd_dwdm',
    desc: 'Eighty wavelengths down one strand of glass that was already in the ground.',
  },
  {
    id: 'switch4b', name: 'Cable landing, second', glyph: 'globe', tag: 'LAND2', h: 28, cat: 'support', cost: 26_000_000_000, net: 9_000_000, draw: 1_800, upkeep: 18_000_000, color: '#c0a0ff', req: 'rnd_land2',
    desc: 'A second shore and a second set of permits. Nothing important should have one route.',
  },
  {
    id: 'switch5', name: 'Satellite uplink farm', glyph: 'globe', tag: 'UPLINK', h: 30, cat: 'support', cost: 900_000_000_000, net: 120_000_000, draw: 42_000, upkeep: 640_000_000, color: '#d0b8ff', req: 'rnd_uplink',
    desc: 'Four hundred dishes tracking whatever is overhead. Weather is now an operational concern.',
  },
  {
    id: 'switch6', name: 'Quantum repeater chain', glyph: 'globe', tag: 'QREPEAT', h: 24, cat: 'support', cost: 64_000_000_000_000, net: 2_400_000_000, draw: 900_000, upkeep: 42_000_000_000, color: '#e0d0ff', req: 'rnd_qrepeat',
    desc: 'Entanglement held across the continent. Nobody can listen and everybody has tried.',
  },
  {
    id: 'office2', name: 'Open plan floor', glyph: 'desk', tag: 'FLOOR', h: 24, cat: 'support', cost: 320_000, staff: 18, draw: 4, upkeep: 980, color: '#d4cdbb', req: 'rnd_openplan',
    desc: 'Desks for eighteen and a coffee machine that is the real reason anyone comes in.',
  },
  {
    id: 'office3', name: 'Head office', glyph: 'desk', tag: 'HQ', h: 30, cat: 'support', cost: 42_000_000, staff: 64, draw: 32, upkeep: 260_000, color: '#ddd6c4', req: 'rnd_hq',
    desc: 'A reception with a sculpture in it. The sculpture is in the annual report.',
  },
  {
    id: 'dorm', name: 'Staff accommodation', glyph: 'desk', tag: 'DORM', h: 24, cat: 'support', cost: 6_400_000, staff: 32, uptime: 0.01, draw: 14, upkeep: 54_000, color: '#cfc8b6', req: 'rnd_dorm',
    desc: 'The town has no housing left, so the company built some. It is not a gesture.',
  },
  {
    id: 'workshop2', name: 'Machine shop', glyph: 'wrench', tag: 'SHOP', h: 22, cat: 'support', cost: 1_900_000, repair: 2.4, draw: 9, upkeep: 4_800, color: '#b8a078', req: 'rnd_machineshop',
    desc: 'Makes the bracket nobody sells any more, at four in the afternoon, out of stock bar.',
  },
  {
    id: 'robot2', name: 'Autonomous logistics floor', glyph: 'wrench', tag: 'AUTOLOG', h: 26, cat: 'support', cost: 900_000_000, staff: 8, repair: 18, draw: 280, upkeep: 2_600_000, color: '#c8b088', req: 'rnd_autolog',
    desc: 'The sleds move themselves. People are there to sign for the lorries.',
  },
  {
    id: 'noc3', name: 'Predictive operations', glyph: 'screen', tag: 'PREDICT', h: 26, cat: 'support', cost: 4_200_000_000, uptime: 0.02, draw: 190, upkeep: 12_000_000, color: '#e8d49c', req: 'rnd_predict',
    desc: 'It tells you what will fail on Thursday, and by Thursday it has usually been right.',
  },
  {
    id: 'security2', name: 'Perimeter and patrol', glyph: 'shield', tag: 'PERIMETER', h: 22, cat: 'support', cost: 9_400_000, security: 0.5, draw: 18, upkeep: 42_000, color: '#a4aab4', req: 'rnd_perimeter',
    desc: 'Fence, dogs, cameras and a gatehouse with a barrier that has stopped two lorries.',
  },
  {
    id: 'security3', name: 'Counter-intrusion centre', glyph: 'shield', tag: 'COUNTER', h: 26, cat: 'support', cost: 1_400_000_000, uptime: 0.006, security: 0.8, draw: 90, upkeep: 3_400_000, color: '#b0b6c0', req: 'rnd_counter',
    desc: 'They run the exercises against themselves, and they usually get in.',
  },
  {
    id: 'lab3', name: 'Fundamental research institute', glyph: 'flask', tag: 'INSTITUTE', h: 30, cat: 'support', cost: 18_000_000_000, research: 420, draw: 4_200, upkeep: 64_000_000, color: '#f0a4c4', req: 'rnd_institute',
    desc: 'Two hundred people with no deliverables and a budget line nobody questions.',
  },
  {
    id: 'lab4', name: 'Theory division', glyph: 'flask', tag: 'THEORY', h: 28, cat: 'support', cost: 900_000_000_000, research: 9_400, draw: 42_000, upkeep: 2_600_000_000, color: '#f4b0cc', req: 'rnd_theory',
    desc: 'Nine of them, and a blackboard that is cleaned once a year with a ceremony.',
  },
  {
    id: 'sales2', name: 'Enterprise accounts', glyph: 'tag', tag: 'ACCOUNTS', h: 22, cat: 'support', cost: 180_000_000, contract: 1, draw: 26, upkeep: 900_000, color: '#eeb078', req: 'rnd_accounts',
    desc: 'One person per customer, and the customers are countries.',
  },
  {
    id: 'sales3', name: 'Sovereign relations', glyph: 'tag', tag: 'SOVEREIGN', h: 26, cat: 'support', cost: 42_000_000_000, uptime: 0.004, contract: 2, draw: 140, upkeep: 180_000_000, color: '#f2bc88', req: 'rnd_sovereign',
    desc: 'A floor of people whose job is that nobody legislates you out of existence.',
  },
  {
    id: 'archive', name: 'Records vault', glyph: 'shield', tag: 'RECORDS', h: 20, cat: 'support', cost: 120_000_000, security: 0.15, research: 34, draw: 42, upkeep: 640_000, color: '#9aa4ae', req: 'rnd_records',
    desc: 'Everything the company has ever done, on media that will outlast the company.',
  },
  {
    id: 'museum', name: 'Visitor centre', glyph: 'desk', tag: 'VISITOR', h: 22, cat: 'support', cost: 2_400_000_000, uptime: 0.002, contract: 1, draw: 64, upkeep: 9_400_000, color: '#d8c8a0', req: 'rnd_visitor',
    desc: 'A viewing gallery over Hall A and a display about the valley before the valley was this.',
  },


  // ---- the rungs each ladder was still missing in the middle.
  {
    id: 'cohalfrack', name: 'Half-rack', glyph: 'rack', tag: 'HALF', h: 22, cat: 'compute', cost: 3_400, slots: 7,
    draw: 0.03, upkeep: 4, color: '#4480cc', req: 'rnd_cohalfrack',
    desc: 'One more rung, where the ladder had a gap.',
  },
  {
    id: 'codeepcabinet', name: 'Deep cabinet', glyph: 'rack', tag: 'DEEP', h: 38, cat: 'compute', cost: 86_000, slots: 26,
    draw: 0.1, upkeep: 34, color: '#5698e2', req: 'rnd_codeepcabinet',
    desc: 'One more rung, where the ladder had a gap.',
  },
  {
    id: 'coreardoorcabi', name: 'Rear-door cabinet', glyph: 'rack', tag: 'RDX', h: 40, cat: 'compute', cost: 1_400_000, slots: 44,
    draw: 0.3, upkeep: 210, color: '#63a8ec', req: 'rnd_coreardoorcabi',
    desc: 'One more rung, where the ladder had a gap.',
  },
  {
    id: 'cosledchassis', name: 'Sled chassis', glyph: 'rack', tag: 'SLED', h: 30, cat: 'compute', cost: 9_400_000, slots: 62,
    draw: 0.5, upkeep: 900, color: '#74bcf4', req: 'rnd_cosledchassis',
    desc: 'One more rung, where the ladder had a gap.',
  },
  {
    id: 'cobladecabinet', name: 'Blade cabinet', glyph: 'rack', tag: 'BLADEC', h: 42, cat: 'compute', cost: 64_000_000, slots: 88,
    draw: 1.1, upkeep: 6_400, color: '#80c8fa', req: 'rnd_cobladecabinet',
    desc: 'One more rung, where the ladder had a gap.',
  },
  {
    id: 'copodhalfheigh', name: 'Pod, half height', glyph: 'rack', tag: 'HPOD', h: 34, cat: 'compute', cost: 420_000_000, slots: 110,
    draw: 2.6, upkeep: 42_000, color: '#90d4ff', req: 'rnd_copodhalfheigh',
    desc: 'One more rung, where the ladder had a gap.',
  },
  {
    id: 'cocryocell', name: 'Cryo cell', glyph: 'rack', tag: 'CELL', h: 44, cat: 'compute', cost: 9_000_000_000, slots: 148,
    draw: 7, upkeep: 900_000, color: '#a8e0ff', req: 'rnd_cocryocell',
    desc: 'One more rung, where the ladder had a gap.',
  },
  {
    id: 'cohallbay', name: 'Hall bay', glyph: 'rack', tag: 'BAY', h: 46, cat: 'compute', cost: 180_000_000_000, slots: 220,
    draw: 18, upkeep: 14_000_000, color: '#b8e8ff', req: 'rnd_cohallbay',
    desc: 'One more rung, where the ladder had a gap.',
  },
  {
    id: 'cosealedgaller', name: 'Sealed gallery', glyph: 'rack', tag: 'GALLERY', h: 50, cat: 'compute', cost: 4_200_000_000_000, slots: 340,
    draw: 44, upkeep: 320_000_000, color: '#c8f0ff', req: 'rnd_cosealedgaller',
    desc: 'One more rung, where the ladder had a gap.',
  },
  {
    id: 'covacuumcolumn', name: 'Vacuum column', glyph: 'rack', tag: 'VCOL', h: 54, cat: 'compute', cost: 120_000_000_000_000, slots: 520,
    draw: 110, upkeep: 6_400_000_000, color: '#d8f6ff', req: 'rnd_covacuumcolumn',
    desc: 'One more rung, where the ladder had a gap.',
  },
  {
    id: 'potwinstrip', name: 'Twin strip', glyph: 'transformer', tag: '2STRIP', h: 12, cat: 'power', cost: 2_600, radius: 5, powerCap: 20,
    draw: 0.02, upkeep: 3, color: '#cc9630', req: 'rnd_potwinstrip',
    desc: 'One more rung, where the ladder had a gap.',
  },
  {
    id: 'podistribution', name: 'Distribution board', glyph: 'transformer', tag: 'DB', h: 16, cat: 'power', cost: 26_000, radius: 5, powerCap: 28,
    draw: 0.06, upkeep: 18, color: '#dca63e', req: 'rnd_podistribution',
    desc: 'One more rung, where the ladder had a gap.',
  },
  {
    id: 'poriserpanel', name: 'Riser panel', glyph: 'transformer', tag: 'PANEL', h: 22, cat: 'power', cost: 140_000, radius: 5, powerCap: 155,
    draw: 0.2, upkeep: 90, color: '#e6b048', req: 'rnd_poriserpanel',
    desc: 'One more rung, where the ladder had a gap.',
  },
  {
    id: 'popackagesubst', name: 'Package substation', glyph: 'transformer', tag: 'PKG', h: 28, cat: 'power', cost: 3_400_000, radius: 6, powerCap: 3_777,
    draw: 2.2, upkeep: 2_400, color: '#f0bc56', req: 'rnd_popackagesubst',
    desc: 'One more rung, where the ladder had a gap.',
  },
  {
    id: 'poswitchyard', name: 'Switchyard', glyph: 'transformer', tag: 'YARD2', h: 34, cat: 'power', cost: 420_000_000, radius: 6, powerCap: 466_666,
    draw: 26, upkeep: 180_000, color: '#ffd070', req: 'rnd_poswitchyard',
    desc: 'One more rung, where the ladder had a gap.',
  },
  {
    id: 'pogridtiesecon', name: 'Grid tie, second', glyph: 'transformer', tag: 'TIE2', h: 38, cat: 'power', cost: 26_000_000_000, radius: 7, powerCap: 28_888_888,
    draw: 300, upkeep: 9_400_000, color: '#ffe49c', req: 'rnd_pogridtiesecon',
    desc: 'One more rung, where the ladder had a gap.',
  },
  {
    id: 'pogenerationpa', name: 'Generation park', glyph: 'transformer', tag: 'GENPARK', h: 42, cat: 'power', cost: 900_000_000_000, radius: 7, powerCap: 1_000_000_000,
    draw: 2600, upkeep: 320_000_000, color: '#fff0c0', req: 'rnd_pogenerationpa',
    desc: 'One more rung, where the ladder had a gap.',
  },
  {
    id: 'poorbitalrecte', name: 'Orbital rectenna', glyph: 'transformer', tag: 'RECT', h: 36, cat: 'power', cost: 42_000_000_000_000, radius: 8, powerCap: 46_666_666_666,
    draw: 42000, upkeep: 9_400_000_000, color: '#fff8e0', req: 'rnd_poorbitalrecte',
    desc: 'One more rung, where the ladder had a gap.',
  },
  {
    id: 'coceilingfanar', name: 'Ceiling fan array', glyph: 'coil', tag: 'CEILING', h: 12, cat: 'cooling', cost: 900, radius: 3, coolCap: 4, water: 0.02,
    draw: 0.3, upkeep: 3, color: '#3fc490', req: 'rnd_coceilingfanar',
    desc: 'One more rung, where the ladder had a gap.',
  },
  {
    id: 'cominisplitban', name: 'Mini split bank', glyph: 'coil', tag: 'MINI', h: 16, cat: 'cooling', cost: 6_400, radius: 3, coolCap: 4, water: 0.02,
    draw: 1.2, upkeep: 12, color: '#47cb9c', req: 'rnd_cominisplitban',
    desc: 'One more rung, where the ladder had a gap.',
  },
  {
    id: 'coductedcrac', name: 'Ducted CRAC', glyph: 'coil', tag: 'DUCTED', h: 26, cat: 'cooling', cost: 64_000, radius: 4, coolCap: 24, water: 0.02,
    draw: 6, upkeep: 120, color: '#4fd4a4', req: 'rnd_coductedcrac',
    desc: 'One more rung, where the ladder had a gap.',
  },
  {
    id: 'cowatersideeco', name: 'Water-side economiser', glyph: 'coil', tag: 'WSE', h: 28, cat: 'cooling', cost: 1_900_000, radius: 4, coolCap: 730, water: 0.02,
    draw: 40, upkeep: 3_400, color: '#5fe4b8', req: 'rnd_cowatersideeco',
    desc: 'One more rung, where the ladder had a gap.',
  },
  {
    id: 'cochillerabsor', name: 'Chiller, absorption tie', glyph: 'coil', tag: 'ABSTIE', h: 30, cat: 'cooling', cost: 42_000_000, radius: 4, coolCap: 16_153, water: 0.02,
    draw: 60, upkeep: 64_000, color: '#6ae6c0', req: 'rnd_cochillerabsor',
    desc: 'One more rung, where the ladder had a gap.',
  },
  {
    id: 'cocoolingtower', name: 'Cooling tower farm', glyph: 'coil', tag: 'TFARM', h: 40, cat: 'cooling', cost: 900_000_000, radius: 5, coolCap: 346_153, water: 0.02,
    draw: 1400, upkeep: 900_000, color: '#84f8d4', req: 'rnd_cocoolingtower',
    desc: 'One more rung, where the ladder had a gap.',
  },
  {
    id: 'coheatpumparra', name: 'Heat pump array', glyph: 'coil', tag: 'HPUMP', h: 26, cat: 'cooling', cost: 18_000_000_000, radius: 5, coolCap: 6_923_076, water: 0.02,
    draw: 9000, upkeep: 26_000_000, color: '#96fadc', req: 'rnd_coheatpumparra',
    desc: 'One more rung, where the ladder had a gap.',
  },
  {
    id: 'codeepcryogeni', name: 'Deep cryogenic plant', glyph: 'coil', tag: 'DEEPCRY', h: 42, cat: 'cooling', cost: 900_000_000_000, radius: 5, coolCap: 346_153_846, water: 0.02,
    draw: 90000, upkeep: 1_400_000_000, color: '#c8fff0', req: 'rnd_codeepcryogeni',
    desc: 'One more rung, where the ladder had a gap.',
  },
  {
    id: 'coambientnulli', name: 'Ambient nullifier', glyph: 'coil', tag: 'NULL', h: 38, cat: 'cooling', cost: 42_000_000_000_000, radius: 6, coolCap: 16_153_846_153, water: 0.02,
    draw: 900000, upkeep: 64_000_000_000, color: '#e8fffa', req: 'rnd_coambientnulli',
    desc: 'One more rung, where the ladder had a gap.',
  },
  {
    id: 'waheadertank', name: 'Header tank', glyph: 'wave', tag: 'HEADER', h: 18, cat: 'water', cost: 1_400, supplyWater: 0, waterCost: 0.3,
    draw: 0, upkeep: 4, color: '#3570bb', req: 'rnd_waheadertank',
    desc: 'One more rung, where the ladder had a gap.',
  },
  {
    id: 'wafiltrationsk', name: 'Filtration skid', glyph: 'wave', tag: 'FILTER', h: 20, cat: 'water', cost: 42_000, supplyWater: 1, waterCost: 0.3,
    draw: 1.2, upkeep: 140, color: '#4390e0', req: 'rnd_wafiltrationsk',
    desc: 'One more rung, where the ladder had a gap.',
  },
  {
    id: 'wabalancingpon', name: 'Balancing pond', glyph: 'wave', tag: 'POND', h: 12, cat: 'water', cost: 900_000, supplyWater: 21, waterCost: 0.3,
    draw: 2, upkeep: 1_900, color: '#3d7fc4', req: 'rnd_wabalancingpon',
    desc: 'One more rung, where the ladder had a gap.',
  },
  {
    id: 'watreatmentwor', name: 'Treatment works', glyph: 'wave', tag: 'WORKS', h: 24, cat: 'water', cost: 26_000_000, supplyWater: 619, waterCost: 0.3,
    draw: 80, upkeep: 42_000, color: '#529ff0', req: 'rnd_watreatmentwor',
    desc: 'One more rung, where the ladder had a gap.',
  },
  {
    id: 'warecoveryhall', name: 'Recovery hall', glyph: 'wave', tag: 'RECHALL', h: 26, cat: 'water', cost: 1_400_000_000, supplyWater: 33_333, waterCost: 0.3,
    draw: 2600, upkeep: 2_400_000, color: '#6ab8ff', req: 'rnd_warecoveryhall',
    desc: 'One more rung, where the ladder had a gap.',
  },
  {
    id: 'waabstractiona', name: 'Abstraction array', glyph: 'wave', tag: 'ARRAY', h: 22, cat: 'water', cost: 64_000_000_000, supplyWater: 1_523_809, waterCost: 0.3,
    draw: 42000, upkeep: 90_000_000, color: '#7cc4ff', req: 'rnd_waabstractiona',
    desc: 'One more rung, where the ladder had a gap.',
  },
  {
    id: 'wadesalination', name: 'Desalination park', glyph: 'wave', tag: 'DPARK', h: 30, cat: 'water', cost: 2_600_000_000_000, supplyWater: 61_904_761, waterCost: 0.3,
    draw: 900000, upkeep: 3_400_000_000, color: '#a0d8ff', req: 'rnd_wadesalination',
    desc: 'One more rung, where the ladder had a gap.',
  },
  {
    id: 'waplanetaryres', name: 'Planetary reserve', glyph: 'wave', tag: 'RESERVE', h: 28, cat: 'water', cost: 180_000_000_000_000, supplyWater: 4_285_714_285, waterCost: 0.3,
    draw: 26000000, upkeep: 240_000_000_000, color: '#d8f4ff', req: 'rnd_waplanetaryres',
    desc: 'One more rung, where the ladder had a gap.',
  },
  {
    id: 'sucommscabinet', name: 'Comms cabinet', glyph: 'switch', tag: 'COMMS', h: 14, cat: 'support', cost: 1_900, net: 3,
    draw: 0.3, upkeep: 8, color: '#8060cc', req: 'rnd_sucommscabinet',
    desc: 'One more rung, where the ladder had a gap.',
  },
  {
    id: 'sucoreswitch', name: 'Core switch', glyph: 'switch', tag: 'CORE', h: 18, cat: 'support', cost: 320_000, net: 94,
    draw: 4, upkeep: 420, color: '#9874e0', req: 'rnd_sucoreswitch',
    desc: 'One more rung, where the ladder had a gap.',
  },
  {
    id: 'sufibrevault', name: 'Fibre vault', glyph: 'switch', tag: 'VAULT2', h: 16, cat: 'support', cost: 9_400_000, net: 2_764,
    draw: 22, upkeep: 12_000, color: '#a884ec', req: 'rnd_sufibrevault',
    desc: 'One more rung, where the ladder had a gap.',
  },
  {
    id: 'suexchangefloo', name: 'Exchange floor', glyph: 'switch', tag: 'EXCH', h: 22, cat: 'support', cost: 420_000_000, net: 123_529,
    draw: 340, upkeep: 900_000, color: '#b894f4', req: 'rnd_suexchangefloo',
    desc: 'One more rung, where the ladder had a gap.',
  },
  {
    id: 'sugroundstatio', name: 'Ground station', glyph: 'switch', tag: 'GROUND', h: 28, cat: 'support', cost: 18_000_000_000, net: 5_294_117,
    draw: 6400, upkeep: 42_000_000, color: '#c8a8fc', req: 'rnd_sugroundstatio',
    desc: 'One more rung, where the ladder had a gap.',
  },
  {
    id: 'surelayconstel', name: 'Relay constellation tie', glyph: 'switch', tag: 'RELAY', h: 30, cat: 'support', cost: 900_000_000_000, net: 264_705_882,
    draw: 90000, upkeep: 2_600_000_000, color: '#d8bcff', req: 'rnd_surelayconstel',
    desc: 'One more rung, where the ladder had a gap.',
  },
  {
    id: 'sucrewquarters', name: 'Crew quarters', glyph: 'switch', tag: 'CREW', h: 24, cat: 'support', cost: 42_000_000, net: 12_352,
    draw: 42, upkeep: 240_000, color: '#d0c8b6', req: 'rnd_sucrewquarters',
    desc: 'One more rung, where the ladder had a gap.',
  },
  {
    id: 'sutrainingcent', name: 'Training centre', glyph: 'switch', tag: 'TRAIN', h: 24, cat: 'support', cost: 900_000_000, net: 264_705,
    draw: 190, upkeep: 4_200_000, color: '#dcd4c2', req: 'rnd_sutrainingcent',
    desc: 'One more rung, where the ladder had a gap.',
  },
  {
    id: 'suregionaloffi', name: 'Regional office', glyph: 'switch', tag: 'REGION', h: 28, cat: 'support', cost: 9_400_000_000, net: 2_764_705,
    draw: 900, upkeep: 42_000_000, color: '#e4dcca', req: 'rnd_suregionaloffi',
    desc: 'One more rung, where the ladder had a gap.',
  },
  {
    id: 'sufoundation', name: 'Foundation', glyph: 'switch', tag: 'FOUND', h: 26, cat: 'support', cost: 180_000_000_000, net: 52_941_176,
    draw: 2400, upkeep: 900_000_000, color: '#eee6d4', req: 'rnd_sufoundation',
    desc: 'One more rung, where the ladder had a gap.',
  },

  {
    id: 'coquarterrack', name: 'Quarter rack', glyph: 'rack', tag: 'QTR', h: 20, cat: 'compute', cost: 1_200, slots: 4,
    draw: 0.02, upkeep: 2, color: '#3d76c4', req: 'rnd_coquarterrack',
    desc: 'One more rung, where the ladder had a gap.',
  },
  {
    id: 'coseismicrated', name: 'Seismic-rated cabinet', glyph: 'rack', tag: 'SEISMIC', h: 38, cat: 'compute', cost: 240_000, slots: 30,
    draw: 0.14, upkeep: 120, color: '#5fa4e8', req: 'rnd_coseismicrated',
    desc: 'One more rung, where the ladder had a gap.',
  },
  {
    id: 'comodularrow', name: 'Modular row', glyph: 'rack', tag: 'ROW', h: 40, cat: 'compute', cost: 34_000_000, slots: 72,
    draw: 0.7, upkeep: 2_600, color: '#7cc0f6', req: 'rnd_comodularrow',
    desc: 'One more rung, where the ladder had a gap.',
  },
  {
    id: 'cocoldvaultbay', name: 'Cold vault bay', glyph: 'rack', tag: 'CVBAY', h: 44, cat: 'compute', cost: 620_000_000_000, slots: 260,
    draw: 22, upkeep: 42_000_000, color: '#bcecff', req: 'rnd_cocoldvaultbay',
    desc: 'One more rung, where the ladder had a gap.',
  },
  {
    id: 'poisolationtra', name: 'Isolation transformer', glyph: 'transformer', tag: 'ISOL', h: 20, cat: 'power', cost: 9_400, radius: 2, powerCap: 140,
    draw: 0.05, upkeep: 12, color: '#d09a36', req: 'rnd_poisolationtra',
    desc: 'One more rung, where the ladder had a gap.',
  },
  {
    id: 'postatictransf', name: 'Static transfer switch', glyph: 'transformer', tag: 'STS', h: 18, cat: 'power', cost: 180_000, radius: 3, powerCap: 2_600,
    draw: 0.3, upkeep: 180, color: '#e8b44a', req: 'rnd_postatictransf',
    desc: 'One more rung, where the ladder had a gap.',
  },
  {
    id: 'postandbydiese', name: 'Standby diesel bank', glyph: 'transformer', tag: 'DBANK', h: 30, cat: 'power', cost: 6_400_000, supplyKW: 3_400,
    draw: 9, upkeep: 42_000, fuel: 0.09, heatOut: 900, color: '#f4c464', req: 'rnd_postandbydiese',
    desc: 'One more rung, where the ladder had a gap.',
  },
  {
    id: 'popeakingturbi', name: 'Peaking turbine', glyph: 'transformer', tag: 'PEAK', h: 36, cat: 'power', cost: 340_000_000, supplyKW: 120_000,
    draw: 140, upkeep: 2_600_000, fuel: 0.07, heatOut: 26_000, color: '#ffd884', req: 'rnd_popeakingturbi',
    desc: 'One more rung, where the ladder had a gap.',
  },
  {
    id: 'cospotcooler', name: 'Spot cooler', glyph: 'coil', tag: 'SPOT', h: 14, cat: 'cooling', cost: 3_200, radius: 2, coolCap: 18,
    draw: 0.9, upkeep: 7, color: '#43c694', req: 'rnd_cospotcooler',
    desc: 'One more rung, where the ladder had a gap.',
  },
  {
    id: 'coaislecontain', name: 'Aisle containment kit', glyph: 'coil', tag: 'KIT', h: 30, cat: 'cooling', cost: 42_000, radius: 3, coolCap: 95,
    draw: 2.6, upkeep: 42, color: '#4bcfa0', req: 'rnd_coaislecontain',
    desc: 'One more rung, where the ladder had a gap.',
  },
  {
    id: 'coliquiddistri', name: 'Liquid distribution unit', glyph: 'coil', tag: 'LDU', h: 26, cat: 'cooling', cost: 900_000, radius: 4, coolCap: 1_100,
    draw: 22, upkeep: 1_400, color: '#5ae0b4', req: 'rnd_coliquiddistri',
    desc: 'One more rung, where the ladder had a gap.',
  },
  {
    id: 'cocascaderefri', name: 'Cascade refrigeration', glyph: 'coil', tag: 'CASCREF', h: 34, cat: 'cooling', cost: 180_000_000, radius: 6, coolCap: 64_000,
    draw: 1900, upkeep: 260_000, color: '#7ef0ca', req: 'rnd_cocascaderefri',
    desc: 'One more rung, where the ladder had a gap.',
  },
  {
    id: 'wasumpandretur', name: 'Sump and return', glyph: 'wave', tag: 'SUMP', h: 10, cat: 'water', cost: 6_400, supplyWater: 0.4, waterCost: 1.1,
    draw: 0.2, upkeep: 14, color: '#3a78c0', req: 'rnd_wasumpandretur',
    desc: 'One more rung, where the ladder had a gap.',
  },
  {
    id: 'wasofteningpla', name: 'Softening plant', glyph: 'wave', tag: 'SOFTEN', h: 22, cat: 'water', cost: 340_000, supplyWater: 7, waterCost: 0.7,
    draw: 3.4, upkeep: 900, color: '#4b96e6', req: 'rnd_wasofteningpla',
    desc: 'One more rung, where the ladder had a gap.',
  },
  {
    id: 'wastoragereser', name: 'Storage reservoir', glyph: 'wave', tag: 'RESVOIR', h: 14, cat: 'water', cost: 42_000_000, supplyWater: 420, waterCost: 0.25,
    draw: 26, upkeep: 64_000, color: '#5fa8f2', req: 'rnd_wastoragereser',
    desc: 'One more rung, where the ladder had a gap.',
  },
  {
    id: 'waregionaltran', name: 'Regional transfer', glyph: 'wave', tag: 'XFER', h: 24, cat: 'water', cost: 9_400_000_000, supplyWater: 42_000, waterCost: 0.06,
    draw: 4200, upkeep: 14_000_000, color: '#8ccaff', req: 'rnd_waregionaltran',
    desc: 'One more rung, where the ladder had a gap.',
  },
  {
    id: 'sustructuredca', name: 'Structured cabling', glyph: 'switch', tag: 'STRUCT', h: 12, cat: 'support', cost: 640, net: 8,
    draw: 0.06, upkeep: 3, color: '#7a5ec0', req: 'rnd_sustructuredca',
    desc: 'One more rung, where the ladder had a gap.',
  },
  {
    id: 'sudistribution', name: 'Distribution frame', glyph: 'switch', tag: 'ODF', h: 16, cat: 'support', cost: 42_000, net: 180,
    draw: 0.9, upkeep: 54, color: '#9070d8', req: 'rnd_sudistribution',
    desc: 'One more rung, where the ladder had a gap.',
  },
  {
    id: 'suborderrouter', name: 'Border router pair', glyph: 'switch', tag: 'BORDER', h: 20, cat: 'support', cost: 2_600_000, net: 5_400,
    draw: 9, upkeep: 3_400, color: '#a884ec', req: 'rnd_suborderrouter',
    desc: 'One more rung, where the ladder had a gap.',
  },
  {
    id: 'suregionalpeer', name: 'Regional peering fabric', glyph: 'switch', tag: 'RPF', h: 24, cat: 'support', cost: 420_000_000, net: 640_000,
    draw: 420, upkeep: 1_400_000, color: '#c0a0ff', req: 'rnd_suregionalpeer',
    desc: 'One more rung, where the ladder had a gap.',
  },
  {
    id: 'susitemedicalc', name: 'Site medical centre', glyph: 'switch', tag: 'MEDICAL', h: 22, cat: 'support', cost: 3_400_000, staff: 6, uptime: 0.004,
    draw: 4, upkeep: 26_000, color: '#d4ccba', req: 'rnd_susitemedicalc',
    desc: 'One more rung, where the ladder had a gap.',
  },
  {
    id: 'sucomponenttes', name: 'Component testing lab', glyph: 'switch', tag: 'TESTLAB', h: 24, cat: 'support', cost: 64_000_000, repair: 3.2, research: 9,
    draw: 42, upkeep: 420_000, color: '#c0a880', req: 'rnd_sucomponenttes',
    desc: 'One more rung, where the ladder had a gap.',
  },
  {
    id: 'sulongrangepla', name: 'Long-range planning', glyph: 'switch', tag: 'PLANNING', h: 26, cat: 'support', cost: 9_400_000_000, contract: 1, research: 64,
    draw: 600, upkeep: 42_000_000, color: '#f0b888', req: 'rnd_sulongrangepla',
    desc: 'One more rung, where the ladder had a gap.',
  },
];


export const BUILDINGS_BY_ID = Object.fromEntries(BUILDINGS.map((b) => [b.id, b]));

export const CATEGORIES = [
  { id: 'compute', name: 'Racks' },
  { id: 'power', name: 'Power' },
  { id: 'cooling', name: 'Cooling' },
  { id: 'water', name: 'Water' },
  { id: 'support', name: 'Support' },

  // ---- the rungs each ladder was still missing in the middle.
  {
    id: 'cohalfrack', name: 'Half-rack', glyph: 'rack', tag: 'HALF', h: 22, cat: 'compute', cost: 3_400, slots: 7,
    draw: 0.03, upkeep: 4, color: '#4480cc', req: 'rnd_cohalfrack',
    desc: 'One more rung, where the ladder had a gap.',
  },
  {
    id: 'codeepcabinet', name: 'Deep cabinet', glyph: 'rack', tag: 'DEEP', h: 38, cat: 'compute', cost: 86_000, slots: 26,
    draw: 0.1, upkeep: 34, color: '#5698e2', req: 'rnd_codeepcabinet',
    desc: 'One more rung, where the ladder had a gap.',
  },
  {
    id: 'coreardoorcabi', name: 'Rear-door cabinet', glyph: 'rack', tag: 'RDX', h: 40, cat: 'compute', cost: 1_400_000, slots: 44,
    draw: 0.3, upkeep: 210, color: '#63a8ec', req: 'rnd_coreardoorcabi',
    desc: 'One more rung, where the ladder had a gap.',
  },
  {
    id: 'cosledchassis', name: 'Sled chassis', glyph: 'rack', tag: 'SLED', h: 30, cat: 'compute', cost: 9_400_000, slots: 62,
    draw: 0.5, upkeep: 900, color: '#74bcf4', req: 'rnd_cosledchassis',
    desc: 'One more rung, where the ladder had a gap.',
  },
  {
    id: 'cobladecabinet', name: 'Blade cabinet', glyph: 'rack', tag: 'BLADEC', h: 42, cat: 'compute', cost: 64_000_000, slots: 88,
    draw: 1.1, upkeep: 6_400, color: '#80c8fa', req: 'rnd_cobladecabinet',
    desc: 'One more rung, where the ladder had a gap.',
  },
  {
    id: 'copodhalfheigh', name: 'Pod, half height', glyph: 'rack', tag: 'HPOD', h: 34, cat: 'compute', cost: 420_000_000, slots: 110,
    draw: 2.6, upkeep: 42_000, color: '#90d4ff', req: 'rnd_copodhalfheigh',
    desc: 'One more rung, where the ladder had a gap.',
  },
  {
    id: 'cocryocell', name: 'Cryo cell', glyph: 'rack', tag: 'CELL', h: 44, cat: 'compute', cost: 9_000_000_000, slots: 148,
    draw: 7, upkeep: 900_000, color: '#a8e0ff', req: 'rnd_cocryocell',
    desc: 'One more rung, where the ladder had a gap.',
  },
  {
    id: 'cohallbay', name: 'Hall bay', glyph: 'rack', tag: 'BAY', h: 46, cat: 'compute', cost: 180_000_000_000, slots: 220,
    draw: 18, upkeep: 14_000_000, color: '#b8e8ff', req: 'rnd_cohallbay',
    desc: 'One more rung, where the ladder had a gap.',
  },
  {
    id: 'cosealedgaller', name: 'Sealed gallery', glyph: 'rack', tag: 'GALLERY', h: 50, cat: 'compute', cost: 4_200_000_000_000, slots: 340,
    draw: 44, upkeep: 320_000_000, color: '#c8f0ff', req: 'rnd_cosealedgaller',
    desc: 'One more rung, where the ladder had a gap.',
  },
  {
    id: 'covacuumcolumn', name: 'Vacuum column', glyph: 'rack', tag: 'VCOL', h: 54, cat: 'compute', cost: 120_000_000_000_000, slots: 520,
    draw: 110, upkeep: 6_400_000_000, color: '#d8f6ff', req: 'rnd_covacuumcolumn',
    desc: 'One more rung, where the ladder had a gap.',
  },
  {
    id: 'potwinstrip', name: 'Twin strip', glyph: 'transformer', tag: '2STRIP', h: 12, cat: 'power', cost: 2_600, radius: 5, powerCap: 20,
    draw: 0.02, upkeep: 3, color: '#cc9630', req: 'rnd_potwinstrip',
    desc: 'One more rung, where the ladder had a gap.',
  },
  {
    id: 'podistribution', name: 'Distribution board', glyph: 'transformer', tag: 'DB', h: 16, cat: 'power', cost: 26_000, radius: 5, powerCap: 28,
    draw: 0.06, upkeep: 18, color: '#dca63e', req: 'rnd_podistribution',
    desc: 'One more rung, where the ladder had a gap.',
  },
  {
    id: 'poriserpanel', name: 'Riser panel', glyph: 'transformer', tag: 'PANEL', h: 22, cat: 'power', cost: 140_000, radius: 5, powerCap: 155,
    draw: 0.2, upkeep: 90, color: '#e6b048', req: 'rnd_poriserpanel',
    desc: 'One more rung, where the ladder had a gap.',
  },
  {
    id: 'popackagesubst', name: 'Package substation', glyph: 'transformer', tag: 'PKG', h: 28, cat: 'power', cost: 3_400_000, radius: 6, powerCap: 3_777,
    draw: 2.2, upkeep: 2_400, color: '#f0bc56', req: 'rnd_popackagesubst',
    desc: 'One more rung, where the ladder had a gap.',
  },
  {
    id: 'poswitchyard', name: 'Switchyard', glyph: 'transformer', tag: 'YARD2', h: 34, cat: 'power', cost: 420_000_000, radius: 6, powerCap: 466_666,
    draw: 26, upkeep: 180_000, color: '#ffd070', req: 'rnd_poswitchyard',
    desc: 'One more rung, where the ladder had a gap.',
  },
  {
    id: 'pogridtiesecon', name: 'Grid tie, second', glyph: 'transformer', tag: 'TIE2', h: 38, cat: 'power', cost: 26_000_000_000, radius: 7, powerCap: 28_888_888,
    draw: 300, upkeep: 9_400_000, color: '#ffe49c', req: 'rnd_pogridtiesecon',
    desc: 'One more rung, where the ladder had a gap.',
  },
  {
    id: 'pogenerationpa', name: 'Generation park', glyph: 'transformer', tag: 'GENPARK', h: 42, cat: 'power', cost: 900_000_000_000, radius: 7, powerCap: 1_000_000_000,
    draw: 2600, upkeep: 320_000_000, color: '#fff0c0', req: 'rnd_pogenerationpa',
    desc: 'One more rung, where the ladder had a gap.',
  },
  {
    id: 'poorbitalrecte', name: 'Orbital rectenna', glyph: 'transformer', tag: 'RECT', h: 36, cat: 'power', cost: 42_000_000_000_000, radius: 8, powerCap: 46_666_666_666,
    draw: 42000, upkeep: 9_400_000_000, color: '#fff8e0', req: 'rnd_poorbitalrecte',
    desc: 'One more rung, where the ladder had a gap.',
  },
  {
    id: 'coceilingfanar', name: 'Ceiling fan array', glyph: 'coil', tag: 'CEILING', h: 12, cat: 'cooling', cost: 900, radius: 3, coolCap: 4, water: 0.02,
    draw: 0.3, upkeep: 3, color: '#3fc490', req: 'rnd_coceilingfanar',
    desc: 'One more rung, where the ladder had a gap.',
  },
  {
    id: 'cominisplitban', name: 'Mini split bank', glyph: 'coil', tag: 'MINI', h: 16, cat: 'cooling', cost: 6_400, radius: 3, coolCap: 4, water: 0.02,
    draw: 1.2, upkeep: 12, color: '#47cb9c', req: 'rnd_cominisplitban',
    desc: 'One more rung, where the ladder had a gap.',
  },
  {
    id: 'coductedcrac', name: 'Ducted CRAC', glyph: 'coil', tag: 'DUCTED', h: 26, cat: 'cooling', cost: 64_000, radius: 4, coolCap: 24, water: 0.02,
    draw: 6, upkeep: 120, color: '#4fd4a4', req: 'rnd_coductedcrac',
    desc: 'One more rung, where the ladder had a gap.',
  },
  {
    id: 'cowatersideeco', name: 'Water-side economiser', glyph: 'coil', tag: 'WSE', h: 28, cat: 'cooling', cost: 1_900_000, radius: 4, coolCap: 730, water: 0.02,
    draw: 40, upkeep: 3_400, color: '#5fe4b8', req: 'rnd_cowatersideeco',
    desc: 'One more rung, where the ladder had a gap.',
  },
  {
    id: 'cochillerabsor', name: 'Chiller, absorption tie', glyph: 'coil', tag: 'ABSTIE', h: 30, cat: 'cooling', cost: 42_000_000, radius: 4, coolCap: 16_153, water: 0.02,
    draw: 60, upkeep: 64_000, color: '#6ae6c0', req: 'rnd_cochillerabsor',
    desc: 'One more rung, where the ladder had a gap.',
  },
  {
    id: 'cocoolingtower', name: 'Cooling tower farm', glyph: 'coil', tag: 'TFARM', h: 40, cat: 'cooling', cost: 900_000_000, radius: 5, coolCap: 346_153, water: 0.02,
    draw: 1400, upkeep: 900_000, color: '#84f8d4', req: 'rnd_cocoolingtower',
    desc: 'One more rung, where the ladder had a gap.',
  },
  {
    id: 'coheatpumparra', name: 'Heat pump array', glyph: 'coil', tag: 'HPUMP', h: 26, cat: 'cooling', cost: 18_000_000_000, radius: 5, coolCap: 6_923_076, water: 0.02,
    draw: 9000, upkeep: 26_000_000, color: '#96fadc', req: 'rnd_coheatpumparra',
    desc: 'One more rung, where the ladder had a gap.',
  },
  {
    id: 'codeepcryogeni', name: 'Deep cryogenic plant', glyph: 'coil', tag: 'DEEPCRY', h: 42, cat: 'cooling', cost: 900_000_000_000, radius: 5, coolCap: 346_153_846, water: 0.02,
    draw: 90000, upkeep: 1_400_000_000, color: '#c8fff0', req: 'rnd_codeepcryogeni',
    desc: 'One more rung, where the ladder had a gap.',
  },
  {
    id: 'coambientnulli', name: 'Ambient nullifier', glyph: 'coil', tag: 'NULL', h: 38, cat: 'cooling', cost: 42_000_000_000_000, radius: 6, coolCap: 16_153_846_153, water: 0.02,
    draw: 900000, upkeep: 64_000_000_000, color: '#e8fffa', req: 'rnd_coambientnulli',
    desc: 'One more rung, where the ladder had a gap.',
  },
  {
    id: 'waheadertank', name: 'Header tank', glyph: 'wave', tag: 'HEADER', h: 18, cat: 'water', cost: 1_400, supplyWater: 0, waterCost: 0.3,
    draw: 0, upkeep: 4, color: '#3570bb', req: 'rnd_waheadertank',
    desc: 'One more rung, where the ladder had a gap.',
  },
  {
    id: 'wafiltrationsk', name: 'Filtration skid', glyph: 'wave', tag: 'FILTER', h: 20, cat: 'water', cost: 42_000, supplyWater: 1, waterCost: 0.3,
    draw: 1.2, upkeep: 140, color: '#4390e0', req: 'rnd_wafiltrationsk',
    desc: 'One more rung, where the ladder had a gap.',
  },
  {
    id: 'wabalancingpon', name: 'Balancing pond', glyph: 'wave', tag: 'POND', h: 12, cat: 'water', cost: 900_000, supplyWater: 21, waterCost: 0.3,
    draw: 2, upkeep: 1_900, color: '#3d7fc4', req: 'rnd_wabalancingpon',
    desc: 'One more rung, where the ladder had a gap.',
  },
  {
    id: 'watreatmentwor', name: 'Treatment works', glyph: 'wave', tag: 'WORKS', h: 24, cat: 'water', cost: 26_000_000, supplyWater: 619, waterCost: 0.3,
    draw: 80, upkeep: 42_000, color: '#529ff0', req: 'rnd_watreatmentwor',
    desc: 'One more rung, where the ladder had a gap.',
  },
  {
    id: 'warecoveryhall', name: 'Recovery hall', glyph: 'wave', tag: 'RECHALL', h: 26, cat: 'water', cost: 1_400_000_000, supplyWater: 33_333, waterCost: 0.3,
    draw: 2600, upkeep: 2_400_000, color: '#6ab8ff', req: 'rnd_warecoveryhall',
    desc: 'One more rung, where the ladder had a gap.',
  },
  {
    id: 'waabstractiona', name: 'Abstraction array', glyph: 'wave', tag: 'ARRAY', h: 22, cat: 'water', cost: 64_000_000_000, supplyWater: 1_523_809, waterCost: 0.3,
    draw: 42000, upkeep: 90_000_000, color: '#7cc4ff', req: 'rnd_waabstractiona',
    desc: 'One more rung, where the ladder had a gap.',
  },
  {
    id: 'wadesalination', name: 'Desalination park', glyph: 'wave', tag: 'DPARK', h: 30, cat: 'water', cost: 2_600_000_000_000, supplyWater: 61_904_761, waterCost: 0.3,
    draw: 900000, upkeep: 3_400_000_000, color: '#a0d8ff', req: 'rnd_wadesalination',
    desc: 'One more rung, where the ladder had a gap.',
  },
  {
    id: 'waplanetaryres', name: 'Planetary reserve', glyph: 'wave', tag: 'RESERVE', h: 28, cat: 'water', cost: 180_000_000_000_000, supplyWater: 4_285_714_285, waterCost: 0.3,
    draw: 26000000, upkeep: 240_000_000_000, color: '#d8f4ff', req: 'rnd_waplanetaryres',
    desc: 'One more rung, where the ladder had a gap.',
  },
  {
    id: 'sucommscabinet', name: 'Comms cabinet', glyph: 'switch', tag: 'COMMS', h: 14, cat: 'support', cost: 1_900, net: 3,
    draw: 0.3, upkeep: 8, color: '#8060cc', req: 'rnd_sucommscabinet',
    desc: 'One more rung, where the ladder had a gap.',
  },
  {
    id: 'sucoreswitch', name: 'Core switch', glyph: 'switch', tag: 'CORE', h: 18, cat: 'support', cost: 320_000, net: 94,
    draw: 4, upkeep: 420, color: '#9874e0', req: 'rnd_sucoreswitch',
    desc: 'One more rung, where the ladder had a gap.',
  },
  {
    id: 'sufibrevault', name: 'Fibre vault', glyph: 'switch', tag: 'VAULT2', h: 16, cat: 'support', cost: 9_400_000, net: 2_764,
    draw: 22, upkeep: 12_000, color: '#a884ec', req: 'rnd_sufibrevault',
    desc: 'One more rung, where the ladder had a gap.',
  },
  {
    id: 'suexchangefloo', name: 'Exchange floor', glyph: 'switch', tag: 'EXCH', h: 22, cat: 'support', cost: 420_000_000, net: 123_529,
    draw: 340, upkeep: 900_000, color: '#b894f4', req: 'rnd_suexchangefloo',
    desc: 'One more rung, where the ladder had a gap.',
  },
  {
    id: 'sugroundstatio', name: 'Ground station', glyph: 'switch', tag: 'GROUND', h: 28, cat: 'support', cost: 18_000_000_000, net: 5_294_117,
    draw: 6400, upkeep: 42_000_000, color: '#c8a8fc', req: 'rnd_sugroundstatio',
    desc: 'One more rung, where the ladder had a gap.',
  },
  {
    id: 'surelayconstel', name: 'Relay constellation tie', glyph: 'switch', tag: 'RELAY', h: 30, cat: 'support', cost: 900_000_000_000, net: 264_705_882,
    draw: 90000, upkeep: 2_600_000_000, color: '#d8bcff', req: 'rnd_surelayconstel',
    desc: 'One more rung, where the ladder had a gap.',
  },
  {
    id: 'sucrewquarters', name: 'Crew quarters', glyph: 'switch', tag: 'CREW', h: 24, cat: 'support', cost: 42_000_000, net: 12_352,
    draw: 42, upkeep: 240_000, color: '#d0c8b6', req: 'rnd_sucrewquarters',
    desc: 'One more rung, where the ladder had a gap.',
  },
  {
    id: 'sutrainingcent', name: 'Training centre', glyph: 'switch', tag: 'TRAIN', h: 24, cat: 'support', cost: 900_000_000, net: 264_705,
    draw: 190, upkeep: 4_200_000, color: '#dcd4c2', req: 'rnd_sutrainingcent',
    desc: 'One more rung, where the ladder had a gap.',
  },
  {
    id: 'suregionaloffi', name: 'Regional office', glyph: 'switch', tag: 'REGION', h: 28, cat: 'support', cost: 9_400_000_000, net: 2_764_705,
    draw: 900, upkeep: 42_000_000, color: '#e4dcca', req: 'rnd_suregionaloffi',
    desc: 'One more rung, where the ladder had a gap.',
  },
  {
    id: 'sufoundation', name: 'Foundation', glyph: 'switch', tag: 'FOUND', h: 26, cat: 'support', cost: 180_000_000_000, net: 52_941_176,
    draw: 2400, upkeep: 900_000_000, color: '#eee6d4', req: 'rnd_sufoundation',
    desc: 'One more rung, where the ladder had a gap.',
  },
];

export function isUnlocked(b, state) {
  return !b.req || state.research.done.includes(b.req);
}
