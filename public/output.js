const canvas = document.querySelector('#output-canvas');
const context = canvas.getContext('2d');

let outputState = {
  active: false,
  height: window.innerHeight || 720,
  width: window.innerWidth || 1280
};

function applyCanvasSize(width, height) {
  canvas.width = width;
  canvas.height = height;
}

function renderLoadingScreen() {
  applyCanvasSize(window.innerWidth || 1280, window.innerHeight || 720);
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = '#000';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = '#fff';
  context.font = '24px sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText('Loading output...', canvas.width / 2, canvas.height / 2);
}

function renderOutputFrame() {
  applyCanvasSize(outputState.width, outputState.height);
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = '#000';
  context.fillRect(0, 0, canvas.width, canvas.height);
}

function render() {
  if (!outputState.active) {
    renderLoadingScreen();
    return;
  }

  renderOutputFrame();
}

async function fetchJson(url) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Request failed for ${url}`);
  }

  return response.json();
}

async function refreshOutputState() {
  outputState = await fetchJson('/api/output/status');
  render();
}

async function initialise() {
  renderLoadingScreen();
  await refreshOutputState();

  window.addEventListener('resize', () => {
    if (!outputState.active) {
      renderLoadingScreen();
    }
  });

  window.setInterval(() => {
    refreshOutputState().catch(() => {});
  }, 1000);
}

initialise();
