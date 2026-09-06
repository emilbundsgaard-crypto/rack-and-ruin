// Contract templates. Offers are generated from these, scaled to whatever
// capacity the player currently has, so the board stays relevant forever.
//
//   minRep    – reputation needed before the template shows up
//   size      – fraction of *sellable* capacity a typical offer asks for
//   pay       – multiplier on the market rate per unit of compute
//   net       – Gbps required per 1000 compute
//   uptime    – SLA floor; drop below it and penalties start
//   days      – contract length in game-days
//   penalty   – multiple of daily pay charged per breached day
//   research  – bonus research points per day while active (rare)

export const CONTRACT_TEMPLATES = [
  { id: 'static', name: 'Static site hosting', client: 'Nordbageriet',
    minRep: 0, size: 0.46, pay: 1.00, net: 3, uptime: 0.80, days: 10, penalty: 0.4,
    blurb: 'Six pages and a contact form. It must simply not be down.' },
  { id: 'mail', name: 'Mail & backup', client: 'Halvorsen Revision',
    minRep: 0, size: 0.54, pay: 1.05, net: 4, uptime: 0.85, days: 11, penalty: 0.5,
    blurb: 'Nightly backups and an IMAP server nobody has patched since 2019.' },
  { id: 'intranet', name: 'Corporate intranet', client: 'Mareld Logistics',
    minRep: 4, size: 0.53, pay: 1.15, net: 5, uptime: 0.90, days: 13, penalty: 0.6,
    blurb: 'Payroll, timesheets and a wiki with 4000 orphaned pages.' },
  { id: 'shop', name: 'E-commerce storefront', client: 'Bruun & Datter',
    minRep: 10, size: 0.59, pay: 1.30, net: 9, uptime: 0.95, days: 14, penalty: 0.9,
    blurb: 'Black Friday is coming and they know exactly when you flinch.' },
  { id: 'game', name: 'Game server cluster', client: 'Vandal Interactive',
    minRep: 18, size: 0.62, pay: 1.35, net: 16, uptime: 0.94, days: 12, penalty: 1.0,
    blurb: 'Latency-sensitive, bursty, and the players are extremely vocal.' },
  { id: 'transcode', name: 'Video transcoding', client: 'Strøm Media',
    minRep: 26, size: 0.65, pay: 1.40, net: 22, uptime: 0.90, days: 16, penalty: 0.8,
    blurb: 'A back catalogue of 40,000 hours, wanted in nine bitrates.' },
  { id: 'cdn', name: 'CDN edge caching', client: 'Aurora Networks',
    minRep: 34, size: 0.56, pay: 1.30, net: 48, uptime: 0.97, days: 18, penalty: 1.1,
    blurb: 'Mostly bandwidth. Bring switching or do not bother bidding.' },
  { id: 'genome', name: 'Genomics pipeline', client: 'Institut for Biovidenskab',
    minRep: 42, size: 0.70, pay: 1.55, net: 12, uptime: 0.88, days: 19, penalty: 0.7,
    research: 1.5,
    blurb: 'Batch work. They care about throughput, not about latency.' },
  { id: 'weather', name: 'Regional weather model', client: 'Meteorologisk Institut',
    minRep: 52, size: 0.71, pay: 1.60, net: 20, uptime: 0.96, days: 21, penalty: 1.2,
    research: 2.5,
    blurb: 'Runs every six hours and must finish before the next one starts.' },
  { id: 'risk', name: 'Financial risk simulation', client: 'Kvist Kapital',
    minRep: 64, size: 0.68, pay: 1.95, net: 26, uptime: 0.99, days: 16, penalty: 2.2,
    blurb: 'Overnight Monte Carlo. Miss the open and they will tell everyone.' },
  { id: 'finetune', name: 'LLM fine-tuning', client: 'Skyfall Labs',
    minRep: 78, size: 0.74, pay: 2.10, net: 40, uptime: 0.97, days: 18, penalty: 1.6,
    research: 5,
    blurb: 'Rented by the GPU-hour, billed by the second, watched constantly.' },
  { id: 'molecular', name: 'Molecular dynamics', client: 'Farmakon A/S',
    minRep: 92, size: 0.73, pay: 2.05, net: 18, uptime: 0.93, days: 22, penalty: 1.3,
    research: 8,
    blurb: 'Ten million timesteps and a chemist who checks in every hour.' },
  { id: 'pretrain', name: 'Foundation model pretraining', client: 'Aether Research',
    minRep: 120, size: 0.85, pay: 2.60, net: 90, uptime: 0.995, days: 24, penalty: 3.0,
    research: 14,
    blurb: 'One run. Ninety days. Any interruption restarts the checkpoint.' },
  { id: 'sovereign', name: 'Sovereign AI cloud', client: 'Ministeriet for Digitalisering',
    minRep: 160, size: 0.81, pay: 2.90, net: 70, uptime: 0.99, days: 29, penalty: 2.6,
    research: 20,
    blurb: 'Air-gapped, audited, and paid for out of a very large budget.' },
  { id: 'climate', name: 'Planetary climate twin', client: 'Earth Systems Consortium',
    minRep: 210, size: 0.85, pay: 3.20, net: 120, uptime: 0.995, days: 30, penalty: 3.4,
    research: 34,
    blurb: 'A kilometre-scale model of the whole atmosphere. Continuously.' },
  { id: 'lattice', name: 'Lattice QCD campaign', client: 'CERN-adjacent collaboration',
    minRep: 280, size: 0.85, pay: 3.40, net: 60, uptime: 0.98, days: 30, penalty: 2.8,
    research: 55,
    blurb: 'Physicists with a grant, a deadline and infinite patience for queues.' },
  { id: 'synthesis', name: 'Autonomous materials lab', client: 'Helix Foundry',
    minRep: 360, size: 0.85, pay: 3.80, net: 150, uptime: 0.995, days: 30, penalty: 4.0,
    research: 90,
    blurb: 'The model designs the alloy, orders it, tests it, and starts again.' },
  { id: 'oracle', name: 'Continental inference grid', client: 'Consortium of everyone',
    minRep: 460, size: 0.85, pay: 4.40, net: 240, uptime: 0.997, days: 30, penalty: 4.5,
    research: 150,
    blurb: 'Half a continent asks it questions. You answer all of them.' },
];

export const TEMPLATES_BY_ID = Object.fromEntries(CONTRACT_TEMPLATES.map((t) => [t.id, t]));

/** Slight name variation so the board does not read like a spreadsheet. */
const PREFIX = ['', '', '', 'Priority ', 'Renewal: ', 'Expanded ', 'Pilot ', 'Multi-year '];

export function decorate(template, seed) {
  const p = PREFIX[Math.floor(seed * PREFIX.length) % PREFIX.length];
  return p + template.name;
}
