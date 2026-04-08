#!/usr/bin/env node

import { access, mkdir, readdir, rm } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { spawn } from 'node:child_process';

const PROJECT_ROOT = process.cwd();
const RIGID_STABILIZE_SCRIPT = path.join(PROJECT_ROOT, 'scripts', 'rigid_stabilize.py');
const DEFAULT_MEDIA_DIR = 'Images/Scenes';
const DEFAULT_VIDEO_ROOT = 'Images/Video';
const DEFAULT_STABILIZE_ROOT = 'Images/Stabilize';
const DEFAULT_SEQUENCE_ROOT = 'Images/Sequences';
const DEFAULT_CLEAN_PLATE_ROOT = 'Images/CleanPlates';

const MEDIA_EXTENSIONS = new Set([
  '.mp4',
  '.mov',
  '.m4v',
  '.avi',
  '.mkv',
  '.webm',
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.tif',
  '.tiff'
]);

const VIDEO_EXTENSIONS = new Set([
  '.mp4',
  '.mov',
  '.m4v',
  '.avi',
  '.mkv',
  '.webm'
]);

function printHelp() {
  console.log(`
Media CLI

Usage:
  npm run media -- <command> [options]

Commands:
  list [dir]
      List media files recursively. Default dir: ${DEFAULT_MEDIA_DIR}

  probe <input>
      Show ffprobe JSON metadata for a file.

  trim <input> --start <time> (--duration <time> | --end <time>) --output <file>
      Trim a video clip without re-encoding audio/video streams.

  frames <input> [--fps <n>] [--format png|jpg] [--output-dir <dir>]
      Extract frames from a video into an output directory.

  contact-sheet <input> [--columns <n>] [--rows <n>] [--width <px>] --output <file>
      Build a thumbnail contact sheet image.

  gif <input> [--start <time>] [--duration <time>] [--fps <n>] [--width <px>] --output <file>
      Export a GIF preview clip.

  transcode <input> [--width <px>] [--fps <n>] --output <file>
      Re-encode a video to H.264/AAC MP4.

  video-to-sequence <input-or-dir> [--fps <n>] [--format png|jpg]
      Convert a video or a folder of videos from ${DEFAULT_VIDEO_ROOT} into image sequences under ${DEFAULT_SEQUENCE_ROOT}.

  stabilize-shot <input-or-dir> [--width <px>] [--analysis-width <px>] [--smooth-radius <n>] [--max-shift-ratio <n>] [--max-rotation-deg <n>]
      Apply rigid x/y + rotation stabilization only, with no frame warping, from ${DEFAULT_VIDEO_ROOT} into ${DEFAULT_STABILIZE_ROOT}.

  clean-plate <input-or-dir> [--method median|average] [--samples <n>] [--start <time>] [--duration <time>] [--width <px>] [--format png|jpg]
      Build a legacy temporal clean plate from ${DEFAULT_VIDEO_ROOT}.

  clean-plate-stack <input-or-dir> [--samples <n>|all] [--start <time>] [--duration <time>] [--width <px>] [--format png|jpg] [--prefer-bright] [--bright-window <n>] [--bright-percentile <n>] [--bright-min-samples <n>]
      Build a Photoshop-style median stack clean plate from any video path. Stabilized input is recommended.

  clean-plate-masked <input-or-dir> [--samples <n>] [--start <time>] [--duration <time>] [--width <px>] [--format png|jpg] [--threshold <n>] [--grow <n>]
      Build a masked clean plate from stabilized shots in ${DEFAULT_STABILIZE_ROOT}.
      This is an alternate experimental workflow.

Options:
  --help
      Show this help.

Examples:
  npm run media -- list
  npm run media -- probe Images/Scenes/Scene1.mp4
  npm run media -- trim Images/Scenes/Scene1.mp4 --start 00:00:05 --duration 4 --output output/scene1-trim.mp4
  npm run media -- frames Images/Scenes/Scene1.mp4 --fps 12 --output-dir output/scene1-frames
  npm run media -- contact-sheet Images/Scenes/Scene1.mp4 --columns 4 --rows 3 --output output/scene1-sheet.jpg
  npm run media -- gif Images/Scenes/Scene1.mp4 --start 2 --duration 3 --fps 10 --width 720 --output output/scene1.gif
  npm run media -- transcode Images/Scenes/Scene1.mp4 --width 1280 --fps 24 --output output/scene1-h264.mp4
  npm run media -- video-to-sequence Images/Video/Scenes
  npm run media -- stabilize-shot Images/Video/Scenes/Scene1.mp4
  npm run media -- stabilize-shot Images/Video/Scenes/Scene1.mp4 --analysis-width 240
  npm run media -- stabilize-shot Images/Video/Scenes/Scene1.mp4 --smooth-radius 21 --max-shift-ratio 0.01 --max-rotation-deg 1.0
  npm run media -- clean-plate Images/Video/Scenes/Scene1.mp4 --method median --samples 24
  npm run media -- clean-plate-stack Images/Stabilize/Scenes/Scene1.mp4 --samples 48
  npm run media -- clean-plate-stack Images/Stabilize/Scenes/Scene1.mp4 --samples all
  npm run media -- clean-plate-stack Images/Stabilize/Scenes/Scene1.mp4 --samples all --prefer-bright
  npm run media -- clean-plate-stack Images/Stabilize/Scenes/Scene1.mp4 --samples all --prefer-bright --bright-percentile 35
  npm run media -- clean-plate-masked Images/Stabilize/Scenes/Scene1.mp4 --samples 24 --threshold 45 --grow 2
`.trim());
}

function toPosix(value) {
  return value.split(path.sep).join('/');
}

function resolveProjectPath(targetPath) {
  if (!targetPath) {
    return PROJECT_ROOT;
  }

  return path.resolve(PROJECT_ROOT, targetPath);
}

async function pathExists(targetPath) {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function collectMediaFiles(rootDir) {
  const entries = await readdir(rootDir, {
    recursive: true,
    withFileTypes: true
  });

  return entries
    .filter((entry) => entry.isFile() && MEDIA_EXTENSIONS.has(path.extname(entry.name).toLowerCase()))
    .map((entry) => path.join(entry.parentPath, entry.name))
    .sort((left, right) => left.localeCompare(right));
}

async function collectVideoFiles(rootDir) {
  const entries = await readdir(rootDir, {
    recursive: true,
    withFileTypes: true
  });

  return entries
    .filter((entry) => entry.isFile() && VIDEO_EXTENSIONS.has(path.extname(entry.name).toLowerCase()))
    .map((entry) => path.join(entry.parentPath, entry.name))
    .sort((left, right) => left.localeCompare(right));
}

function parseArgs(argv) {
  const positional = [];
  const options = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (!token.startsWith('--')) {
      positional.push(token);
      continue;
    }

    const key = token.slice(2);
    const nextToken = argv[index + 1];

    if (!nextToken || nextToken.startsWith('--')) {
      options[key] = true;
      continue;
    }

    options[key] = nextToken;
    index += 1;
  }

  return {
    command: positional[0] ?? null,
    positional: positional.slice(1),
    options
  };
}

