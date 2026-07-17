const clamp01 = (value) => Math.min(1, Math.max(0, Number(value) || 0));
const NOTE_HZ = Object.freeze({ C: 261.63, D: 293.66, E: 329.63, F: 349.23, G: 392, A: 440, Bb: 466.16, B: 493.88, 'C+': 523.25, 'D+': 587.33 });

export const DATA_INSTRUMENTS = Object.freeze([
  ['swellCello', 'sea', 'Swell', 'swellHeight', 'sine', 1500], ['waveMarimba', 'sea', 'Wave', 'waveHeight', 'triangle', 620], ['foamBells', 'sea', 'Foam', 'swellPeriod', 'sine', 1100], ['currentPluck', 'sea', 'Current', 'currentVelocity', 'triangle', 780], ['pressureBass', 'sea', 'Pressure', 'pressure', 'sine', 1300],
  ['tideOrgan', 'wind', 'Tide', 'seaLevel', 'sine', 1700], ['seaWarmthPad', 'wind', 'Sea Temp', 'seaTemp', 'triangle', 1400], ['windReed', 'wind', 'Wind', 'windSpeed', 'sawtooth', 1000], ['gustHarp', 'wind', 'Gust', 'windGusts', 'triangle', 900], ['visibilityFlute', 'wind', 'Visibility', 'visibility', 'sine', 1500],
  ['cloudChoir', 'sky', 'Cloud', 'cloudCover', 'sine', 1600], ['rainDroplets', 'sky', 'Rain', 'precipitation', 'sine', 360], ['sunGlass', 'sky', 'Sun', 'sunshineDuration', 'sine', 1150], ['uvSpark', 'sky', 'UV', 'uvIndex', 'triangle', 720], ['airGrain', 'sky', 'Air', 'pm25', 'sawtooth', 1250],
].map(([id, group, label, key, type, interval]) => Object.freeze({ id, group, label, key, type, interval })));

export const MANUAL_INSTRUMENTS = Object.freeze({
  pluck: Object.freeze({ label: 'PLUCK', type: 'triangle', octave: 1, duration: .24 }),
  bass: Object.freeze({ label: 'BASS', type: 'sine', octave: .25, duration: .42 }),
  bell: Object.freeze({ label: 'BELL', type: 'sine', octave: 2, duration: .55 }),
  pad: Object.freeze({ label: 'PAD', type: 'triangle', octave: 1, duration: 1.4 }),
});

export const MOTIF_STEPS = Object.freeze([
  Object.freeze({ note: 'C', beats: 2 }),
  Object.freeze({ note: 'D', beats: 2 }),
  Object.freeze({ note: 'A', beats: 6 }),
  Object.freeze({ note: 'G', beats: 1 }),
  Object.freeze({ note: 'F', beats: 1 }),
  Object.freeze({ note: 'C+', beats: 6 }),
  Object.freeze({ note: 'F', beats: 1 }),
  Object.freeze({ note: 'F', beats: 1 }),
  Object.freeze({ note: 'D+', beats: 4 }),
  Object.freeze({ note: 'D+', beats: 1 }),
  Object.freeze({ note: 'C+', beats: 1 }),
  Object.freeze({ note: 'Bb', beats: 1 }),
  Object.freeze({ note: 'D+', beats: 1 }),
  Object.freeze({ note: 'C+', beats: 6 }),
]);
export const MOTIF_NOTES = Object.freeze(MOTIF_STEPS.filter((step) => step.note).map((step) => step.note));

export async function resumeAudioContext(context, timeoutMs = 4000) {
  let timeoutId;
  try {
    await Promise.race([context.resume(), new Promise((_, reject) => { timeoutId = globalThis.setTimeout(() => reject(new Error('Audio could not start. Try again in a regular browser window.')), timeoutMs); })]);
  } finally { globalThis.clearTimeout(timeoutId); }
}

export function voiceParameters(values) {
  const value = (name) => clamp01(values[name]);
  return { droneHz: 146 + value('swellHeight') * 80, windGain: value('windSpeed') * .055, rainDensity: value('precipitation'), pan: value('waveDirection') * 2 - 1, brightness: .3 + value('shortwaveRadiation') * .7 };
}

function ramp(param, value, now, seconds = .15) { param.cancelScheduledValues(now); param.setValueAtTime(Math.max(.0001, param.value), now); param.linearRampToValueAtTime(Math.max(.0001, value), now + seconds); }

