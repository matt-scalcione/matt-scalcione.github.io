/*
 * API wrapper functions for retrieving live esports data.
 *
 * This file defines asynchronous helper functions that call external
 * services to fetch match schedules, statistics and betting odds. These
 * functions gracefully handle missing API keys or network failures by
 * returning empty results. When implementing additional integrations,
 * update these functions or add new ones as necessary.
 */

/**
 * Fetch upcoming matches for a given game from the PandaScore API.
 *
 * @param {string} game A short code identifying the game: 'lol' or 'dota2'
 * @param {number} limit Maximum number of matches to retrieve (default 10)
 * @returns {Promise<Array>} A promise that resolves to an array of match objects
 */
async function fetchPandaScoreMatches(game, limit = 10) {
  const apiKey = (API_CONFIG && API_CONFIG.pandaScoreApiKey) || '';
  if (!apiKey) {
    // No API key configured; return empty result to force fallback
    return [];
  }
  const gameSlug = game === 'lol' ? 'league-of-legends' : 'dota-2';
  const url = new URL('https://api.pandascore.co/matches/upcoming');
  url.searchParams.set('token', apiKey);
  url.searchParams.set('per_page', limit);
  // Filter by game slug; the Pandascore API supports filter by videogame slug
  url.searchParams.set('filter[videogame_slug]', gameSlug);
  try {
    const response = await fetch(url.toString());
    if (!response.ok) {
      console.error('Failed to fetch matches from PandaScore', response.status);
      return [];
    }
    const data = await response.json();
    if (!Array.isArray(data)) {
      return [];
    }
    return data.map(item => {
      // Extract teams
      const opponents = item.opponents || [];
      const team1 = opponents[0] && opponents[0].opponent ? opponents[0].opponent.name : 'TBD';
      const team2 = opponents[1] && opponents[1].opponent ? opponents[1].opponent.name : 'TBD';
      const beginAt = item.begin_at ? new Date(item.begin_at) : null;
      const date = beginAt ? beginAt.toISOString().substring(0, 10) : '';
      const time = beginAt ? beginAt.toISOString().substring(11, 16) : '';
      const event = item.league ? `${item.league.name} ${item.serie ? item.serie.full_name : ''}`.trim() : '';
      return {
        id: item.id,
        game,
        date,
        time,
        team1,
        team2,
        event,
        slug: `${team1.toLowerCase().replace(/\s+/g, '-')}-vs-${team2.toLowerCase().replace(/\s+/g, '-')}-${date}`,
        // Additional fields may be included later
      };
    });
  } catch (err) {
    console.error('Error fetching matches from PandaScore', err);
    return [];
  }
}

/**
 * Fetch detailed statistics for a match via the PandaScore API.
 *
 * Note: Pandascore does not provide in-depth analysis; this function returns
 * basic information such as teams, scores and participants. It should be
 * extended with other data sources (e.g., Stratz for Dota or internal
 * analysis) to deliver richer insights.
 *
 * @param {number|string} matchId The match ID from PandaScore
 * @returns {Promise<Object|null>} Match details or null on failure
 */
async function fetchPandaScoreMatchDetails(matchId) {
  const apiKey = (API_CONFIG && API_CONFIG.pandaScoreApiKey) || '';
  if (!apiKey) {
    return null;
  }
  const url = `https://api.pandascore.co/matches/${matchId}?token=${apiKey}`;
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error('Failed to fetch match details from PandaScore', response.status);
      return null;
    }
    const data = await response.json();
    return data;
  } catch (err) {
    console.error('Error fetching match details from PandaScore', err);
    return null;
  }
}

/**
 * Fetch betting odds for a match.
 *
 * As free esports odds feeds are rare, this function is currently a stub.
 * If you sign up for an odds provider with a free tier that includes esports
 * (e.g., PandaScore odds endpoints or another aggregator), update this
 * function to call the appropriate API and return a standardised odds
 * structure similar to the sample data: [{book, team1Odds, team2Odds, total}].
 *
 * @param {Object} match A match object with at least an id and game fields
 * @returns {Promise<Array>} Array of odds objects
 */
async function fetchOddsForMatch(match) {
  // Example: integrate with Pandascore odds endpoint (requires paid plan)
  // const apiKey = API_CONFIG.pandaScoreApiKey;
  // const url = `https://api.pandascore.co/odds/matches/${match.id}?token=${apiKey}`;
  // Fetch and parse odds here

  // Currently return empty array to signal no live odds available
  return [];
}

/**
 * Fetch team or player statistics for a match.
 *
 * This is a placeholder to integrate a game-specific stats provider (e.g., Stratz
 * for Dota or custom analytics for LoL). The function should return an
 * object with properties similar to the sample structure used in matches.js:
 * { recentForm, winRates, headToHead, keyPlayers }
 *
 * @param {Object} match A match object
 * @returns {Promise<Object|null>} Stats object or null on failure
 */
async function fetchStatsForMatch(match) {
  const game = match.game;
  if (game === 'dota2' && API_CONFIG.stratzApiToken) {
    // Example: fetch Dota statistics from Stratz API
    // Note: The Stratz GraphQL API requires a bearer token in the header
    // const query = `query GetMatch($id: Long!) { match(id: $id) { id } }`;
    // const response = await fetch('https://api.stratz.com/graphql', {
    //   method: 'POST',
    //   headers: {
    //     'Content-Type': 'application/json',
    //     'Authorization': `Bearer ${API_CONFIG.stratzApiToken}`,
    //   },
    //   body: JSON.stringify({ query, variables: { id: match.id } }),
    // });
    // const result = await response.json();
    // Parse result and return stats
    return null;
  }
  // For other games or missing token, return null to indicate no live stats
  return null;
}

// Export functions to global scope so they can be used in page scripts
window.fetchPandaScoreMatches = fetchPandaScoreMatches;
window.fetchPandaScoreMatchDetails = fetchPandaScoreMatchDetails;
window.fetchOddsForMatch = fetchOddsForMatch;
window.fetchStatsForMatch = fetchStatsForMatch;