function assertOption(options, name, message) {
  const value = options[name];

  if (value === undefined || value === true || value === '') {
    throw new Error(message);
  }

  return value;
}

function parseTimeValue(value, label) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  if (typeof value === 'number') {
    return value;
  }

  const input = String(value).trim();

  if (/^\d+(\.\d+)?$/.test(input)) {
    return Number(input);
  }

  const parts = input.split(':').map((part) => Number(part));

  if (parts.some((part) => !Number.isFinite(part) || part < 0)) {
    throw new Error(`${label} must be a number of seconds or a HH:MM:SS value`);
  }

  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }

  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }

  throw new Error(`${label} must be a number of seconds or a HH:MM:SS value`);
}

function buildOutputPath(inputPath, options, fallbackSuffix) {
  if (options.output) {
    return resolveProjectPath(String(options.output));
  }

  const inputAbsolutePath = resolveProjectPath(inputPath);
  const inputBasename = path.basename(inputAbsolutePath, path.extname(inputAbsolutePath));
  return path.join(PROJECT_ROOT, 'output', `${inputBasename}${fallbackSuffix}`);
}

function buildMirroredPath(inputAbsolutePath, sourceRoot, outputRoot, extension, { nestByBasename = false } = {}) {
  const sourceRootPath = resolveProjectPath(sourceRoot);
  const outputRootPath = resolveProjectPath(outputRoot);
  const relativeInputPath = path.relative(sourceRootPath, inputAbsolutePath);

  if (relativeInputPath.startsWith('..') || path.isAbsolute(relativeInputPath)) {
    throw new Error(`Input must be inside ${sourceRoot}`);
  }

  const relativeDirectory = path.dirname(relativeInputPath);
  const basename = path.basename(inputAbsolutePath, path.extname(inputAbsolutePath));

  if (nestByBasename) {
    return path.join(outputRootPath, relativeDirectory, basename);
  }

  return path.join(outputRootPath, relativeDirectory, `${basename}.${extension}`);
}

function tryBuildMirroredPath(inputAbsolutePath, sourceRoot, outputRoot, extension, options = {}) {
  try {
    return buildMirroredPath(inputAbsolutePath, sourceRoot, outputRoot, extension, options);
  } catch {
    return null;
  }
}

function buildMirroredSequenceDir(inputAbsolutePath) {
  return buildMirroredPath(inputAbsolutePath, DEFAULT_VIDEO_ROOT, DEFAULT_SEQUENCE_ROOT, 'png', {
    nestByBasename: true
  });
}

function buildMirroredStabilizePath(inputAbsolutePath) {
  return buildMirroredPath(inputAbsolutePath, DEFAULT_VIDEO_ROOT, DEFAULT_STABILIZE_ROOT, 'mp4');
}

function buildMirroredLegacyCleanPlatePath(inputAbsolutePath, format) {
  const extension = format === 'jpeg' ? 'jpg' : format;
  return buildMirroredPath(inputAbsolutePath, DEFAULT_VIDEO_ROOT, DEFAULT_CLEAN_PLATE_ROOT, extension);
}

function buildMirroredMaskedCleanPlatePath(inputAbsolutePath, format) {
  const extension = format === 'jpeg' ? 'jpg' : format;
  return buildMirroredPath(inputAbsolutePath, DEFAULT_STABILIZE_ROOT, DEFAULT_CLEAN_PLATE_ROOT, extension);
}

function buildFlexibleCleanPlatePath(inputAbsolutePath, format, batchRoot = null) {
  const extension = format === 'jpeg' ? 'jpg' : format;
  const mirroredPath = (
    tryBuildMirroredPath(inputAbsolutePath, DEFAULT_STABILIZE_ROOT, DEFAULT_CLEAN_PLATE_ROOT, extension) ||
    tryBuildMirroredPath(inputAbsolutePath, DEFAULT_VIDEO_ROOT, DEFAULT_CLEAN_PLATE_ROOT, extension)
  );

  if (mirroredPath) {
    return mirroredPath;
  }

  if (batchRoot) {
    const relativeInputPath = path.relative(batchRoot, inputAbsolutePath);

    if (!relativeInputPath.startsWith('..') && !path.isAbsolute(relativeInputPath)) {
      const relativeDirectory = path.dirname(relativeInputPath);
      const basename = path.basename(inputAbsolutePath, path.extname(inputAbsolutePath));
      return path.join(PROJECT_ROOT, 'output', 'clean-plates', relativeDirectory, `${basename}.${extension}`);
    }
  }

  const basename = path.basename(inputAbsolutePath, path.extname(inputAbsolutePath));
  return path.join(PROJECT_ROOT, 'output', `${basename}-clean-plate-stack.${extension}`);
}

function formatSeconds(value) {
  return Number(value).toFixed(2);
}

function printProgressLine(message, { replace = false } = {}) {
  if (replace && process.stdout.isTTY) {
    process.stdout.write(`\r${message}`);
    return;
  }

  console.log(message);
}

function finishProgressLine() {
  if (process.stdout.isTTY) {
    process.stdout.write('\n');
  }
}

async function ensureParentDir(filePath) {
  await mkdir(path.dirname(filePath), {
    recursive: true
  });
}

function spawnCommand(command, args, { inheritStdio = true, inputBuffer = null } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: inheritStdio ? ['pipe', 'inherit', 'inherit'] : ['pipe', 'pipe', 'pipe']
    });

    const stdoutChunks = [];
    const stderrChunks = [];

    if (!inheritStdio) {
      child.stdout.on('data', (chunk) => {
        stdoutChunks.push(chunk);
      });

      child.stderr.on('data', (chunk) => {
        stderrChunks.push(chunk);
      });
    }

    child.on('error', reject);

    if (inputBuffer) {
      child.stdin.write(inputBuffer);
    }

    child.stdin.end();

    child.on('exit', (code) => {
      const stdout = Buffer.concat(stdoutChunks);
      const stderr = Buffer.concat(stderrChunks);

      if (code === 0) {
        resolve({
          stderr,
          stdout
        });
        return;
      }

      reject(new Error(stderr.toString().trim() || `${command} exited with code ${code ?? 'unknown'}`));
    });
  });
}

