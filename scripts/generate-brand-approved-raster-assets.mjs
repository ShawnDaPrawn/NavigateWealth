import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const assetsDir = path.join(rootDir, 'public', 'brand-assets');
const sourceDir = path.join(assetsDir, 'extracted-source');

const sourcePaths = {
  full: path.join(sourceDir, '2_Logo_With_Icon', 'Navigate_Wealth_Logo_With_Icon@2x.png'),
  logoOnly: path.join(sourceDir, '3_Logo_Only', 'Navigate_Wealth_Logo_Only@2x.png'),
  iconOnly: path.join(sourceDir, '1_Icon_Only', 'Navigate_Wealth_Icon_Only@2x.png'),
};

const BRAND_PURPLE = { r: 106, g: 39, b: 216 };
const WHITE = { r: 255, g: 255, b: 255 };
const MONO = { r: 46, g: 17, b: 82 };
const FULL_TEXT_MIN_X = 580;
const UPSCALE_FACTOR = 2;

async function loadRgba(sourcePath) {
  const { data, info } = await sharp(sourcePath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  return {
    data: Uint8ClampedArray.from(data),
    width: info.width,
    height: info.height,
  };
}

function indexFor(width, x, y) {
  return y * width + x;
}

function findAlphaComponents(image, alphaThreshold = 10) {
  const { data, width, height } = image;
  const visited = new Uint8Array(width * height);
  const components = [];
  const neighbors = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const start = indexFor(width, x, y);
      if (visited[start] || data[start * 4 + 3] < alphaThreshold) {
        continue;
      }

      const queue = [start];
      const pixels = [];
      visited[start] = 1;
      let minX = x;
      let maxX = x;
      let minY = y;
      let maxY = y;

      while (queue.length > 0) {
        const current = queue.pop();
        const cx = current % width;
        const cy = Math.floor(current / width);
        pixels.push(current);

        if (cx < minX) minX = cx;
        if (cx > maxX) maxX = cx;
        if (cy < minY) minY = cy;
        if (cy > maxY) maxY = cy;

        for (const [dx, dy] of neighbors) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) {
            continue;
          }

          const next = indexFor(width, nx, ny);
          if (visited[next] || data[next * 4 + 3] < alphaThreshold) {
            continue;
          }

          visited[next] = 1;
          queue.push(next);
        }
      }

      components.push({
        pixels,
        minX,
        maxX,
        minY,
        maxY,
      });
    }
  }

  return components;
}

function recolorPixels(image, pixelIndexes, color) {
  const output = new Uint8ClampedArray(image.data);

  for (const pixelIndex of pixelIndexes) {
    const offset = pixelIndex * 4;
    output[offset] = color.r;
    output[offset + 1] = color.g;
    output[offset + 2] = color.b;
  }

  return {
    data: output,
    width: image.width,
    height: image.height,
  };
}

function recolorAllVisiblePixels(image, color) {
  const output = new Uint8ClampedArray(image.data);

  for (let i = 0; i < image.width * image.height; i += 1) {
    const alpha = output[i * 4 + 3];
    if (alpha < 10) {
      continue;
    }

    output[i * 4] = color.r;
    output[i * 4 + 1] = color.g;
    output[i * 4 + 2] = color.b;
  }

  return {
    data: output,
    width: image.width,
    height: image.height,
  };
}

function toSharp(image) {
  return sharp(Buffer.from(image.data), {
    raw: {
      width: image.width,
      height: image.height,
      channels: 4,
    },
  });
}

async function writePng(outputPath, image, options = {}) {
  const {
    width = image.width * UPSCALE_FACTOR,
    height = image.height * UPSCALE_FACTOR,
    fit = 'fill',
    extend,
  } = options;

  let pipeline = toSharp(image);

  if (extend) {
    pipeline = pipeline.extend(extend);
  }

  await pipeline
    .resize(width, height, {
      fit,
      kernel: sharp.kernel.lanczos3,
    })
    .sharpen()
    .png({
      compressionLevel: 9,
      adaptiveFiltering: true,
      palette: false,
    })
    .toFile(outputPath);
}

async function main() {
  const fullLogo = await loadRgba(sourcePaths.full);
  const logoOnly = await loadRgba(sourcePaths.logoOnly);
  const iconOnly = await loadRgba(sourcePaths.iconOnly);

  const fullLogoComponents = findAlphaComponents(fullLogo);
  const fullTextPixels = fullLogoComponents
    .filter((component) => component.minX > FULL_TEXT_MIN_X)
    .flatMap((component) => component.pixels);

  const reversedFull = recolorPixels(fullLogo, fullTextPixels, WHITE);
  const brandFull = recolorPixels(fullLogo, fullTextPixels, WHITE);
  const darkLogoOnly = recolorAllVisiblePixels(logoOnly, WHITE);
  const brandLogoOnly = recolorAllVisiblePixels(logoOnly, WHITE);
  const monochromeFull = recolorAllVisiblePixels(fullLogo, MONO);

  await writePng(path.join(assetsDir, 'navigate-wealth-primary.png'), fullLogo);
  await writePng(path.join(assetsDir, 'navigate-wealth-reversed.png'), reversedFull);
  await writePng(path.join(assetsDir, 'navigate-wealth-brand.png'), brandFull);

  await writePng(path.join(assetsDir, 'navigate-wealth-logo-only-light.png'), logoOnly);
  await writePng(path.join(assetsDir, 'navigate-wealth-logo-only-dark.png'), darkLogoOnly);
  await writePng(path.join(assetsDir, 'navigate-wealth-logo-only-brand.png'), brandLogoOnly);

  await writePng(path.join(assetsDir, 'navigate-wealth-icon-only-light.png'), iconOnly);
  await writePng(path.join(assetsDir, 'navigate-wealth-icon-only-dark.png'), iconOnly);
  await writePng(path.join(assetsDir, 'navigate-wealth-icon-only-brand.png'), iconOnly);

  await writePng(path.join(assetsDir, 'navigate-wealth-icon-padded.png'), iconOnly, {
    extend: {
      top: 56,
      bottom: 56,
      left: 56,
      right: 56,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
    width: (iconOnly.width + 112) * UPSCALE_FACTOR,
    height: (iconOnly.height + 112) * UPSCALE_FACTOR,
  });

  await toSharp(iconOnly)
    .extend({
      top: 90,
      bottom: 90,
      left: 90,
      right: 90,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .resize(1600, 1600, {
      fit: 'contain',
      kernel: sharp.kernel.lanczos3,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .sharpen()
    .png({ compressionLevel: 9, adaptiveFiltering: true, palette: false })
    .toFile(path.join(assetsDir, 'navigate-wealth-social.png'));

  await writePng(path.join(assetsDir, 'navigate-wealth-monochrome.png'), monochromeFull);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
