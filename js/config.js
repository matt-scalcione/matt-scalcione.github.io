// Configuration for API keys.
// Fill in your API tokens to enable live data fetching. If left empty, the
// application will fall back to static sample data.
const API_CONFIG = {
  // PandaScore API key for accessing match schedules, stats and (if available) odds.
  // You can obtain a free API token by creating an account at https://pandascore.co.
  pandaScoreApiKey: '',

  // Stratz API token for Dota statistics. Create a free account at https://stratz.com
  // and obtain your default API token to enable Dota-specific stats (optional).
  stratzApiToken: '',

  // Odds API key. If you sign up for a free plan from a provider that offers esports odds,
  // populate this value and update the fetchOddsForMatch function accordingly.
  oddsApiKey: '',
};