async function ensureFfmpeg() {
  try {
    await spawnCommand('ffmpeg', ['-version'], {
      inheritStdio: false
    });
  } catch {
    throw new Error('ffmpeg is required but was not found on PATH. Install ffmpeg first.');
  }
}

async function ensureFfprobe() {
  try {
    await spawnCommand('ffprobe', ['-version'], {
      inheritStdio: false
    });
  } catch {
    throw new Error('ffprobe is required but was not found on PATH. Install ffmpeg/ffprobe first.');
  }
}

async function validateInputFile(inputPath) {
  const absoluteInputPath = resolveProjectPath(inputPath);

  if (!(await pathExists(absoluteInputPath))) {
    throw new Error(`Input file not found: ${inputPath}`);
  }

  return absoluteInputPath;
}

async function validateInputPath(inputPath) {
  const absoluteInputPath = resolveProjectPath(inputPath);

  if (!(await pathExists(absoluteInputPath))) {
    throw new Error(`Input path not found: ${inputPath}`);
  }

  return absoluteInputPath;
}

async function isDirectory(targetPath) {
  try {
    const entries = await readdir(targetPath);
    return Array.isArray(entries);
  } catch {
    return false;
  }
}

async function getVideoInfo(inputAbsolutePath) {
  await ensureFfprobe();

  const result = await spawnCommand('ffprobe', [
    '-v',
    'error',
    '-print_format',
    'json',
    '-show_entries',
    'stream=width,height,avg_frame_rate,r_frame_rate,nb_frames:format=duration',
    inputAbsolutePath
  ], {
    inheritStdio: false
  });

  const parsed = JSON.parse(result.stdout.toString());
  const videoStream = Array.isArray(parsed.streams)
    ? parsed.streams.find((stream) => Number.isFinite(Number(stream.width)) && Number.isFinite(Number(stream.height)))
    : null;
  const durationSeconds = Number(parsed.format?.duration);

  if (!videoStream || !Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    throw new Error(`Unable to determine video metadata for ${toPosix(path.relative(PROJECT_ROOT, inputAbsolutePath))}`);
  }

  const frameRateSource = String(videoStream.avg_frame_rate || videoStream.r_frame_rate || '0/0');
  const [frameRateNumerator, frameRateDenominator] = frameRateSource.split('/').map((part) => Number(part));
  const fps = (
    Number.isFinite(frameRateNumerator) &&
    Number.isFinite(frameRateDenominator) &&
    frameRateDenominator > 0
  )
    ? frameRateNumerator / frameRateDenominator
    : 0;
  const frameCount = Number(videoStream.nb_frames);

  return {
    durationSeconds,
    fps: Number.isFinite(fps) && fps > 0 ? fps : 0,
    frameCount: Number.isFinite(frameCount) && frameCount > 0 ? Math.floor(frameCount) : null,
    height: Number(videoStream.height),
    width: Number(videoStream.width)
  };
}

function computeScaledDimensions(width, height, targetWidth = null) {
  if (!targetWidth) {
    return {
      height,
      width
    };
  }

  const scaledWidth = Math.max(2, Math.floor(Number(targetWidth) / 2) * 2);
  const scaledHeight = Math.max(2, Math.floor((height * scaledWidth) / width / 2) * 2);

  return {
    height: scaledHeight,
    width: scaledWidth
  };
}

function inferRgbaFrameHeight(frame, width) {
  const rowSize = width * 4;

  if (rowSize <= 0 || frame.length % rowSize !== 0) {
    return null;
  }

  return frame.length / rowSize;
}

function parsePositiveInteger(value, label, { min = 1 } = {}) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue) || numericValue < min) {
    throw new Error(`${label} must be at least ${min}`);
  }

  return Math.floor(numericValue);
}

function parsePercentage(value, label) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue) || numericValue <= 0 || numericValue > 100) {
    throw new Error(`${label} must be greater than 0 and less than or equal to 100`);
  }

  return numericValue;
}

function parseStackSamplesOption(value) {
  if (value === undefined || value === null || value === '') {
    return 48;
  }

  if (typeof value === 'string' && value.trim().toLowerCase() === 'all') {
    return 'all';
  }

  return parsePositiveInteger(value, 'clean-plate-stack --samples', { min: 3 });
}

function buildStackSampleTimes(videoInfo, startSeconds, plateDurationSeconds, samplesOption) {
  if (samplesOption !== 'all') {
    return Array.from({ length: samplesOption }, (_, index) => {
      const ratio = samplesOption === 1 ? 0.5 : (index + 0.5) / samplesOption;
      return startSeconds + plateDurationSeconds * ratio;
    });
  }

  const fps = videoInfo.fps;

  if (!Number.isFinite(fps) || fps <= 0) {
    throw new Error('clean-plate-stack --samples all requires readable frame-rate metadata');
  }

  const startFrame = Math.max(0, Math.floor(startSeconds * fps));
  const endSeconds = startSeconds + plateDurationSeconds;
  let endFrameExclusive = Math.max(startFrame + 1, Math.ceil(endSeconds * fps));

  if (videoInfo.frameCount) {
    endFrameExclusive = Math.min(endFrameExclusive, videoInfo.frameCount);
  }

  const sampleTimes = [];

  for (let frameIndex = startFrame; frameIndex < endFrameExclusive; frameIndex += 1) {
    sampleTimes.push(frameIndex / fps);
  }

  return sampleTimes;
}

function pixelLuma(red, green, blue) {
  return red * 0.2126 + green * 0.7152 + blue * 0.0722;
}

function medianFromValues(values) {
  if (values.length === 0) {
    return 0;
  }

  values.sort((left, right) => left - right);
  return values[Math.floor(values.length / 2)];
}

function parseBrightBiasOptions(options, sampleCount) {
  const preferBright = Boolean(options['prefer-bright']);

  if (!preferBright) {
    return null;
  }

  const brightWindow = options['bright-window'] === undefined
    ? 24
    : parsePositiveInteger(options['bright-window'], 'clean-plate-stack --bright-window');
  const brightPercentile = options['bright-percentile'] === undefined
    ? null
    : parsePercentage(options['bright-percentile'], 'clean-plate-stack --bright-percentile');
  const brightMinSamples = options['bright-min-samples'] === undefined
    ? Math.min(sampleCount, Math.max(3, Math.ceil(sampleCount * 0.15)))
    : parsePositiveInteger(options['bright-min-samples'], 'clean-plate-stack --bright-min-samples');

  return {
    brightMinSamples: Math.min(sampleCount, brightMinSamples),
    brightPercentile,
    brightWindow
  };
}

