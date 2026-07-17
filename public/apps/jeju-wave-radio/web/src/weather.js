const JEJU = Object.freeze({ latitude: 33.2539, longitude: 126.5601, timezone: 'Asia/Seoul' });

export const VIDEO_STATES = Object.freeze([
  'sunny_day',
  'sunny_night',
  'cloudy_day',
  'cloudy_night',
  'rainy_day',
  'rainy_night',
]);

export const clamp01 = (value) => Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
const normalize = (value, low, high) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? clamp01((numeric - low) / (high - low)) : Number.NaN;
};

export const DEFAULT_VALUES = Object.freeze({
  videoState: 'sunny_day',
  source: 'fallback',
  updatedAt: null,
  values: Object.freeze({
    swellHeight: 0.32,
    swellPeriod: 0.52,
    waveHeight: 0.48,
    wavePeriod: 0.5,
    waveDirection: 0.5,
    seaTemp: 0.78,
    cloudCover: 0.18,
    windSpeed: 0.34,
    pressure: 0.56,
    precipitation: 0.12,
    pm25: 0.08,
    ozone: 0.52,
    shortwaveRadiation: 0.55,
    uvIndex: 0.45,
    seaLevel: 0.5,
    currentVelocity: 0.3,
    apparentTemperature: 0.72,
    relativeHumidity: 0.55,
    windDirection: 0.5,
    windGusts: 0.25,
    visibility: 0.65,
    sunshineDuration: 0.5,
    currentDirection: 0.5,
  }),
});

export const resolveVideoState = ({ precipitation, cloudCover, isDay, weatherCode = 0 }) => {
  const suffix = isDay ? 'day' : 'night';
  const rainCodes = new Set([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 71, 73, 75, 77, 80, 81, 82, 85, 86, 95, 96, 99]);

  if (Number(precipitation) > 0 || rainCodes.has(Number(weatherCode))) return `rainy_${suffix}`;
  return `${Number(cloudCover) >= 60 || [3, 45, 48].includes(Number(weatherCode)) ? 'cloudy' : 'sunny'}_${suffix}`;
};

function buildUrl(base, current) {
  const query = new URLSearchParams({
    latitude: String(JEJU.latitude),
    longitude: String(JEJU.longitude),
    current,
    timezone: JEJU.timezone,
  });
  return `${base}?${query}`;
}

function valueOf(payload, key) {
  return payload?.current?.[key];
}

function normalizeValues(weather, marine, air) {
  return {
    swellHeight: normalize(valueOf(marine, 'swell_wave_height'), 0, 4),
    swellPeriod: normalize(valueOf(marine, 'swell_wave_period'), 2, 16),
    waveHeight: normalize(valueOf(marine, 'wave_height'), 0, 4),
    wavePeriod: normalize(valueOf(marine, 'wave_period'), 2, 14),
    waveDirection: normalize(valueOf(marine, 'wave_direction'), 0, 360),
    seaTemp: normalize(valueOf(marine, 'sea_surface_temperature'), 8, 30),
    cloudCover: normalize(valueOf(weather, 'cloud_cover'), 0, 100),
    windSpeed: normalize(valueOf(weather, 'wind_speed_10m'), 0, 18),
    pressure: normalize(valueOf(weather, 'pressure_msl'), 980, 1040),
    precipitation: normalize(valueOf(weather, 'precipitation'), 0, 8),
    pm25: normalize(valueOf(air, 'pm2_5'), 0, 75),
    ozone: normalize(valueOf(air, 'ozone'), 0, 180),
    shortwaveRadiation: normalize(valueOf(weather, 'shortwave_radiation'), 0, 800),
    uvIndex: normalize(valueOf(weather, 'uv_index'), 0, 11),
    seaLevel: normalize(valueOf(marine, 'sea_level_height_msl'), -1, 1),
    currentVelocity: normalize(valueOf(marine, 'ocean_current_velocity'), 0, 2),
    apparentTemperature: normalize(valueOf(weather, 'apparent_temperature'), 0, 35),
    relativeHumidity: normalize(valueOf(weather, 'relative_humidity_2m'), 0, 100),
    windDirection: normalize(valueOf(weather, 'wind_direction_10m'), 0, 360),
    windGusts: normalize(valueOf(weather, 'wind_gusts_10m'), 0, 40),
    visibility: normalize(valueOf(weather, 'visibility'), 0, 30000),
    sunshineDuration: normalize(valueOf(weather, 'sunshine_duration'), 0, 3600),
    currentDirection: normalize(valueOf(marine, 'ocean_current_direction'), 0, 360),
  };
}

async function readEndpoint(fetchImpl, url) {
  const response = await fetchImpl(url);
  if (!response.ok) throw new Error(`Open-Meteo ${new URL(url).hostname} response was not OK`);
  return response.json();
}

function mergeLiveValues(weather, marine, air) {
  const normalized = normalizeValues(weather, marine, air);
  return Object.fromEntries(
    Object.entries(DEFAULT_VALUES.values).map(([key, fallback]) => {
      const value = normalized[key];
      return [key, Number.isFinite(value) ? value : fallback];
    }),
  );
}

export async function fetchJejuWeather(fetchImpl = fetch) {
  const weatherUrl = buildUrl(
    'https://api.open-meteo.com/v1/forecast',
    'cloud_cover,wind_speed_10m,pressure_msl,precipitation,weather_code,is_day,shortwave_radiation,uv_index,apparent_temperature,relative_humidity_2m,wind_direction_10m,wind_gusts_10m,visibility,sunshine_duration',
  );
  const marineUrl = buildUrl(
    'https://marine-api.open-meteo.com/v1/marine',
    'swell_wave_height,swell_wave_period,wave_height,wave_period,wave_direction,sea_surface_temperature,sea_level_height_msl,ocean_current_velocity,ocean_current_direction',
  );
  const airUrl = buildUrl('https://air-quality-api.open-meteo.com/v1/air-quality', 'pm2_5,ozone');

  try {
    const [weatherResult, marineResult, airResult] = await Promise.allSettled([
      readEndpoint(fetchImpl, weatherUrl),
      readEndpoint(fetchImpl, marineUrl),
      readEndpoint(fetchImpl, airUrl),
    ]);

    const weather = weatherResult.status === 'fulfilled' ? weatherResult.value : null;
    const marine = marineResult.status === 'fulfilled' ? marineResult.value : null;
    const air = airResult.status === 'fulfilled' ? airResult.value : null;
    const liveCount = [weather, marine, air].filter(Boolean).length;

    if (liveCount === 0) throw new Error('Open-Meteo responses were unavailable');

    const values = mergeLiveValues(weather, marine, air);
    const videoState = weather
      ? resolveVideoState({
        precipitation: valueOf(weather, 'precipitation'),
        cloudCover: valueOf(weather, 'cloud_cover'),
        isDay: valueOf(weather, 'is_day'),
        weatherCode: valueOf(weather, 'weather_code'),
      })
      : DEFAULT_VALUES.videoState;

    return { values, videoState, source: liveCount === 3 ? 'live' : 'live-partial', updatedAt: new Date().toISOString() };
  } catch (error) {
    return {
      ...DEFAULT_VALUES,
      values: { ...DEFAULT_VALUES.values },
      error: error instanceof Error ? error.message : 'Live weather is unavailable',
    };
  }
}
