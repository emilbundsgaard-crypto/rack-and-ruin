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
];

export const HARDWARE_BY_ID = Object.fromEntries(HARDWARE.map((h) => [h.id, h]));

/** Best hardware the player has unlocked, newest first. */
export function unlockedHardware(state) {
  return HARDWARE.filter((h) => !h.req || state.research.done.includes(h.req));
}