function composeMedianPlate(frames, width, height, brightBias = null) {
  const output = new Uint8Array(width * height * 4);

  for (let index = 0; index < width * height; index += 1) {
    const valuesR = [];
    const valuesG = [];
    const valuesB = [];
    const valuesLuma = [];

    for (const frame of frames) {
      const pixelOffset = index * 4;
      valuesR.push(frame[pixelOffset]);
      valuesG.push(frame[pixelOffset + 1]);
      valuesB.push(frame[pixelOffset + 2]);
      valuesLuma.push(pixelLuma(
        frame[pixelOffset],
        frame[pixelOffset + 1],
        frame[pixelOffset + 2]
      ));
    }

    if (brightBias) {
      const brightValuesR = [];
      const brightValuesG = [];
      const brightValuesB = [];

      if (brightBias.brightPercentile !== null) {
        const orderedIndices = valuesLuma
          .map((luma, sampleIndex) => ({ luma, sampleIndex }))
          .sort((left, right) => right.luma - left.luma);
        const keepCount = Math.ceil((orderedIndices.length * brightBias.brightPercentile) / 100);

        for (let sampleIndex = 0; sampleIndex < keepCount; sampleIndex += 1) {
          const orderedSampleIndex = orderedIndices[sampleIndex].sampleIndex;
          brightValuesR.push(valuesR[orderedSampleIndex]);
          brightValuesG.push(valuesG[orderedSampleIndex]);
          brightValuesB.push(valuesB[orderedSampleIndex]);
        }
      } else {
        let maxLuma = 0;

        for (const luma of valuesLuma) {
          if (luma > maxLuma) {
            maxLuma = luma;
          }
        }

        const lumaFloor = maxLuma - brightBias.brightWindow;

        for (let sampleIndex = 0; sampleIndex < valuesLuma.length; sampleIndex += 1) {
          if (valuesLuma[sampleIndex] < lumaFloor) {
            continue;
          }

          brightValuesR.push(valuesR[sampleIndex]);
          brightValuesG.push(valuesG[sampleIndex]);
          brightValuesB.push(valuesB[sampleIndex]);
        }
      }

      if (brightValuesR.length >= brightBias.brightMinSamples) {
        valuesR.length = 0;
        valuesG.length = 0;
        valuesB.length = 0;
        valuesR.push(...brightValuesR);
        valuesG.push(...brightValuesG);
        valuesB.push(...brightValuesB);
      }
    }

    const pixelOffset = index * 4;
    output[pixelOffset] = medianFromValues(valuesR);
    output[pixelOffset + 1] = medianFromValues(valuesG);
    output[pixelOffset + 2] = medianFromValues(valuesB);
    output[pixelOffset + 3] = 255;
  }

  return output;
}

function dilateMask(mask, width, height, radius) {
  if (radius <= 0) {
    return mask;
  }

  let source = mask;

  for (let pass = 0; pass < radius; pass += 1) {
    const target = new Uint8Array(source.length);

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const index = y * width + x;

        if (source[index]) {
          target[index] = 1;
          continue;
        }

        let covered = 0;

        for (let offsetY = -1; offsetY <= 1 && !covered; offsetY += 1) {
          const nextY = y + offsetY;

          if (nextY < 0 || nextY >= height) {
            continue;
          }

          for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
            const nextX = x + offsetX;

            if (nextX < 0 || nextX >= width) {
              continue;
            }

            if (source[nextY * width + nextX]) {
              covered = 1;
              break;
            }
          }
        }

        target[index] = covered;
      }
    }

    source = target;
  }

  return source;
}

function buildSilhouetteMask(rgbaFrame, width, height, threshold, grow) {
  const mask = new Uint8Array(width * height);

  for (let index = 0; index < width * height; index += 1) {
    const pixelOffset = index * 4;
    const luma = pixelLuma(
      rgbaFrame[pixelOffset],
      rgbaFrame[pixelOffset + 1],
      rgbaFrame[pixelOffset + 2]
    );

    if (luma <= threshold) {
      mask[index] = 1;
    }
  }

  return dilateMask(mask, width, height, grow);
}

function composeMaskedMedianPlate(frames, masks, width, height) {
  const output = new Uint8Array(width * height * 4);
  const holes = new Uint8Array(width * height);

  for (let index = 0; index < width * height; index += 1) {
    const valuesR = [];
    const valuesG = [];
    const valuesB = [];

    for (let frameIndex = 0; frameIndex < frames.length; frameIndex += 1) {
      if (masks[frameIndex][index]) {
        continue;
      }

      const pixelOffset = index * 4;
      valuesR.push(frames[frameIndex][pixelOffset]);
      valuesG.push(frames[frameIndex][pixelOffset + 1]);
      valuesB.push(frames[frameIndex][pixelOffset + 2]);
    }

    const pixelOffset = index * 4;

    if (valuesR.length === 0) {
      holes[index] = 1;
      output[pixelOffset + 3] = 255;
      continue;
    }

    output[pixelOffset] = medianFromValues(valuesR);
    output[pixelOffset + 1] = medianFromValues(valuesG);
    output[pixelOffset + 2] = medianFromValues(valuesB);
    output[pixelOffset + 3] = 255;
  }

  return {
    holes,
    output
  };
}

function fillPlateHoles(output, holes, frames, width, height) {
  const workingHoles = holes.slice();
  let pass = 0;

  while (pass < 32) {
    let filledThisPass = 0;

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const index = y * width + x;

        if (!workingHoles[index]) {
          continue;
        }

        let red = 0;
        let green = 0;
        let blue = 0;
        let count = 0;

        for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
          const nextY = y + offsetY;

          if (nextY < 0 || nextY >= height) {
            continue;
          }

          for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
            const nextX = x + offsetX;

            if (nextX < 0 || nextX >= width || (offsetX === 0 && offsetY === 0)) {
              continue;
            }

            const neighborIndex = nextY * width + nextX;

            if (workingHoles[neighborIndex]) {
              continue;
            }

            const pixelOffset = neighborIndex * 4;
            red += output[pixelOffset];
            green += output[pixelOffset + 1];
            blue += output[pixelOffset + 2];
            count += 1;
          }
        }

        if (count === 0) {
          continue;
        }

        const pixelOffset = index * 4;
        output[pixelOffset] = Math.round(red / count);
        output[pixelOffset + 1] = Math.round(green / count);
        output[pixelOffset + 2] = Math.round(blue / count);
        output[pixelOffset + 3] = 255;
        workingHoles[index] = 0;
        filledThisPass += 1;
      }
    }

    if (filledThisPass === 0) {
      break;
    }

    pass += 1;
  }

  for (let index = 0; index < width * height; index += 1) {
    if (!workingHoles[index]) {
      continue;
    }

    const valuesR = [];
    const valuesG = [];
    const valuesB = [];

    for (const frame of frames) {
      const pixelOffset = index * 4;
      valuesR.push(frame[pixelOffset]);
      valuesG.push(frame[pixelOffset + 1]);
      valuesB.push(frame[pixelOffset + 2]);
    }

    const pixelOffset = index * 4;
    output[pixelOffset] = medianFromValues(valuesR);
    output[pixelOffset + 1] = medianFromValues(valuesG);
    output[pixelOffset + 2] = medianFromValues(valuesB);
    output[pixelOffset + 3] = 255;
  }
}

