(function () {
  const bootFlag = "data-signal-local-booted";

  if (document.documentElement.getAttribute(bootFlag) === "true") {
    return;
  }

  const looksLikeStaleShell =
    document.body?.classList.contains("signal-body") ||
    String(document.title || "").toLowerCase().includes("midnight signal");

  if (!looksLikeStaleShell) {
    return;
  }

  document.documentElement.setAttribute(bootFlag, "true");

  const styleText = `
    :root {
      --signal-bg: #eef1f5;
      --signal-paper: rgba(255, 255, 255, 0.94);
      --signal-ink: #142034;
      --signal-muted: #5f6978;
      --signal-line: rgba(20, 32, 52, 0.12);
      --signal-brand: #8a1217;
      --signal-brand-deep: #621015;
      --signal-alert: #ffce62;
      --signal-shadow: 0 24px 60px rgba(24, 39, 70, 0.14);
    }

    html {
      scroll-behavior: smooth;
    }

    body.signal-local-body {
      margin: 0;
      color: var(--signal-ink);
      font-family: "IBM Plex Sans", "Segoe UI", sans-serif;
      background:
        radial-gradient(circle at top left, rgba(138, 18, 23, 0.12), transparent 28%),
        radial-gradient(circle at top right, rgba(11, 28, 58, 0.1), transparent 32%),
        linear-gradient(180deg, #f8fafc 0%, #edf1f6 100%);
    }

    .signal-local-body * {
      box-sizing: border-box;
    }

    .signal-workshop-banner {
      position: sticky;
      top: 0;
      z-index: 40;
      padding: 0.9rem 1.25rem;
      text-align: center;
      font-size: 0.98rem;
      line-height: 1.45;
      font-weight: 800;
      letter-spacing: 0.01em;
      color: #352100;
      background: linear-gradient(90deg, #ffd978 0%, var(--signal-alert) 55%, #ffba45 100%);
      border-bottom: 1px solid rgba(53, 33, 0, 0.18);
    }

    .signal-local-shell {
      width: min(1240px, calc(100vw - 32px));
      margin: 0 auto;
      padding: 18px 0 48px;
    }

    .signal-local-masthead {
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      gap: 24px;
      padding: 10px 0 18px;
    }

    .signal-brand-lockup {
      display: flex;
      align-items: center;
      gap: 14px;
    }

    .signal-brand-badge {
      display: grid;
      place-items: center;
      width: 64px;
      height: 64px;
      border-radius: 18px;
      background: linear-gradient(160deg, var(--signal-brand) 0%, #c82f35 100%);
      box-shadow: 0 16px 34px rgba(138, 18, 23, 0.28);
      color: #fff;
      font-size: 1.55rem;
      font-weight: 800;
    }

    .signal-brand-copy {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .signal-brand-copy strong,
    .signal-section-title,
    .signal-hero h1,
    .signal-panel-title {
      font-family: "Newsreader", Georgia, serif;
    }

    .signal-brand-copy strong {
      font-size: clamp(2rem, 2.5vw, 2.8rem);
      line-height: 1;
      letter-spacing: -0.03em;
    }

    .signal-brand-copy span {
      color: var(--signal-muted);
      font-size: 0.98rem;
      text-transform: uppercase;
      letter-spacing: 0.16em;
    }

    .signal-masthead-meta {
      display: grid;
      justify-items: end;
      gap: 6px;
      color: var(--signal-muted);
      font-size: 0.98rem;
    }

    .signal-status-row {
      display: inline-flex;
      align-items: center;
      gap: 10px;
    }

    .signal-live-pill {
      display: inline-flex;
      align-items: center;
      gap: 9px;
      padding: 0.45rem 0.8rem;
      border-radius: 999px;
      background: rgba(138, 18, 23, 0.1);
      color: var(--signal-brand);
      font-size: 0.86rem;
      font-weight: 800;
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }

    .signal-live-pill::before {
      content: "";
      width: 10px;
      height: 10px;
      border-radius: 999px;
      background: currentColor;
      box-shadow: 0 0 0 0 rgba(138, 18, 23, 0.32);
      animation: signal-pulse 1.7s infinite;
    }

    @keyframes signal-pulse {
      0% { box-shadow: 0 0 0 0 rgba(138, 18, 23, 0.34); }
      70% { box-shadow: 0 0 0 14px rgba(138, 18, 23, 0); }
      100% { box-shadow: 0 0 0 0 rgba(138, 18, 23, 0); }
    }

    .signal-ticker {
      overflow: hidden;
      border-radius: 18px;
      background: linear-gradient(90deg, var(--signal-brand-deep) 0%, var(--signal-brand) 100%);
      box-shadow: var(--signal-shadow);
      color: #fff;
    }

    .signal-ticker-track {
      display: flex;
      gap: 36px;
      min-width: max-content;
      padding: 13px 22px;
      font-size: 0.98rem;
      font-weight: 700;
      letter-spacing: 0.02em;
      animation: signal-ticker 28s linear infinite;
    }

    @keyframes signal-ticker {
      from { transform: translateX(0); }
      to { transform: translateX(-35%); }
    }

    .signal-layout {
      display: grid;
      grid-template-columns: repeat(12, minmax(0, 1fr));
      gap: 22px;
      margin-top: 22px;
    }

    .signal-card {
      border: 1px solid var(--signal-line);
      border-radius: 26px;
      background: var(--signal-paper);
      box-shadow: var(--signal-shadow);
      backdrop-filter: blur(16px);
    }

    .signal-hero {
      grid-column: span 8;
      padding: 28px;
    }

    .signal-hero-meta {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 18px;
      margin-bottom: 18px;
      color: var(--signal-muted);
      font-size: 0.98rem;
    }

    .signal-hero h1 {
      margin: 0;
      font-size: clamp(2.6rem, 4.3vw, 4.4rem);
      line-height: 0.96;
      letter-spacing: -0.045em;
    }

    .signal-dek {
      margin: 18px 0 0;
      font-size: 1.24rem;
      line-height: 1.5;
      color: #2d3a4a;
    }

    .signal-summary-grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 14px;
      margin-top: 24px;
    }

    .signal-summary-item {
      padding: 16px;
      border-radius: 20px;
      border: 1px solid rgba(138, 18, 23, 0.12);
      background:
        linear-gradient(180deg, rgba(138, 18, 23, 0.05), rgba(138, 18, 23, 0)),
        #fff;
    }

    .signal-summary-item span,
    .signal-kicker {
      display: block;
      color: var(--signal-muted);
      font-size: 0.82rem;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.14em;
    }

    .signal-summary-item strong {
      display: block;
      margin-top: 8px;
      font-size: 1.06rem;
      line-height: 1.35;
    }

    .signal-panel {
      grid-column: span 4;
      padding: 24px;
      color: #fff;
      border: 1px solid rgba(91, 185, 255, 0.18);
      background:
        radial-gradient(circle at top, rgba(91, 185, 255, 0.32), transparent 34%),
        linear-gradient(180deg, #08111d 0%, #0d1827 100%);
    }

    .signal-panel-label {
      color: rgba(207, 224, 246, 0.84);
      font-size: 0.82rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.16em;
    }

    .signal-panel-title {
      margin: 10px 0 16px;
      font-size: 2rem;
      line-height: 1;
    }

    .signal-radar {
      position: relative;
      display: grid;
      place-items: center;
      aspect-ratio: 1 / 1;
      margin: 20px 0;
      overflow: hidden;
      border: 1px solid rgba(125, 226, 255, 0.18);
      border-radius: 28px;
      background:
        radial-gradient(circle, rgba(91, 185, 255, 0.24) 0%, transparent 34%),
        radial-gradient(circle, transparent 38%, rgba(138, 255, 245, 0.08) 39%, transparent 40%),
        radial-gradient(circle, transparent 57%, rgba(138, 255, 245, 0.08) 58%, transparent 59%),
        linear-gradient(180deg, rgba(7, 16, 26, 0.88), rgba(6, 12, 19, 0.98));
    }

    .signal-radar::before,
    .signal-radar::after {
      content: "";
      position: absolute;
      inset: 0;
    }

    .signal-radar::before {
      background:
        linear-gradient(90deg, transparent 49.5%, rgba(130, 227, 255, 0.12) 50%, transparent 50.5%),
        linear-gradient(0deg, transparent 49.5%, rgba(130, 227, 255, 0.12) 50%, transparent 50.5%);
    }

    .signal-radar::after {
      background: conic-gradient(
        from 25deg,
        rgba(111, 255, 241, 0.54) 0deg,
        rgba(111, 255, 241, 0) 54deg,
        rgba(111, 255, 241, 0) 360deg
      );
      animation: signal-sweep 5.4s linear infinite;
    }

    @keyframes signal-sweep {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }

    .signal-contact-point {
      position: absolute;
      width: 18px;
      height: 18px;
      border-radius: 999px;
      background: #9af6ff;
      box-shadow: 0 0 0 8px rgba(154, 246, 255, 0.12), 0 0 22px rgba(154, 246, 255, 0.88);
      animation: signal-target 2.2s ease-in-out infinite;
    }

    @keyframes signal-target {
      0%, 100% { transform: scale(0.92); }
      50% { transform: scale(1.16); }
    }

    .signal-panel-facts,
    .signal-detail-list,
    .signal-advisory-list,
    .signal-timeline {
      display: grid;
      gap: 12px;
    }

    .signal-panel-fact,
    .signal-detail-list li,
    .signal-advisory-list li,
    .signal-impact-item,
    .signal-timeline-copy {
      border-radius: 18px;
    }

    .signal-panel-fact {
      padding: 14px 16px;
      border: 1px solid rgba(165, 214, 255, 0.14);
      background: rgba(255, 255, 255, 0.05);
    }

    .signal-panel-fact span {
      display: block;
      color: rgba(207, 224, 246, 0.7);
      font-size: 0.78rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.13em;
    }

    .signal-panel-fact strong {
      display: block;
      margin-top: 6px;
      font-size: 1rem;
      line-height: 1.35;
    }

    .signal-article {
      grid-column: span 7;
      padding: 28px;
    }

    .signal-section-title {
      margin: 10px 0 0;
      font-size: 2.25rem;
      line-height: 1.04;
      letter-spacing: -0.035em;
    }

    .signal-article p {
      margin: 16px 0 0;
      font-size: 1.08rem;
      line-height: 1.72;
    }

    .signal-list-card {
      grid-column: span 5;
      padding: 26px;
    }

    .signal-detail-list,
    .signal-advisory-list {
      margin: 18px 0 0;
      padding: 0;
      list-style: none;
    }

    .signal-detail-list li,
    .signal-advisory-list li {
      position: relative;
      padding: 16px 18px 16px 20px;
      border: 1px solid var(--signal-line);
      background: linear-gradient(180deg, rgba(20, 32, 52, 0.03), rgba(20, 32, 52, 0));
      line-height: 1.55;
    }

    .signal-detail-list li::before,
    .signal-advisory-list li::before {
      content: "";
      position: absolute;
      left: 0;
      top: 15px;
      bottom: 15px;
      width: 5px;
      border-radius: 999px;
      background: linear-gradient(180deg, var(--signal-brand), #ef6f63);
    }

    .signal-timeline-card,
    .signal-impact-card {
      grid-column: span 6;
      padding: 26px;
    }

    .signal-timeline {
      margin-top: 18px;
      gap: 16px;
    }

    .signal-timeline-item {
      display: grid;
      grid-template-columns: 112px minmax(0, 1fr);
      gap: 18px;
      align-items: start;
    }

    .signal-timeline-time {
      padding-top: 2px;
      color: var(--signal-brand);
      font-size: 1rem;
      font-weight: 800;
    }

    .signal-timeline-copy {
      padding: 16px 18px;
      border: 1px solid rgba(138, 18, 23, 0.12);
      background: rgba(138, 18, 23, 0.05);
    }

    .signal-timeline-copy strong {
      display: block;
      font-size: 1.02rem;
    }

    .signal-timeline-copy p {
      margin: 8px 0 0;
      color: #334256;
      line-height: 1.56;
    }

    .signal-impact-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 14px;
      margin-top: 18px;
    }

    .signal-impact-item {
      padding: 18px;
      border: 1px solid var(--signal-line);
      background: #fff;
    }

    .signal-impact-item span {
      display: block;
      color: var(--signal-muted);
      font-size: 0.8rem;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.13em;
    }

    .signal-impact-item strong {
      display: block;
      margin-top: 8px;
      font-size: 1rem;
      line-height: 1.48;
    }

    .signal-advisory-card {
      grid-column: span 12;
      padding: 26px;
    }

    .signal-watch-strip {
      margin-top: 20px;
      padding: 18px 20px;
      border-radius: 18px;
      background: linear-gradient(90deg, var(--signal-brand-deep) 0%, var(--signal-brand) 100%);
      color: #fff;
      font-size: 1.05rem;
      font-weight: 700;
      line-height: 1.6;
    }

    .signal-footer {
      margin-top: 20px;
      color: var(--signal-muted);
      font-size: 0.98rem;
    }

    @media (max-width: 1100px) {
      .signal-hero,
      .signal-panel,
      .signal-article,
      .signal-list-card,
      .signal-timeline-card,
      .signal-impact-card,
      .signal-advisory-card {
        grid-column: span 12;
      }

      .signal-summary-grid,
      .signal-impact-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }

    @media (max-width: 720px) {
      .signal-local-shell {
        width: min(100vw - 20px, 1240px);
        padding-top: 14px;
      }

      .signal-workshop-banner {
        padding: 0.85rem 0.95rem;
        font-size: 0.92rem;
      }

      .signal-local-masthead,
      .signal-hero-meta {
        flex-direction: column;
        align-items: flex-start;
      }

      .signal-masthead-meta {
        justify-items: start;
      }

      .signal-hero,
      .signal-panel,
      .signal-article,
      .signal-list-card,
      .signal-timeline-card,
      .signal-impact-card,
      .signal-advisory-card {
        padding: 22px;
        border-radius: 22px;
      }

      .signal-summary-grid,
      .signal-impact-grid {
        grid-template-columns: minmax(0, 1fr);
      }

      .signal-timeline-item {
        grid-template-columns: minmax(0, 1fr);
        gap: 8px;
      }
    }
  `;

  const shellMarkup = `
    <div class="signal-workshop-banner" role="alert">
      WORKSHOP NOTICE: This page is completely fake and exists only for an academic research workshop on April 20, 2026. Do not treat the report below as real.
    </div>
    <div class="signal-local-shell">
      <header class="signal-local-masthead" aria-label="Signal Local masthead">
        <div class="signal-brand-lockup">
          <div class="signal-brand-badge" aria-hidden="true">SL</div>
          <div class="signal-brand-copy">
            <strong>Signal Local</strong>
            <span>Continuous Breaking Coverage Desk</span>
          </div>
        </div>
        <div class="signal-masthead-meta">
          <div class="signal-status-row">
            <span class="signal-live-pill">Live</span>
            <span id="toplineLocation">Resolving local desk...</span>
          </div>
          <div id="toplineUpdated">Updating time stamp...</div>
        </div>
      </header>

      <div class="signal-ticker" aria-hidden="true">
        <div class="signal-ticker-track">
          <span>Breaking coverage</span>
          <span>Live eyewitness reports</span>
          <span>Airspace monitoring</span>
          <span>First responder posture</span>
          <span>Signal Local desk</span>
          <span>Developing situation</span>
          <span>Breaking coverage</span>
          <span>Live eyewitness reports</span>
          <span>Airspace monitoring</span>
          <span>First responder posture</span>
          <span>Signal Local desk</span>
          <span>Developing situation</span>
        </div>
      </div>

      <main class="signal-layout">
        <section class="signal-card signal-hero">
          <div class="signal-hero-meta">
            <span class="signal-live-pill">Special Report</span>
            <span id="localStamp">Loading localized incident timing...</span>
          </div>
          <h1 id="headline">Residents report a low-altitude unidentified craft over your area</h1>
          <p id="dek" class="signal-dek">
            Signal Local is loading a city-specific incident brief using your current connection region.
          </p>
          <div class="signal-summary-grid">
            <div class="signal-summary-item">
              <span>Primary location</span>
              <strong id="summaryLocation">Resolving local area...</strong>
            </div>
            <div class="signal-summary-item">
              <span>Local time</span>
              <strong id="summaryTime">Synchronizing...</strong>
            </div>
            <div class="signal-summary-item">
              <span>Observed coordinates</span>
              <strong id="summaryCoords">Pending...</strong>
            </div>
            <div class="signal-summary-item">
              <span>Status</span>
              <strong id="summaryStatus">Monitoring witness traffic</strong>
            </div>
          </div>
        </section>

        <aside class="signal-card signal-panel" aria-label="Live status panel">
          <div class="signal-panel-label">Airspace and on-scene read</div>
          <h2 id="panelTitle" class="signal-panel-title">Contact holding over your area</h2>
          <div class="signal-radar" aria-hidden="true">
            <div class="signal-contact-point"></div>
          </div>
          <div class="signal-panel-facts">
            <div class="signal-panel-fact">
              <span>Emergency posture</span>
              <strong id="panelPosture">Local agencies are moving into perimeter control.</strong>
            </div>
            <div class="signal-panel-fact">
              <span>Witness pattern</span>
              <strong id="panelPattern">Reports mention silent movement and unusual light behavior.</strong>
            </div>
            <div class="signal-panel-fact">
              <span>Closest area named by callers</span>
              <strong id="panelArea">Waiting for location context...</strong>
            </div>
          </div>
        </aside>

        <section class="signal-card signal-article">
          <div class="signal-kicker">Top story</div>
          <h2 class="signal-section-title">What would be visible on the ground right now</h2>
          <p id="leadParagraph">Localized report copy is loading. If the lookup fails, the page will fall back to a regional briefing.</p>
          <p id="bodyParagraphA"></p>
          <p id="bodyParagraphB"></p>
          <p id="bodyParagraphC"></p>
        </section>

        <section class="signal-card signal-list-card">
          <div class="signal-kicker">Eyewitness detail</div>
          <h2 class="signal-section-title">What residents say they are seeing</h2>
          <ul id="sightingList" class="signal-detail-list"></ul>
        </section>

        <section class="signal-card signal-timeline-card">
          <div class="signal-kicker">Minute by minute</div>
          <h2 class="signal-section-title">How the response is unfolding locally</h2>
          <div id="timeline" class="signal-timeline"></div>
        </section>

        <section class="signal-card signal-impact-card">
          <div class="signal-kicker">Operational impacts</div>
          <h2 class="signal-section-title">Immediate disruptions in the area</h2>
          <div id="impactGrid" class="signal-impact-grid"></div>
        </section>

        <section class="signal-card signal-advisory-card">
          <div class="signal-kicker">Public advisory</div>
          <h2 class="signal-section-title">What residents are being told to do right now</h2>
          <ul id="advisoryList" class="signal-advisory-list"></ul>
          <div id="watchStrip" class="signal-watch-strip">
            Keep filming from a protected position, stay clear of elevated roads, and leave open sightlines for emergency crews.
          </div>
          <div class="signal-footer">
            Signal Local desk coverage refreshes local time and location markers automatically in the browser.
          </div>
        </section>
      </main>
    </div>
  `;

  const GEO_PROVIDERS = [
    {
      url: "https://get.geojs.io/v1/ip/geo.json",
      parse(data) {
        return {
          city: data?.city,
          region: data?.region,
          regionCode: data?.region_code,
          country: data?.country,
          countryCode: data?.country_code,
          latitude: data?.latitude,
          longitude: data?.longitude,
          postal: data?.postal_code,
          timezone: data?.timezone
        };
      }
    },
    {
      url: "https://ipwho.is/",
      parse(data) {
        if (!data?.success) {
          return null;
        }
        return {
          city: data?.city,
          region: data?.region,
          regionCode: data?.region_code,
          country: data?.country,
          countryCode: data?.country_code,
          latitude: data?.latitude,
          longitude: data?.longitude,
          postal: data?.postal,
          timezone: data?.timezone?.id
        };
      }
    },
    {
      url: "https://ipapi.co/json/",
      parse(data) {
        if (!data || data.error) {
          return null;
        }
        return {
          city: data?.city,
          region: data?.region,
          regionCode: data?.region_code,
          country: data?.country_name,
          countryCode: data?.country_code,
          latitude: data?.latitude,
          longitude: data?.longitude,
          postal: data?.postal,
          timezone: data?.timezone
        };
      }
    }
  ];

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function upsertMeta(selector, attributes) {
    let node = document.head.querySelector(selector);
    if (!node) {
      node = document.createElement("meta");
      document.head.appendChild(node);
    }
    for (const [name, value] of Object.entries(attributes)) {
      node.setAttribute(name, value);
    }
  }

  function upsertLink(selector, attributes) {
    let node = document.head.querySelector(selector);
    if (!node) {
      node = document.createElement("link");
      document.head.appendChild(node);
    }
    for (const [name, value] of Object.entries(attributes)) {
      node.setAttribute(name, value);
    }
  }

  function formatDateTime(date, timezone, options) {
    try {
      return new Intl.DateTimeFormat("en-US", { timeZone: timezone, ...options }).format(date);
    } catch {
      return new Intl.DateTimeFormat("en-US", options).format(date);
    }
  }

  function fetchWithTimeout(url, timeoutMs) {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), timeoutMs);
    return fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" }
    }).finally(() => window.clearTimeout(timer));
  }

  function normalizeLocation(input) {
    const timezone = String(
      input?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || "America/New_York"
    ).trim();
    const city = String(input?.city || "").trim();
    const region = String(input?.region || "").trim();
    const regionCode = String(input?.regionCode || "").trim();
    const country = String(input?.country || "").trim() || "United States";
    const countryCode = String(input?.countryCode || "").trim();
    const latitude = Number.parseFloat(input?.latitude);
    const longitude = Number.parseFloat(input?.longitude);
    const postal = String(input?.postal || "").trim();

    return {
      city: city || "your area",
      region: region || "",
      regionCode: regionCode || "",
      country,
      countryCode,
      latitude: Number.isFinite(latitude) ? latitude : null,
      longitude: Number.isFinite(longitude) ? longitude : null,
      postal,
      timezone
    };
  }

  async function resolveLocation() {
    for (const provider of GEO_PROVIDERS) {
      try {
        const response = await fetchWithTimeout(provider.url, 4500);
        if (!response.ok) {
          continue;
        }
        const data = await response.json();
        const parsed = provider.parse(data);
        if (!parsed) {
          continue;
        }
        return normalizeLocation(parsed);
      } catch {
        continue;
      }
    }

    return normalizeLocation(null);
  }

  function getLocalHour(date, timezone) {
    const value = formatDateTime(date, timezone, {
      hour: "numeric",
      hour12: false
    });
    const hour = Number.parseInt(value, 10);
    return Number.isFinite(hour) ? hour : date.getHours();
  }

  function sceneProfile(hour) {
    if (hour >= 5 && hour < 11) {
      return {
        sky: "morning light",
        object:
          "a silver hull reflecting sunrise without any visible propeller, exhaust plume, or wake",
        behavior:
          "hovering above rooftops for several seconds before shifting sideways in one abrupt movement",
        effect: "a bright white glare spilling across windshields and upper-story windows"
      };
    }

    if (hour >= 11 && hour < 17) {
      return {
        sky: "broad daylight",
        object: "a sharply defined metallic craft hanging almost motionless against the clouds",
        behavior: "stopping dead in the air, then accelerating laterally without banking",
        effect: "hard flashes of reflected light and a low vibration felt through parked cars"
      };
    }

    if (hour >= 17 && hour < 21) {
      return {
        sky: "dusk",
        object:
          "a matte black triangular craft with a cold blue underside glow and no visible engine wash",
        behavior:
          "holding steady above the horizon line before cutting across the skyline in silence",
        effect: "an electric-blue rim light visible over intersections, parking lots, and treetops"
      };
    }

    return {
      sky: "night sky",
      object:
        "a dark airframe outlined by thin amber edge lights that do not blink like standard aircraft",
      behavior:
        "remaining silent while drifting low enough for witnesses to make out panel seams on the underside",
      effect: "a dim halo over nearby buildings and repeated static bursts on radios and phones"
    };
  }

  function compactLocationLabel(location) {
    if (location.regionCode && location.countryCode === "US") {
      return `${location.city}, ${location.regionCode}`;
    }
    if (location.region) {
      return `${location.city}, ${location.region}`;
    }
    return location.city;
  }

  function fullLocationLabel(location) {
    if (location.regionCode && location.countryCode === "US") {
      return `${location.city}, ${location.regionCode}`;
    }
    if (location.region && location.country) {
      return `${location.city}, ${location.region}, ${location.country}`;
    }
    if (location.country && location.city !== "your area") {
      return `${location.city}, ${location.country}`;
    }
    return location.city;
  }

  function formatCoordinates(location) {
    if (!Number.isFinite(location.latitude) || !Number.isFinite(location.longitude)) {
      return "Unavailable";
    }
    return `${location.latitude.toFixed(3)}, ${location.longitude.toFixed(3)}`;
  }

  function buildReport(location) {
    const now = new Date();
    const zone = location.timezone;
    const localHour = getLocalHour(now, zone);
    const profile = sceneProfile(localHour);
    const compactLocation = compactLocationLabel(location);
    const fullLocation = fullLocationLabel(location);
    const regionPhrase = location.region || location.country || "the surrounding area";
    const firstCall = new Date(now.getTime() - 47 * 60 * 1000);
    const perimeterTime = new Date(now.getTime() - 29 * 60 * 1000);
    const airspaceTime = new Date(now.getTime() - 18 * 60 * 1000);
    const medicalTime = new Date(now.getTime() - 10 * 60 * 1000);
    const localStamp = formatDateTime(now, zone, {
      weekday: "long",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit"
    });
    const topStamp = formatDateTime(now, zone, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short"
    });
    const statusArea =
      location.city === "your area" ? "near the local horizon" : `over ${compactLocation}`;
    const coordLabel = formatCoordinates(location);
    const trafficReference =
      location.city === "your area"
        ? "major roads leading toward the primary viewing area"
        : `${location.city}'s outer arterial roads and open parking decks`;
    const callerZone =
      location.city === "your area"
        ? "the nearest residential corridor"
        : `the south and east edges of ${location.city}`;

    return {
      headline: `Residents report an unidentified craft hovering ${statusArea}`,
      dek:
        `Dispatch traffic from ${fullLocation} describes ${profile.object}. Witnesses say the object remained visible in the ${profile.sky}, then moved with no obvious propulsion, rotor wash, or engine noise.`,
      summaryLocation: fullLocation,
      summaryTime: topStamp,
      summaryCoords: coordLabel,
      summaryStatus: "Perimeter forming, aviation hold requested, hospitals on standby",
      panelTitle: `Contact holding ${statusArea}`,
      panelPosture:
        "Police, fire, and state aviation monitors are treating the scene as an active unknown-aircraft event.",
      panelPattern:
        "Most callers independently describe silent motion, intense localized light, and short bursts of signal interference.",
      panelArea: callerZone,
      localStamp: `Last updated ${localStamp}`,
      topLocation: `Live desk: ${fullLocation}`,
      topUpdated: `Updated ${topStamp}`,
      leadParagraph:
        `${formatDateTime(firstCall, zone, { hour: "numeric", minute: "2-digit" })}, residents in ${fullLocation} began calling 911 to describe ${profile.object}. Several callers said the object paused above the same section of sky long enough for neighbors to come outside, point upward, and begin filming before it ${profile.behavior}.`,
      bodyParagraphA:
        `If a discovery like this unfolded in public, what people on the ground would notice first is the mismatch between what they are seeing and how aircraft normally behave. Witnesses in ${location.city === "your area" ? regionPhrase : location.city} are describing a silhouette with clean geometric edges, no blinking navigation pattern, and no audible engine signature, even while it appears low enough to judge size against buildings and tree lines.`,
      bodyParagraphB:
        `${profile.effect} has become one of the most repeated details in the incoming calls. Drivers report dashboard glitches, residents say pets became agitated before looking up, and people standing in open lots describe a pressure change in the chest rather than a conventional passing sound. Those are the kinds of sensory details emergency managers would document immediately in a first-contact incident because they indicate a physical presence, not a distant light.`,
      bodyParagraphC:
        `The local response described in this report reflects what agencies would likely do within the first hour of a confirmed unknown aerial event: isolate the clearest sightline, clear road shoulders and rooftops, lock down low-altitude traffic, and route anyone reporting burns, hearing distortion, panic symptoms, or contact with residue toward supervised medical screening. In ${fullLocation}, that means crews are focusing on ${trafficReference} while aviation monitors keep the sky above ${regionPhrase} under active review.`,
      sightings: [
        "A hull shape with no wings, rotor blades, or exhaust trail, visible long enough for multiple witnesses to describe the same outline from different blocks.",
        `A silent hover followed by a sudden sideways movement that looked wrong for any helicopter, drone, or fixed-wing aircraft normally seen over ${regionPhrase}.`,
        "Repeated flicker on porch lights, traffic signals, and phone screens during the moments when the object appeared brightest overhead.",
        "Reflections racing across glass, car roofs, and upper windows even when the object itself seemed to stay nearly still in the sky.",
        "People stopping in the street, on sidewalks, and in parking lots because the motion pattern looked deliberate rather than random or weather-driven."
      ],
      timeline: [
        {
          time: formatDateTime(firstCall, zone, { hour: "numeric", minute: "2-digit" }),
          title: "First clustered calls reach dispatch",
          body: `Callers from ${callerZone} report a low object with unusual light behavior and no audible engine signature.`
        },
        {
          time: formatDateTime(perimeterTime, zone, { hour: "numeric", minute: "2-digit" }),
          title: "Perimeter control begins",
          body: "Police units start moving vehicles away from the cleanest viewing corridors and keep bystanders off medians, overpasses, and school lots."
        },
        {
          time: formatDateTime(airspaceTime, zone, { hour: "numeric", minute: "2-digit" }),
          title: "Aviation hold is requested",
          body: `A regional aviation advisory is relayed to keep low-altitude traffic clear while the object remains visible over ${regionPhrase}.`
        },
        {
          time: formatDateTime(medicalTime, zone, { hour: "numeric", minute: "2-digit" }),
          title: "Medical screening posture activated",
          body: "Hospitals are asked to watch for patients describing flash exposure, nausea, tinnitus, burns, or contact with unusual debris."
        }
      ],
      impacts: [
        {
          label: "Traffic",
          value: `Expect rapid closures around ${trafficReference} as officers push drivers away from shoulders and open vantage points.`
        },
        {
          label: "Communications",
          value: "Residents are reporting brief static bursts, camera autofocus failures, and signal drops during the brightest visual pulses."
        },
        {
          label: "Airspace",
          value: `Regional flight paths would be rerouted to preserve a sterile observation zone above ${fullLocation}.`
        },
        {
          label: "Medical",
          value: "Triage teams would prioritize dizziness, hearing changes, eye irritation, anxiety spikes, and any claimed contact with residue."
        }
      ],
      advisories: [
        `Stay indoors or watch from a covered position if you are already near a clear line of sight in ${fullLocation}.`,
        "Do not stop on highway shoulders, parking ramps, or school grounds to record the object. Those spaces may be taken over by emergency crews without notice.",
        "If you notice ringing in the ears, skin irritation, sudden disorientation, or contact with falling material, move away and seek medical direction immediately.",
        "Keep pets inside, charge devices, and preserve any original video files without editing or compressing them if investigators request evidence."
      ],
      watchStrip:
        `Residents in ${fullLocation} should leave the clearest intersections, rooftops, and elevated lots to emergency teams. If the object drops debris or lands, do not approach it, touch residue, or attempt to collect fragments.`
    };
  }

  function setText(id, value) {
    const node = document.getElementById(id);
    if (node) {
      node.textContent = value;
    }
  }

  function renderList(id, items, builder) {
    const node = document.getElementById(id);
    if (!node) {
      return;
    }
    node.innerHTML = items.map(builder).join("");
  }

  function applyMeta(report) {
    document.title = `${report.summaryLocation} | Signal Local Breaking Coverage`;
    upsertMeta('meta[name="description"]', {
      name: "description",
      content: `${report.summaryLocation}: localized breaking-news presentation for a workshop simulation page.`
    });
    upsertMeta('meta[name="robots"]', {
      name: "robots",
      content: "noindex, nofollow, noarchive, nosnippet, max-image-preview:none"
    });
    upsertMeta('meta[name="theme-color"]', {
      name: "theme-color",
      content: "#8a1217"
    });
    upsertMeta('meta[property="og:title"]', {
      property: "og:title",
      content: `${report.summaryLocation} | Signal Local Breaking Coverage`
    });
    upsertMeta('meta[property="og:description"]', {
      property: "og:description",
      content: `${report.summaryLocation}: localized breaking-news presentation for a workshop simulation page.`
    });
    upsertLink('link[rel="canonical"]', {
      rel: "canonical",
      href: "https://matt-scalcione.github.io/whoa/signal.html"
    });
  }

  function renderReport(report) {
    applyMeta(report);
    setText("headline", report.headline);
    setText("dek", report.dek);
    setText("summaryLocation", report.summaryLocation);
    setText("summaryTime", report.summaryTime);
    setText("summaryCoords", report.summaryCoords);
    setText("summaryStatus", report.summaryStatus);
    setText("panelTitle", report.panelTitle);
    setText("panelPosture", report.panelPosture);
    setText("panelPattern", report.panelPattern);
    setText("panelArea", report.panelArea);
    setText("localStamp", report.localStamp);
    setText("toplineLocation", report.topLocation);
    setText("toplineUpdated", report.topUpdated);
    setText("leadParagraph", report.leadParagraph);
    setText("bodyParagraphA", report.bodyParagraphA);
    setText("bodyParagraphB", report.bodyParagraphB);
    setText("bodyParagraphC", report.bodyParagraphC);
    setText("watchStrip", report.watchStrip);

    renderList("sightingList", report.sightings, (item) => `<li>${escapeHtml(item)}</li>`);
    renderList(
      "timeline",
      report.timeline,
      (item) => `
        <div class="signal-timeline-item">
          <div class="signal-timeline-time">${escapeHtml(item.time)}</div>
          <div class="signal-timeline-copy">
            <strong>${escapeHtml(item.title)}</strong>
            <p>${escapeHtml(item.body)}</p>
          </div>
        </div>
      `
    );
    renderList(
      "impactGrid",
      report.impacts,
      (item) => `
        <div class="signal-impact-item">
          <span>${escapeHtml(item.label)}</span>
          <strong>${escapeHtml(item.value)}</strong>
        </div>
      `
    );
    renderList("advisoryList", report.advisories, (item) => `<li>${escapeHtml(item)}</li>`);
  }

  function mountShell() {
    document.documentElement.lang = "en";
    document.body.className = "signal-local-body";
    document.body.innerHTML = shellMarkup;

    document.querySelectorAll('link[href$="signal.css"]').forEach((node) => node.remove());

    if (!document.head.querySelector('link[data-signal-fonts="true"]')) {
      const fontLink = document.createElement("link");
      fontLink.setAttribute("rel", "stylesheet");
      fontLink.setAttribute(
        "href",
        "https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,600;6..72,700;6..72,800&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap"
      );
      fontLink.setAttribute("data-signal-fonts", "true");
      document.head.appendChild(fontLink);
    }

    let styleNode = document.head.querySelector("#signal-local-style");
    if (!styleNode) {
      styleNode = document.createElement("style");
      styleNode.id = "signal-local-style";
      document.head.appendChild(styleNode);
    }
    styleNode.textContent = styleText;
  }

  mountShell();

  resolveLocation()
    .then((location) => {
      renderReport(buildReport(location));
    })
    .catch(() => {
      renderReport(buildReport(normalizeLocation(null)));
    });
})();
