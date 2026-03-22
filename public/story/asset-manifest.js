export const STORY_DEFAULTS = {
  autoAdvance: true,
  beatDurationMs: 9000,
  chapter: 'wander',
  cueIndex: 0,
  density: 'medium',
  palette: 'moonrise',
  revision: 0,
  seed: 'achmed-1926'
};

export const PALETTE_DEFINITIONS = {
  moonrise: {
    glow: '#f3d9a4',
    haze: '#8fa1c6',
    skyBottom: '#26334d',
    skyTop: '#05101f'
  },
  sunset: {
    glow: '#ffd18b',
    haze: '#d88756',
    skyBottom: '#632f36',
    skyTop: '#170c1d'
  },
  emerald: {
    glow: '#e5ffb4',
    haze: '#89b294',
    skyBottom: '#14303b',
    skyTop: '#041211'
  }
};

export const LOCATION_DEFINITIONS = {
  desert: {
    backdrop: 'dunes',
    foreground: 'palms',
    horizon: 0.68,
    label: 'Desert Dunes'
  },
  palace: {
    backdrop: 'palace',
    foreground: 'arch',
    horizon: 0.66,
    label: 'Palace Court'
  },
  island: {
    backdrop: 'cliffs',
    foreground: 'rocks',
    horizon: 0.64,
    label: 'Island Cliff'
  },
  forest: {
    backdrop: 'forest',
    foreground: 'branches',
    horizon: 0.7,
    label: 'Enchanted Grove'
  }
};

export const ACTOR_DEFINITIONS = {
  achmed: {
    animate: {
      notes: 'Export idle, walk, gesture, and ride symbols as transparent clips.',
      symbol: 'Achmed'
    },
    label: 'Achmed',
    renderer: 'procedural-cutout'
  },
  horse: {
    animate: {
      notes: 'Use a looping ride cycle with a stable registration point at the front hoof.',
      symbol: 'Horse'
    },
    label: 'Horse',
    renderer: 'procedural-cutout'
  },
  witch: {
    animate: {
      notes: 'Export veil, cloak, and summoning loops as separate symbols.',
      symbol: 'Witch'
    },
    label: 'Witch',
    renderer: 'procedural-cutout'
  },
  spiritBird: {
    animate: {
      notes: 'A short looping flap cycle works better than a full scene export.',
      symbol: 'SpiritBird'
    },
    label: 'Spirit Bird',
    renderer: 'procedural-cutout'
  },
  guard: {
    animate: {
      notes: 'Guard silhouettes can be exported as single hold poses plus a subtle sway loop.',
      symbol: 'Guard'
    },
    label: 'Guard',
    renderer: 'procedural-cutout'
  }
};

export const CHAPTER_DEFINITIONS = {
  wander: {
    beats: ['crossing', 'arrival', 'omen'],
    locations: ['desert', 'island', 'forest']
  },
  palace: {
    beats: ['procession', 'courtship', 'omen'],
    locations: ['palace', 'forest']
  },
  flight: {
    beats: ['pursuit', 'flight', 'arrival'],
    locations: ['desert', 'island', 'palace']
  },
  sorcery: {
    beats: ['ritual', 'transformation', 'omen'],
    locations: ['forest', 'island', 'palace']
  }
};