async function extractFrameRgba(inputAbsolutePath, timeSeconds, width = null) {
  const filters = [];

  if (width) {
    filters.push(`scale=${Number(width)}:-2`);
  }

  const args = [
    '-v',
    'error',
    '-ss',
    String(timeSeconds),
    '-i',
    inputAbsolutePath,
    '-frames:v',
    '1'
  ];

  if (filters.length > 0) {
    args.push('-vf', filters.join(','));
  }

  args.push(
    '-pix_fmt',
    'rgba',
    '-f',
    'rawvideo',
    'pipe:1'
  );

  const result = await spawnCommand('ffmpeg', args, {
    inheritStdio: false
  });

  return new Uint8Array(result.stdout);
}

async function writeRgbaImage(outputPath, rgbaBuffer, width, height) {
  await ensureParentDir(outputPath);

  await spawnCommand('ffmpeg', [
    '-y',
    '-f',
    'rawvideo',
    '-pix_fmt',
    'rgba',
    '-s',
    `${width}x${height}`,
    '-i',
    'pipe:0',
    '-frames:v',
    '1',
    '-update',
    '1',
    outputPath
  ], {
    inheritStdio: false,
    inputBuffer: Buffer.from(rgbaBuffer)
  });
}

async function handleList(targetDir) {
  const absoluteDir = resolveProjectPath(targetDir || DEFAULT_MEDIA_DIR);

  if (!(await pathExists(absoluteDir))) {
    throw new Error(`Directory not found: ${targetDir || DEFAULT_MEDIA_DIR}`);
  }

  const files = await collectMediaFiles(absoluteDir);

  if (files.length === 0) {
    console.log('No media files found.');
    return;
  }

  files.forEach((filePath) => {
    console.log(toPosix(path.relative(PROJECT_ROOT, filePath)));
  });
}

async function handleProbe(inputPath) {
  await ensureFfprobe();
  const absoluteInputPath = await validateInputFile(inputPath);
  const result = await spawnCommand('ffprobe', [
    '-v',
    'error',
    '-print_format',
    'json',
    '-show_format',
    '-show_streams',
    absoluteInputPath
  ], {
    inheritStdio: false
  });

  console.log(result.stdout.toString().trim());
}

async function handleTrim(inputPath, options) {
  await ensureFfmpeg();
  const absoluteInputPath = await validateInputFile(inputPath);
  const start = assertOption(options, 'start', 'trim requires --start');
  const outputPath = buildOutputPath(inputPath, options, '-trim.mp4');
  const args = ['-y', '-ss', String(start), '-i', absoluteInputPath];

  if (options.duration) {
    args.push('-t', String(options.duration));
  } else if (options.end) {
    args.push('-to', String(options.end));
  } else {
    throw new Error('trim requires either --duration or --end');
  }

  args.push('-c', 'copy', outputPath);

  await ensureParentDir(outputPath);
  await spawnCommand('ffmpeg', args);
  console.log(`Wrote ${toPosix(path.relative(PROJECT_ROOT, outputPath))}`);
}

async function handleFrames(inputPath, options) {
  await ensureFfmpeg();
  const absoluteInputPath = await validateInputFile(inputPath);
  const fps = options.fps ? Number(options.fps) : 12;
  const format = String(options.format || 'png').toLowerCase();
  const inputBasename = path.basename(inputPath, path.extname(inputPath));
  const outputDir = resolveProjectPath(options['output-dir'] || path.join('output', `${inputBasename}-frames`));

  if (!['png', 'jpg', 'jpeg'].includes(format)) {
    throw new Error('frames --format must be png, jpg, or jpeg');
  }

  await mkdir(outputDir, {
    recursive: true
  });

  const pattern = path.join(outputDir, `frame-%05d.${format === 'jpeg' ? 'jpg' : format}`);
  await spawnCommand('ffmpeg', [
    '-y',
    '-i',
    absoluteInputPath,
    '-vf',
    `fps=${fps}`,
    pattern
  ]);
  console.log(`Wrote ${toPosix(path.relative(PROJECT_ROOT, outputDir))}`);
}

async function handleContactSheet(inputPath, options) {
  await ensureFfmpeg();
  const absoluteInputPath = await validateInputFile(inputPath);
  const columns = options.columns ? Number(options.columns) : 4;
  const rows = options.rows ? Number(options.rows) : 3;
  const width = options.width ? Number(options.width) : 320;
  const outputPath = buildOutputPath(inputPath, options, '-sheet.jpg');
  const tileWidth = Math.max(1, Math.floor(width));
  const filter = `fps=1,scale=${tileWidth}:-1,tile=${columns}x${rows}`;

  await ensureParentDir(outputPath);
  await spawnCommand('ffmpeg', [
    '-y',
    '-i',
    absoluteInputPath,
    '-frames:v',
    '1',
    '-vf',
    filter,
    outputPath
  ]);
  console.log(`Wrote ${toPosix(path.relative(PROJECT_ROOT, outputPath))}`);
}

async function handleGif(inputPath, options) {
  await ensureFfmpeg();
  const absoluteInputPath = await validateInputFile(inputPath);
  const outputPath = buildOutputPath(inputPath, options, '.gif');
  const fps = options.fps ? Number(options.fps) : 10;
  const width = options.width ? Number(options.width) : 720;
  const args = ['-y'];

  if (options.start) {
    args.push('-ss', String(options.start));
  }

  args.push('-i', absoluteInputPath);

  if (options.duration) {
    args.push('-t', String(options.duration));
  }

  args.push(
    '-vf',
    `fps=${fps},scale=${width}:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse`,
    outputPath
  );

  await ensureParentDir(outputPath);
  await spawnCommand('ffmpeg', args);
  console.log(`Wrote ${toPosix(path.relative(PROJECT_ROOT, outputPath))}`);
}

