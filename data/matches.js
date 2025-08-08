// Sample data for matches and best bets.
// In a full implementation this data would be fetched from an API or database.
// Until real APIs are enabled, this file provides placeholder content for demonstration.

// List of upcoming matches. Each match contains metadata used by the index and match pages.
const matches = [
  {
    id: 1,
    game: 'lol',
    date: '2025-08-08', // ISO date format (YYYY-MM-DD)
    time: '18:00', // 24-hour time (HH:MM)
    team1: 'Team Liquid',
    team2: 'Cloud9',
    event: 'LCS Summer Split Finals',
    slug: 'team-liquid-vs-cloud9-aug-8-2025',
    analysis:
      'Team Liquid has been on a hot streak this season with strong macro play and superior objective control. Cloud9, however, brings explosive laning and a high kill participation rate. The matchup will hinge on jungle pathing and early game skirmishes.',
    stats: {
      recentForm: 'Team Liquid 4-1 | Cloud9 3-2',
      winRates: 'Team Liquid 62% | Cloud9 58%',
      headToHead: 'Liquid leads 3-2 in last 5 meetings',
      keyPlayers:
        'TL: Bjergsen (KDA 5.2), C9: Fudge (KDA 4.8)',
    },
    odds: [
      { book: 'Pinnacle', team1Odds: '+120', team2Odds: '-130', total: '2.5' },
      { book: 'Bet365', team1Odds: '+115', team2Odds: '-125', total: '2.5' },
      { book: 'DraftKings', team1Odds: '+118', team2Odds: '-128', total: '2.5' },
    ],
    bestBook: 'Pinnacle',
    bestOdds: '+120',
  },
  {
    id: 2,
    game: 'dota2',
    date: '2025-08-08',
    time: '20:00',
    team1: 'OG',
    team2: 'PSG.LGD',
    event: 'The International Qualifier',
    slug: 'og-vs-psg-lgd-aug-8-2025',
    analysis:
      'OG’s disciplined teamfight execution faces PSG.LGD’s aggressive farm-centric style. Expect a battle of tempo control. The key matchup will be in the mid lane where both teams rely heavily on their star players.',
    stats: {
      recentForm: 'OG 3-2 | PSG.LGD 4-1',
      winRates: 'OG 55% | PSG.LGD 68%',
      headToHead: 'PSG.LGD leads 4-1 in last 5 meetings',
      keyPlayers: 'OG: BZM (GPM 540), LGD: NothingToSay (GPM 600)',
    },
    odds: [
      { book: 'Pinnacle', team1Odds: '+150', team2Odds: '-170', total: '2.5' },
      { book: 'Bet365', team1Odds: '+155', team2Odds: '-175', total: '2.5' },
      { book: '888sport', team1Odds: '+148', team2Odds: '-165', total: '2.5' },
    ],
    bestBook: 'Bet365',
    bestOdds: '+155',
  },
  {
    id: 3,
    game: 'lol',
    date: '2025-08-09',
    time: '16:00',
    team1: 'G2 Esports',
    team2: 'Fnatic',
    event: 'LEC Playoffs Round 1',
    slug: 'g2-esports-vs-fnatic-aug-9-2025',
    analysis:
      'A classic European rivalry. G2’s macro decision-making and diverse champion pool meet Fnatic’s mechanical prowess. Watch for the top-lane matchup as Wunder faces off against BrokenBlade.',
    stats: {
      recentForm: 'G2 5-0 | Fnatic 2-3',
      winRates: 'G2 70% | Fnatic 50%',
      headToHead: 'G2 leads 4-1 in last 5 meetings',
      keyPlayers: 'G2: Caps (KDA 6.1), FNC: Humanoid (KDA 4.0)',
    },
    odds: [
      { book: 'Pinnacle', team1Odds: '-140', team2Odds: '+125', total: '2.5' },
      { book: 'Bet365', team1Odds: '-150', team2Odds: '+130', total: '2.5' },
      { book: 'DraftKings', team1Odds: '-145', team2Odds: '+128', total: '2.5' },
    ],
    bestBook: 'Pinnacle',
    bestOdds: '-140',
  },
  {
    id: 4,
    game: 'dota2',
    date: '2025-08-09',
    time: '14:00',
    team1: 'Team Secret',
    team2: 'Evil Geniuses',
    event: 'Regional Finals',
    slug: 'team-secret-vs-evil-geniuses-aug-9-2025',
    analysis:
      'Team Secret’s late game-focused drafts will be tested by EG’s aggressive early game pushes. Expect mind games at the draft stage and heavy emphasis on vision control.',
    stats: {
      recentForm: 'Secret 4-1 | EG 3-2',
      winRates: 'Secret 60% | EG 56%',
      headToHead: 'Secret leads 3-2 in last 5 meetings',
      keyPlayers: 'Secret: Puppey (Assist 10.2), EG: Arteezy (GPM 580)',
    },
    odds: [
      { book: 'Pinnacle', team1Odds: '-110', team2Odds: '+100', total: '2.5' },
      { book: 'Bet365', team1Odds: '-105', team2Odds: '+102', total: '2.5' },
      { book: 'GG.Bet', team1Odds: '-108', team2Odds: '+105', total: '2.5' },
    ],
    bestBook: 'Bet365',
    bestOdds: '-105',
  },
];

// Sample best bets. Each entry features a title and a brief description.
const bestBets = [
  {
    title: 'Team Liquid ML (+120)',
    description: 'Team Liquid’s objective-focused playstyle counters Cloud9’s skirmish reliance. Value on the moneyline at plus odds.',
  },
  {
    title: 'PSG.LGD -1.5 (+160)',
    description: 'LGD’s superior drafting and late-game scaling make them likely to take the series 2-0. Generous line at +160.',
  },
  {
    title: 'G2 vs Fnatic Over 2.5 Maps (-105)',
    description: 'Rivalry matches tend to go the distance. Fnatic can take at least one game off G2’s fast tempo.',
  },
];

// Expose matches and bestBets to the global scope so that other scripts can
// assign and access them via window. Using window properties ensures that
// asynchronous API calls can override these values later.
window.matches = matches;
window.bestBets = bestBets;