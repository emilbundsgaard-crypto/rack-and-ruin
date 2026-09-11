/**
 * The Ashbrook register.
 *
 * A city of a million people, in the order it empties: every street, estate,
 * ward and institution, each with the one line that says how it went.
 *
 * It adds no mechanics. Nothing here is bought, managed or clicked; the only
 * input is the damage figure the simulation already produces. What it changes
 * is what that figure means — you do not watch a bar fill, you watch the
 * Hallorans leave, and then Weir Road, and then the Northgate wards, and then
 * the hospital.
 *
 * The shape matters as much as the arithmetic. It opens on single households
 * close enough to the fence to hear it, widens to whole districts as water,
 * grid capacity and land start going the other way, and narrows again at the
 * end to the handful of people who would not leave. A million is a number.
 * The Trescothicks leaving the light on is not.
 *
 *   at    the damage at which they are gone
 *   addr  where, as anyone in the city would say it
 *   who   the household, or nothing for a place
 *   n     how many people (0 for places, which hold no one)
 *   line  what happened
 *
 * The people add up to 1,000,000 exactly, which is checked at load rather
 * than trusted: a register that disagrees with the population counter would
 * be worse than no register.
 */

export const REGISTER = [
  // ---- the fence. Close enough to hear it, and the first to say so.
  { at: 0.004, addr: '7 Weir Road', who: 'The Ferns', n: 2,
    line: 'Ken Fern worked nights and slept days. He put the house up in March and took the first offer on it.' },
  { at: 0.007, addr: '3 Mill Lane', who: 'Mrs Dacre', n: 1,
    line: 'Ninety-one, and she said the hum was the only thing she could still hear clearly. Her niece moved her to Belper.' },
  { at: 0.009, addr: '22 Mill Lane', who: 'The Okonjos', n: 4,
    line: 'Eleven years here. Adaeze said it was the noise. Tunde said it was the noise and everything after it.' },
  { at: 0.011, addr: '5 Bramley Close', who: 'The Pethericks', n: 3,
    line: 'They had double glazing put in, then thicker glazing, then a survey, and then they went.' },
  { at: 0.013, addr: 'Weir Road, the even numbers', who: 'Fourteen houses', n: 38,
    line: 'They backed onto the new fence. One landlord bought all six in a fortnight and boarded them the same month.' },
  { at: 0.016, addr: 'Kiln Row', who: 'Eleven houses', n: 27,
    line: 'Closest to the access road. Forty lorries a day at first, and then nobody counted any more.' },
  { at: 0.019, addr: '14 Weir Road', who: 'The Hallorans', n: 5,
    line: 'Bridget had the environmental health officer out four times. He agreed with her every time and could do nothing.' },
  { at: 0.022, addr: 'Brookside, the top of the estate', who: 'Nineteen households', n: 48,
    line: 'Built in 1968 for the view down the valley. The view is now a substation and a fence.' },
  { at: 0.026, addr: 'The Green, north side', who: 'Sixteen households', n: 43,
    line: 'The nearest houses to the intake. They went one after another over a summer, in the order you would guess.' },
  { at: 0.030, addr: 'Fold Lane', who: 'Twenty-two households', n: 61,
    line: 'A survey put the night reading at 47 decibels at the back bedrooms. The limit is 45, and the fine was paid.' },
  { at: 0.035, addr: 'The allotments, Weir Road end', who: null, n: 0,
    line: 'Ninety plots, worked since 1946. The land was needed for the second transformer compound.' },
  { at: 0.040, addr: 'Mill Lane, 24 to 40', who: 'Seventeen houses', n: 44,
    line: 'The company bought the odd numbers first. The even numbers understood what that meant and held out four months.' },
  { at: 0.046, addr: '1 Kiln Row', who: 'The Adeyemis', n: 6,
    line: 'Femi had been a shift engineer at the old works. He knew exactly what the noise was and it did not help.' },
  { at: 0.052, addr: 'Weir Road, the rest', who: 'Twenty-nine households', n: 78,
    line: 'The road nearest the site emptied in under a year. It is the only street the company never had to buy twice.' },
  { at: 0.060, addr: 'Bramley Close', who: 'Twelve households', n: 34,
    line: 'A close built in 1998 for people who wanted somewhere quiet. It was, for twenty-six years.' },
  { at: 0.068, addr: 'The Chase', who: 'Forty bungalows', n: 52,
    line: 'Built for people who had retired here on purpose. The first to go were the ones who could still drive.' },

  // ---- the water. The river was the reason the city was built here.
  { at: 0.078, addr: 'The Ashbrook Angling Club', who: null, n: 0,
    line: 'Founded 1889. The abstraction licence was varied in a consultation that drew eleven responses.' },
  { at: 0.086, addr: 'Weirside, the lower terraces', who: 'Ninety households', n: 214,
    line: 'The river dropped four feet in a dry August and did not come back up in September.' },
  { at: 0.095, addr: 'Bleachfield Street', who: 'Sixty-one households', n: 158,
    line: 'Named for what used to happen here, which needed the same water and employed rather more people.' },
  { at: 0.105, addr: 'The Old Baths', who: null, n: 0,
    line: 'Closed for the summer for essential works, in a summer when the supply company would not commit to a volume.' },
  { at: 0.116, addr: 'Tanyard Ward, the river end', who: 'Four hundred households', n: 940,
    line: 'The oldest housing in the city and the lowest-lying. The insurers went first, then the mortgages, then the people.' },
  { at: 0.128, addr: 'Lockgate Row', who: 'Thirty-four households', n: 89,
    line: 'They had been promised the towpath would stay public. It is inside the fence now, with a gate nobody has the code for.' },
  { at: 0.141, addr: '9 Bleachfield Street', who: 'The Sarpongs', n: 4,
    line: 'They had no car. When the water pressure went in the top-floor flats they had a fortnight to work out what that meant.' },
  { at: 0.155, addr: 'Tanyard Ward, the rest', who: 'Nine hundred households', n: 2_180,
    line: 'A ward of three thousand in 2011. The census after this one will not have a category for what it became.' },

  // ---- the grid. Everything else that wanted a connection stopped getting one.
  { at: 0.170, addr: 'Hartley & Vane, castings', who: null, n: 0,
    line: 'Four hundred years of iron in this valley, and it ended over a grid connection they were told to wait eight years for.' },
  { at: 0.186, addr: 'The Northgate industrial estate', who: null, n: 0,
    line: 'Sixty-one units. Forty-three of them needed three-phase, and the queue for three-phase was the campus.' },
  { at: 0.203, addr: 'Northgate, the works housing', who: 'Two thousand households', n: 4_900,
    line: 'Built by the foundry for the foundry. It outlasted the foundry by nineteen months.' },
  { at: 0.221, addr: 'Cropwell Ward', who: 'Three thousand households', n: 7_400,
    line: 'The brownouts were always in the same four wards, and the company always said the two facts were unrelated.' },
  { at: 0.240, addr: 'Ashbrook Bus Depot', who: null, n: 0,
    line: 'The electric fleet was the council’s proudest thing. They could not charge it and sold it to Nottingham.' },
  { at: 0.260, addr: 'The 42, the 9 and the 9A', who: null, n: 0,
    line: 'Three routes cut in one timetable change. It is a long way to anywhere from Northgate without them.' },
  { at: 0.281, addr: 'Saltergate Ward', who: 'Five thousand households', n: 12_600,
    line: 'Furthest from the site and first to lose its supply when the priority schedule was published.' },
  { at: 0.300, addr: 'Northgate Ward, the rest', who: 'Eleven thousand households', n: 27_800,
    line: 'Nobody moved out of Northgate because of the hum. They moved because there was no work and the lights went out.' },

  // ---- the money. The city was still full. It had stopped being affordable.
  { at: 0.320, addr: 'Cropwell Ward, the new build', who: 'Nine hundred households', n: 2_100,
    line: 'Sold off-plan to people who worked at the campus. When the campus automated a shift they sold at a loss together.' },
  { at: 0.342, addr: 'The Arboretum flats', who: 'Twelve hundred households', n: 2_400,
    line: 'Bought as investments by people who had never been to Ashbrook, and let to people who could not afford to leave it.' },
  { at: 0.365, addr: 'Ashbrook College of Art', who: null, n: 0,
    line: 'A hundred and thirty years, closed on an intake of nineteen. The building is a substation control room.' },
  { at: 0.388, addr: 'Woodborough Ward', who: 'Eight thousand households', n: 19_700,
    line: 'Rents doubled in four years against wages that did not. The people who left were not the people who complained.' },
  { at: 0.412, addr: 'The Market Hall', who: null, n: 0,
    line: 'Eighty-one stalls in 2019 and nine on the day it shut. The council could not insure a building nobody used.' },
  { at: 0.437, addr: 'Saltergate Ward, the rest', who: 'Fourteen thousand households', n: 34_600,
    line: 'The ward with the lowest incomes in the city absorbed the highest energy prices in the county. It did not.' },
  { at: 0.462, addr: 'Ashbrook Town FC', who: null, n: 0,
    line: 'Founded 1891, folded in the National League North. The ground is a car park for the north gate.' },
  { at: 0.488, addr: 'The Beeches', who: 'Six thousand households', n: 15_300,
    line: 'A good address with good schools. The schools were good because of the families, and the families went.' },
  { at: 0.515, addr: 'Woodborough Ward, the rest', who: 'Seventeen thousand households', n: 42_000,
    line: 'Twenty-three streets. The company bought eleven of them outright and boarded what it did not need.' },

  // ---- the services. What a city is, once you take enough people out of it.
  { at: 0.542, addr: 'Ashbrook General, maternity', who: null, n: 0,
    line: 'The last baby born in Ashbrook was on a Tuesday in February. Since then it is forty minutes to Derby.' },
  { at: 0.570, addr: 'Cropwell Ward, the rest', who: 'Twenty-one thousand households', n: 51_800,
    line: 'The ward that had kept its shops kept them longest, and then lost them in one quarter.' },
  { at: 0.598, addr: 'Eleven primary schools', who: null, n: 0,
    line: 'Closed in one review. The document called it rationalising the estate to reflect demographic change.' },
  { at: 0.626, addr: 'Sandiacre Ward', who: 'Twenty-six thousand households', n: 64_200,
    line: 'It went in the order the school closures went, which is the order the families with choices went.' },
  { at: 0.654, addr: 'Ashbrook Central Library', who: null, n: 0,
    line: 'Opened 1906 by a man who had made his money in the valley. Closed 2031 by a committee that met online.' },
  { at: 0.682, addr: 'The Ridings', who: 'Thirty-one thousand households', n: 76_500,
    line: 'The largest estate in the county when it was built. It is the largest empty one now.' },
  { at: 0.710, addr: 'Ashbrook General, everything else', who: null, n: 0,
    line: 'A district general hospital needs a district. The trust moved the last three wards to Chesterfield in March.' },

  // ---- the fall. A city does not empty evenly. It empties all at once, late.
  { at: 0.734, addr: 'Sandiacre Ward, the rest', who: 'Thirty-four thousand households', n: 83_900,
    line: 'Once the hospital went, the people who had stayed for the hospital had no reason left to argue with.' },
  { at: 0.756, addr: 'Ashbrook University, the Weirside campus', who: null, n: 0,
    line: 'Nine thousand students in 2024. The last cohort graduated into a city with one employer.' },
  { at: 0.774, addr: 'The student quarter', who: 'Eleven thousand households', n: 21_800,
    line: 'Ten streets of houses in multiple occupation, converted back to nothing in particular and then to nothing.' },
  { at: 0.792, addr: 'The Ridings, the rest', who: 'Thirty-eight thousand households', n: 92_929,
    line: 'The council ran a managed decline programme for it. The word managed was doing a great deal of work.' },
  { at: 0.810, addr: 'Highfields Ward', who: 'Thirty-six thousand households', n: 88_700,
    line: 'The last ward where a house sold at the asking price. That was in the spring, and it was one house.' },
  { at: 0.828, addr: 'Every remaining secondary school', who: null, n: 0,
    line: 'Four became one, and one became a coach to Matlock at ten past seven in the morning.' },
  { at: 0.845, addr: 'The Beeches, the rest', who: 'Twenty-seven thousand households', n: 67_400,
    line: 'The good address went last of the good addresses, which is the only distinction it has left.' },
  { at: 0.861, addr: 'Highfields Ward, the rest', who: 'Thirty thousand households', n: 74_100,
    line: 'By this point leaving was not a decision anyone announced. You noticed a car gone and that was it.' },
  { at: 0.876, addr: 'The Arboretum, the rest', who: 'Twenty-two thousand households', n: 53_200,
    line: 'The freeholder was a pension fund in Toronto that wrote the whole block down to zero in one line.' },
  { at: 0.890, addr: 'Bleachfield and Lockgate, what was left', who: 'Nineteen thousand households', n: 46_800,
    line: 'The oldest part of the city and the last of it to hold a majority of people who had been born in it.' },
  { at: 0.903, addr: 'Tanyard, the new flats', who: 'Fourteen thousand households', n: 28_900,
    line: 'Finished in the year the hospital closed. Two hundred and six of the eight hundred were ever occupied.' },
  { at: 0.915, addr: 'Northgate, everything still standing', who: 'Sixteen thousand households', n: 39_400,
    line: 'The company owns all of it. It is cheaper to hold than to demolish and quieter than either.' },
  { at: 0.926, addr: 'Ashbrook Crematorium', who: null, n: 0,
    line: 'The busiest year in its history was the year before it closed, which is the sentence the inquiry kept.' },
  { at: 0.936, addr: 'The last of Cropwell', who: 'Nine thousand households', n: 22_300,
    line: 'A rota for the generator, a WhatsApp group for the water, and a shop that opened two mornings a week.' },
  { at: 0.945, addr: 'The last of Saltergate', who: 'Six thousand households', n: 15_100,
    line: 'The poorest ward stayed longest, because leaving costs money and they had run out of it years ago.' },

  // ---- the last of it. Back down to names, because that is how it started.
  { at: 0.953, addr: 'Prentice & Son', who: null, n: 0,
    line: 'The shop on the corner, four generations of it. The last order was two pints of milk and a paper.' },
  { at: 0.960, addr: 'The Chase, the last bungalows', who: 'Nine households', n: 11,
    line: 'Built for people who had retired here on purpose. The council moved the last four out in a minibus.' },
  { at: 0.966, addr: 'Chapel Row', who: 'Seventeen houses', n: 44,
    line: 'The families with school-age children went in one term, which is how a street empties fastest.' },
  { at: 0.971, addr: '12 Station Road', who: 'The Mbekis', n: 6,
    line: 'They had the furthest to move and the least reason to stay once the last school shut.' },
  { at: 0.975, addr: 'The Green, the cottages', who: 'Seven households', n: 18,
    line: 'Listed, all seven, which meant they could not be altered and could not be sold and are still standing empty.' },
  { at: 0.979, addr: 'Station Road, 1 to 11', who: 'Eleven houses', n: 30,
    line: 'The company offered above the valuation on the whole row, which everyone understood as the last offer.' },
  { at: 0.982, addr: 'Brookside, the last three', who: 'Three households', n: 6,
    line: 'Three houses with lights on in an estate of four hundred. They shared one generator and a rota.' },
  { at: 0.985, addr: '2 Bramley Close', who: 'The Threlfalls', n: 4,
    line: 'Joan Threlfall ran the playgroup out of the church hall. There had been no playgroup for nine years.' },
  { at: 0.988, addr: '1 Weir Road', who: 'The Cadwalladers', n: 3,
    line: 'Gwen had the oldest house on the road and the last working landline in it.' },
  { at: 0.990, addr: 'The Green, the last four', who: 'Four households', n: 9,
    line: 'They shared a generator and a rota for it. It is the closest thing to a city Ashbrook had left.' },
  { at: 0.992, addr: '5 The Green', who: 'Sam Ollerenshaw', n: 1,
    line: 'Councillor for Tanyard. He kept holding surgeries after there was no ward, and then after there was no council.' },
  { at: 0.994, addr: '9 Station Road', who: 'The Baptistes', n: 4,
    line: 'Marie said she would go when the church went. The church had not gone yet, so she stayed another winter.' },
  { at: 0.996, addr: '17 Mill Lane', who: 'The Trescothicks', n: 3,
    line: 'The last house on Mill Lane with a light in it. They left the light on when they went, and it is still on.' },
  { at: 0.998, addr: 'St Chad’s', who: null, n: 0,
    line: 'Deconsecrated on a Thursday morning to nine people. You rent the nave for overflow storage.' },
  { at: 0.999, addr: '1 Chapel Row', who: 'Marie Baptiste', n: 1,
    line: 'She had said she would go when the church went. She waited until the Friday, and then she went.' },
  { at: 1.00, addr: 'Ashbrook', who: null, n: 0,
    line: 'There is a site, and a road that used to lead somewhere, and a sign the county has not got round to taking down.' },
];

/** People in the register, which must equal the population the city started with. */
export const TOWN_POPULATION = REGISTER.reduce((t, r) => t + r.n, 0);

/** Households and places still there at this much damage, and those gone. */
export function standing(damage) {
  return REGISTER.filter((r) => damage < r.at);
}

export function gone(damage) {
  return REGISTER.filter((r) => damage >= r.at);
}

/** The most recent departure, which is what the town panel leads with. */
export function lastToGo(damage) {
  const g = gone(damage);
  return g.length ? g[g.length - 1] : null;
}