async function handleTranscode(inputPath, options) {
  await ensureFfmpeg();
  const absoluteInputPath = await validateInputFile(inputPath);
  const outputPath = buildOutputPath(inputPath, options, '-transcoded.mp4');
  const filters = [];

  if (options.width) {
    filters.push(`scale=${Number(options.width)}:-2`);
  }

  if (options.fps) {
    filters.push(`fps=${Number(options.fps)}`);
  }

  const args = ['-y', '-i', absoluteInputPath];

  if (filters.length > 0) {
    args.push('-vf', filters.join(','));
  }

  args.push(
    '-c:v',
    'libx264',
    '-pix_fmt',
    'yuv420p',
    '-c:a',
    'aac',
    '-movflags',
    '+faststart',
    outputPath
  );

  await ensureParentDir(outputPath);
  await spawnCommand('ffmpeg', args);
  console.log(`Wrote ${toPosix(path.relative(PROJECT_ROOT, outputPath))}`);
}

async function extractVideoSequence(inputAbsolutePath, options) {
  const format = String(options.format || 'png').toLowerCase();
  const fps = options.fps ? Number(options.fps) : null;

  if (!['png', 'jpg', 'jpeg'].includes(format)) {
    throw new Error('video-to-sequence --format must be png, jpg, or jpeg');
  }

  const outputDir = buildMirroredSequenceDir(inputAbsolutePath);
  const extension = format === 'jpeg' ? 'jpg' : format;
  const pattern = path.join(outputDir, `frame-%05d.${extension}`);
  const args = ['-y', '-i', inputAbsolutePath];

  if (fps) {
    args.push('-vf', `fps=${fps}`);
  }

  args.push(pattern);

  await mkdir(outputDir, {
    recursive: true
  });

  await spawnCommand('ffmpeg', args);
  console.log(`Wrote ${toPosix(path.relative(PROJECT_ROOT, outputDir))}`);
}

async function handleVideoToSequence(inputPath, options) {
  await ensureFfmpeg();

  const targetPath = await validateInputPath(inputPath || DEFAULT_VIDEO_ROOT);
  const targetIsDirectory = await isDirectory(targetPath);

  if (!targetIsDirectory) {
    if (!VIDEO_EXTENSIONS.has(path.extname(targetPath).toLowerCase())) {
      throw new Error('video-to-sequence input file must be a supported video format');
    }

    await extractVideoSequence(targetPath, options);
    return;
  }

  const videoFiles = await collectVideoFiles(targetPath);

  if (videoFiles.length === 0) {
    console.log('No video files found.');
    return;
  }

  for (const filePath of videoFiles) {
    await extractVideoSequence(filePath, options);
  }
}

async function stabilizeShot(inputAbsolutePath, options) {
  const outputPath = options.output
    ? resolveProjectPath(String(options.output))
    : buildMirroredStabilizePath(inputAbsolutePath);
  const smoothRadius = options['smooth-radius']
    ? parsePositiveInteger(options['smooth-radius'], 'stabilize-shot --smooth-radius')
    : 6;
  const temporaryOutputPath = `${outputPath}.silent.mp4`;

  await ensureParentDir(outputPath);

  try {
    await spawnCommand('python3', [
      RIGID_STABILIZE_SCRIPT,
      '--input',
      inputAbsolutePath,
      '--output',
      temporaryOutputPath,
      '--smooth-radius',
      String(smoothRadius),
      ...(options.width ? ['--width', String(Number(options.width))] : []),
      ...(options['analysis-width'] ? ['--analysis-width', String(Number(options['analysis-width']))] : []),
      ...(options['max-shift-ratio'] ? ['--max-shift-ratio', String(Number(options['max-shift-ratio']))] : []),
      ...(options['max-rotation-deg'] ? ['--max-rotation-deg', String(Number(options['max-rotation-deg']))] : [])
    ]);

    await spawnCommand('ffmpeg', [
      '-y',
      '-i',
      temporaryOutputPath,
      '-i',
      inputAbsolutePath,
      '-map',
      '0:v:0',
      '-map',
      '1:a?',
      '-c:v',
      'libx264',
      '-pix_fmt',
      'yuv420p',
      '-c:a',
      'aac',
      '-movflags',
      '+faststart',
      outputPath
    ]);
  } finally {
    if (await pathExists(temporaryOutputPath)) {
      await rm(temporaryOutputPath, {
        force: true
      });
    }
  }

  console.log(`Wrote ${toPosix(path.relative(PROJECT_ROOT, outputPath))}`);
}

async function handleStabilizeShot(inputPath, options) {
  await ensureFfmpeg();

  const targetPath = await validateInputPath(inputPath || DEFAULT_VIDEO_ROOT);
  const targetIsDirectory = await isDirectory(targetPath);

  if (!targetIsDirectory) {
    if (!VIDEO_EXTENSIONS.has(path.extname(targetPath).toLowerCase())) {
      throw new Error('stabilize-shot input file must be a supported video format');
    }

    await stabilizeShot(targetPath, options);
    return;
  }

  const videoFiles = await collectVideoFiles(targetPath);

  if (videoFiles.length === 0) {
    console.log('No video files found.');
    return;
  }

  for (const filePath of videoFiles) {
    await stabilizeShot(filePath, {
      ...options,
      output: undefined
    });
  }
}

