import {
  DEFAULT_SHADER_PARAMS,
  cloneShaderParams,
  hexToRgb,
  normaliseShaderParams,
  rgbToHex
} from '/flying-horse-state.js';

const OUTPUT_PRESET_STORAGE_KEY = 'achmed.output-presets';
const BUILTIN_PRESETS = [
  { height: 720, id: 'builtin:hd', name: 'HD 1280x720', width: 1280 },
  { height: 1080, id: 'builtin:fullhd', name: 'Full HD 1920x1080', width: 1920 },
  { height: 2160, id: 'builtin:uhd', name: 'UHD 3840x2160', width: 3840 },
  { height: 1920, id: 'builtin:portrait-hd', name: 'Portrait 1080x1920', width: 1080 }
];

const elements = {
  controlUrl: document.querySelector('#control-url'),
  deleteOutputPreset: document.querySelector('#delete-output-preset'),
  ndiFpsInput: document.querySelector('#ndi-fps-input'),
  ndiSourceInput: document.querySelector('#ndi-source-input'),
  ndiState: document.querySelector('#ndi-state'),
  outputHeightInput: document.querySelector('#output-height-input'),
  outputPresetName: document.querySelector('#output-preset-name'),
  outputPresetSelect: document.querySelector('#output-preset-select'),
  outputSizeLock: document.querySelector('#output-size-lock'),
  outputStatus: document.querySelector('#output-status'),
  outputSummary: document.querySelector('#output-summary'),
  outputUrl: document.querySelector('#output-url'),
  outputWidthInput: document.querySelector('#output-width-input'),
  saveOutputPreset: document.querySelector('#save-output-preset'),
  shaderControls: document.querySelector('#shader-controls'),
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
let outputPresets = [];
let shaderParams = cloneShaderParams(DEFAULT_SHADER_PARAMS);
let shaderSaveTimeout = null;

function syncInputValue(input, value) {
  if (document.activeElement === input) {
    return;
  }

  input.value = value;
}

function getCustomPresets() {
  try {
    const rawValue = window.localStorage.getItem(OUTPUT_PRESET_STORAGE_KEY);

    if (!rawValue) {
      return [];
    }

    const parsedValue = JSON.parse(rawValue);

    if (!Array.isArray(parsedValue)) {
      return [];
    }

    return parsedValue
      .filter((preset) => (
        preset &&
        typeof preset.id === 'string' &&
        typeof preset.name === 'string' &&
        Number.isFinite(Number(preset.width)) &&
        Number.isFinite(Number(preset.height))
      ))
      .map((preset) => ({
        id: preset.id,
        name: preset.name,
        width: Number(preset.width),
        height: Number(preset.height)
      }));
  } catch {
    return [];
  }
}

function saveCustomPresets(customPresets) {
  window.localStorage.setItem(OUTPUT_PRESET_STORAGE_KEY, JSON.stringify(customPresets));
}

function loadOutputPresets() {
  outputPresets = [...BUILTIN_PRESETS, ...getCustomPresets()];
}

function getSelectedPreset() {
  return outputPresets.find((preset) => preset.id === elements.outputPresetSelect.value) ?? null;
}

function setOutputDimensions(width, height) {
  elements.outputWidthInput.value = String(width);
  elements.outputHeightInput.value = String(height);
}

function renderPresetOptions() {
  const selectedValue = elements.outputPresetSelect.value;
  const optionMarkup = outputPresets
    .map((preset) => `<option value="${preset.id}">${preset.name}</option>`)
    .join('');

  elements.outputPresetSelect.innerHTML = `<option value="">Select preset</option>${optionMarkup}`;

  if (outputPresets.some((preset) => preset.id === selectedValue)) {
    elements.outputPresetSelect.value = selectedValue;
  }

  const selectedPreset = getSelectedPreset();
  elements.deleteOutputPreset.disabled = !selectedPreset || selectedPreset.id.startsWith('builtin:');
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
  elements.outputSizeLock.textContent = outputState.active
    ? `Locked while running at ${outputState.width} x ${outputState.height}`
    : 'Unlocked';
  elements.startOutput.disabled = outputState.active;
  elements.stopOutput.disabled = !outputState.active;
  elements.outputPresetSelect.disabled = outputState.active;
  elements.outputWidthInput.disabled = outputState.active;
  elements.outputHeightInput.disabled = outputState.active;
}

function renderNdiStatus() {
  if (!ndiStatus) {
    return;
  }

  if (ndiStatus.lastError) {
    elements.ndiState.textContent = ndiStatus.lastError;
  } else if (!ndiStatus.available) {
    elements.ndiState.textContent = 'Unavailable';
  } else if (ndiStatus.running) {
    elements.ndiState.textContent = 'Streaming';
  } else {
    elements.ndiState.textContent = 'Ready';
  }

  if (typeof ndiStatus.sourceName === 'string') {
    syncInputValue(elements.ndiSourceInput, ndiStatus.sourceName);
  }

  if (typeof ndiStatus.fps === 'number') {
    syncInputValue(elements.ndiFpsInput, String(ndiStatus.fps));
  }
}

function getShaderRangeInputs() {
  return Array.from(elements.shaderControls?.querySelectorAll('input[type="range"][id^="sl-"]') ?? []);
}

function getShaderParamKey(input) {
  return input.id.replace(/^sl-/, '');
}

function getShaderDisplayValue(input, value) {
  const step = Number(input.step);

  if (Number.isFinite(step) && step >= 1) {
    return String(Math.round(value));
  }

  if (Number.isFinite(step) && step > 0) {
    const [, decimals = ''] = input.step.split('.');
    return Number(value).toFixed(decimals.length);
  }

  return Number(value).toFixed(2);
}

function renderShaderControls() {
  if (!elements.shaderControls) {
    return;
  }

  for (const input of getShaderRangeInputs()) {
    const key = getShaderParamKey(input);
    const value = Number(shaderParams[key]);
    const displayValue = document.querySelector(`#val-${key}`);

    if (!Number.isFinite(value)) {
      continue;
    }

    if (document.activeElement !== input) {
      input.value = String(value);
    }

    if (displayValue) {
      displayValue.textContent = getShaderDisplayValue(input, value);
    }
  }

  const selectedHex = rgbToHex(shaderParams.baseColor).toLowerCase();

  elements.shaderControls.querySelectorAll('.color-swatch').forEach((swatch) => {
    swatch.classList.toggle('selected', swatch.dataset.hex?.toLowerCase() === selectedHex);
  });
}

async function saveShaderParams() {
  shaderParams = normaliseShaderParams(
    await postJson('/api/shader/params', shaderParams),
    shaderParams
  );
  renderShaderControls();
}

function scheduleShaderParamsSave() {
  window.clearTimeout(shaderSaveTimeout);
  shaderSaveTimeout = window.setTimeout(() => {
    saveShaderParams().catch(() => {});
  }, 80);
}

async function refreshShaderParams() {
  shaderParams = normaliseShaderParams(await fetchJson('/api/shader/params'));
  renderShaderControls();
}

function bindShaderControls() {
  if (!elements.shaderControls) {
    return;
  }

  for (const input of getShaderRangeInputs()) {
    input.addEventListener('input', () => {
      const key = getShaderParamKey(input);
      const value = Number(input.value);

      if (!Number.isFinite(value)) {
        return;
      }

      shaderParams[key] = value;
      renderShaderControls();
      scheduleShaderParamsSave();
    });
  }

  elements.shaderControls.querySelectorAll('.color-swatch').forEach((swatch) => {
    swatch.addEventListener('click', () => {
      shaderParams.baseColor = hexToRgb(swatch.dataset.hex);
      renderShaderControls();
      scheduleShaderParamsSave();
    });
  });
}

function render() {
  renderConfig();
  renderPresetOptions();
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
  loadOutputPresets();
  currentConfig = await fetchJson('/api/config');
  await refreshShaderParams();
  await refreshStatuses();
}

elements.outputPresetSelect.addEventListener('change', () => {
  if (outputState.sizeLocked) {
    return;
  }

  const selectedPreset = getSelectedPreset();

  if (!selectedPreset) {
    return;
  }

  setOutputDimensions(selectedPreset.width, selectedPreset.height);
  elements.outputPresetName.value = selectedPreset.name;
  renderPresetOptions();
});

elements.saveOutputPreset.addEventListener('click', () => {
  const name = elements.outputPresetName.value.trim();
  const width = Number(elements.outputWidthInput.value);
  const height = Number(elements.outputHeightInput.value);

  if (!name || !Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return;
  }

  const customPresets = getCustomPresets();
  const presetId = `custom:${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || Date.now()}`;
  const existingIndex = customPresets.findIndex((preset) => preset.name.toLowerCase() === name.toLowerCase());
  const nextPreset = {
    id: existingIndex >= 0 ? customPresets[existingIndex].id : presetId,
    name,
    width,
    height
  };

  if (existingIndex >= 0) {
    customPresets.splice(existingIndex, 1, nextPreset);
  } else {
    customPresets.push(nextPreset);
  }

  saveCustomPresets(customPresets);
  loadOutputPresets();
  elements.outputPresetSelect.value = nextPreset.id;
  renderPresetOptions();
});

elements.deleteOutputPreset.addEventListener('click', () => {
  const selectedPreset = getSelectedPreset();

  if (!selectedPreset || selectedPreset.id.startsWith('builtin:')) {
    return;
  }

  const customPresets = getCustomPresets().filter((preset) => preset.id !== selectedPreset.id);
  saveCustomPresets(customPresets);
  loadOutputPresets();
  elements.outputPresetSelect.value = '';
  elements.outputPresetName.value = '';
  renderPresetOptions();
});

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

bindShaderControls();
initialise();

window.setInterval(() => {
  refreshStatuses().catch(() => {});
}, 2000);
