const SOURCE_IMAGE_URL = "/assets/hero_bg.webp";
const POINT_DATA_URL = "/assets/bead-curtain-points.bin";
const POINT_FLOATS = 8;
const SAMPLE_STEP = 7;
const MAX_TRAIL_POINTS = 72;
const DESKTOP_PIXEL_RATIO_CAP = 1.5;
const MOBILE_PIXEL_RATIO_CAP = 1.25;
const TRAIL_LINGER_SECONDS = 4.0;
const TRAIL_POINT_MIN_DISTANCE = 0.006;
const SHOCK_WIND_DELAY_SECONDS = 0.12;
const SHOCK_RAMP_SECONDS = 0.68;
const SHOCK_WHITE_IN_SECONDS = 2.22;
const SHOCK_HOLD_SECONDS = 1.45;
const SHOCK_FADE_SECONDS = 0.88;
const SHOCK_TOTAL_SECONDS = SHOCK_WHITE_IN_SECONDS + SHOCK_HOLD_SECONDS + SHOCK_FADE_SECONDS;
const BEAD_CURTAIN_BOUNDS = [-0.5, 0.5, -0.99, 0.99];

const SPLAT_VERTEX_SHADER = `
attribute vec2 pointPosition;
attribute vec3 pointColor;
attribute float curtainMask;
attribute float phase;
attribute float pointSize;

uniform float uTime;
uniform float uAspect;
uniform float uPointScale;
uniform vec2 uShockCenter;
uniform float uShockStrength;
uniform float uSceneZoom;
uniform float uBlackTunnel;
const int MAX_TRAIL_POINTS = ${MAX_TRAIL_POINTS};
uniform int uTrailCount;
uniform vec2 uTrailMouse[MAX_TRAIL_POINTS];
uniform float uTrailAge[MAX_TRAIL_POINTS];

varying vec3 vColor;
varying float vCurtainMask;

void main()
{
    vec2 pos = pointPosition;
    float topAnchor = 1.0 - smoothstep(0.66, 0.98, pointPosition.y);
    float accumulatedSway = 0.0;
    float accumulatedYOffset = 0.0;
    float accumulatedDepth = 0.0;

    for (int i = 0; i < MAX_TRAIL_POINTS; ++i) {
        if (i >= uTrailCount) {
            break;
        }

        vec2 trailMouse = uTrailMouse[i];
        float trailAge = uTrailAge[i];
        float trailFade = exp(-trailAge * 0.55);
        float horizontalDelta = (pointPosition.x - trailMouse.x) * uAspect;
        float stringFalloff = exp(-horizontalDelta * horizontalDelta * 320.0) * curtainMask;
        float verticalDistance = max(0.0, trailMouse.y - pointPosition.y);
        float belowMouse = smoothstep(-0.08, 0.58, verticalDistance);
        float topTouchDamp = 1.0 - smoothstep(0.38, 0.96, trailMouse.y) * 0.58;
        float upperTouchLowerBoost = smoothstep(0.30, 0.94, trailMouse.y) * smoothstep(0.08, 1.18, verticalDistance);
        float propagation = smoothstep(-0.12, 0.34, trailAge * 1.05 - verticalDistance);
        float contactPulse = exp(-pow((pointPosition.y - trailMouse.y) * 3.0, 2.0)) * 0.22;
        float waveDownString = sin(uTime * 3.2 + phase * 0.08 - verticalDistance * 3.8 - trailAge * 1.2);
        float delayedWave = sin(uTime * 2.1 + phase * 0.05 - verticalDistance * 5.2 - trailAge * 0.8);
        float returnWave = sin(uTime * 1.3 + phase * 0.05 + pointPosition.y * 2.6 - trailAge * 0.5);
        float gravitySettle = (1.0 - exp(-trailAge * 1.45)) * exp(-trailAge * 0.62);
        float stringMotion = stringFalloff * topAnchor * topTouchDamp * trailFade * 0.74
            * (0.10 + belowMouse * 0.30 + propagation * 0.42 + contactPulse + upperTouchLowerBoost * 0.42);
        float sway = (waveDownString * 0.020 + delayedWave * 0.010 + returnWave * 0.004) * stringMotion;

        accumulatedSway += sway;
        accumulatedYOffset += cos(uTime * 2.8 + phase * 0.12 + pointPosition.y * 3.8 - trailAge) * 0.002 * stringMotion;
        accumulatedYOffset -= gravitySettle * stringFalloff * topAnchor * belowMouse * 0.020;
        accumulatedDepth += waveDownString * 0.018 * stringMotion;
    }

    pos.x += accumulatedSway;
    pos.y += accumulatedYOffset;
    float depthLift = accumulatedDepth;

    vec2 shockDelta = pointPosition - uShockCenter;
    float radialDistance = length(vec2(shockDelta.x * uAspect, shockDelta.y * 0.90));
    float radialContact = exp(-radialDistance * radialDistance * 6.2) * curtainMask;
    float radialRing = exp(-pow(radialDistance - 0.22, 2.0) * 90.0) * curtainMask;
    float shockHorizontal = abs(shockDelta.x * uAspect);
    float fanVertical = clamp(uShockCenter.y - pointPosition.y, 0.0, 1.65);
    float fanWidth = mix(0.18, 1.02, smoothstep(0.00, 1.18, fanVertical));
    float fanMask = exp(-pow(shockHorizontal / max(fanWidth, 0.001), 2.0) * 1.45)
        * smoothstep(-0.02, 1.45, fanVertical) * curtainMask;
    float fanDirection = clamp((shockDelta.x * uAspect) / max(fanWidth, 0.001), -1.0, 1.0);
    fanDirection = sign(fanDirection + 0.001) * smoothstep(0.02, 0.20, abs(fanDirection));
    float downstreamCurtain = fanMask * (0.52 + fanVertical * 0.34);
    vec2 radialDirection = normalize(vec2(shockDelta.x * uAspect, shockDelta.y * 0.90) + vec2(0.001, 0.001));
    float ringImpulse = radialRing * uShockStrength * 0.18;
    float heightRipple = sin((pointPosition.y - uShockCenter.y) * 7.0 + uTime * 4.0 + phase * 0.05);
    float fanSpread = fanMask * (0.085 + fanVertical * fanVertical * 0.45 + radialContact * 0.20) * uShockStrength;
    float fanBend = sin(fanVertical * 2.15 + phase * 0.035 + uTime * 1.65) * fanMask * uShockStrength * 0.014;
    float windEnvelope = (radialContact * 0.22 + downstreamCurtain * 0.60) * uShockStrength + fanSpread * 0.46;
    float verticalColumnImpulse = fanDirection * fanSpread * 0.11 + fanBend;
    pos += radialDirection * ringImpulse * 0.020;
    pos.x += fanDirection * fanSpread;
    pos.x += verticalColumnImpulse;
    pos.x += heightRipple * windEnvelope * 0.010;
    pos.y -= fanSpread * 0.10 + downstreamCurtain * uShockStrength * 0.022;
    depthLift += windEnvelope * 0.20 + fanSpread * 0.30 + ringImpulse * 0.08;

    vec2 tunnelVector = uShockCenter - pos;
    float tunnelPull = uBlackTunnel * curtainMask * (0.15 + radialContact * 0.25 + downstreamCurtain * 0.60);
    pos += tunnelVector * tunnelPull * 0.26;
    depthLift -= tunnelPull * 0.34;

    vec2 zoomedPos = uShockCenter + (pos - uShockCenter) * uSceneZoom;
    gl_Position = vec4(zoomedPos, depthLift, 1.0);
    gl_PointSize = pointSize * uPointScale;

    vColor = pointColor * 1.24;
    vCurtainMask = curtainMask;
}
`;