async function createLegacyCleanPlate(inputAbsolutePath, options) {
  const format = String(options.format || 'png').toLowerCase();
  const samples = options.samples ? Number(options.samples) : 24;
  const method = String(options.method || 'median').toLowerCase();

  if (!['png', 'jpg', 'jpeg'].includes(format)) {
    throw new Error('clean-plate --format must be png, jpg, or jpeg');
  }

  if (!['average', 'median'].includes(method)) {
    throw new Error('clean-plate --method must be either median or average');
  }

  if (!Number.isFinite(samples) || samples < (method === 'median' ? 3 : 2)) {
    throw new Error(`clean-plate --samples must be at least ${method === 'median' ? 3 : 2} for ${method} mode`);
  }

  const outputPath = options.output
    ? resolveProjectPath(String(options.output))
    : buildMirroredLegacyCleanPlatePath(inputAbsolutePath, format);

  await ensureParentDir(outputPath);

  const videoInfo = await getVideoInfo(inputAbsolutePath);
  const startSeconds = parseTimeValue(options.start, 'clean-plate --start') ?? 0;
  const plateDurationSeconds = parseTimeValue(options.duration, 'clean-plate --duration')
    ?? Math.max(0, videoInfo.durationSeconds - startSeconds);

  if (plateDurationSeconds <= 0) {
    throw new Error('clean-plate --duration must be greater than 0 seconds');
  }

  if (method === 'average') {
    const sampleFps = samples / plateDurationSeconds;
    const weights = Array.from({
      length: Math.floor(samples)
    }, () => '1').join(' ');
    const filters = [`fps=${sampleFps}`];

    if (options.width) {
      filters.push(`scale=${Number(options.width)}:-2`);
    }

    filters.push(`tmix=frames=${Math.floor(samples)}:weights='${weights}'`);

    const args = ['-y'];

    if (startSeconds > 0) {
      args.push('-ss', String(startSeconds));
    }

    args.push('-i', inputAbsolutePath);

    if (plateDurationSeconds < videoInfo.durationSeconds) {
      args.push('-t', String(plateDurationSeconds));
    }

    args.push(
      '-an',
      '-vf',
      filters.join(','),
      '-update',
      '1',
      outputPath
    );

    await spawnCommand('ffmpeg', args);
    console.log(`Wrote ${toPosix(path.relative(PROJECT_ROOT, outputPath))}`);
    return;
  }

  const sampleCount = Math.floor(samples);
  const args = ['-y'];
  const filterChains = [];
  const medianInputs = [];

  for (let index = 0; index < sampleCount; index += 1) {
    const ratio = sampleCount === 1 ? 0.5 : (index + 0.5) / sampleCount;
    const sampleTime = startSeconds + plateDurationSeconds * ratio;

    args.push('-ss', String(sampleTime), '-i', inputAbsolutePath);

    const sourceLabel = `${index}:v`;
    const outputLabel = `v${index}`;

    if (options.width) {
      filterChains.push(`[${sourceLabel}]scale=${Number(options.width)}:-2[${outputLabel}]`);
      medianInputs.push(`[${outputLabel}]`);
    } else {
      medianInputs.push(`[${sourceLabel}]`);
    }
  }

  filterChains.push(`${medianInputs.join('')}xmedian=inputs=${sampleCount}[plate]`);

  args.push(
    '-an',
    '-filter_complex',
    filterChains.join(';'),
    '-map',
    '[plate]',
    '-frames:v',
    '1',
    '-update',
    '1',
    outputPath
  );

  await spawnCommand('ffmpeg', args);
  console.log(`Wrote ${toPosix(path.relative(PROJECT_ROOT, outputPath))}`);
}

async function handleCleanPlate(inputPath, options) {
  await ensureFfmpeg();

  const targetPath = await validateInputPath(inputPath || DEFAULT_VIDEO_ROOT);
  const targetIsDirectory = await isDirectory(targetPath);

  if (!targetIsDirectory) {
    if (!VIDEO_EXTENSIONS.has(path.extname(targetPath).toLowerCase())) {
      throw new Error('clean-plate input file must be a supported video format');
    }

    await createLegacyCleanPlate(targetPath, options);
    return;
  }

  const videoFiles = await collectVideoFiles(targetPath);

  if (videoFiles.length === 0) {
    console.log('No video files found.');
    return;
  }

  for (const filePath of videoFiles) {
    await createLegacyCleanPlate(filePath, {
      ...options,
      output: undefined
    });
  }
}

async function createMedianStackCleanPlate(inputAbsolutePath, options, batchRoot = null) {
  const format = String(options.format || 'png').toLowerCase();
  const samples = parseStackSamplesOption(options.samples);

  if (!['png', 'jpg', 'jpeg'].includes(format)) {
    throw new Error('clean-plate-stack --format must be png, jpg, or jpeg');
  }

  const outputPath = options.output
    ? resolveProjectPath(String(options.output))
    : buildFlexibleCleanPlatePath(inputAbsolutePath, format, batchRoot);

  const videoInfo = await getVideoInfo(inputAbsolutePath);
  const startSeconds = parseTimeValue(options.start, 'clean-plate-stack --start') ?? 0;
  const plateDurationSeconds = parseTimeValue(options.duration, 'clean-plate-stack --duration')
    ?? Math.max(0, videoInfo.durationSeconds - startSeconds);

  if (plateDurationSeconds <= 0) {
    throw new Error('clean-plate-stack --duration must be greater than 0 seconds');
  }

  const scaledSize = computeScaledDimensions(videoInfo.width, videoInfo.height, options.width ? Number(options.width) : null);
  const frames = [];
  const sampleTimes = buildStackSampleTimes(videoInfo, startSeconds, plateDurationSeconds, samples);
  let frameHeight = scaledSize.height;

  for (const sampleTime of sampleTimes) {
    const frame = await extractFrameRgba(inputAbsolutePath, sampleTime, scaledSize.width);

    if (frame.length === 0) {
      continue;
    }

    const inferredHeight = inferRgbaFrameHeight(frame, scaledSize.width);

    if (!inferredHeight) {
      throw new Error(`Unexpected raw frame size for ${toPosix(path.relative(PROJECT_ROOT, inputAbsolutePath))}`);
    }

    if (frames.length === 0) {
      frameHeight = inferredHeight;
    }

    if (inferredHeight !== frameHeight) {
      throw new Error(`Inconsistent raw frame size for ${toPosix(path.relative(PROJECT_ROOT, inputAbsolutePath))}`);
    }

    frames.push(frame);
  }

  if (frames.length === 0) {
    throw new Error(`Unable to extract any frames for ${toPosix(path.relative(PROJECT_ROOT, inputAbsolutePath))}`);
  }

  const brightBias = parseBrightBiasOptions(options, frames.length);
  const output = composeMedianPlate(frames, scaledSize.width, frameHeight, brightBias);
  await writeRgbaImage(outputPath, output, scaledSize.width, frameHeight);
  console.log(`Wrote ${toPosix(path.relative(PROJECT_ROOT, outputPath))}`);
}

async function handleCleanPlateStack(inputPath, options) {
  await ensureFfmpeg();

  const targetPath = await validateInputPath(inputPath || DEFAULT_STABILIZE_ROOT);
  const targetIsDirectory = await isDirectory(targetPath);

  if (!targetIsDirectory) {
    if (!VIDEO_EXTENSIONS.has(path.extname(targetPath).toLowerCase())) {
      throw new Error('clean-plate-stack input file must be a supported video format');
    }

    await createMedianStackCleanPlate(targetPath, options);
    return;
  }

  const videoFiles = await collectVideoFiles(targetPath);

  if (videoFiles.length === 0) {
    console.log('No video files found.');
    return;
  }

  for (const filePath of videoFiles) {
    await createMedianStackCleanPlate(filePath, {
      ...options,
      output: undefined
    }, targetPath);
  }
}

