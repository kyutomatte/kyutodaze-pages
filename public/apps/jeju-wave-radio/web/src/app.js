import { DEFAULT_VALUES, fetchJejuWeather } from './weather.js?v=20260717-blue-night-compact';
import { createRenderer } from './renderer.js?v=20260717-blue-night-compact';
import { DATA_INSTRUMENTS, MANUAL_INSTRUMENTS, createSynth } from './synth.js?v=20260717-blue-night-compact';

const noteNames = Object.freeze({ C: 'C', D: 'D', E: 'E', G: 'G', A: 'A', B: 'B', 'C+': 'C+', 'D+': 'D+' });
const notes = Object.freeze(Object.keys(noteNames));
const canvas = document.querySelector('#visual');
const synth = createSynth();
const startButton = document.querySelector('#start-audio');
const refreshButton = document.querySelector('#refresh-live-data');
const masterLevel = document.querySelector('#master-level');
const status = document.querySelector('#status');
const blueNight = document.querySelector('#blue-night');
let renderer = null;
let payload = { ...DEFAULT_VALUES, values: { ...DEFAULT_VALUES.values } };
const instrumentMeters = new Map();
let motifActive = false;

function showStatus(message) { status.textContent = message; }

async function renderState(state) {
  if (!renderer) return;
  if (!await renderer.setState(state)) showStatus('Video failed to load; keeping the last frame.');
}

function updateDataMeters() {
  instrumentMeters.forEach(({ fill, current, instrument }) => {
    const amount = Math.round(Math.min(1, Math.max(0, Number(payload.values[instrument.key]) || 0)) * 100);
    fill.style.width = `${amount}%`;
    current.textContent = String(amount);
  });
}

function buildInstrumentControls() {
  const containers = { sea: document.querySelector('#sea-instruments'), wind: document.querySelector('#wind-instruments'), sky: document.querySelector('#sky-instruments') };
  DATA_INSTRUMENTS.forEach((instrument) => {
    const row = document.createElement('label'); row.className = 'instrument-row';
    const enabled = document.createElement('input'); enabled.type = 'checkbox'; enabled.checked = true; enabled.setAttribute('aria-label', `Enable ${instrument.label}`);
    const name = document.createElement('span'); name.textContent = instrument.label;
    const meterStack = document.createElement('span'); meterStack.className = 'meter-stack';
    const meter = document.createElement('span'); meter.className = 'data-meter'; meter.setAttribute('aria-label', `${instrument.label} data level`);
    const fill = document.createElement('span'); fill.className = 'data-meter-fill'; meter.append(fill);
    const readout = document.createElement('span'); readout.className = 'meter-readout';
    const min = document.createElement('span'); min.textContent = '0';
    const current = document.createElement('span'); current.className = 'meter-current'; current.textContent = '0';
    const max = document.createElement('span'); max.textContent = '100';
    readout.append(min, current, max);
    meterStack.append(meter, readout);
    instrumentMeters.set(instrument.id, { fill, current, instrument });
    enabled.addEventListener('change', () => synth.setInstrument(instrument.id, { enabled: enabled.checked }));
    row.append(enabled, name, meterStack); containers[instrument.group].append(row);
  });
}

function buildManualControls() {
  const container = document.querySelector('#manual-instruments');
  Object.entries(MANUAL_INSTRUMENTS).forEach(([id, instrument]) => {
    const row = document.createElement('div'); row.className = 'manual-row';
    const label = document.createElement('span'); label.textContent = instrument.label; row.append(label);
    notes.forEach((note) => { const button = document.createElement('button'); button.type = 'button'; button.textContent = noteNames[note]; button.addEventListener('click', () => { if (!synth.playManual(id, note)) showStatus('Press START AUDIO before manual triggers.'); }); row.append(button); });
    container.append(row);
  });
}

try { renderer = createRenderer(canvas); } catch { const fallback = document.createElement('div'); fallback.className = 'visual-fallback'; fallback.textContent = 'WebGL unavailable'; canvas.replaceWith(fallback); showStatus('Video is unavailable, but the audio patch is still usable.'); }

buildInstrumentControls(); buildManualControls(); updateDataMeters(); synth.update(payload.values);

startButton.addEventListener('click', async () => { startButton.disabled = true; try { await synth.start(); synth.setMaster(masterLevel.value); startButton.textContent = 'AUDIO RUNNING'; showStatus('Audio engine is running. You should hear the confirmation tone and live data voices.'); } catch (error) { startButton.disabled = false; showStatus(error instanceof Error ? error.message : 'Unable to start audio.'); } });
refreshButton.addEventListener('click', async () => { refreshButton.disabled = true; showStatus('Polling Jeju weather and marine data.'); payload = await fetchJejuWeather(); synth.update(payload.values); updateDataMeters(); if (payload.source === 'live') showStatus('Jeju data patched into the synth.'); else if (payload.source === 'live-partial') showStatus('Partial Jeju data patched in; unavailable channels keep fallback levels.'); else showStatus('Live data unavailable; fallback values are driving the patch.'); await renderState(payload.videoState); refreshButton.disabled = false; });
masterLevel.addEventListener('input', () => synth.setMaster(masterLevel.value));
blueNight.addEventListener('click', () => { motifActive = !motifActive; blueNight.setAttribute('aria-pressed', String(motifActive)); synth.setMotif(motifActive); showStatus(motifActive ? '제주도의 푸른밤 모티프가 재생 중입니다.' : '제주도의 푸른밤 모티프를 멈췄습니다.'); });
window.addEventListener('beforeunload', () => { renderer?.destroy(); synth.stop(); });
refreshButton.click();