const SPLAT_FRAGMENT_SHADER = `
precision mediump float;
varying vec3 vColor;
varying float vCurtainMask;

uniform float softness;
uniform vec3 uClockLight;
uniform float uBeadBrightness;
uniform float uShockEmission;

void main()
{
    float d = length(gl_PointCoord - 0.5);
    float alpha = exp(-d * d * softness);
    float edgeFade = smoothstep(0.52, 0.08, d);
    float beadDensity = mix(0.42, 0.78, vCurtainMask);
    vec2 spriteNormalXY = gl_PointCoord - 0.5;
    vec3 beadNormal = normalize(vec3(spriteNormalXY * 1.35, 0.42));
    vec3 lightDirection = normalize(vec3(uClockLight.xy, 0.68));
    float clockLightAmount = max(dot(beadNormal, lightDirection), 0.0) * uClockLight.z * vCurtainMask;
    vec3 color = vColor * (uBeadBrightness + alpha * 0.07 + clockLightAmount);
    color += vec3(1.0, 0.78, 0.42) * uShockEmission * vCurtainMask;
    float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));
    float saturationBoost = 1.32;
    color = mix(vec3(luma), color, saturationBoost);
    gl_FragColor = vec4(color, alpha * edgeFade * beadDensity);
}
`;

const BACKGROUND_VERTEX_SHADER = `
attribute vec2 quadPosition;
attribute vec2 quadUV;

uniform vec2 uShockCenter;
uniform float uSceneZoom;

varying vec2 vUV;

void main()
{
    vUV = quadUV;
    vec2 zoomedPosition = uShockCenter + (quadPosition - uShockCenter) * uSceneZoom;
    gl_Position = vec4(zoomedPosition, 0.0, 1.0);
}
`;

