import {
  CHAPTER_DEFINITIONS,
  LOCATION_DEFINITIONS,
  PALETTE_DEFINITIONS
} from './asset-manifest.js';

const DENSITY_ACTOR_COUNTS = {
  spare: 2,
  medium: 3,
  ornate: 5
};

function hashText(text) {
  let hash = 2166136261;

  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function createRng(seedText) {
  let state = hashText(seedText) || 1;

  return () => {
    state = Math.imul(state ^ (state >>> 15), 1 | state);
    state ^= state + Math.imul(state ^ (state >>> 7), 61 | state);
    return ((state ^ (state >>> 14)) >>> 0) / 4294967296;
  };
}

function pick(rng, values) {
  return values[Math.floor(rng() * values.length)] ?? values[0];
}

function range(rng, min, max) {
  return min + (max - min) * rng();
}

function buildCrossingActors(rng, density) {
  const actors = [
    {
      direction: 1,
      kind: 'rider',
      lane: 'mid',
      scale: range(rng, 0.95, 1.08),
      xEnd: 0.78,
      xStart: -0.18
    },
    {
      direction: 1,
      kind: 'bird-flock',
      lane: 'sky',
      scale: range(rng, 0.82, 1.02),
      xEnd: 0.74,
      xStart: 0.2
    }
  ];

  if (density !== 'spare') {
    actors.push({
      direction: 1,
      kind: 'guard',
      lane: 'back',
      scale: range(rng, 0.75, 0.88),
      xEnd: 0.18,
      xStart: -0.06
    });
  }

  return actors;
}

function buildArrivalActors(rng, density) {
  const actors = [
    {
      direction: 1,
      kind: 'hero',
      lane: 'mid',
      scale: range(rng, 0.84, 0.96),
      xEnd: 0.48,
      xStart: 0.22
    }
  ];

  if (density !== 'spare') {
    actors.push({
      direction: -1,
      kind: 'guard',
      lane: 'front',
      scale: range(rng, 0.95, 1.08),
      xEnd: 0.86,
      xStart: 0.9
    });
  }

  if (density === 'ornate') {
    actors.push({
      direction: 1,
      kind: 'bird-flock',
      lane: 'sky',
      scale: range(rng, 0.74, 0.88),
      xEnd: 0.62,
      xStart: 0.38
    });
  }

  return actors;
}

function buildOmenActors(rng, density) {
  const actors = [
    {
      direction: 1,
      kind: 'hero',
      lane: 'mid',
      scale: range(rng, 0.82, 0.94),
      xEnd: 0.42,
      xStart: 0.42
    },
    {
      direction: -1,
      kind: 'witch',
      lane: 'back',
      scale: range(rng, 0.92, 1.06),
      xEnd: 0.74,
      xStart: 0.74
    }
  ];

  actors.push({
    direction: 1,
    kind: 'bird-flock',
    lane: 'sky',
    scale: range(rng, 0.84, 1.04),
    xEnd: 0.7,
    xStart: 0.24
  });

  if (density === 'ornate') {
    actors.push({
      direction: -1,
      kind: 'guard',
      lane: 'front',
      scale: range(rng, 0.94, 1.08),
      xEnd: 0.92,
      xStart: 0.92
    });
  }

  return actors;
}

function buildProcessionActors(rng, density) {
  const actors = [
    {
      direction: 1,
      kind: 'hero',
      lane: 'mid',
      scale: range(rng, 0.86, 0.98),
      xEnd: 0.28,
      xStart: -0.08
    },
    {
      direction: 1,
      kind: 'guard',
      lane: 'front',
      scale: range(rng, 0.94, 1.08),
      xEnd: 0.62,
      xStart: 0.2
    }
  ];

  if (density !== 'spare') {
    actors.push({
      direction: 1,
      kind: 'guard',
      lane: 'back',
      scale: range(rng, 0.74, 0.88),
      xEnd: 0.1,
      xStart: -0.16
    });
  }

  if (density === 'ornate') {
    actors.push({
      direction: -1,
      kind: 'bird-flock',
      lane: 'sky',
      scale: range(rng, 0.78, 0.92),
      xEnd: 0.84,
      xStart: 0.38
    });
  }

  return actors;
}

function buildCourtshipActors(rng, density) {
  const actors = [
    {
      direction: 1,
      kind: 'hero',
      lane: 'mid',
      scale: range(rng, 0.84, 0.96),
      xEnd: 0.34,
      xStart: 0.24
    },
    {
      direction: -1,
      kind: 'witch',
      lane: 'back',
      scale: range(rng, 0.86, 0.98),
      xEnd: 0.68,
      xStart: 0.68
    }
  ];

  if (density !== 'spare') {
    actors.push({
      direction: -1,
      kind: 'guard',
      lane: 'front',
      scale: range(rng, 0.96, 1.08),
      xEnd: 0.9,
      xStart: 0.9
    });
  }

  return actors;
}

function buildPursuitActors(rng, density) {
  const actors = [
    {
      direction: 1,
      kind: 'rider',
      lane: 'front',
      scale: range(rng, 1.02, 1.14),
      xEnd: 0.92,
      xStart: 0.08
    },
    {
      direction: 1,
      kind: 'guard',
      lane: 'mid',
      scale: range(rng, 0.84, 0.96),
      xEnd: 0.58,
      xStart: -0.12
    }
  ];

  if (density !== 'spare') {
    actors.push({
      direction: 1,
      kind: 'bird-flock',
      lane: 'sky',
      scale: range(rng, 0.8, 0.94),
      xEnd: 0.72,
      xStart: 0.16
    });
  }

  return actors;
}

function buildFlightActors(rng, density) {
  const actors = [
    {
      direction: 1,
      kind: 'flying-rider',
      lane: 'sky',
      scale: range(rng, 0.9, 1.04),
      xEnd: 0.88,
      xStart: 0.18
    },
    {
      direction: -1,
      kind: 'bird-flock',
      lane: 'sky',
      scale: range(rng, 0.8, 0.96),
      xEnd: 0.84,
      xStart: 0.46
    }
  ];

  if (density === 'ornate') {
    actors.push({
      direction: -1,
      kind: 'witch',
      lane: 'back',
      scale: range(rng, 0.9, 1.06),
      xEnd: 0.78,
      xStart: 0.78
    });
  }

  return actors;
}

function buildRitualActors(rng, density) {
  const actors = [
    {
      direction: -1,
      kind: 'witch',
      lane: 'mid',
      scale: range(rng, 0.98, 1.14),
      xEnd: 0.58,
      xStart: 0.58
    },
    {
      direction: 1,
      kind: 'bird-flock',
      lane: 'sky',
      scale: range(rng, 0.86, 1.06),
      xEnd: 0.72,
      xStart: 0.28
    }
  ];

  if (density !== 'spare') {
    actors.push({
      direction: 1,
      kind: 'hero',
      lane: 'back',
      scale: range(rng, 0.72, 0.84),
      xEnd: 0.16,
      xStart: 0.16
    });
  }

  return actors;
}

function buildTransformationActors(rng, density) {
  const actors = [
    {
      direction: 1,
      kind: 'witch',
      lane: 'mid',
      scale: range(rng, 0.94, 1.08),
      xEnd: 0.56,
      xStart: 0.56
    },
    {
      direction: 1,
      kind: 'hero',
      lane: 'front',
      scale: range(rng, 0.82, 0.94),
      xEnd: 0.32,
      xStart: 0.32
    },
    {
      direction: 1,
      kind: 'bird-flock',
      lane: 'sky',
      scale: range(rng, 0.78, 0.94),
      xEnd: 0.68,
      xStart: 0.2
    }
  ];

  if (density === 'ornate') {
    actors.push({
      direction: -1,
      kind: 'guard',
      lane: 'back',
      scale: range(rng, 0.72, 0.84),
      xEnd: 0.82,
      xStart: 0.82
    });
  }

  return actors;
}

const BEAT_BUILDERS = {
  arrival: buildArrivalActors,
  courtship: buildCourtshipActors,
  crossing: buildCrossingActors,
  flight: buildFlightActors,
  omen: buildOmenActors,
  procession: buildProcessionActors,
  pursuit: buildPursuitActors,
  ritual: buildRitualActors,
  transformation: buildTransformationActors
};

export function createStoryBeat(storyState, beatIndex) {
  const chapter = CHAPTER_DEFINITIONS[storyState.chapter] ?? CHAPTER_DEFINITIONS.wander;
  const palette = PALETTE_DEFINITIONS[storyState.palette] ?? PALETTE_DEFINITIONS.moonrise;
  const density = storyState.density;
  const rng = createRng([
    storyState.seed,
    storyState.chapter,
    storyState.palette,
    storyState.density,
    storyState.revision,
    beatIndex
  ].join(':'));
  const beatType = chapter.beats[beatIndex % chapter.beats.length] ?? chapter.beats[0];
  const locationId = pick(rng, chapter.locations);
  const location = LOCATION_DEFINITIONS[locationId] ?? LOCATION_DEFINITIONS.desert;
  const actorBuilder = BEAT_BUILDERS[beatType] ?? buildCrossingActors;
  const actorCount = DENSITY_ACTOR_COUNTS[density] ?? DENSITY_ACTOR_COUNTS.medium;
  const actors = actorBuilder(rng, density).slice(0, actorCount);

  return {
    actors,
    beatIndex,
    beatType,
    horizon: location.horizon,
    locationId,
    locationLabel: location.label,
    palette,
    paletteId: storyState.palette,
    seed: storyState.seed
  };
}
