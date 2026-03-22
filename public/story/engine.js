import { STORY_DEFAULTS } from './asset-manifest.js';
import { createStoryBeat } from './director.js';
import { renderStoryBeat } from './render.js';

const STORY_CHAPTERS = new Set(['wander', 'palace', 'flight', 'sorcery']);
const STORY_DENSITIES = new Set(['spare', 'medium', 'ornate']);
const STORY_PALETTES = new Set(['moonrise', 'sunset', 'emerald']);

function normaliseStoryState(nextState = {}, fallback = STORY_DEFAULTS) {
  const autoAdvanceValue = nextState.autoAdvance ?? fallback.autoAdvance;
  const beatDurationMs = Number(nextState.beatDurationMs ?? fallback.beatDurationMs);
  const cueIndex = Number(nextState.cueIndex ?? fallback.cueIndex);
  const revision = Number(nextState.revision ?? fallback.revision);
  const seedValue = String(nextState.seed ?? fallback.seed ?? '').trim();
  const chapterValue = String(nextState.chapter ?? fallback.chapter ?? 'wander');
  const densityValue = String(nextState.density ?? fallback.density ?? 'medium');
  const paletteValue = String(nextState.palette ?? fallback.palette ?? 'moonrise');

  return {
    autoAdvance: typeof autoAdvanceValue === 'string'
      ? autoAdvanceValue !== 'false'
      : Boolean(autoAdvanceValue),
    beatDurationMs: Math.max(2000, Math.min(30000, Number.isFinite(beatDurationMs) ? beatDurationMs : 9000)),
    chapter: STORY_CHAPTERS.has(chapterValue) ? chapterValue : 'wander',
    cueIndex: Number.isFinite(cueIndex) ? Math.max(0, Math.floor(cueIndex)) : 0,
    density: STORY_DENSITIES.has(densityValue) ? densityValue : 'medium',
    palette: STORY_PALETTES.has(paletteValue) ? paletteValue : 'moonrise',
    revision: Number.isFinite(revision) ? Math.max(0, Math.floor(revision)) : 0,
    seed: seedValue || STORY_DEFAULTS.seed
  };
}

function createFingerprint(storyState) {
  return [
    storyState.seed,
    storyState.chapter,
    storyState.palette,
    storyState.density,
    storyState.autoAdvance,
    storyState.beatDurationMs,
    storyState.cueIndex,
    storyState.revision
  ].join('|');
}

export class StoryEngine {
  constructor(initialStoryState = {}) {
    this.storyState = normaliseStoryState(initialStoryState);
    this.storyFingerprint = '';
    this.beatStartedAtMs = 0;
    this.currentBeat = null;
    this.currentBeatIndex = this.storyState.cueIndex;
    this.localBeatOffset = 0;
  }

  applyStoryState(nextStoryState, nowMs = 0) {
    const normalisedStoryState = normaliseStoryState(nextStoryState, this.storyState);
    const nextFingerprint = createFingerprint(normalisedStoryState);

    if (nextFingerprint === this.storyFingerprint && this.currentBeat) {
      this.storyState = normalisedStoryState;
      return;
    }

    this.storyState = normalisedStoryState;
    this.storyFingerprint = nextFingerprint;
    this.localBeatOffset = 0;
    this.currentBeatIndex = this.storyState.cueIndex;
    this.currentBeat = createStoryBeat(this.storyState, this.currentBeatIndex);
    this.beatStartedAtMs = nowMs;
  }

  advanceBeat(nowMs) {
    this.localBeatOffset += 1;
    this.currentBeatIndex = this.storyState.cueIndex + this.localBeatOffset;
    this.currentBeat = createStoryBeat(this.storyState, this.currentBeatIndex);
    this.beatStartedAtMs = nowMs;
  }

  ensureBeat(nowMs) {
    if (!this.currentBeat) {
      this.applyStoryState(this.storyState, nowMs);
      return;
    }

    if (!this.storyState.autoAdvance) {
      return;
    }

    if (nowMs - this.beatStartedAtMs < this.storyState.beatDurationMs) {
      return;
    }

    this.advanceBeat(nowMs);
  }

  draw(p5) {
    const nowMs = p5.millis();

    this.ensureBeat(nowMs);
    renderStoryBeat(p5, this.currentBeat, this.storyState, nowMs - this.beatStartedAtMs);
  }
}

export function createStoryEngine(initialStoryState) {
  return new StoryEngine(initialStoryState);
}
