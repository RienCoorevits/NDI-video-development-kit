export const DEFAULT_SHADER_PARAMS = {
  vidscale: 1.00,
  vidoffset: 0.00,
  vidmix: 1.00,
  fps: 24,
  baseColor: { r: 0, g: 223, b: 0 },
  colorsat: 1.00,
  bright: 180,
  sepia: 0.56,
  contrast: 1.10,
  flicker: 7,
  fspeed: 3.70,
  bands: 0.04,
  cloudLayers: 3,
  cloudBehind: 2,
  cloudScale: 2.10,
  cloudFlat: 20.0,
  cloudDriftX: 1.55,
  cloudDriftY: 1.00,
  cloudDensity: 0.45,
  cloudDark: 0.14,
  cloudParallax: 1.20,
  cloudEdge: 0.51,
  cloudTurb: 0.30,
  grain: 8,
  gsize: 0.9,
  shake: 0.90,
  drift: 0.95,
  vignette: 0.33,
  viganim: 0.12,
  burn: 0.40,
  halo: 0.20,
  scratch: 0.01,
  dust: 0.07,
  texscale: 2.8,
  texstr: 0.05
};

const NUMERIC_SHADER_KEYS = Object.entries(DEFAULT_SHADER_PARAMS)
  .filter(([, value]) => typeof value === 'number')
  .map(([key]) => key);

export function cloneShaderParams(params = DEFAULT_SHADER_PARAMS) {
  return JSON.parse(JSON.stringify(params));
}

function clampChannel(value, fallback) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return fallback;
  }

  return Math.max(0, Math.min(255, Math.round(numericValue)));
}

export function hexToRgb(hex) {
  const normalizedHex = String(hex).trim();

  if (!/^#[0-9a-f]{6}$/i.test(normalizedHex)) {
    return cloneShaderParams().baseColor;
  }

  return {
    r: parseInt(normalizedHex.slice(1, 3), 16),
    g: parseInt(normalizedHex.slice(3, 5), 16),
    b: parseInt(normalizedHex.slice(5, 7), 16)
  };
}

export function rgbToHex(color) {
  const params = normaliseShaderParams({ baseColor: color });

  return `#${[params.baseColor.r, params.baseColor.g, params.baseColor.b]
    .map((channel) => channel.toString(16).padStart(2, '0'))
    .join('')}`;
}

export function normaliseShaderParams(payload = {}, fallback = DEFAULT_SHADER_PARAMS) {
  const nextParams = cloneShaderParams(fallback);

  for (const key of NUMERIC_SHADER_KEYS) {
    const nextValue = Number(payload?.[key]);

    if (Number.isFinite(nextValue)) {
      nextParams[key] = nextValue;
    }
  }

  if (payload?.baseColor && typeof payload.baseColor === 'object') {
    nextParams.baseColor = {
      r: clampChannel(payload.baseColor.r, nextParams.baseColor.r),
      g: clampChannel(payload.baseColor.g, nextParams.baseColor.g),
      b: clampChannel(payload.baseColor.b, nextParams.baseColor.b)
    };
  }

  return nextParams;
}
