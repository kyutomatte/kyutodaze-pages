import { mkdirSync, readdirSync, statSync, unlinkSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import sharp from "sharp";

const roots = ["public/assets/works", "public/assets/open-works"];
const mediaPattern = /\.(png|jpe?g|webp|gif|mp4|mov|webm)$/i;
const videoPattern = /\.(mp4|mov|webm)$/i;
const checkOnly = process.argv.includes("--check");
const force = process.argv.includes("--force");
const maxSize = Number(process.env.MEDIA_PREVIEW_SIZE ?? 960);
const quality = Number(process.env.MEDIA_PREVIEW_QUALITY ?? 76);
const scaleFilter = `scale=w='if(gt(iw,ih),min(${maxSize},iw),-2)':h='if(gt(iw,ih),-2,min(${maxSize},ih))'`;

function walk(directory) {
  const entries = [];

  for (const name of readdirSync(directory)) {
    const absolutePath = path.join(directory, name);
    const stats = statSync(absolutePath);

    if (stats.isDirectory()) {
      if (name !== "thumbs") entries.push(...walk(absolutePath));
    } else if (mediaPattern.test(name)) {
      entries.push(absolutePath);
    }
  }

  return entries;
}

function getPreviewPath(sourcePath) {
  return path.join(path.dirname(sourcePath), "thumbs", `${path.basename(sourcePath)}.webp`);
}

function needsPreview(sourcePath, previewPath) {
  if (force) return true;

  try {
    return statSync(previewPath).mtimeMs < statSync(sourcePath).mtimeMs;
  } catch {
    return true;
  }
}

function buildFfmpegPosterArgs(sourcePath, posterPath) {
  return [
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    "-ss",
    "00:00:00.35",
    "-i",
    sourcePath,
    "-frames:v",
    "1",
    "-vf",
    scaleFilter,
    "-q:v",
    "4",
    "-an",
    posterPath
  ];
}

function run(command, args, sourcePath) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });

  if (result.status !== 0) {
    const message = result.stderr || result.stdout || `${command} exited with ${result.status}`;
    throw new Error(`${sourcePath}\n${message}`);
  }
}

async function convertImageToPreview(sourcePath, previewPath) {
  await sharp(sourcePath)
    .rotate()
    .resize({ width: maxSize, height: maxSize, fit: "inside", withoutEnlargement: true })
    .webp({ quality, effort: 4 })
    .toFile(previewPath);
}

async function generatePreview(sourcePath, previewPath) {
  mkdirSync(path.dirname(previewPath), { recursive: true });

  if (!videoPattern.test(sourcePath)) {
    await convertImageToPreview(sourcePath, previewPath);
    return;
  }

  const posterPath = path.join(path.dirname(previewPath), `.${path.basename(sourcePath)}.preview.jpg`);

  try {
    run("ffmpeg", buildFfmpegPosterArgs(sourcePath, posterPath), sourcePath);
    await convertImageToPreview(posterPath, previewPath);
  } finally {
    try {
      unlinkSync(posterPath);
    } catch {
      // Temporary poster may not exist when ffmpeg fails.
    }
  }
}

const sources = roots.flatMap((root) => {
  try {
    return walk(root);
  } catch {
    return [];
  }
});

const stale = sources
  .map((sourcePath) => ({ sourcePath, previewPath: getPreviewPath(sourcePath) }))
  .filter(({ sourcePath, previewPath }) => needsPreview(sourcePath, previewPath));

if (checkOnly) {
  if (stale.length > 0) {
    console.error(`${stale.length} media preview files are missing or stale.`);
    for (const { previewPath } of stale.slice(0, 40)) console.error(previewPath);
    process.exitCode = 1;
  } else {
    console.log(`All ${sources.length} media preview files are current.`);
  }
} else {
  for (const [index, { sourcePath, previewPath }] of stale.entries()) {
    await generatePreview(sourcePath, previewPath);
    console.log(`[${index + 1}/${stale.length}] ${previewPath}`);
  }

  console.log(`Generated ${stale.length} media preview files. Checked ${sources.length} source files.`);
}
