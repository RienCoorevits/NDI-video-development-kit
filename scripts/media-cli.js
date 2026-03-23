#!/usr/bin/env node

import { access, mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { spawn } from 'node:child_process';

const PROJECT_ROOT = process.cwd();
const DEFAULT_MEDIA_DIR = 'Images/Scenes';
const DEFAULT_VIDEO_ROOT = 'Images/Video';
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
      The folder structure under Video is mirrored under Sequences, with one subfolder per source filename.

  clean-plate <input-or-dir> [--method median|average] [--samples <n>] [--start <time>] [--duration <time>] [--width <px>] [--format png|jpg]
      Build a clean plate from a video or folder of videos in ${DEFAULT_VIDEO_ROOT}.
      Outputs are mirrored under ${DEFAULT_CLEAN_PLATE_ROOT}.

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
  npm run media -- video-to-sequence Images/Video/Locations/'Location 2.mp4' --fps 12 --format jpg
  npm run media -- clean-plate Images/Video/Scenes/Scene1.mp4 --method median --samples 24 --output output/scene1-clean-plate.png
  npm run media -- clean-plate Images/Video/Scenes --samples 16 --width 1280
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

async function ensureParentDir(filePath) {
  await mkdir(path.dirname(filePath), {
    recursive: true
  });
}

function spawnCommand(command, args, { inheritStdio = true } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: inheritStdio ? 'inherit' : ['ignore', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    if (!inheritStdio) {
      child.stdout.on('data', (chunk) => {
        stdout += chunk.toString();
      });

      child.stderr.on('data', (chunk) => {
        stderr += chunk.toString();
      });
    }

    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve({
          stderr,
          stdout
        });
        return;
      }

      reject(new Error(stderr.trim() || `${command} exited with code ${code ?? 'unknown'}`));
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

function buildMirroredSequenceDir(inputAbsolutePath) {
  return buildMirroredPath(inputAbsolutePath, DEFAULT_VIDEO_ROOT, DEFAULT_SEQUENCE_ROOT, 'png', {
    nestByBasename: true
  });
}

function buildMirroredCleanPlatePath(inputAbsolutePath, format) {
  const extension = format === 'jpeg' ? 'jpg' : format;
  return buildMirroredPath(inputAbsolutePath, DEFAULT_VIDEO_ROOT, DEFAULT_CLEAN_PLATE_ROOT, extension);
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

  console.log(result.stdout.trim());
}

async function getDurationSeconds(inputAbsolutePath) {
  await ensureFfprobe();

  const result = await spawnCommand('ffprobe', [
    '-v',
    'error',
    '-show_entries',
    'format=duration',
    '-of',
    'default=noprint_wrappers=1:nokey=1',
    inputAbsolutePath
  ], {
    inheritStdio: false
  });
  const durationSeconds = Number(result.stdout.trim());

  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    throw new Error(`Unable to determine duration for ${toPosix(path.relative(PROJECT_ROOT, inputAbsolutePath))}`);
  }

  return durationSeconds;
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

  const args = [
    '-y',
    '-i',
    absoluteInputPath
  ];

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

async function createCleanPlate(inputAbsolutePath, options) {
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
    : buildMirroredCleanPlatePath(inputAbsolutePath, format);

  await ensureParentDir(outputPath);

  const fullDurationSeconds = await getDurationSeconds(inputAbsolutePath);
  const startSeconds = options.start ? Number(options.start) : 0;
  const plateDurationSeconds = options.duration ? Number(options.duration) : Math.max(0, fullDurationSeconds - startSeconds);

  if (!Number.isFinite(startSeconds) || startSeconds < 0) {
    throw new Error('clean-plate --start must be a non-negative number of seconds');
  }

  if (!Number.isFinite(plateDurationSeconds) || plateDurationSeconds <= 0) {
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

    if (plateDurationSeconds < fullDurationSeconds) {
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

    await createCleanPlate(targetPath, options);
    return;
  }

  const videoFiles = await collectVideoFiles(targetPath);

  if (videoFiles.length === 0) {
    console.log('No video files found.');
    return;
  }

  for (const filePath of videoFiles) {
    await createCleanPlate(filePath, {
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

  if (command === 'clean-plate') {
    await handleCleanPlate(positional[0] || DEFAULT_VIDEO_ROOT, options);
    return;
  }

  throw new Error(`Unknown command: ${command}`);
}

main().catch((error) => {
  console.error(`[media-cli] ${error.message}`);
  process.exit(1);
});
