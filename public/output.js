import { createStoryEngine } from './story/engine.js';

const DEFAULT_OUTPUT_SIZE = {
  height: 720,
  width: 1280
};

let currentOutputSize = DEFAULT_OUTPUT_SIZE;
let sketchInstance = null;
let storyEngine = createStoryEngine();

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

async function fetchStoryState() {
  return fetchJson('/api/story/status');
}

function syncSketchSize(nextOutputSize) {
  currentOutputSize = nextOutputSize;

  if (!sketchInstance || !sketchInstance.canvas) {
    return;
  }

  if (
    sketchInstance.width === currentOutputSize.width &&
    sketchInstance.height === currentOutputSize.height
  ) {
    return;
  }

  sketchInstance.resizeCanvas(currentOutputSize.width, currentOutputSize.height, true);
}

async function initialise() {
  const [initialOutputSize, initialStoryState] = await Promise.all([
    fetchOutputSize(),
    fetchStoryState()
  ]);

  currentOutputSize = initialOutputSize;
  storyEngine = createStoryEngine(initialStoryState);

  sketchInstance = new window.p5((p5) => {
    p5.setup = () => {
      p5.createCanvas(currentOutputSize.width, currentOutputSize.height);
      p5.frameRate(60);
      storyEngine.applyStoryState(initialStoryState, 0);
    };

    p5.draw = () => {
      storyEngine.draw(p5);
    };
  });

  window.setInterval(() => {
    Promise.allSettled([fetchOutputSize(), fetchStoryState()]).then((results) => {
      const [outputSizeResult, storyStateResult] = results;

      if (outputSizeResult.status === 'fulfilled') {
        const nextOutputSize = outputSizeResult.value;

        if (
          nextOutputSize.width !== currentOutputSize.width ||
          nextOutputSize.height !== currentOutputSize.height
        ) {
          syncSketchSize(nextOutputSize);
        }
      }

      if (storyStateResult.status === 'fulfilled') {
        const nowMs = sketchInstance ? sketchInstance.millis() : 0;
        storyEngine.applyStoryState(storyStateResult.value, nowMs);
      }
    });
  }, 1000);
}

initialise();