const BACKGROUND_FRAGMENT_SHADER = `
precision mediump float;
varying vec2 vUV;

uniform sampler2D uBackgroundTexture;

void main()
{
    vec3 source = texture2D(uBackgroundTexture, vUV).rgb;
    float ndcX = vUV.x * 2.0 - 1.0;
    float ndcY = 1.0 - vUV.y * 2.0;
    float curtainX = step(-0.455, ndcX) * (1.0 - step(0.50, ndcX));
    float curtainY = step(-0.99, ndcY) * (1.0 - step(0.99, ndcY));
    float curtainCutout = curtainX * curtainY;
    if (curtainCutout > 0.5) {
        discard;
    }
    gl_FragColor = vec4(source, 1.0);
}
`;

const WHITEOUT_VERTEX_SHADER = `
attribute vec2 quadPosition;

void main()
{
    gl_Position = vec4(quadPosition, 0.0, 1.0);
}
`;

const WHITEOUT_FRAGMENT_SHADER = `
precision mediump float;
uniform float uWhiteAlpha;

void main()
{
    gl_FragColor = vec4(1.0, 1.0, 1.0, uWhiteAlpha);
}
`;

function createShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(message || "Unable to compile WebGL shader");
  }

  return shader;
}

function createProgram(gl, vertexSource, fragmentSource) {
  const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexSource);
  const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
  const program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  gl.deleteShader(vertexShader);
  gl.deleteShader(fragmentShader);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const message = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error(message || "Unable to link WebGL program");
  }

  return program;
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Unable to load ${src}`));
    image.src = src;
  });
}

async function fetchPointData(src) {
  const response = await fetch(src);
  if (!response.ok) throw new Error(`Unable to load ${src}`);
  return new Float32Array(await response.arrayBuffer());
}

function createTexture(gl, image) {
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
  gl.bindTexture(gl.TEXTURE_2D, null);
  return texture;
}

function createArrayBuffer(gl, values) {
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, values, gl.STATIC_DRAW);
  return buffer;
}

function bindPointAttributes(gl, program, pointBuffer) {
  const stride = POINT_FLOATS * Float32Array.BYTES_PER_ELEMENT;
  const attributes = [
    ["pointPosition", 2, 0],
    ["pointColor", 3, 2],
    ["curtainMask", 1, 5],
    ["phase", 1, 6],
    ["pointSize", 1, 7]
  ];

  gl.bindBuffer(gl.ARRAY_BUFFER, pointBuffer);
  for (const [name, size, offset] of attributes) {
    const location = gl.getAttribLocation(program, name);
    if (location < 0) continue;
    gl.enableVertexAttribArray(location);
    gl.vertexAttribPointer(location, size, gl.FLOAT, false, stride, offset * Float32Array.BYTES_PER_ELEMENT);
  }
}

function bindQuadAttributes(gl, program, quadBuffer, withUv = true) {
  gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
  const positionLocation = gl.getAttribLocation(program, "quadPosition");
  gl.enableVertexAttribArray(positionLocation);
  gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, withUv ? 16 : 8, 0);

  if (withUv) {
    const uvLocation = gl.getAttribLocation(program, "quadUV");
    gl.enableVertexAttribArray(uvLocation);
    gl.vertexAttribPointer(uvLocation, 2, gl.FLOAT, false, 16, 8);
  }
}

function cursorPositionToWorld(event, canvas) {
  const rect = canvas.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return [0, 0];
  return [
    ((event.clientX - rect.left) / rect.width) * 2 - 1,
    1 - ((event.clientY - rect.top) / rect.height) * 2
  ];
}

function updateMouseTrail(trail, cursor, now) {
  const recent = trail.filter((point) => now - point.time <= TRAIL_LINGER_SECONDS);
  const last = recent[recent.length - 1];
  const shouldAppend =
    !last ||
    Math.hypot(cursor[0] - last.x, cursor[1] - last.y) >= TRAIL_POINT_MIN_DISTANCE ||
    now - last.time >= 0.12;

  if (shouldAppend) {
    recent.push({ x: cursor[0], y: cursor[1], time: now });
  }

  return recent.slice(-MAX_TRAIL_POINTS);
}

function buildTrailUniforms(trail, now) {
  const positions = new Float32Array(MAX_TRAIL_POINTS * 2);
  const ages = new Float32Array(MAX_TRAIL_POINTS);
  const active = trail.filter((point) => now - point.time >= 0 && now - point.time <= TRAIL_LINGER_SECONDS);

  active.forEach((point, index) => {
    positions[index * 2] = point.x;
    positions[index * 2 + 1] = point.y;
    ages[index] = Math.max(0, now - point.time);
  });

  return { positions, ages, count: active.length };
}

function smoothstep(edge0, edge1, value) {
  const t = Math.min(Math.max((value - edge0) / (edge1 - edge0), 0), 1);
  return t * t * (3 - 2 * t);
}

function computeShockState(age) {
  if (age == null || age < 0 || age >= SHOCK_TOTAL_SECONDS) {
    return { shockStrength: 0, shockEmission: 0, sceneZoom: 1, blackTunnel: 0, whiteAlpha: 0 };
  }

  const windAge = Math.max(0, age - SHOCK_WIND_DELAY_SECONDS);
  const ramp = smoothstep(0, SHOCK_RAMP_SECONDS, windAge);
  const settle = 1 - smoothstep(1.86, 2.78, age);
  const shockStrength = ramp * settle * 0.86;
  const emissionRamp = smoothstep(1.05, SHOCK_WHITE_IN_SECONDS, age);
  const emissionFade = 1 - smoothstep(1.55, 2.8, age);
  const shockEmission = emissionRamp * emissionFade * 2.55;
  const blackTunnel = smoothstep(0.42, SHOCK_WHITE_IN_SECONDS, age) * (1 - smoothstep(2.78, SHOCK_TOTAL_SECONDS, age));
  const sceneZoom = 1 + blackTunnel * 0.9;
  let whiteAlpha = 0;

  if (age < SHOCK_WHITE_IN_SECONDS) {
    whiteAlpha = smoothstep(1.24, SHOCK_WHITE_IN_SECONDS, age);
  } else if (age < SHOCK_WHITE_IN_SECONDS + SHOCK_HOLD_SECONDS) {
    whiteAlpha = 1;
  } else {
    const fadeAge = age - SHOCK_WHITE_IN_SECONDS - SHOCK_HOLD_SECONDS;
    whiteAlpha = 1 - smoothstep(0, SHOCK_FADE_SECONDS, fadeAge);
  }

  return {
    shockStrength,
    shockEmission,
    sceneZoom,
    blackTunnel,
    whiteAlpha: Math.min(Math.max(whiteAlpha, 0), 1)
  };
}

function computeClockLight() {
  const now = new Date();
  const secondsOfDay = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
  const dayPhase = (secondsOfDay % 86400) / 86400;
  const sunAngle = (dayPhase - 0.5) * Math.PI;
  const daylight = Math.max(0, Math.sin(dayPhase * Math.PI));
  return new Float32Array([
    Math.sin(sunAngle),
    Math.cos(sunAngle) * 0.35 + 0.2,
    0.055 + daylight * 0.07
  ]);
}

function setUniform(gl, location, setter) {
  if (location != null) setter(location);
}

export function initHeroWebgl(canvas) {
  if (!canvas) return null;

  const gl = canvas.getContext("webgl", {
    alpha: false,
    antialias: true,
    premultipliedAlpha: false
  });
  if (!gl) {
    canvas.dataset.webglState = "unsupported";
    return null;
  }

  let animationFrame = 0;
  let disposed = false;
  let pointCount = 0;
  let backgroundTexture = null;
  let pointBuffer = null;
  let trail = [];
  let cursor = [0, 0];
  let shockCenter = [0, 0];
  let shockStartedAt = null;

  const splatProgram = createProgram(gl, SPLAT_VERTEX_SHADER, SPLAT_FRAGMENT_SHADER);
  const backgroundProgram = createProgram(gl, BACKGROUND_VERTEX_SHADER, BACKGROUND_FRAGMENT_SHADER);
  const whiteoutProgram = createProgram(gl, WHITEOUT_VERTEX_SHADER, WHITEOUT_FRAGMENT_SHADER);
  const quadBuffer = createArrayBuffer(
    gl,
    new Float32Array([
      -1, -1, 0, 1,
      1, -1, 1, 1,
      -1, 1, 0, 0,
      1, 1, 1, 0
    ])
  );
  const whiteoutBuffer = createArrayBuffer(gl, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]));

  const splatUniforms = {
    time: gl.getUniformLocation(splatProgram, "uTime"),
    aspect: gl.getUniformLocation(splatProgram, "uAspect"),
    pointScale: gl.getUniformLocation(splatProgram, "uPointScale"),
    shockCenter: gl.getUniformLocation(splatProgram, "uShockCenter"),
    shockStrength: gl.getUniformLocation(splatProgram, "uShockStrength"),
    sceneZoom: gl.getUniformLocation(splatProgram, "uSceneZoom"),
    blackTunnel: gl.getUniformLocation(splatProgram, "uBlackTunnel"),
    trailCount: gl.getUniformLocation(splatProgram, "uTrailCount"),
    trailMouse: gl.getUniformLocation(splatProgram, "uTrailMouse"),
    trailAge: gl.getUniformLocation(splatProgram, "uTrailAge"),
    softness: gl.getUniformLocation(splatProgram, "softness"),
    clockLight: gl.getUniformLocation(splatProgram, "uClockLight"),
    beadBrightness: gl.getUniformLocation(splatProgram, "uBeadBrightness"),
    shockEmission: gl.getUniformLocation(splatProgram, "uShockEmission")
  };
  const backgroundUniforms = {
    shockCenter: gl.getUniformLocation(backgroundProgram, "uShockCenter"),
    sceneZoom: gl.getUniformLocation(backgroundProgram, "uSceneZoom"),
    backgroundTexture: gl.getUniformLocation(backgroundProgram, "uBackgroundTexture")
  };
  const whiteoutUniforms = {
    whiteAlpha: gl.getUniformLocation(whiteoutProgram, "uWhiteAlpha")
  };

  const resize = () => {
    const pixelRatioCap = window.innerWidth < 720 ? MOBILE_PIXEL_RATIO_CAP : DESKTOP_PIXEL_RATIO_CAP;
    const pixelRatio = Math.min(window.devicePixelRatio || 1, pixelRatioCap);
    const width = Math.max(1, Math.round(canvas.clientWidth * pixelRatio));
    const height = Math.max(1, Math.round(canvas.clientHeight * pixelRatio));

    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
  };

  const handlePointerMove = (event) => {
    cursor = cursorPositionToWorld(event, canvas);
    trail = updateMouseTrail(trail, cursor, performance.now() / 1000);
  };

  const handlePointerDown = (event) => {
    cursor = cursorPositionToWorld(event, canvas);
    shockCenter = cursor;
    shockStartedAt = performance.now() / 1000;
    trail = updateMouseTrail(trail, cursor, shockStartedAt);
  };

  canvas.addEventListener("pointermove", handlePointerMove);
  canvas.addEventListener("pointerdown", handlePointerDown);

  const render = () => {
    if (disposed) return;
    resize();

    const now = performance.now() / 1000;
    const shock = computeShockState(shockStartedAt == null ? null : now - shockStartedAt);
    const trailUniforms = buildTrailUniforms(trail, now);
    const aspect = canvas.width / Math.max(canvas.height, 1);
    const pointScale = Math.max(0.72, Math.min(canvas.width / 1200, 1.45));

    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.disable(gl.DEPTH_TEST);

    if (backgroundTexture) {
      gl.useProgram(backgroundProgram);
      bindQuadAttributes(gl, backgroundProgram, quadBuffer);
      setUniform(gl, backgroundUniforms.shockCenter, (location) => gl.uniform2fv(location, shockCenter));
      setUniform(gl, backgroundUniforms.sceneZoom, (location) => gl.uniform1f(location, shock.sceneZoom));
      setUniform(gl, backgroundUniforms.backgroundTexture, (location) => gl.uniform1i(location, 0));
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, backgroundTexture);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    if (pointBuffer && pointCount > 0) {
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.useProgram(splatProgram);
      bindPointAttributes(gl, splatProgram, pointBuffer);
      setUniform(gl, splatUniforms.time, (location) => gl.uniform1f(location, now));
      setUniform(gl, splatUniforms.aspect, (location) => gl.uniform1f(location, aspect));
      setUniform(gl, splatUniforms.pointScale, (location) => gl.uniform1f(location, pointScale));
      setUniform(gl, splatUniforms.shockCenter, (location) => gl.uniform2fv(location, shockCenter));
      setUniform(gl, splatUniforms.shockStrength, (location) => gl.uniform1f(location, shock.shockStrength));
      setUniform(gl, splatUniforms.sceneZoom, (location) => gl.uniform1f(location, shock.sceneZoom));
      setUniform(gl, splatUniforms.blackTunnel, (location) => gl.uniform1f(location, shock.blackTunnel));
      setUniform(gl, splatUniforms.trailCount, (location) => gl.uniform1i(location, trailUniforms.count));
      setUniform(gl, splatUniforms.trailMouse, (location) => gl.uniform2fv(location, trailUniforms.positions));
      setUniform(gl, splatUniforms.trailAge, (location) => gl.uniform1fv(location, trailUniforms.ages));
      setUniform(gl, splatUniforms.softness, (location) => gl.uniform1f(location, 7.6));
      setUniform(gl, splatUniforms.clockLight, (location) => gl.uniform3fv(location, computeClockLight()));
      setUniform(gl, splatUniforms.beadBrightness, (location) => gl.uniform1f(location, 0.98));
      setUniform(gl, splatUniforms.shockEmission, (location) => gl.uniform1f(location, shock.shockEmission));
      gl.drawArrays(gl.POINTS, 0, pointCount);
    }

    if (shock.whiteAlpha > 0.001) {
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.useProgram(whiteoutProgram);
      bindQuadAttributes(gl, whiteoutProgram, whiteoutBuffer, false);
      setUniform(gl, whiteoutUniforms.whiteAlpha, (location) => gl.uniform1f(location, shock.whiteAlpha));
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    animationFrame = requestAnimationFrame(render);
  };

  Promise.all([loadImage(SOURCE_IMAGE_URL), fetchPointData(POINT_DATA_URL)])
    .then(([image, points]) => {
      if (disposed) return;
      backgroundTexture = createTexture(gl, image);
      pointCount = points.length / POINT_FLOATS;
      pointBuffer = createArrayBuffer(gl, points);
      canvas.dataset.webglState = "ready";
    })
    .catch((error) => {
      canvas.dataset.webglState = "error";
      console.error(error);
    });

  render();

  return {
    destroy() {
      disposed = true;
      cancelAnimationFrame(animationFrame);
      canvas.removeEventListener("pointermove", handlePointerMove);
      canvas.removeEventListener("pointerdown", handlePointerDown);
    }
  };
}
