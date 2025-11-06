// Utility functions and event handlers for the eSports Betting Tips site

document.addEventListener('DOMContentLoaded', () => {
  // Populate current year in footer
  const yearElement = document.getElementById('yearPlaceholder');
  if (yearElement) {
    yearElement.textContent = new Date().getFullYear();
  }

  // Toggle mobile menu visibility
  const mobileMenuBtn = document.getElementById('mobileMenuButton');
  const mobileMenu = document.getElementById('mobileMenu');
  if (mobileMenuBtn && mobileMenu) {
    mobileMenuBtn.addEventListener('click', () => {
      mobileMenu.classList.toggle('hidden');
    });
  }

  // Only run match listing code if container exists
  const matchesContainer = document.getElementById('matchesContainer');
  if (matchesContainer) {
    // Attempt to load live matches from external API. If none are returned,
    // fallback to the locally defined `matches` array from data/matches.js.
    async function loadMatches() {
      let liveMatches = [];
      try {
        // Fetch both LoL and Dota matches in parallel
        const [lolMatches, dotaMatches] = await Promise.all([
          window.fetchPandaScoreMatches ? fetchPandaScoreMatches('lol', 10) : Promise.resolve([]),
          window.fetchPandaScoreMatches ? fetchPandaScoreMatches('dota2', 10) : Promise.resolve([]),
        ]);
        liveMatches = [...lolMatches, ...dotaMatches];
      } catch (err) {
        console.error('Error loading live matches', err);
      }
      // If live data exists, override the global matches array. Otherwise, use existing sample data.
      if (Array.isArray(liveMatches) && liveMatches.length > 0) {
        window.matches = liveMatches;
      }
      // Initial render
      renderMatches(window.matches);
    }
    // Render matches with optional filtering
    function renderMatches(list) {
      matchesContainer.innerHTML = '';
      if (!list || list.length === 0) {
        matchesContainer.innerHTML = '<p class="col-span-full text-center text-gray-600">No matches found for the selected filters.</p>';
        return;
      }
      list.forEach(match => {
        const card = document.createElement('div');
        card.className = 'bg-white shadow rounded-lg overflow-hidden flex flex-col';
        // Compute human-readable date/time
        let dateStr = '';
        if (match.date && match.time) {
          const dt = new Date(match.date + 'T' + match.time);
          dateStr = dt.toLocaleString(undefined, {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          });
        }
        // Prepare best odds display if present
        let oddsHtml = '';
        if (match.bestOdds && match.bestBook) {
          oddsHtml = `<p class="text-sm text-gray-600 mb-1">Best Odds:</p><p class="font-medium"><span class="text-accent">${match.bestOdds}</span> at ${match.bestBook}</p>`;
        }
        card.innerHTML = `
          <div class="p-4 flex-1 flex flex-col justify-between">
            <div>
              <p class="text-sm text-gray-500 mb-1">${match.game === 'lol' ? 'League of Legends' : 'Dota 2'}${dateStr ? ' • ' + dateStr : ''}</p>
              <h3 class="text-xl font-semibold mb-2">${match.team1} vs ${match.team2}</h3>
              <p class="text-sm text-gray-600 mb-4">${match.event || ''}</p>
            </div>
            <div class="mt-auto">
              ${oddsHtml}
            </div>
          </div>
          <div class="bg-gray-100 p-3 text-right">
            <a href="match.html?id=${match.id}" class="text-accent font-medium hover:underline">Read More →</a>
          </div>
        `;
        matchesContainer.appendChild(card);
      });
    }
    // Apply filters to the current matches list
    function applyFilters() {
      const gameFilter = document.getElementById('gameFilter');
      const dateFilter = document.getElementById('dateFilter');
      const selectedGame = gameFilter ? gameFilter.value : 'all';
      const selectedDate = dateFilter ? dateFilter.value : '';
      let filtered = window.matches;
      if (selectedGame !== 'all') {
        filtered = filtered.filter(m => m.game === selectedGame);
      }
      if (selectedDate) {
        filtered = filtered.filter(m => m.date === selectedDate);
      }
      renderMatches(filtered);
    }
    // Set up event listeners for filters
    const gameFilterEl = document.getElementById('gameFilter');
    const dateFilterEl = document.getElementById('dateFilter');
    if (gameFilterEl) {
      gameFilterEl.addEventListener('change', applyFilters);
    }
    if (dateFilterEl) {
      dateFilterEl.addEventListener('change', applyFilters);
    }
    // Kick off data load
    loadMatches();
  }

  // Populate best bets section if available
  const bestBetsContainer = document.getElementById('bestBetsContainer');
  if (bestBetsContainer && typeof bestBets !== 'undefined') {
    bestBets.forEach(bet => {
      const div = document.createElement('div');
      div.className = 'p-4 bg-white border border-gray-200 rounded-lg shadow';
      div.innerHTML = `
        <h4 class="font-semibold text-lg mb-1">${bet.title}</h4>
        <p class="text-sm text-gray-600">${bet.description}</p>
      `;
      bestBetsContainer.appendChild(div);
    });
  }
});