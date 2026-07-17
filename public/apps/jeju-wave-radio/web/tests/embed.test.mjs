import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

function cssBlock(css, selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return Array.from(css.matchAll(new RegExp(`${escaped}\\s*{[^}]*}`, 'g'))).at(-1)?.[0] ?? '';
}

test('embed page exposes visual, audio opt-in, and status controls', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');

  assert.match(html, /<canvas id="visual"/);
  assert.match(html, /<button id="start-audio"[^>]*>START AUDIO<\/button>/);
  assert.match(html, /id="status" role="status"/);
  assert.match(html, /rel="stylesheet" href="\.\/styles\.css\?v=/);
  assert.match(html, /type="module" src="\.\/src\/app\.js\?v=/);
});

test('studio shell presents the PureData rebuild as an English sound-first instrument', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const css = await readFile(new URL('../styles.css', import.meta.url), 'utf8');
  const note = cssBlock(css, '.masthead-note');

  assert.match(html, />JEJU WAVE RADIO</);
  assert.match(html, /<p class="masthead-note">PureData로 설계한 패치를 사이트 임베드를 위해 WebGL\/Web Audio 기반으로 재구성했습니다\.<\/p>/);
  assert.match(note, /font-size:\s*clamp\(\.62rem,\s*1vw,\s*\.78rem\)/);
  assert.match(note, /color:\s*#5a5a5a/);
  assert.match(note, /margin:\s*8px 0 0/);
  assert.doesNotMatch(css, /\.masthead p,\s*\.kicker/);
  assert.doesNotMatch(note, /var\(--red\)|#e21f2b/);
  assert.match(html, /제주도의 푸른밤/);
  assert.doesNotMatch(html, /BLUE NIGHT/);
  assert.doesNotMatch(html, /PUREDATA \/ WEBGL REBUILD|PureData patch rebuilt for embeddable WebGL and Web Audio/);
  assert.doesNotMatch(html, /display-mode|원본 비율|화면 채우기|실시간 미리보기|맑은 밤|소리 시작|실시간 데이터/);
});

test('video monitor keeps visible text out of the visual preview area', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');

  assert.doesNotMatch(html, /VIDEO MONITOR|Weather Clip|LIVE DATA|FALLBACK DATA|Sunny Night|CLIP SOURCE/);
  assert.doesNotMatch(html, /id="weather-state"|id="source-state"/);
});

test('blue-night lives below the video as a physical Jeju symbol button', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const manualPanel = html.match(/<section class="panel manual-panel">[\s\S]*?<\/section>/)?.[0] ?? '';
  const previewPanel = html.match(/<aside class="preview-panel">[\s\S]*?<\/aside>/)?.[0] ?? '';

  assert.doesNotMatch(manualPanel, /id="blue-night"/);
  assert.match(previewPanel, /<button id="blue-night"[^>]*aria-pressed="false"[^>]*aria-label="제주도의 푸른밤 모티프 켜기\/끄기"/);
  assert.match(previewPanel, /<img class="motif-icon" src="\.\/assets\/jeju-blue-night-button\.png" alt="">/);
  assert.match(previewPanel, /<span>제주도의 푸른밤<\/span>/);
  assert.doesNotMatch(previewPanel, /motif-palm|motif-disc|BLUE NIGHT/);
});

