import assert from 'node:assert/strict';
import test from 'node:test';
import { DATA_INSTRUMENTS, MANUAL_INSTRUMENTS, MOTIF_NOTES, MOTIF_STEPS, createSynth, resumeAudioContext, voiceParameters } from '../src/synth.js';

test('active weather raises core voice energy and changes stereo direction', () => {
  const calm = voiceParameters({
    swellHeight: 0,
    waveHeight: 0,
    wavePeriod: 0,
    windSpeed: 0,
    precipitation: 0,
    seaLevel: 0,
    shortwaveRadiation: 0,
    ozone: 0,
    waveDirection: 0,
  });
  const active = voiceParameters({
    swellHeight: 1,
    waveHeight: 1,
    wavePeriod: 1,
    windSpeed: 1,
    precipitation: 1,
    seaLevel: 1,
    shortwaveRadiation: 1,
    ozone: 1,
    waveDirection: 1,
  });

  assert.ok(active.droneHz > calm.droneHz);
  assert.ok(active.windGain > calm.windGain);
  assert.ok(active.rainDensity > calm.rainDensity);
  assert.equal(calm.pan, -1);
  assert.equal(active.pan, 1);
});

test('audio resume rejects instead of leaving the start control pending forever', async () => {
  const stalledContext = { resume: () => new Promise(() => {}) };

  await assert.rejects(resumeAudioContext(stalledContext, 5), /Audio could not start/);
});

test('full desktop instrument inventory and blue-night motif are available in the browser', () => {
  assert.equal(DATA_INSTRUMENTS.length, 15);
  assert.deepEqual(DATA_INSTRUMENTS.map((instrument) => instrument.id), [
    'swellCello', 'waveMarimba', 'foamBells', 'currentPluck', 'pressureBass',
    'tideOrgan', 'seaWarmthPad', 'windReed', 'gustHarp', 'visibilityFlute',
    'cloudChoir', 'rainDroplets', 'sunGlass', 'uvSpark', 'airGrain',
  ]);
  assert.deepEqual(DATA_INSTRUMENTS.map((instrument) => instrument.label), [
    'Swell', 'Wave', 'Foam', 'Current', 'Pressure',
    'Tide', 'Sea Temp', 'Wind', 'Gust', 'Visibility',
    'Cloud', 'Rain', 'Sun', 'UV', 'Air',
  ]);
  assert.deepEqual(Object.keys(MANUAL_INSTRUMENTS), ['pluck', 'bass', 'bell', 'pad']);
  assert.ok(MOTIF_NOTES.length > 8);
});

test('blue-night motif treats holds as extended notes and parenthesized notes as eighths', () => {
  assert.deepEqual(MOTIF_NOTES, ['C', 'D', 'A', 'G', 'F', 'C+', 'F', 'F', 'D+', 'D+', 'C+', 'Bb', 'D+', 'C+']);
  assert.deepEqual(MOTIF_STEPS.map(({ note, beats }) => [note, beats]), [
    ['C', 2],
    ['D', 2],
    ['A', 6],
    ['G', 1],
    ['F', 1],
    ['C+', 6],
    ['F', 1],
    ['F', 1],
    ['D+', 4],
    ['D+', 1],
    ['C+', 1],
    ['Bb', 1],
    ['D+', 1],
    ['C+', 6],
  ]);
  assert.equal(MOTIF_STEPS.reduce((sum, step) => sum + step.beats, 0), 34);
});

