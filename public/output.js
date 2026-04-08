const DEFAULT_OUTPUT_SIZE = {
  height: 720,
  width: 1280
};

const BOAT_COMPOSITION_ID = '66D73063E1BC48DEB0DEB06FD696BA4A';
const WIND_ANIMATION_FRAMES = 9;
const WIND_NOISE_SPEED = 0.18;
const DEFAULT_BOAT_WIND_STATE = {
  speed: 1,
  strength: 1
};

let currentOutputSize = { ...DEFAULT_OUTPUT_SIZE };
let boatWindState = { ...DEFAULT_BOAT_WIND_STATE };
let canvas = null;
let stage = null;
let background = null;
let boatRoot = null;
let boatLibrary = null;
let windLabel = null;
let lastRenderTimestamp = null;
let lastRenderedFrame = -1;
let windNoiseTime = 0;

async function fetchJson(url) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Request failed for ${url}`);
  }

  return response.json();
}

async function fetchOutputSize() {
  const outputState = await fetchJson('/api/output/status');

  return {
    height: Number(outputState.height) || currentOutputSize.height,
    width: Number(outputState.width) || currentOutputSize.width
  };
}

async function fetchBoatWindState() {
  const windState = await fetchJson('/api/boat/wind');

  return normaliseBoatWindState(windState);
}

function getBoatLibrary() {
  const composition = window.AdobeAn?.getComposition(BOAT_COMPOSITION_ID);
  const library = composition?.getLibrary();

  if (!window.createjs || !composition || !library?.Boat_HTML5Canvas) {
    throw new Error('Boat CreateJS export is not available.');
  }

  return library;
}

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normaliseBoatWindState(payload = boatWindState) {
  const strength = Number(payload.strength ?? boatWindState.strength ?? DEFAULT_BOAT_WIND_STATE.strength);
  const speed = Number(payload.speed ?? boatWindState.speed ?? DEFAULT_BOAT_WIND_STATE.speed);

  return {
    strength: Number.isFinite(strength) ? clamp(strength, 0, 2) : DEFAULT_BOAT_WIND_STATE.strength,
    speed: Number.isFinite(speed) ? clamp(speed, 0, 4) : DEFAULT_BOAT_WIND_STATE.speed
  };
}

function hashNoise(value) {
  const hash = Math.sin(value * 127.1 + 311.7) * 43758.5453;
  return hash - Math.floor(hash);
}

function smoothNoise(value) {
  const index = Math.floor(value);
  const fraction = value - index;
  const curve = fraction * fraction * (3 - 2 * fraction);

  return hashNoise(index) * (1 - curve) + hashNoise(index + 1) * curve;
}

function getWindStrength(windTime) {
  const baseWind = smoothNoise(windTime * WIND_NOISE_SPEED);
  const gust = smoothNoise(windTime * 0.74 + 23.7);
  const fineMotion = smoothNoise(windTime * 1.85 + 71.4);
  const rawWindStrength = baseWind * 0.68 + gust * 0.24 + fineMotion * 0.08;

  return clamp01(rawWindStrength * boatWindState.strength);
}

function resizeBackground() {
  if (!background) {
    return;
  }

  background.graphics
    .clear()
    .beginFill('#ffffff')
    .drawRect(0, 0, currentOutputSize.width, currentOutputSize.height);
}

function positionBoat() {
  if (!boatRoot || !boatLibrary) {
    return;
  }

  const boatWidth = boatLibrary.properties.width;
  const boatHeight = boatLibrary.properties.height;
  const scale = Math.min(
    currentOutputSize.width / boatWidth,
    currentOutputSize.height / boatHeight,
    1
  );

  boatRoot.x = (currentOutputSize.width - boatWidth * scale) * 0.5;
  boatRoot.y = (currentOutputSize.height - boatHeight * scale) * 0.5;
  boatRoot.scaleX = scale;
  boatRoot.scaleY = scale;
}

function syncOutputSize(nextOutputSize) {
  currentOutputSize = nextOutputSize;
  canvas.width = currentOutputSize.width;
  canvas.height = currentOutputSize.height;
  resizeBackground();
  positionBoat();
  stage?.update();
}

function initialiseBoat() {
  boatLibrary = getBoatLibrary();
  background = new window.createjs.Shape();
  boatRoot = new boatLibrary.Boat_HTML5Canvas(undefined, 0, true);
  windLabel = new window.createjs.Text('', '28px sans-serif', '#000000');
  stage = new window.createjs.Stage(canvas);

  stage.addChild(background);
  stage.addChild(boatRoot);
  stage.addChild(windLabel);
  resizeBackground();
  positionBoat();

  windLabel.x = 24;
  windLabel.y = 20;
  windLabel.textBaseline = 'top';
  boatRoot.gotoAndStop(0);
  window.AdobeAn?.compositionLoaded?.(boatLibrary.properties.id);
  window.requestAnimationFrame(renderBoatFrame);
}

function renderBoatFrame(timestamp) {
  if (lastRenderTimestamp === null) {
    lastRenderTimestamp = timestamp;
  }

  const elapsedSeconds = Math.max(0, (timestamp - lastRenderTimestamp) / 1000);
  lastRenderTimestamp = timestamp;
  windNoiseTime += elapsedSeconds * boatWindState.speed;

  const windStrength = getWindStrength(windNoiseTime);
  const frame = Math.round(windStrength * (WIND_ANIMATION_FRAMES - 1));

  if (frame !== lastRenderedFrame) {
    boatRoot.gotoAndStop(frame);
    lastRenderedFrame = frame;
  }

  windLabel.text = `Wind: ${Math.round(windStrength * 100)}%  Speed: ${boatWindState.speed.toFixed(2)}x`;
  stage.update();
  window.requestAnimationFrame(renderBoatFrame);
}

async function initialise() {
  canvas = document.querySelector('#output-canvas');
  [currentOutputSize, boatWindState] = await Promise.all([
    fetchOutputSize(),
    fetchBoatWindState()
  ]);
  syncOutputSize(currentOutputSize);
  initialiseBoat();

  window.setInterval(() => {
    fetchOutputSize()
      .then((nextOutputSize) => {
        if (
          nextOutputSize.width === currentOutputSize.width &&
          nextOutputSize.height === currentOutputSize.height
        ) {
          return;
        }

        syncOutputSize(nextOutputSize);
      })
      .catch(() => {});
  }, 1000);

  window.setInterval(() => {
    fetchBoatWindState()
      .then((nextBoatWindState) => {
        boatWindState = nextBoatWindState;
      })
      .catch(() => {});
  }, 250);
}

initialise();