async function createMaskedCleanPlate(inputAbsolutePath, options) {
  const format = String(options.format || 'png').toLowerCase();
  const threshold = options.threshold ? Number(options.threshold) : 45;
  const grow = options.grow ? parsePositiveInteger(options.grow, 'clean-plate-masked --grow') : 2;
  const samples = options.samples ? parsePositiveInteger(options.samples, 'clean-plate-masked --samples', { min: 3 }) : 24;
  const relativeInputPath = toPosix(path.relative(PROJECT_ROOT, inputAbsolutePath));

  if (!['png', 'jpg', 'jpeg'].includes(format)) {
    throw new Error('clean-plate-masked --format must be png, jpg, or jpeg');
  }

  if (!Number.isFinite(threshold) || threshold < 0 || threshold > 255) {
    throw new Error('clean-plate-masked --threshold must be between 0 and 255');
  }

  const outputPath = options.output
    ? resolveProjectPath(String(options.output))
    : buildMirroredMaskedCleanPlatePath(inputAbsolutePath, format);

  const videoInfo = await getVideoInfo(inputAbsolutePath);
  const startSeconds = parseTimeValue(options.start, 'clean-plate-masked --start') ?? 0;
  const plateDurationSeconds = parseTimeValue(options.duration, 'clean-plate-masked --duration')
    ?? Math.max(0, videoInfo.durationSeconds - startSeconds);

  if (plateDurationSeconds <= 0) {
    throw new Error('clean-plate-masked --duration must be greater than 0 seconds');
  }

  const scaledSize = computeScaledDimensions(videoInfo.width, videoInfo.height, options.width ? Number(options.width) : null);
  const frames = [];
  const masks = [];
  let frameHeight = scaledSize.height;

  console.log(`[clean-plate-masked] ${relativeInputPath}`);
  console.log(`[clean-plate-masked] samples=${samples} range=${formatSeconds(startSeconds)}s-${formatSeconds(startSeconds + plateDurationSeconds)}s size=${scaledSize.width}x${scaledSize.height}`);

  for (let index = 0; index < samples; index += 1) {
    const ratio = samples === 1 ? 0.5 : (index + 0.5) / samples;
    const sampleTime = startSeconds + plateDurationSeconds * ratio;
    printProgressLine(
      `[clean-plate-masked] extracting sample ${index + 1}/${samples} at ${formatSeconds(sampleTime)}s`,
      { replace: true }
    );
    const frame = await extractFrameRgba(inputAbsolutePath, sampleTime, scaledSize.width);
    const inferredHeight = inferRgbaFrameHeight(frame, scaledSize.width);

    if (!inferredHeight) {
      finishProgressLine();
      throw new Error(`Unexpected raw frame size for ${toPosix(path.relative(PROJECT_ROOT, inputAbsolutePath))}`);
    }

    if (frames.length === 0) {
      frameHeight = inferredHeight;
    }

    if (inferredHeight !== frameHeight) {
      finishProgressLine();
      throw new Error(`Inconsistent raw frame size for ${toPosix(path.relative(PROJECT_ROOT, inputAbsolutePath))}`);
    }

    frames.push(frame);
    masks.push(buildSilhouetteMask(frame, scaledSize.width, frameHeight, threshold, grow));
  }

  finishProgressLine();
  console.log('[clean-plate-masked] composing masked median plate');
  const { holes, output } = composeMaskedMedianPlate(frames, masks, scaledSize.width, frameHeight);
  console.log('[clean-plate-masked] filling remaining holes');
  fillPlateHoles(output, holes, frames, scaledSize.width, frameHeight);
  console.log('[clean-plate-masked] writing output image');
  await writeRgbaImage(outputPath, output, scaledSize.width, frameHeight);
  console.log(`Wrote ${toPosix(path.relative(PROJECT_ROOT, outputPath))}`);
}

async function handleCleanPlateMasked(inputPath, options) {
  await ensureFfmpeg();

  const targetPath = await validateInputPath(inputPath || DEFAULT_STABILIZE_ROOT);
  const targetIsDirectory = await isDirectory(targetPath);

  if (!targetIsDirectory) {
    if (!VIDEO_EXTENSIONS.has(path.extname(targetPath).toLowerCase())) {
      throw new Error('clean-plate-masked input file must be a supported video format');
    }

    await createMaskedCleanPlate(targetPath, options);
    return;
  }

  const videoFiles = await collectVideoFiles(targetPath);

  if (videoFiles.length === 0) {
    console.log('No video files found.');
    return;
  }

  for (let index = 0; index < videoFiles.length; index += 1) {
    const filePath = videoFiles[index];
    console.log(`[clean-plate-masked] file ${index + 1}/${videoFiles.length}: ${toPosix(path.relative(PROJECT_ROOT, filePath))}`);
    await createMaskedCleanPlate(filePath, {
      ...options,
      output: undefined
    });
  }
}

async function main() {
  const { command, options, positional } = parseArgs(process.argv.slice(2));

  if (!command || options.help) {
    printHelp();
    return;
  }

  if (command === 'list') {
    await handleList(positional[0]);
    return;
  }

  if (command === 'probe') {
    if (!positional[0]) {
      throw new Error('probe requires an input file path');
    }

    await handleProbe(positional[0]);
    return;
  }

  if (command === 'trim') {
    if (!positional[0]) {
      throw new Error('trim requires an input file path');
    }

    await handleTrim(positional[0], options);
    return;
  }

  if (command === 'frames') {
    if (!positional[0]) {
      throw new Error('frames requires an input file path');
    }

    await handleFrames(positional[0], options);
    return;
  }

  if (command === 'contact-sheet') {
    if (!positional[0]) {
      throw new Error('contact-sheet requires an input file path');
    }

    await handleContactSheet(positional[0], options);
    return;
  }

  if (command === 'gif') {
    if (!positional[0]) {
      throw new Error('gif requires an input file path');
    }

    await handleGif(positional[0], options);
    return;
  }

  if (command === 'transcode') {
    if (!positional[0]) {
      throw new Error('transcode requires an input file path');
    }

    await handleTranscode(positional[0], options);
    return;
  }

  if (command === 'video-to-sequence') {
    await handleVideoToSequence(positional[0] || DEFAULT_VIDEO_ROOT, options);
    return;
  }

  if (command === 'stabilize-shot') {
    await handleStabilizeShot(positional[0] || DEFAULT_VIDEO_ROOT, options);
    return;
  }

  if (command === 'clean-plate') {
    await handleCleanPlate(positional[0] || DEFAULT_VIDEO_ROOT, options);
    return;
  }

  if (command === 'clean-plate-stack') {
    await handleCleanPlateStack(positional[0] || DEFAULT_STABILIZE_ROOT, options);
    return;
  }

  if (command === 'clean-plate-masked') {
    await handleCleanPlateMasked(positional[0] || DEFAULT_STABILIZE_ROOT, options);
    return;
  }

  throw new Error(`Unknown command: ${command}`);
}

main().catch((error) => {
  console.error(`[media-cli] ${error.message}`);
  process.exit(1);
});
