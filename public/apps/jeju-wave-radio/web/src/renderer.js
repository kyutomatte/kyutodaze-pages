export const VIDEO_SOURCES = Object.freeze(Object.fromEntries(
  ['sunny_day', 'sunny_night', 'cloudy_day', 'cloudy_night', 'rainy_day', 'rainy_night']
    .map((state) => [state, `../assets/video/${state}.mp4`]),
));

export const isKnownState = (state) => Object.hasOwn(VIDEO_SOURCES, state);

export function getAspectLayout(sourceAspect, stageAspect, mode = 'contain') {
  const ratio = Number(sourceAspect) / Number(stageAspect);
  if (mode === 'cover') return { mode: 'cover', x: 1, y: Math.round(Math.min(1, ratio) * 1000) / 1000 };
  return { mode: 'contain', x: Math.round(Math.min(1, ratio) * 1000) / 1000, y: 1 };
}

const VERTEX_SHADER = `
  attribute vec2 aPosition;
  varying vec2 vUv;
  void main() {
    vUv = aPosition * 0.5 + 0.5;
    gl_Position = vec4(aPosition, 0.0, 1.0);
  }
`;

const FRAGMENT_SHADER = `
  precision mediump float;
  varying vec2 vUv;
  uniform sampler2D uFrom;
  uniform sampler2D uTo;
  uniform float uMix;
  uniform float uStageAspect;
  uniform float uSourceAspect;
  uniform float uDisplayMode;
  void main() {
    vec2 uv = vec2(vUv.x, 1.0 - vUv.y);
    float ratio = uSourceAspect / uStageAspect;
    if (uDisplayMode < 0.5) {
      if (ratio < 1.0) {
        if (abs(uv.x - 0.5) > ratio * 0.5) { gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); return; }
        uv.x = (uv.x - 0.5) / ratio + 0.5;
      } else {
        float height = 1.0 / ratio;
        if (abs(uv.y - 0.5) > height * 0.5) { gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); return; }
        uv.y = (uv.y - 0.5) / height + 0.5;
      }
    } else if (ratio < 1.0) {
      uv.y = (uv.y - 0.5) * ratio + 0.5;
    } else {
      uv.x = (uv.x - 0.5) / ratio + 0.5;
    }
    gl_FragColor = mix(texture2D(uFrom, uv), texture2D(uTo, uv), uMix);
  }
`;

function compileShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`WebGL shader failed to compile: ${message}`);
  }
  return shader;
}

function createProgram(gl) {
  const program = gl.createProgram();
  gl.attachShader(program, compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER));
  gl.attachShader(program, compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const message = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error(`WebGL program failed to link: ${message}`);
  }
  return program;
}

function createVideo() {
  const video = document.createElement('video');
  video.muted = true;
  video.loop = true;
  video.playsInline = true;
  video.preload = 'auto';
  return video;
}

function loadVideo(video, source) {
  if (video.dataset.source === source && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const cleanup = () => {
      video.removeEventListener('canplay', onReady);
      video.removeEventListener('error', onError);
    };
    const onReady = () => {
      cleanup();
      video.play().catch(() => {});
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error(`Unable to load visual media: ${source}`));
    };
    video.addEventListener('canplay', onReady, { once: true });
    video.addEventListener('error', onError, { once: true });
    video.dataset.source = source;
    video.src = source;
    video.load();
  });
}

function createTexture(gl) {
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([16, 47, 69, 255]));
  return texture;
}

export function createRenderer(canvas) {
  const gl = canvas.getContext('webgl', { alpha: false, antialias: true });
  if (!gl) throw new Error('WebGL is unavailable in this browser.');

  const program = createProgram(gl);
  const videos = [createVideo(), createVideo()];
  const textures = [createTexture(gl), createTexture(gl)];
  const positionBuffer = gl.createBuffer();
  const positionLocation = gl.getAttribLocation(program, 'aPosition');
  const fromLocation = gl.getUniformLocation(program, 'uFrom');
  const toLocation = gl.getUniformLocation(program, 'uTo');
  const mixLocation = gl.getUniformLocation(program, 'uMix');
  const stageAspectLocation = gl.getUniformLocation(program, 'uStageAspect');
  const sourceAspectLocation = gl.getUniformLocation(program, 'uSourceAspect');
  const displayModeLocation = gl.getUniformLocation(program, 'uDisplayMode');
  let active = 0;
  let state = null;
  let transition = null;
  let frameId = null;
  let requestId = 0;
  let destroyed = false;
  let displayMode = 'contain';

  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  gl.useProgram(program);
  gl.enableVertexAttribArray(positionLocation);
  gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
  gl.uniform1i(fromLocation, 0);
    gl.uniform1i(toLocation, 1);

  function resize() {
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(1, Math.round(canvas.clientWidth * ratio));
    const height = Math.max(1, Math.round(canvas.clientHeight * ratio));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
      gl.viewport(0, 0, width, height);
    }
  }

  function upload(index) {
    const video = videos[index];
    if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
    gl.activeTexture(index === active ? gl.TEXTURE0 : gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, textures[index]);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
  }

  function draw(timestamp) {
    if (destroyed) return;
    resize();
    const target = transition?.to ?? active;
    upload(active);
    if (target !== active) upload(target);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, textures[active]);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, textures[target]);

    const video = videos[target];
    gl.uniform1f(stageAspectLocation, canvas.width / canvas.height);
    gl.uniform1f(sourceAspectLocation, video.videoWidth && video.videoHeight ? video.videoWidth / video.videoHeight : 9 / 16);
    gl.uniform1f(displayModeLocation, displayMode === 'cover' ? 1 : 0);

    let mix = 0;
    if (transition) {
      mix = Math.min(1, (timestamp - transition.startedAt) / transition.duration);
      if (mix === 1) {
        videos[active].pause();
        active = target;
        transition = null;
        mix = 0;
      }
    }
    gl.uniform1f(mixLocation, mix);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    frameId = requestAnimationFrame(draw);
  }

  function setState(nextState, fadeMs = 1000) {
    if (!isKnownState(nextState) || destroyed) return Promise.resolve(false);
    if (nextState === state && !transition) return Promise.resolve(true);

    const nextRequest = ++requestId;
    const target = active === 0 ? 1 : 0;
    return loadVideo(videos[target], VIDEO_SOURCES[nextState])
      .then(() => {
        if (destroyed || nextRequest !== requestId) return false;
        state = nextState;
        if (state === null) return true;
        transition = { to: target, startedAt: performance.now(), duration: Math.max(1, fadeMs) };
        return true;
      })
      .catch(() => false);
  }

  function destroy() {
    destroyed = true;
    if (frameId !== null) cancelAnimationFrame(frameId);
    videos.forEach((video) => {
      video.pause();
      video.removeAttribute('src');
      video.load();
    });
    textures.forEach((texture) => gl.deleteTexture(texture));
    gl.deleteBuffer(positionBuffer);
    gl.deleteProgram(program);
  }

  window.addEventListener('resize', resize);
  frameId = requestAnimationFrame(draw);

  return { setState, setDisplayMode: (mode) => { displayMode = mode === 'cover' ? 'cover' : 'contain'; }, resize, destroy };
}
