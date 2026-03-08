function line(widthClass = "w-100") {
  return `<span class="skeleton-line ${widthClass}"></span>`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function productEmptyMarkup({
  eyebrow = "No data yet",
  title = "Nothing to show",
  body = "This surface will populate when matching data is available.",
  tips = [],
  compact = false
} = {}) {
  const tipMarkup = Array.isArray(tips) && tips.length
    ? `
      <div class="empty-tips" aria-label="Suggestions">
        ${tips.map((tip) => `<span class="empty-tip">${escapeHtml(tip)}</span>`).join("")}
      </div>
    `
    : "";

  return `
    <article class="empty empty-rich empty-product${compact ? " compact" : ""}">
      <p class="empty-kicker">${escapeHtml(eyebrow)}</p>
      <strong class="empty-title">${escapeHtml(title)}</strong>
      <p class="empty-body">${escapeHtml(body)}</p>
      ${tipMarkup}
    </article>
  `;
}

export function overviewSkeletonMarkup({ cards = 4, featured = true } = {}) {
  const summaryCards = Array.from({ length: cards }, () => `
    <article class="overview-card skeleton-surface">
      <p class="overview-label">${line("w-35")}</p>
      <p class="overview-value">${line("w-55")}</p>
      <p class="overview-note">${line("w-85")}</p>
    </article>
  `).join("");

  const featuredMarkup = featured
    ? `
      <article class="overview-featured skeleton-surface static">
        <div class="overview-featured-top">
          ${line("w-20")}
          ${line("w-35")}
        </div>
        <p class="overview-featured-match">${line("w-90")}</p>
        <div class="overview-featured-score">
          ${line("w-15")}
          ${line("w-10")}
          ${line("w-15")}
        </div>
        <p class="overview-note">${line("w-75")}</p>
      </article>
    `
    : "";

  return `${summaryCards}${featuredMarkup}`;
}

export function matchCardsSkeletonMarkup(count = 4) {
  return Array.from({ length: count }, () => `
    <article class="match-card skeleton-surface">
      <div class="card-top">
        ${line("w-20")}
        ${line("w-30")}
      </div>
      <p class="card-eventline">${line("w-70")}</p>
      <div class="teams">
        <div class="team-line">
          ${line("w-70")}
          ${line("w-12")}
        </div>
        <div class="team-line">
          ${line("w-65")}
          ${line("w-12")}
        </div>
      </div>
      <p class="signal">${line("w-50")}</p>
      <div class="card-meta-row">
        ${line("w-35")}
        ${line("w-20")}
      </div>
    </article>
  `).join("");
}

export function tableSkeletonMarkup({ rows = 5, columns = 6 } = {}) {
  const header = Array.from({ length: columns }, () => `<th>${line("w-60")}</th>`).join("");
  const body = Array.from({ length: rows }, () => `
    <tr>
      ${Array.from({ length: columns }, () => `<td>${line("w-80")}</td>`).join("")}
    </tr>
  `).join("");

  return `
    <table class="data-table skeleton-table">
      <thead>
        <tr>${header}</tr>
      </thead>
      <tbody>${body}</tbody>
    </table>
  `;
}

export function panelSkeletonMarkup(lines = 4) {
  return `
    <div class="skeleton-panel">
      ${Array.from({ length: lines }, (_, index) => line(index === lines - 1 ? "w-60" : index === 0 ? "w-90" : "w-80")).join("")}
    </div>
  `;
}

export function listSkeletonMarkup(count = 4) {
  return `
    <div class="skeleton-list">
      ${Array.from({ length: count }, () => `
        <div class="skeleton-list-row">
          <div class="skeleton-list-copy">
            ${line("w-70")}
            ${line("w-40")}
          </div>
          ${line("w-18")}
        </div>
      `).join("")}
    </div>
  `;
}

export function trackerSkeletonMarkup(rows = 10) {
  return `
    <div class="table-wrap">
      <table class="tracker-table skeleton-table">
        <thead>
          <tr>
            <th>${line("w-40")}</th>
            <th>${line("w-65")}</th>
            <th>${line("w-35")}</th>
            <th>${line("w-35")}</th>
            <th>${line("w-35")}</th>
          </tr>
        </thead>
        <tbody>
          ${Array.from({ length: rows }, () => `
            <tr>
              <td>${line("w-45")}</td>
              <td>${line("w-85")}</td>
              <td>${line("w-70")}</td>
              <td>${line("w-55")}</td>
              <td>${line("w-55")}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}
