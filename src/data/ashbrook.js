/**
 * The Ashbrook register.
 *
 * The town used to be one number falling from 940 to nothing. This is the same
 * number with names on it: every household and every landmark, in the order
 * they go, each with the one line that says how.
 *
 * It adds no mechanics. Nothing here is bought, managed or clicked; the only
 * input is the damage figure the simulation already produces. What it changes
 * is what that figure means — you do not watch a bar fill, you watch the
 * Hallorans leave.
 *
 *   at    the damage at which they are gone
 *   addr  where, as anyone in the town would say it
 *   who   the household, or nothing for a place
 *   n     how many people (0 for places, which hold no one)
 *   line  what happened
 *
 * The people add up to 940 exactly, which is checked at load rather than
 * trusted: a register that disagrees with the population counter would be
 * worse than no register.
 */

export const REGISTER = [
  { at: 0.03, addr: '7 Weir Road', who: 'The Ferns', n: 2,
    line: 'Ken Fern worked nights and slept days. He put the house up in March and took the first offer on it.' },
  { at: 0.05, addr: '3 Mill Lane', who: 'Mrs Dacre', n: 1,
    line: 'Ninety-one, and she said the hum was the only thing she could still hear clearly. Her niece moved her to Belper.' },
  { at: 0.06, addr: 'Brookside, the top of the estate', who: 'Nineteen households', n: 48,
    line: 'The estate was built in 1968 for the view down the valley. The view is now a substation and a fence.' },
  { at: 0.07, addr: 'Weir Road, the even numbers', who: 'Fourteen houses', n: 38,
    line: 'They backed onto the new fence. One landlord bought all six in a fortnight and boarded them the same month.' },
  { at: 0.09, addr: '22 Mill Lane', who: 'The Okonjos', n: 4,
    line: 'Eleven years here. Adaeze said it was the noise. Tunde said it was the noise and everything after it.' },
  { at: 0.11, addr: '5 Bramley Close', who: 'The Pethericks', n: 3,
    line: 'They had double glazing put in, then thicker glazing, then a survey, and then they went.' },
  { at: 0.12, addr: 'Kiln Row', who: 'Eleven houses', n: 27,
    line: 'Closest to the access road. Forty lorries a day at first, and then nobody counted any more.' },
  { at: 0.13, addr: 'The Green, north side', who: 'Sixteen households', n: 43,
    line: 'The nearest houses to the intake. They went one after another over a summer, in the order you would guess.' },
  { at: 0.15, addr: '18 Station Road', who: 'The Bewleys', n: 5,
    line: 'Three generations under one roof. The youngest two left first, and after that there was no reason for the rest.' },
  { at: 0.16, addr: 'Orchard Rise', who: 'Fourteen households', n: 39,
    line: 'The newest houses in Ashbrook, finished in 2019. The last of them was lived in for four years.' },
  { at: 0.17, addr: '11 Chapel Row', who: 'Ivy Marchant', n: 1,
    line: 'She had lived on Chapel Row since she was born on it. Her son drove down and packed the house in a day.' },
  { at: 0.19, addr: 'Weir Road, the odd numbers', who: 'Fifteen houses', n: 41,
    line: 'The valuations came back and the whole side of the street understood the same thing at the same time.' },
  { at: 0.21, addr: 'Fold Lane, the top end', who: 'Twelve houses', n: 31,
    line: 'The bore holes went in that spring. By the autumn the lane had a rota for who would ring the council.' },
  { at: 0.22, addr: '9 Bramley Close', who: 'The Achtermanns', n: 4,
    line: 'They were the ones who organised the petition. Eleven hundred signatures. It is in a drawer somewhere.' },
  { at: 0.24, addr: 'The allotments', who: null, n: 0,
    line: 'Thirty-one plots behind Mill Lane. The water restrictions did for them; your cooling towers were exempt.' },
  { at: 0.26, addr: '2 The Green', who: 'The Sowdens', n: 2,
    line: 'Barry Sowden kept the gardens judging for nineteen years. There was nothing to judge by August.' },
  { at: 0.27, addr: 'Brookside, the middle', who: 'Twenty households', n: 52,
    line: 'Two hundred metres of identical houses, emptied at the rate of about one a month for two years.' },
  { at: 0.28, addr: 'Mill Lane, 24 to 38', who: 'Fifteen houses', n: 40,
    line: 'A terrace built for the mill that closed in 1974. It outlasted the mill by fifty years and you by none.' },
  { at: 0.30, addr: '4 Chapel Row', who: 'The Idowus', n: 5,
    line: 'Folasade had just got the extension approved. The council wrote again to say the approval was withdrawn.' },
  { at: 0.32, addr: 'The Green, south side', who: 'Eighteen households', n: 49,
    line: 'They held out longest on the green because of the view. The view is a substation bay.' },
  { at: 0.33, addr: 'Fold Lane, the bottom end', who: 'Nine houses', n: 22,
    line: 'They were told the noise would stop when the second phase finished. The second phase finished.' },
  { at: 0.34, addr: '30 Station Road', who: 'The Kirkbrides', n: 4,
    line: 'Both of them worked at the site by then. They still could not stand living next to it.' },
  { at: 0.36, addr: '1 Bramley Close', who: 'The Haggartys', n: 6,
    line: 'Four children, one dog, and a decision they put off for two years and then made in a weekend.' },
  { at: 0.39, addr: 'Ashbrook Cricket Club', who: null, n: 0,
    line: 'Founded 1888. The square is hardstanding for your contractors. The club folded in the spring.' },
  { at: 0.41, addr: '14 Mill Lane', who: 'The Hallorans', n: 4,
    line: 'They stayed for the club, and when the club went they left for Derby. The dog stayed two days longer.' },
  { at: 0.42, addr: 'The caravan site', who: 'Twenty-two pitches', n: 34,
    line: 'Seasonal, then not seasonal, then not there. The hardstanding is still marked out in white paint.' },
  { at: 0.43, addr: 'Chapel Row, 12 to 20', who: 'Nine houses', n: 24,
    line: 'Sold as one lot to a company registered in Jersey. Nobody has ever come to look at them.' },
  { at: 0.45, addr: '8 The Green', who: 'Dr Whitfeld', n: 2,
    line: 'She had the surgery list for thirty years. She wrote to every patient and told them where to register instead.' },
  { at: 0.47, addr: 'Station Road, the flats', who: 'Twenty households', n: 46,
    line: 'The flats over the parade. The parade went first; the flats followed the way flats do.' },
  { at: 0.48, addr: 'Brookside, the low end', who: 'Seventeen households', n: 43,
    line: 'The end of the estate nearest the water. They went when the water did, which was quick.' },
  { at: 0.50, addr: 'The weir', who: null, n: 0,
    line: 'Down to a trickle by June. The fish went first, then the herons, then the people who came for the herons.' },
  { at: 0.52, addr: 'The Anglers Arms', who: null, n: 0,
    line: 'Last orders on a Tuesday. Trevor said the trade went with the river, and he was not wrong about much.' },
  { at: 0.54, addr: '6 Weir Road', who: 'The Prossers', n: 3,
    line: 'Angling club secretary, forty years. He kept the minutes going for two meetings after there was a river.' },
  { at: 0.55, addr: 'Kiln Row, the rest', who: 'Eight houses', n: 19,
    line: 'A row of eight with one shared drive. The last two families kept it swept between them for a while.' },
  { at: 0.56, addr: 'Mill Lane, 1 to 21', who: 'Twenty-one houses', n: 45,
    line: 'The long side of Mill Lane, empty in eight months. The street lights were left on for another year.' },
  { at: 0.58, addr: '16 Bramley Close', who: 'The Nkemelus', n: 5,
    line: 'Chidi had been the one telling everyone it would settle down. He was the last on the close to say so.' },
  { at: 0.60, addr: 'Ashbrook Post Office', who: null, n: 0,
    line: 'The counter did pensions, parcels and gossip. Two of the three had already stopped.' },
  { at: 0.62, addr: 'Orchard Rise, the rest', who: 'Eleven households', n: 29,
    line: 'Bought new, sold at a loss, all eleven within a year of each other.' },
  { at: 0.63, addr: 'Ashbrook Primary', who: null, n: 0,
    line: 'Forty-one on the roll in September, nineteen by June. It closed at the end of the summer term.' },
  { at: 0.65, addr: 'Chapel Row, 1 to 9', who: 'Nine houses', n: 25,
    line: 'The families with school-age children went in one term, which is how a street empties fastest.' },
  { at: 0.67, addr: '12 Station Road', who: 'The Mbekis', n: 6,
    line: 'They had the furthest to move and the least reason to stay once the school shut.' },
  { at: 0.69, addr: 'The Green, the cottages', who: 'Seven households', n: 18,
    line: 'Listed, all seven, which meant they could not be altered and could not be sold and are still standing empty.' },
  { at: 0.70, addr: 'Brookside, what was left', who: 'Thirteen households', n: 31,
    line: 'The estate had four hundred people in it once. This was the last of them, and they knew it.' },
  { at: 0.71, addr: '2 Bramley Close', who: 'The Threlfalls', n: 4,
    line: 'Joan Threlfall ran the playgroup out of the church hall. There had been no playgroup for a year.' },
  { at: 0.73, addr: 'Station Road, 1 to 11', who: 'Eleven houses', n: 30,
    line: 'The company offered above the valuation on the whole row, which everyone understood as the last offer.' },
  { at: 0.76, addr: 'Prentice & Son', who: null, n: 0,
    line: 'The shop on the corner, four generations of it. The last order was two pints of milk and a paper.' },
  { at: 0.77, addr: 'Fold Lane, the last of it', who: 'Seven houses', n: 16,
    line: 'No shop, no bus, no school. Fold Lane worked out what that added up to before most streets did.' },
  { at: 0.78, addr: 'The 42 bus', who: null, n: 0,
    line: 'Cut the same week the shop shut. Without it you could not get out, and without the shop you had to.' },
  { at: 0.80, addr: '20 Mill Lane', who: 'The Sarpongs', n: 4,
    line: 'They had no car. When the 42 went they had a fortnight to work out what that meant, and then they went.' },
  { at: 0.82, addr: 'Bramley Close, the rest', who: 'Nine households', n: 26,
    line: 'A close of twelve built in 1998 for people who wanted somewhere quiet. It was, for twenty-six years.' },
  { at: 0.84, addr: '1 Weir Road', who: 'The Cadwalladers', n: 3,
    line: 'Gwen had the oldest house on the road and the last working landline in it.' },
  { at: 0.85, addr: 'The Chase bungalows', who: 'Nine households', n: 11,
    line: 'Built for people who had retired here on purpose. The council moved the last four out in a minibus.' },
  { at: 0.86, addr: 'Chapel Row, the rest', who: 'Eight houses', n: 21,
    line: 'By then leaving was not a decision anyone announced. You noticed a car gone and that was it.' },
  { at: 0.89, addr: '5 The Green', who: 'Sam Ollerenshaw', n: 1,
    line: 'Parish councillor. He kept holding meetings after there was no quorum, and then after there was no council.' },
  { at: 0.91, addr: '9 Station Road', who: 'The Baptistes', n: 4,
    line: 'Marie said she would go when the church went. The church had not gone yet, so she stayed another winter.' },
  { at: 0.92, addr: 'Brookside, the last three', who: 'Three households', n: 6,
    line: 'Three houses with lights on in an estate of a hundred and forty. They shared one generator and a rota.' },
  { at: 0.93, addr: 'The Green, the last four', who: 'Four households', n: 9,
    line: 'They shared a generator and a rota for it. It is the closest thing to a village Ashbrook had left.' },
  { at: 0.95, addr: '17 Mill Lane', who: 'The Trescothicks', n: 3,
    line: 'The last house on Mill Lane with a light in it. They left the light on when they went, and it is still on.' },
  { at: 0.97, addr: 'St Chad’s', who: null, n: 0,
    line: 'Deconsecrated on a Thursday morning to nine people. You rent the nave for overflow storage.' },
  { at: 0.99, addr: '1 Chapel Row', who: 'Marie Baptiste', n: 1,
    line: 'She had said she would go when the church went. She waited until the Friday, and then she went.' },
  { at: 1.00, addr: 'Ashbrook', who: null, n: 0,
    line: 'There is a site, and a road that used to lead somewhere, and a sign the county has not got round to taking down.' },
];

/** People in the register, which must equal the population the town started with. */
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