test('layout makes audio controls primary and keeps the video monitor portrait sized', async () => {
  const css = await readFile(new URL('../styles.css', import.meta.url), 'utf8');

  assert.match(css, /\.studio\s*{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s*360px/);
  assert.match(css, /\.stage\s*{[^}]*aspect-ratio:\s*716\s*\/\s*1284/);
  assert.match(css, /\.preview-panel\s*{[^}]*max-width:\s*360px/);
  assert.match(css, /\.motif-control\s*{[^}]*min-height:\s*0/);
  assert.match(css, /\.motif-control\s*{[^}]*box-shadow:/);
  assert.match(css, /\.motif-button-plate\s*{[^}]*transform:\s*perspective\(900px\)\s*rotateX\(/);
  assert.match(css, /\.motif-control:active\s+\.motif-button-plate/);
  assert.match(css, /\.motif-control\[aria-pressed="true"\]/);
  assert.doesNotMatch(css, /Impact|Haettenschweiler|Arial Black/);
  assert.match(css, /Diatype Variable/);
});

test('blue-night button panel matches the neutral box system without floating or red states', async () => {
  const css = await readFile(new URL('../styles.css', import.meta.url), 'utf8');
  const preview = css.match(/\.preview-panel\s*{\s*display:\s*grid;[^}]*}/)?.[0] ?? '';
  const motif = cssBlock(css, '.motif-control');
  const pressed = cssBlock(css, '.motif-control[aria-pressed="true"]');
  const icon = cssBlock(css, '.motif-icon');
  const plateShadow = css.match(/\.motif-button-plate::before\s*{\s*content:\s*none;[^}]*}/)?.[0] ?? '';

  assert.doesNotMatch(css, /(^|\n)button:first-of-type\s*{/);
  assert.match(css, /\.button-row button:first-of-type\s*{[^}]*background:\s*#ef8588/);
  assert.match(preview, /gap:\s*12px/);
  assert.match(preview, /border:\s*0/);
  assert.match(preview, /background:\s*transparent/);
  assert.match(preview, /grid-template-rows:\s*auto auto/);
  assert.match(css.match(/\.stage\s*{\s*position:\s*relative;[^}]*}/)?.[0] ?? '', /width:\s*100%/);
  assert.match(motif, /border:\s*2px solid var\(--line\)/);
  assert.match(motif, /border-color:\s*var\(--line\)/);
  assert.match(motif, /background:\s*var\(--panel\)/);
  assert.match(motif, /color:\s*var\(--ink\)/);
  assert.match(motif, /box-shadow:\s*none/);
  assert.doesNotMatch(`${motif}\n${pressed}`, /#ef8588|#fff6f4|#eaf3f5|#f3f0e9|var\(--red\)|color:\s*#fff|border-color:\s*#ef8588/);
  assert.match(plateShadow, /content:\s*none/);
  assert.doesNotMatch(plateShadow, /background:/);
  assert.match(icon, /filter:\s*none/);
  assert.doesNotMatch(icon, /drop-shadow|translateY\(-/);
});

test('blue-night button uses a larger icon inside a compact box', async () => {
  const css = await readFile(new URL('../styles.css', import.meta.url), 'utf8');
  const motif = cssBlock(css, '.motif-control');
  const plate = css.match(/\.motif-button-plate\s*{\s*position:\s*relative;[^}]*}/)?.[0] ?? '';

  assert.match(motif, /min-height:\s*0/);
  assert.match(motif, /padding:\s*12px 16px 14px/);
  assert.match(motif, /gap:\s*6px/);
  assert.match(plate, /width:\s*min\(285px,\s*92%\)/);
});

test('blue-night PNG is cropped close to the actual icon artwork', async () => {
  const png = await readFile(new URL('../assets/jeju-blue-night-button.png', import.meta.url));
  const width = png.readUInt32BE(16);
  const height = png.readUInt32BE(20);

  assert.ok(width <= 1040, `expected cropped width, got ${width}`);
  assert.ok(height <= 960, `expected cropped height, got ${height}`);
});


test('instrument rows expose data meters that can follow live weather values', async () => {
  const app = await readFile(new URL('../src/app.js', import.meta.url), 'utf8');

  assert.match(app, /className = 'data-meter'/);
  assert.match(app, /className = 'meter-readout'/);
  assert.match(app, /className = 'meter-current'/);
  assert.match(app, /updateDataMeters/);
  assert.match(app, /payload\.values\[instrument\.key\]/);
  assert.match(app, /current\.textContent = String\(amount\)/);
  assert.doesNotMatch(app, /Swell Cello|Wave Marimba|Tide Organ|Gust Harp|Cloud Choir|Visibility Flute/);
  assert.doesNotMatch(app, /querySelector\('#metrics'\)|renderMetrics/);
  assert.doesNotMatch(app, /level\.addEventListener\('input'/);
});

test('blue-night status copy is localized to the Korean song title', async () => {
  const app = await readFile(new URL('../src/app.js', import.meta.url), 'utf8');

  assert.match(app, /제주도의 푸른밤 모티프가 재생 중입니다\./);
  assert.match(app, /제주도의 푸른밤 모티프를 멈췄습니다\./);
  assert.doesNotMatch(app, /BLUE NIGHT motif/);
});

test('standalone embed example permits audio activation', async () => {
  const html = await readFile(new URL('../embed-example.html', import.meta.url), 'utf8');

  assert.match(html, /<iframe/);
  assert.match(html, /src="\.\/"/);
  assert.match(html, /allow="autoplay"/);
});

test('preview instructions serve from the repository root so weather media resolves', async () => {
  const readme = await readFile(new URL('../README.md', import.meta.url), 'utf8');

  assert.match(readme, /cd \.\.\npython3 -m http\.server 8080/);
  assert.doesNotMatch(readme, /cd web\npython3 -m http\.server 8080/);
});
