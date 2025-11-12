const fs = require('fs');
const path = require('path');
const target = path.join(__dirname, '..', 'estate', 'index.html');
let html = fs.readFileSync(target, 'utf8');

// Remove any module scripts Vite injected or any accidental script->css issues
html = html.replace(/<script[^>]*type="module"[^>]*>[^<]*<\/script>\s*/g, '');

// Inject a safe loader that reads the manifest and loads the correct JS and CSS
const loader = `
<script type="module">
(async () => {
  const BASE = '/estate/';
  let res = await fetch(BASE + 'manifest.json', { cache: 'no-store' });
  if (!res.ok) {
    res = await fetch(BASE + '.vite/manifest.json', { cache: 'no-store' });
  }
  if (!res.ok) throw new Error('Unable to load manifest.json');
  const m = await res.json();
  const entry = Object.values(m).find(x => x && x.isEntry) || m['src/main.tsx'] || m['src/main.ts'];
  if (!entry || !entry.file) throw new Error('No JS entry in manifest');
  // Load CSS first (if any)
  (entry.css || []).forEach(href => {
    const l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = href.startsWith('/') ? BASE + href.slice(1) : BASE + href;
    document.head.appendChild(l);
  });
  // Load JS entry
  const s = document.createElement('script');
  s.type = 'module';
  s.crossOrigin = '';
  s.src = entry.file.startsWith('/') ? BASE + entry.file.slice(1) : BASE + entry.file;
  document.head.appendChild(s);
})();
</script>`;
html = html.replace('</body>', loader + '\n</body>');
fs.writeFileSync(target, html);
console.log('Patched', target);
