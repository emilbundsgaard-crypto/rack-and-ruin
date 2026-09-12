// Everything that can be slotted into a rack.
//
//   compute : units of capacity produced when healthy, powered and cool
//   power   : kW drawn at full load
//   heat    : kW of heat dumped into the room (a little lower than power,
//             the rest leaves as light, noise and network traffic)
//   wear    : condition lost per game-day at 22 °C, doubles roughly every 12 °C
//   net     : Gbps of switching the unit needs to be useful
//
// The list is deliberately long: it is the spine of the whole progression.

export const HARDWARE = [
  {
    id: 'desktop', name: 'Salvaged desktop', short: 'DSK', tier: 0,
    cost: 320, compute: 1, power: 0.22, heat: 0.2, wear: 0.9, net: 0.02,
    desc: 'Somebody threw it out. It still posts. Mostly.',
  },
  {
    id: 'pizza', name: '1U pizza box', short: '1U', tier: 0,
    cost: 1_600, compute: 4.5, power: 0.46, heat: 0.41, wear: 0.7, net: 0.06,
    req: 'rnd_rails',
    desc: 'A proper rackmount server. Loud enough to be heard through a wall.',
  },
  {
    id: 'db2u', name: '2U database node', short: '2U', tier: 1,
    cost: 6_200, compute: 16, power: 0.78, heat: 0.7, wear: 0.6, net: 0.2,
    req: 'rnd_storage',
    desc: 'Twelve spindles and enough RAM to keep an index resident.',
  },
  {
    id: 'blade', name: 'Blade chassis', short: 'BLD', tier: 2,
    cost: 27_000, compute: 62, power: 1.39, heat: 1.25, wear: 0.55, net: 0.6,
    req: 'rnd_blades',
    desc: 'Sixteen half-height blades sharing a backplane.',
  },
  {
    id: 'gpu4', name: 'Quad-GPU node', short: 'G4', tier: 3,
    cost: 120_000, compute: 250, power: 2.6, heat: 2.35, wear: 0.7, net: 2,
    req: 'rnd_gpu',
    desc: 'Four accelerators, one very unhappy power supply.',
  },
  {
    id: 'trainpod', name: 'Training pod', short: 'TP', tier: 4,
    cost: 550_000, compute: 1_050, power: 5.1, heat: 4.6, wear: 0.75, net: 8,
    req: 'rnd_trainpod',
    desc: 'Eight accelerators on a fabric switch. Rented by the hour.',
  },
  {
    id: 'tensor', name: 'Tensor rack unit', short: 'TRU', tier: 5,
    cost: 2_600_000, compute: 4_400, power: 9.9, heat: 8.9, wear: 0.8, net: 10,
    req: 'rnd_tensor',
    desc: 'A full rack unit of systolic arrays. Ships on a pallet.',
  },
  {
    id: 'superpod', name: 'Liquid superpod', short: 'LSP', tier: 6,
    cost: 12_000_000, compute: 19_000, power: 19.9, heat: 17, wear: 0.7, net: 30,
    req: 'rnd_superpod',
    desc: 'Direct-to-chip coolant loops. Do not open while running.',
  },
  {
    id: 'photonic', name: 'Photonic accelerator', short: 'PHO', tier: 7,
    cost: 60_000_000, compute: 84_000, power: 41, heat: 33, wear: 0.6, net: 90,
    req: 'rnd_photonic',
    desc: 'Matrix multiplies at the speed of light, minus the optics tax.',
  },
  {
    id: 'quantum', name: 'Quantum coprocessor', short: 'QPU', tier: 8,
    cost: 300_000_000, compute: 380_000, power: 86, heat: 68, wear: 0.5, net: 300,
    req: 'rnd_quantum',
    desc: 'Runs at 15 millikelvin inside a room you cannot keep below 30 °C.',
  },
  {
    id: 'neuro', name: 'Neuromorphic lattice', short: 'NML', tier: 9,
    cost: 1_600_000_000, compute: 1_800_000, power: 189, heat: 140, wear: 0.45, net: 900,
    req: 'rnd_neuro',
    desc: 'Spiking silicon that sleeps when idle and dreams when it does not.',
  },
  {
    id: 'zetta', name: 'Zettascale core', short: 'ZET', tier: 10,
    cost: 9_100_000_000, compute: 9_500_000, power: 465, heat: 340, wear: 0.4, net: 3_000,
    req: 'rnd_zetta',
    desc: 'The last thing anybody bothered to give a model number.',
  },

  // ---------------------------------------------------------------- siblings
  //
  // One alternative at every tier, rather than a longer ladder. A longer
  // ladder would push compute-per-kW further still, and that ratio is the
  // spine of the economy: revenue scales with compute and almost every cost
  // scales with kW, so stretching it is how the cost side vanished in the
  // first place. These sit beside their tier-mates instead — each better at
  // one thing and worse at another, so which one you buy is a decision about
  // the site you actually have rather than a number going up.
  {
    id: 'nuc', name: 'Mini PC cluster', short: 'NUC', tier: 0,
    cost: 900, compute: 2.2, power: 0.16, heat: 0.13, wear: 0.5, net: 0.03,
    req: 'rnd_minipc',
    desc: 'Eight of them on a shelf. Half the work of a pizza box for a third of the heat.',
  },
  {
    id: 'jbod', name: 'Archive node', short: 'ARC', tier: 1,
    cost: 4_200, compute: 9, power: 0.30, heat: 0.26, wear: 0.35, net: 0.05,
    req: 'rnd_archive',
    desc: 'Spinning rust and very little else. Cheap to run and hard to break.',
  },
  {
    id: 'twin1u', name: 'Twin 1U node', short: '2×1U', tier: 2,
    cost: 34_000, compute: 88, power: 2.3, heat: 2.2, wear: 0.85, net: 1,
    req: 'rnd_twin',
    desc: 'Two boards in one chassis. More work per slot, and it runs hot enough to say so.',
  },
  {
    id: 'fpga', name: 'FPGA array', short: 'FPG', tier: 3,
    cost: 150_000, compute: 190, power: 1.55, heat: 1.3, wear: 0.4, net: 1.2,
    req: 'rnd_fpga',
    desc: 'Reconfigurable, frugal and patient. Costs more per unit of work and repays it in the bill.',
  },
  {
    id: 'armsled', name: 'ARM microserver sled', short: 'ARM', tier: 4,
    cost: 480_000, compute: 820, power: 3.3, heat: 2.9, wear: 0.5, net: 12,
    req: 'rnd_arm',
    desc: 'Ninety-six cores that sip. Wants more switching than it is worth if your network is thin.',
  },
  {
    id: 'inferbox', name: 'Inference appliance', short: 'INF', tier: 5,
    cost: 2_200_000, compute: 3_200, power: 6.2, heat: 5.4, wear: 0.6, net: 4,
    req: 'rnd_inference',
    desc: 'Built to serve, not to train. Modest output, and it barely touches the switches.',
  },
  {
    id: 'denspod', name: 'Dense compute pod', short: 'DCP', tier: 6,
    cost: 15_000_000, compute: 27_000, power: 31, heat: 28, wear: 0.9, net: 40,
    req: 'rnd_denspod',
    desc: 'Everything the superpod does and more of it, at a temperature that eats the hardware.',
  },
  {
    id: 'wafer', name: 'Wafer-scale engine', short: 'WSE', tier: 7,
    cost: 96_000_000, compute: 140_000, power: 78, heat: 66, wear: 0.75, net: 120,
    req: 'rnd_wafer',
    desc: 'One die the size of a dinner plate. Enormous in a slot, and enormous in the bill.',
  },
  {
    id: 'optic', name: 'Optical fabric node', short: 'OFN', tier: 8,
    cost: 340_000_000, compute: 300_000, power: 60, heat: 44, wear: 0.42, net: 90,
    req: 'rnd_optic',
    desc: 'Switches in glass. Less raw output than the quantum crate and a third of the network to feed it.',
  },
  {
    id: 'analog', name: 'Analogue compute array', short: 'ANA', tier: 9,
    cost: 1_900_000_000, compute: 2_400_000, power: 210, heat: 165, wear: 0.95, net: 700,
    req: 'rnd_analog',
    desc: 'Maths in voltages. Faster and cheaper to run than anything at its tier, and it wears out watching you.',
  },
  {
    id: 'swarm', name: 'Swarm node', short: 'SWM', tier: 10,
    cost: 7_400_000_000, compute: 6_200_000, power: 275, heat: 205, wear: 0.3, net: 1_800,
    req: 'rnd_swarm',
    desc: 'Redundant to the point of boredom. Two thirds of a zettascale core and a fraction of the wear.',
  },
  {
    id: 'supercon', name: 'Superconducting core', short: 'SCC', tier: 10,
    cost: 13_000_000_000, compute: 13_000_000, power: 560, heat: 300, wear: 0.55, net: 4_000,
    req: 'rnd_supercon',
    desc: 'Zero resistance in the die and a great deal of it everywhere else. The most work a slot can hold.',
  },
  // ======================================================== past the zettascale
  //
  // Seven tiers above what used to be the end, and the rule changes here.
  //
  // Below, each tier was roughly twice the work per kilowatt of the one under
  // it — 4,495x from the salvaged desktop to the zettascale core. That ratio is
  // the spine of the economy: revenue follows compute, nearly every cost
  // follows kilowatts, and stretching it is how the cost side vanished once
  // already. Carrying on at that rate for seven more tiers would multiply it by
  // another 250 and undo the whole correction.
  //
  // So these get bigger rather than better. Compute per unit rises about 2.8x a
  // tier; compute per kilowatt rises about 1.25x. You are buying machines that
  // do more because there is more of them, not because physics got kinder — and
  // the power, the heat and the bill all scale with that.
  {
    id: 'exa', name: 'Exascale cabinet', short: 'EXA', tier: 11,
    cost: 90_000_000_000, compute: 26_000_000, power: 1_000, heat: 720, wear: 0.45, net: 8_000,
    req: 'rnd_exa',
    desc: 'Delivered by crane through a hole left in the roof for the purpose.',
  },
  {
    id: 'exa2', name: 'Exascale twin', short: 'EX2', tier: 11,
    cost: 140_000_000_000, compute: 41_000_000, power: 1_720, heat: 1_290, wear: 0.7, net: 13_000,
    req: 'rnd_exa2',
    desc: 'Two cabinets on one spine. More per slot, and it runs hot enough to need the liquid loop it assumes you have.',
  },
  {
    id: 'coldexa', name: 'Sub-ambient exascale', short: 'CXA', tier: 11,
    cost: 165_000_000_000, compute: 24_000_000, power: 760, heat: 430, wear: 0.32, net: 7_400,
    req: 'rnd_coldexa',
    desc: 'Runs below freezing at the die. Less work per slot than the standard cabinet, and far less of it comes back as heat.',
  },
  {
    id: 'sparseexa', name: 'Sparse tensor engine', short: 'SPX', tier: 11,
    cost: 78_000_000_000, compute: 21_000_000, power: 880, heat: 640, wear: 0.5, net: 3_200,
    req: 'rnd_sparse',
    desc: 'Skips the zeroes, and most of a modern model is zeroes. Cheap, frugal on switching, useless on dense work.',
  },
  {
    id: 'zeta', name: 'Zetta lattice', short: 'ZTL', tier: 12,
    cost: 600_000_000_000, compute: 72_000_000, power: 2_300, heat: 1_620, wear: 0.42, net: 22_000,
    req: 'rnd_zeta',
    desc: 'A hall in a box. The commissioning engineer stays on site for a fortnight.',
  },
  {
    id: 'zeta2', name: 'Zetta lattice, dense rack', short: 'ZT2', tier: 12,
    cost: 880_000_000_000, compute: 116_000_000, power: 4_000, heat: 3_000, wear: 0.68, net: 36_000,
    req: 'rnd_zeta2',
    desc: 'The same lattice packed until the rear door will not shut. It is faster and it will not last as long.',
  },
  {
    id: 'memzeta', name: 'Memory-coherent zetta', short: 'MZT', tier: 12,
    cost: 1_050_000_000_000, compute: 64_000_000, power: 1_900, heat: 1_280, wear: 0.35, net: 9_000,
    req: 'rnd_memcoh',
    desc: 'One address space across the whole rack. Less raw output, a fraction of the switching, and nothing ever waits on a copy.',
  },
  {
    id: 'optzeta', name: 'All-optical interconnect', short: 'OZT', tier: 12,
    cost: 760_000_000_000, compute: 58_000_000, power: 1_640, heat: 990, wear: 0.4, net: 4_800,
    req: 'rnd_alloptical',
    desc: 'No copper anywhere in the path. The switching bill falls through the floor and the optics bill does not.',
  },
  {
    id: 'yotta', name: 'Yottascale frame', short: 'YOT', tier: 13,
    cost: 4_000_000_000_000, compute: 200_000_000, power: 5_400, heat: 3_700, wear: 0.4, net: 60_000,
    req: 'rnd_yotta',
    desc: 'Sold by the megawatt, not by the unit. The quote has a delivery window measured in quarters.',
  },
  {
    id: 'yotta2', name: 'Yottascale, liquid-immersed', short: 'YO2', tier: 13,
    cost: 5_600_000_000_000, compute: 310_000_000, power: 9_100, heat: 4_100, wear: 0.5, net: 92_000,
    req: 'rnd_yotta2',
    desc: 'Sunk in dielectric to the top of the frame. Half the heat of the air-cooled version and nearly twice the draw.',
  },
  {
    id: 'stochastic', name: 'Stochastic compute array', short: 'STC', tier: 13,
    cost: 3_200_000_000_000, compute: 168_000_000, power: 3_900, heat: 2_700, wear: 0.85, net: 34_000,
    req: 'rnd_stochastic',
    desc: 'Answers that are right often enough, arrived at for a fraction of the energy. Wears like something running that hard should.',
  },
  {
    id: 'photmesh', name: 'Photonic mesh frame', short: 'PMF', tier: 13,
    cost: 4_900_000_000_000, compute: 186_000_000, power: 4_300, heat: 2_200, wear: 0.3, net: 21_000,
    req: 'rnd_photmesh',
    desc: 'Light in the fabric and light in the die. Nothing in it gets hot enough to complain and nothing in it is cheap.',
  },
  {
    id: 'planck', name: 'Planck-class array', short: 'PLK', tier: 14,
    cost: 28_000_000_000_000, compute: 560_000_000, power: 12_800, heat: 8_400, wear: 0.38, net: 165_000,
    req: 'rnd_planck',
    desc: 'The first machine that needs its own substation before it will power on.',
  },
  {
    id: 'planck2', name: 'Planck-class, overclocked', short: 'PK2', tier: 14,
    cost: 39_000_000_000_000, compute: 880_000_000, power: 22_000, heat: 15_400, wear: 0.75, net: 260_000,
    req: 'rnd_planck2',
    desc: 'Run past its rating with the vendor’s blessing and none of the vendor’s warranty.',
  },
  {
    id: 'roomtemp', name: 'Superconducting frame', short: 'SCF', tier: 14,
    cost: 46_000_000_000_000, compute: 520_000_000, power: 8_600, heat: 3_100, wear: 0.25, net: 140_000,
    req: 'rnd_roomtempcore',
    desc: 'No resistance in the die and very little heat out of it. Everything about it is expensive except running it.',
  },
  {
    id: 'neuroscale', name: 'Cortical-scale lattice', short: 'CSL', tier: 14,
    cost: 33_000_000_000_000, compute: 610_000_000, power: 11_400, heat: 7_200, wear: 0.55, net: 48_000,
    req: 'rnd_neuroscale',
    desc: 'Spiking silicon at the density of the thing it was named after. Idles at almost nothing and needs hardly any network.',
  },
  {
    id: 'singularity', name: 'Continuum processor', short: 'CTM', tier: 15,
    cost: 190_000_000_000_000, compute: 1_600_000_000, power: 31_000, heat: 19_500, wear: 0.36, net: 420_000,
    req: 'rnd_continuum',
    desc: 'The specification sheet stopped listing cores and started listing floor loading.',
  },
  {
    id: 'singularity2', name: 'Continuum, dual-plane', short: 'CT2', tier: 15,
    cost: 265_000_000_000_000, compute: 2_500_000_000, power: 53_000, heat: 36_000, wear: 0.7, net: 660_000,
    req: 'rnd_continuum2',
    desc: 'Two planes sharing a substrate. It does what two of them do in the space of one and the heat of three.',
  },
  {
    id: 'quantumfab', name: 'Fault-tolerant quantum bank', short: 'FTQ', tier: 15,
    cost: 310_000_000_000_000, compute: 1_450_000_000, power: 24_000, heat: 11_000, wear: 0.2, net: 96_000,
    req: 'rnd_ftq',
    desc: 'Error-corrected all the way up. It barely wears, it barely switches, and it costs what a small country spends on roads.',
  },
  {
    id: 'thermo', name: 'Thermodynamic sampler', short: 'THS', tier: 15,
    cost: 150_000_000_000_000, compute: 1_280_000_000, power: 21_000, heat: 17_800, wear: 0.9, net: 210_000,
    req: 'rnd_thermo',
    desc: 'Computes by letting noise settle. The cheapest work at its tier and it eats itself doing it.',
  },
  {
    id: 'megastructure', name: 'Compute megastructure', short: 'MEG', tier: 16,
    cost: 1_300_000_000_000_000, compute: 4_500_000_000, power: 74_000, heat: 44_000, wear: 0.34, net: 1_100_000,
    req: 'rnd_mega',
    desc: 'It is not installed so much as constructed. Planning permission took longer than the build.',
  },
  {
    id: 'megastructure2', name: 'Megastructure, stacked', short: 'MG2', tier: 16,
    cost: 1_850_000_000_000_000, compute: 7_100_000_000, power: 128_000, heat: 88_000, wear: 0.66, net: 1_700_000,
    req: 'rnd_mega2',
    desc: 'Nine of them in a column, sharing one spine and one very serious fire suppression system.',
  },
  {
    id: 'vacuum', name: 'Vacuum-gap lattice', short: 'VAC', tier: 16,
    cost: 2_200_000_000_000_000, compute: 4_100_000_000, power: 58_000, heat: 21_000, wear: 0.22, net: 880_000,
    req: 'rnd_vacuum',
    desc: 'Nothing between the layers at all, which turns out to be the best insulator anybody has found.',
  },
  {
    id: 'reversible', name: 'Reversible logic frame', short: 'REV', tier: 16,
    cost: 1_600_000_000_000_000, compute: 3_900_000_000, power: 46_000, heat: 14_000, wear: 0.4, net: 720_000,
    req: 'rnd_reversiblelogic',
    desc: 'Computation that can be run backwards throws away almost no energy. Almost.',
  },
  {
    id: 'dyson', name: 'Orbital compute tether', short: 'ORB', tier: 17,
    cost: 9_000_000_000_000_000, compute: 13_000_000_000, power: 180_000, heat: 96_000, wear: 0.3, net: 3_100_000,
    req: 'rnd_orbital',
    desc: 'The compute is up there. What is on your floor is the ground station, and it is still the largest thing you own.',
  },
  {
    id: 'dyson2', name: 'Tether array', short: 'OR2', tier: 17,
    cost: 13_000_000_000_000_000, compute: 21_000_000_000, power: 320_000, heat: 190_000, wear: 0.62, net: 4_900_000,
    req: 'rnd_orbital2',
    desc: 'Four tethers and a launch cadence. Somebody in the company now has opinions about weather in Guiana.',
  },
  {
    id: 'substrate', name: 'Programmable matter substrate', short: 'PMS', tier: 17,
    cost: 16_000_000_000_000_000, compute: 12_200_000_000, power: 142_000, heat: 52_000, wear: 0.18, net: 2_400_000,
    req: 'rnd_substrate',
    desc: 'It reconfigures itself into whatever the workload wants. It has never needed a spare part.',
  },
  {
    id: 'final', name: 'The last machine', short: 'FIN', tier: 17,
    cost: 24_000_000_000_000_000, compute: 19_000_000_000, power: 205_000, heat: 88_000, wear: 0.26, net: 3_800_000,
    req: 'rnd_last',
    desc: 'Nobody has given it a model number. There is nothing left to number it against.',
  },
  // ================================================== more choice in the middle
  // Two more at every tier from the back office to the campus. The middle of
  // the game had one decision per tier and a long stretch where the only new
  // thing was the next tier; this is where most of a run is actually spent.
  {
    id: 'laptop', name: 'Pallet of laptops', short: 'LAP', tier: 0,
    cost: 540, compute: 1.6, power: 0.09, heat: 0.07, wear: 0.75, net: 0.02,
    req: 'rnd_salvage',
    desc: 'A lease return nobody wanted. Batteries removed, lids off, stacked four deep.',
  },
  {
    id: 'tower', name: 'Workstation tower', short: 'TWR', tier: 0,
    cost: 2_400, compute: 6.5, power: 0.72, heat: 0.66, wear: 0.6, net: 0.09,
    req: 'rnd_workstation',
    desc: 'More work than a pizza box and it takes the space of two. The airflow is an afterthought.',
  },
  {
    id: 'nas', name: 'Storage appliance', short: 'NAS', tier: 1,
    cost: 9_800, compute: 22, power: 1.15, heat: 1.05, wear: 0.5, net: 0.35,
    req: 'rnd_nas',
    desc: 'Twenty-four bays and a controller that does the thinking. Dense, warm and dependable.',
  },
  {
    id: 'micro', name: 'Microserver shelf', short: 'MSV', tier: 1,
    cost: 5_600, compute: 12, power: 0.36, heat: 0.3, wear: 0.42, net: 0.12,
    req: 'rnd_microserver',
    desc: 'Sixteen tiny nodes on a shelf. Frugal, quiet, and hopeless at anything that needs one big core.',
  },
  {
    id: 'blade2', name: 'Full-height blade chassis', short: 'BL2', tier: 2,
    cost: 52_000, compute: 124, power: 2.7, heat: 2.45, wear: 0.6, net: 1.3,
    req: 'rnd_blade2',
    desc: 'Eight full-height blades and a midplane that costs more than the blades.',
  },
  {
    id: 'gpu1', name: 'Single-GPU node', short: 'G1', tier: 2,
    cost: 31_000, compute: 74, power: 1.05, heat: 0.95, wear: 0.5, net: 0.8,
    req: 'rnd_gpu1',
    desc: 'One accelerator and a power supply that is not frightened of it. The cheapest way into real throughput.',
  },
  {
    id: 'gpu8', name: 'Eight-GPU node', short: 'G8', tier: 3,
    cost: 240_000, compute: 540, power: 5.9, heat: 5.4, wear: 0.8, net: 4.5,
    req: 'rnd_gpu8',
    desc: 'Eight cards, two power supplies and a fan wall you can hear from the car park.',
  },
  {
    id: 'vector', name: 'Vector engine', short: 'VEC', tier: 3,
    cost: 175_000, compute: 300, power: 2.2, heat: 1.8, wear: 0.45, net: 1.6,
    req: 'rnd_vector',
    desc: 'Wide registers and a memory bus to match. Sober, efficient, and no use at all for training.',
  },
  {
    id: 'trainpod2', name: 'Training pod, liquid', short: 'TP2', tier: 4,
    cost: 780_000, compute: 1_640, power: 8.4, heat: 5.9, wear: 0.6, net: 14,
    req: 'rnd_trainpod2',
    desc: 'Cold plates on every accelerator. More work, more draw, and a third less heat into the room.',
  },
  {
    id: 'edge', name: 'Edge inference sled', short: 'EDG', tier: 4,
    cost: 390_000, compute: 700, power: 2.4, heat: 2.0, wear: 0.4, net: 3,
    req: 'rnd_edge',
    desc: 'Built to sit in a cabinet in a shop. Sips power, needs almost no switching, and never complains.',
  },
  {
    id: 'tensor2', name: 'Tensor unit, wide', short: 'TR2', tier: 5,
    cost: 3_900_000, compute: 6_900, power: 15.4, heat: 13.4, wear: 0.85, net: 16,
    req: 'rnd_tensor2',
    desc: 'Twice the arrays on the same pallet. It is the loudest thing you will ever rack.',
  },
  {
    id: 'graph', name: 'Graph processor', short: 'GRP', tier: 5,
    cost: 2_900_000, compute: 3_800, power: 6.6, heat: 5.5, wear: 0.5, net: 22,
    req: 'rnd_graph',
    desc: 'Built for pointer chasing rather than matrix multiplies. Frugal, and it wants a great deal of network.',
  },
  {
    id: 'superpod2', name: 'Superpod, two-phase', short: 'SP2', tier: 6,
    cost: 18_000_000, compute: 24_500, power: 22.6, heat: 14, wear: 0.55, net: 36,
    req: 'rnd_superpod2',
    desc: 'Boiling coolant at the die. More work than the standard pod and it puts far less of it into the hall.',
  },
  {
    id: 'sparse6', name: 'Mixture-of-experts unit', short: 'MOE', tier: 6,
    cost: 13_500_000, compute: 21_000, power: 17.8, heat: 15.2, wear: 0.75, net: 18,
    req: 'rnd_moe',
    desc: 'Only a fraction of it is awake at any moment, which is the whole trick and also the whole risk.',
  },
  {
    id: 'photonic2', name: 'Photonic accelerator, coherent', short: 'PH2', tier: 7,
    cost: 84_000_000, compute: 118_000, power: 52, heat: 39, wear: 0.52, net: 130,
    req: 'rnd_photonic2',
    desc: 'Phase as well as amplitude. Half again the output of the first generation and a calibration rig that lives on site.',
  },
  {
    id: 'inmem', name: 'In-memory compute bank', short: 'IMC', tier: 7,
    cost: 71_000_000, compute: 96_000, power: 33, heat: 24, wear: 0.36, net: 55,
    req: 'rnd_inmem',
    desc: 'The arithmetic happens in the memory array. Nothing moves, so nothing gets hot and nothing needs switching.',
  },
  {
    id: 'quantum2', name: 'Quantum coprocessor, annealing', short: 'QA', tier: 8,
    cost: 390_000_000, compute: 470_000, power: 104, heat: 82, wear: 0.58, net: 340,
    req: 'rnd_quantum2',
    desc: 'Narrower than the gate machine and very much faster at the one thing it does.',
  },
  {
    id: 'asic8', name: 'Workload ASIC', short: 'ASC', tier: 8,
    cost: 265_000_000, compute: 340_000, power: 52, heat: 38, wear: 0.3, net: 190,
    req: 'rnd_asic',
    desc: 'Fixed function, taped out for one workload. Nothing touches it on efficiency until the workload changes.',
  },
  {
    id: 'neuro2', name: 'Neuromorphic lattice, dense', short: 'NL2', tier: 9,
    cost: 2_100_000_000, compute: 2_700_000, power: 260, heat: 205, wear: 0.62, net: 1_150,
    req: 'rnd_neuro2',
    desc: 'The same silicon packed four times as close. It dreams louder and it does not sleep as well.',
  },
  {
    id: 'hybrid9', name: 'Hybrid analogue-digital core', short: 'HYB', tier: 9,
    cost: 2_600_000_000, compute: 2_200_000, power: 168, heat: 118, wear: 0.44, net: 640,
    req: 'rnd_hybrid',
    desc: 'Analogue where precision does not matter and digital where it does, with a converter in between that is the expensive part.',
  },
];



export const HARDWARE_BY_ID = Object.fromEntries(HARDWARE.map((h) => [h.id, h]));

/** Best hardware the player has unlocked, newest first. */
export function unlockedHardware(state) {
  return HARDWARE.filter((h) => !h.req || state.research.done.includes(h.req));
}
