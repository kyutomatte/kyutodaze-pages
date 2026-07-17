import assert from 'node:assert/strict';
import test from 'node:test';
import { clamp01, resolveVideoState, DEFAULT_VALUES, fetchJejuWeather } from '../src/weather.js';

test('normalized values never escape zero through one', () => {
  assert.equal(clamp01(-1), 0);
  assert.equal(clamp01(0.4), 0.4);
  assert.equal(clamp01(2), 1);
});

test('rain has priority over cloud and preserves night', () => {
  assert.equal(resolveVideoState({ precipitation: 0.01, cloudCover: 20, isDay: 0 }), 'rainy_night');
});

test('cloud threshold chooses cloudy otherwise sunny', () => {
  assert.equal(resolveVideoState({ precipitation: 0, cloudCover: 60, isDay: 1 }), 'cloudy_day');
  assert.equal(resolveVideoState({ precipitation: 0, cloudCover: 59, isDay: 1 }), 'sunny_day');
});

test('fallback is a bounded sunny-day payload', () => {
  assert.equal(DEFAULT_VALUES.videoState, 'sunny_day');
  assert.ok(Object.values(DEFAULT_VALUES.values).every((value) => value >= 0 && value <= 1));
});

test('live weather still drives gauges when a secondary endpoint fails', async () => {
  const fetchImpl = async (url) => {
    if (String(url).includes('marine-api')) return { ok: false, json: async () => ({}) };
    if (String(url).includes('air-quality-api')) {
      return {
        ok: true,
        json: async () => ({ current: { pm2_5: 12, ozone: 90 } }),
      };
    }

    return {
      ok: true,
      json: async () => ({
        current: {
          cloud_cover: 75,
          wind_speed_10m: 9,
          pressure_msl: 1010,
          precipitation: 0,
          weather_code: 3,
          is_day: 1,
          shortwave_radiation: 400,
          uv_index: 6,
          apparent_temperature: 22,
          relative_humidity_2m: 65,
          wind_direction_10m: 180,
          wind_gusts_10m: 20,
          visibility: 15000,
          sunshine_duration: 1800,
        },
      }),
    };
  };

  const payload = await fetchJejuWeather(fetchImpl);

  assert.equal(payload.source, 'live-partial');
  assert.equal(payload.videoState, 'cloudy_day');
  assert.equal(payload.values.cloudCover, 0.75);
  assert.equal(payload.values.windSpeed, 0.5);
  assert.equal(payload.values.swellHeight, DEFAULT_VALUES.values.swellHeight);
});
