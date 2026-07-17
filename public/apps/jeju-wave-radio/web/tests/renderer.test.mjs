import assert from 'node:assert/strict';
import test from 'node:test';
import { VIDEO_SOURCES, getAspectLayout, isKnownState } from '../src/renderer.js';

test('renderer maps the exact six weather states to local MP4 files', () => {
  assert.deepEqual(Object.keys(VIDEO_SOURCES).sort(), [
    'cloudy_day',
    'cloudy_night',
    'rainy_day',
    'rainy_night',
    'sunny_day',
    'sunny_night',
  ]);
  assert.equal(VIDEO_SOURCES.sunny_day, '../assets/video/sunny_day.mp4');
  assert.equal(isKnownState('storm'), false);
});

test('portrait video uses black side space for contain and a centered crop for cover', () => {
  assert.deepEqual(getAspectLayout(9 / 16, 16 / 9, 'contain'), { mode: 'contain', x: 0.316, y: 1 });
  assert.deepEqual(getAspectLayout(9 / 16, 16 / 9, 'cover'), { mode: 'cover', x: 1, y: 0.316 });
});