export function createSynth() {
  let context = null; let master = null; let timer = null; let motifTimer = null; let started = false; let motifEnabled = false; let values = {}; let masterLevel = .72; let motifIndex = 0;
  const instruments = Object.fromEntries(DATA_INSTRUMENTS.map((instrument) => [instrument.id, { enabled: true, level: .8, last: Number.NEGATIVE_INFINITY }]));

  function tone(frequency, gain, duration, type = 'sine', pan = 0) {
    if (!context || !master || gain <= 0) return;
    const now = context.currentTime; const osc = context.createOscillator(); const env = context.createGain(); const stereo = context.createStereoPanner?.() || context.createGain();
    osc.type = type; osc.frequency.setValueAtTime(Math.max(35, frequency), now); env.gain.setValueAtTime(.0001, now); env.gain.exponentialRampToValueAtTime(Math.max(.0002, gain), now + .012); env.gain.exponentialRampToValueAtTime(.0001, now + duration);
    if ('pan' in stereo) stereo.pan.setValueAtTime(pan, now); osc.connect(env).connect(stereo).connect(master); osc.start(now); osc.stop(now + duration + .04);
  }

  function frequencyFor(instrument, intensity) {
    const base = { swellCello: 110, waveMarimba: 330, foamBells: 660, currentPluck: 280, pressureBass: 72, tideOrgan: 164, seaWarmthPad: 220, windReed: 440, gustHarp: 520, visibilityFlute: 700, cloudChoir: 196, rainDroplets: 880, sunGlass: 990, uvSpark: 1320, airGrain: 310 }[instrument.id];
    return base * (1 + intensity * (instrument.id === 'pressureBass' ? .18 : .65));
  }

  function scheduleDataVoices() {
    if (!context || !started) return;
    const now = context.currentTime;
    DATA_INSTRUMENTS.forEach((instrument) => {
      const state = instruments[instrument.id]; const intensity = clamp01(values[instrument.key]);
      if (!state.enabled || intensity < .015 || now - state.last < instrument.interval / 1000) return;
      const longVoice = ['swellCello', 'tideOrgan', 'seaWarmthPad', 'cloudChoir'].includes(instrument.id);
      tone(frequencyFor(instrument, intensity), (.018 + intensity * .076) * state.level, longVoice ? 1.15 : .24 + intensity * .4, instrument.type, (clamp01(values.waveDirection) * 2 - 1) * .7);
      state.last = now;
    });
  }

  function confirmationTone() {
    tone(440, .075, .16, 'triangle', -.18);
    tone(660, .045, .22, 'sine', .18);
  }

  function motifStepMs() { return 270 - clamp01(values.shortwaveRadiation) * 55 + clamp01(values.precipitation) * 35; }

  function queueMotifStep(delayMs = 0) {
    motifTimer = window.setTimeout(() => {
      if (!started || !motifEnabled) return;
      const step = MOTIF_STEPS[motifIndex % MOTIF_STEPS.length]; motifIndex += 1;
      const stepMs = motifStepMs();
      if (step.note) {
        const duration = Math.min(1.15, Math.max(.28, step.beats * stepMs * .001 * .86));
        const weatherLift = 1 + clamp01(values.seaTemp) * .08;
        tone(NOTE_HZ[step.note] * weatherLift, .105, duration, 'triangle', .3);
        tone(NOTE_HZ[step.note] * 1.5, .042, Math.min(.55, duration * .72), 'sine', -.12);
        tone(NOTE_HZ[step.note] * .5, .025, Math.min(1.1, duration * 1.05), 'sine', -.28);
      }
      queueMotifStep(step.beats * stepMs);
    }, delayMs);
  }

  function startMotif() {
    if (!started || motifTimer) return;
    motifIndex = 0;
    queueMotifStep(0);
  }

  function stopMotif() { if (motifTimer) window.clearTimeout(motifTimer); motifTimer = null; motifIndex = 0; }

  return {
    async start() { if (!context) { const AudioContextClass = window.AudioContext || window.webkitAudioContext; if (!AudioContextClass) throw new Error('This browser does not support Web Audio.'); context = new AudioContextClass(); master = context.createGain(); master.connect(context.destination); } await resumeAudioContext(context); started = true; Object.values(instruments).forEach((instrument) => { instrument.last = Number.NEGATIVE_INFINITY; }); ramp(master.gain, masterLevel * .54, context.currentTime, .12); confirmationTone(); scheduleDataVoices(); if (!timer) timer = window.setInterval(scheduleDataVoices, 80); if (motifEnabled) startMotif(); },
    update(nextValues) { values = { ...nextValues }; },
    setMaster(level) { masterLevel = clamp01(level); if (context && master) ramp(master.gain, masterLevel * .54, context.currentTime); },
    setInstrument(id, patch) { if (instruments[id]) Object.assign(instruments[id], patch); },
    playManual(name, note) { const instrument = MANUAL_INSTRUMENTS[name]; if (!started || !instrument || !NOTE_HZ[note]) return false; tone(NOTE_HZ[note] * instrument.octave, name === 'bass' ? .15 : .1, instrument.duration, instrument.type, name === 'bass' ? -.2 : .2); if (name === 'pad') tone(NOTE_HZ[note] * instrument.octave * 1.498, .055, instrument.duration, instrument.type, -.2); return true; },
    setMotif(enabled) { motifEnabled = Boolean(enabled); if (motifEnabled) startMotif(); else stopMotif(); },
    async stop() { started = false; stopMotif(); if (timer) window.clearInterval(timer); timer = null; if (context) await context.close(); context = null; master = null; },
    getState() { return { started, instruments: structuredClone(instruments) }; },
  };
}
