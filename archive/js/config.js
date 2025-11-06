// Configuration for API keys.
// Fill in your API tokens to enable live data fetching. If left empty, the
// application will fall back to static sample data.
const API_CONFIG = {
  // PandaScore API key for accessing match schedules, stats and (if available) odds.
  // You can obtain a free API token by creating an account at https://pandascore.co.
  pandaScoreApiKey: '9dTkhsoOf_Y6Zh2jNRZFOcytBRxzVPaOkQgIjkigjyW4rne4nkA',

  // Stratz API token for Dota statistics. Create a free account at https://stratz.com
  // and obtain your default API token to enable Dota-specific stats (optional).
  stratzApiToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJTdWJqZWN0IjoiNGViMTI2MmYtYjkzNS00ODk4LWE3ZTgtNTA4Zjk3MjUyMWYzIiwiU3RlYW1JZCI6Ijg1MTg1ODQ3IiwiQVBJVXNlciI6ImZhbHNlIiwibmJmIjoxNzU0NzYxOTczLCJleHAiOjE3ODYyOTc5NzMsImlhdCI6MTc1NDc2MTk3MywiaXNzIjoiaHR0cHM6Ly9hcGkuc3RyYXR6LmNvbSJ9.4wWzrJQD7zBLEOPaqBkmbr9KaRuyPdaTKrrZvq6KWRs',

  // Odds API key. If you sign up for a free plan from a provider that offers esports odds,
  // populate this value and update the fetchOddsForMatch function accordingly.
  oddsApiKey: '',
};