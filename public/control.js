const elements = {
  controlUrl: document.querySelector('#control-url'),
  ndiFpsInput: document.querySelector('#ndi-fps-input'),
  ndiMessage: document.querySelector('#ndi-message'),
  ndiReason: document.querySelector('#ndi-reason'),
  ndiSourceInput: document.querySelector('#ndi-source-input'),
  ndiStatus: document.querySelector('#ndi-status'),
  outputHeightInput: document.querySelector('#output-height-input'),
  outputStatus: document.querySelector('#output-status'),
  outputSummary: document.querySelector('#output-summary'),
  outputUrl: document.querySelector('#output-url'),
  outputWidthInput: document.querySelector('#output-width-input'),
  startOutput: document.querySelector('#start-output'),
  stopOutput: document.querySelector('#stop-output')
};

let currentConfig = null;
let ndiStatus = null;
let outputState = {
  active: false,
  height: Number(elements.outputHeightInput.value),
  width: Number(elements.outputWidthInput.value)
};

function syncInputValue(input, value) {
  if (document.activeElement === input) {
    return;
  }

  input.value = value;
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);

  if (!response.ok) {
    throw new Error(`Request failed for ${url}`);
  }

  return response.json();
}

async function postJson(url, payload = {}) {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const body = await response.json();

  if (!response.ok) {
    throw new Error(body.error ?? `Request failed for ${url}`);
  }

  return body;
}

function renderConfig() {
  if (!currentConfig) {
    return;
  }

  elements.controlUrl.textContent = currentConfig.controlUrl;
  elements.controlUrl.href = currentConfig.controlUrl;
  elements.outputUrl.textContent = currentConfig.outputUrl;
  elements.outputUrl.href = currentConfig.outputUrl;
}

function renderOutputState() {
  elements.outputStatus.textContent = outputState.active ? 'Running' : 'Stopped';
  elements.outputSummary.textContent = `${outputState.width} x ${outputState.height}`;
  elements.startOutput.disabled = outputState.active;
  elements.stopOutput.disabled = !outputState.active;
}

function renderNdiStatus() {
  if (!ndiStatus) {
    return;
  }

  elements.ndiStatus.textContent = ndiStatus.available ? (ndiStatus.running ? 'Streaming' : 'Ready') : 'Unavailable';
  elements.ndiReason.textContent = ndiStatus.reason ?? 'idle';
  elements.ndiMessage.textContent =
    ndiStatus.lastError ?? (ndiStatus.available ? 'NDI sender is idle.' : 'NDI requires the Electron control app.');

  if (typeof ndiStatus.sourceName === 'string') {
    syncInputValue(elements.ndiSourceInput, ndiStatus.sourceName);
  }

  if (typeof ndiStatus.fps === 'number') {
    syncInputValue(elements.ndiFpsInput, String(ndiStatus.fps));
  }
}

function render() {
  renderConfig();
  renderOutputState();
  renderNdiStatus();
}

async function refreshStatuses() {
  const [nextOutputState, nextNdiStatus] = await Promise.all([
    fetchJson('/api/output/status'),
    fetchJson('/api/ndi/status')
  ]);

  outputState = nextOutputState;
  ndiStatus = nextNdiStatus;
  render();
}

async function initialise() {
  currentConfig = await fetchJson('/api/config');
  await refreshStatuses();
}

elements.startOutput.addEventListener('click', async () => {
  const response = await postJson('/api/output/start', {
    fps: Number(elements.ndiFpsInput.value),
    height: Number(elements.outputHeightInput.value),
    sourceName: elements.ndiSourceInput.value.trim() || 'Achmed Output',
    width: Number(elements.outputWidthInput.value)
  });

  outputState = response.outputState;
  ndiStatus = response.ndiStatus;
  render();
});

elements.stopOutput.addEventListener('click', async () => {
  const response = await postJson('/api/output/stop');
  outputState = response.outputState;
  ndiStatus = response.ndiStatus;
  render();
});

initialise();

window.setInterval(() => {
  refreshStatuses().catch(() => {});
}, 2000);