test('starting the synth immediately schedules an audible confirmation tone', async () => {
  let oscillatorStarts = 0;
  const originalWindow = globalThis.window;
  const makeParam = () => ({
    value: 1,
    cancelScheduledValues() {},
    setValueAtTime(value) { this.value = value; },
    linearRampToValueAtTime(value) { this.value = value; },
    exponentialRampToValueAtTime(value) { this.value = value; },
  });
  const makeNode = () => ({ connect(target) { return target; } });

  class FakeAudioContext {
    constructor() {
      this.currentTime = 0;
      this.destination = makeNode();
    }
    resume() { return Promise.resolve(); }
    close() { return Promise.resolve(); }
    createGain() { return { ...makeNode(), gain: makeParam() }; }
    createStereoPanner() { return { ...makeNode(), pan: makeParam() }; }
    createOscillator() {
      return {
        ...makeNode(),
        frequency: makeParam(),
        start() { oscillatorStarts += 1; },
        stop() {},
      };
    }
  }

  globalThis.window = {
    AudioContext: FakeAudioContext,
    setInterval: globalThis.setInterval,
    clearInterval: globalThis.clearInterval,
  };

  try {
    const synth = createSynth();
    synth.update({ waveDirection: 0.5, swellHeight: 0.5 });
    await synth.start();
    await synth.stop();
  } finally {
    globalThis.window = originalWindow;
  }

  assert.ok(oscillatorStarts > 0);
});

test('blue-night motif starts after audio even when toggled before start', async () => {
  let scheduledIntervals = 0;
  const originalWindow = globalThis.window;
  const makeParam = () => ({
    value: 1,
    cancelScheduledValues() {},
    setValueAtTime(value) { this.value = value; },
    linearRampToValueAtTime(value) { this.value = value; },
    exponentialRampToValueAtTime(value) { this.value = value; },
  });
  const makeNode = () => ({ connect(target) { return target; } });

  class FakeAudioContext {
    constructor() {
      this.currentTime = 0;
      this.destination = makeNode();
    }
    resume() { return Promise.resolve(); }
    close() { return Promise.resolve(); }
    createGain() { return { ...makeNode(), gain: makeParam() }; }
    createStereoPanner() { return { ...makeNode(), pan: makeParam() }; }
    createOscillator() {
      return {
        ...makeNode(),
        frequency: makeParam(),
        start() {},
        stop() {},
      };
    }
  }

  globalThis.window = {
    AudioContext: FakeAudioContext,
    setInterval() {
      scheduledIntervals += 1;
      return scheduledIntervals;
    },
    setTimeout() {
      scheduledIntervals += 1;
      return scheduledIntervals;
    },
    clearInterval() {},
    clearTimeout() {},
  };

  try {
    const synth = createSynth();
    DATA_INSTRUMENTS.forEach((instrument) => synth.setInstrument(instrument.id, { enabled: false }));
    synth.setMotif(true);
    await synth.start();
    await synth.stop();
  } finally {
    globalThis.window = originalWindow;
  }

  assert.equal(scheduledIntervals, 2);
});

test('default master output is intentionally louder than the prototype', async () => {
  let peakMasterGain = 0;
  const originalWindow = globalThis.window;
  const makeParam = (onValue = () => {}) => ({
    value: 1,
    cancelScheduledValues() {},
    setValueAtTime(value) { this.value = value; onValue(value); },
    linearRampToValueAtTime(value) { this.value = value; onValue(value); },
    exponentialRampToValueAtTime(value) { this.value = value; onValue(value); },
  });
  const makeNode = () => ({ connect(target) { return target; } });

  class FakeAudioContext {
    constructor() {
      this.currentTime = 0;
      this.destination = makeNode();
    }
    resume() { return Promise.resolve(); }
    close() { return Promise.resolve(); }
    createGain() {
      return {
        ...makeNode(),
        gain: makeParam((value) => { peakMasterGain = Math.max(peakMasterGain, value); }),
      };
    }
    createStereoPanner() { return { ...makeNode(), pan: makeParam() }; }
    createOscillator() {
      return {
        ...makeNode(),
        frequency: makeParam(),
        start() {},
        stop() {},
      };
    }
  }

  globalThis.window = {
    AudioContext: FakeAudioContext,
    setInterval: globalThis.setInterval,
    clearInterval: globalThis.clearInterval,
  };

  try {
    const synth = createSynth();
    await synth.start();
    await synth.stop();
  } finally {
    globalThis.window = originalWindow;
  }

  assert.ok(peakMasterGain >= 0.4);
});
