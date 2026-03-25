import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = process.cwd();
const BRAND_DIR = path.join(ROOT, 'public', 'brand-assets');
const SOURCE_DIR = path.join(BRAND_DIR, 'extracted-source');

const FULL_LOGO_SOURCE = path.join(
  SOURCE_DIR,
  '2_Logo_With_Icon',
  'Navigate_Wealth_Logo_With_Icon@2x.png',
);
const LOGO_ONLY_SOURCE = path.join(
  SOURCE_DIR,
  '3_Logo_Only',
  'Navigate_Wealth_Logo_Only@2x.png',
);
const ICON_ONLY_SOURCE = path.join(
  SOURCE_DIR,
  '1_Icon_Only',
  'Navigate_Wealth_Icon_Only@2x.png',
);

const FULL_WIDTH = 1576;
const FULL_HEIGHT = 892;
const LOGO_ONLY_WIDTH = 1704;
const LOGO_ONLY_HEIGHT = 448;
const ICON_ONLY_WIDTH = 622;
const ICON_ONLY_HEIGHT = 838;
const ICON_CANVAS = { width: 782, height: 1058, paddingX: 80, paddingY: 120 };
const SOCIAL_CANVAS = { width: 1600, height: 1600, padding: 210 };
const PRIMARY_OUTPUT_WIDTH = 3200;
const TRACE_SCALE = 3;
const TRACE_TOLERANCE = 0.18;

function pointKey(point) {
  return `${point.x.toFixed(3)},${point.y.toFixed(3)}`;
}

function lerpEdge(valueA, valueB, threshold = 0.5) {
  const delta = valueB - valueA;
  if (Math.abs(delta) < 1e-6) return 0.5;
  const t = (threshold - valueA) / delta;
  return Math.max(0, Math.min(1, t));
}

function averageColor(raw, width, pixelIndexes) {
  let r = 0;
  let g = 0;
  let b = 0;
  let a = 0;

  for (const pixelIndex of pixelIndexes) {
    const offset = pixelIndex * 4;
    const alpha = raw[offset + 3];
    if (alpha === 0) continue;
    r += raw[offset] * alpha;
    g += raw[offset + 1] * alpha;
    b += raw[offset + 2] * alpha;
    a += alpha;
  }

  if (a === 0) {
    return '#000000';
  }

  const toHex = (value) => Math.round(value).toString(16).padStart(2, '0');
  return `#${toHex(r / a)}${toHex(g / a)}${toHex(b / a)}`;
}

function simplifyDouglasPeucker(points, tolerance) {
  if (points.length <= 3) return points.slice();

  const sqTolerance = tolerance * tolerance;

  function sqDistanceToSegment(point, segmentStart, segmentEnd) {
    let x = segmentStart.x;
    let y = segmentStart.y;
    let dx = segmentEnd.x - x;
    let dy = segmentEnd.y - y;

    if (dx !== 0 || dy !== 0) {
      const t = ((point.x - x) * dx + (point.y - y) * dy) / (dx * dx + dy * dy);
      if (t > 1) {
        x = segmentEnd.x;
        y = segmentEnd.y;
      } else if (t > 0) {
        x += dx * t;
        y += dy * t;
      }
    }

    dx = point.x - x;
    dy = point.y - y;
    return dx * dx + dy * dy;
  }

  function simplify(startIndex, endIndex, input, output) {
    let maxDistance = sqTolerance;
    let farthestIndex = -1;

    for (let index = startIndex + 1; index < endIndex; index += 1) {
      const distance = sqDistanceToSegment(input[index], input[startIndex], input[endIndex]);
      if (distance > maxDistance) {
        farthestIndex = index;
        maxDistance = distance;
      }
    }

    if (farthestIndex !== -1) {
      if (farthestIndex - startIndex > 1) simplify(startIndex, farthestIndex, input, output);
      output.push(input[farthestIndex]);
      if (endIndex - farthestIndex > 1) simplify(farthestIndex, endIndex, input, output);
    }
  }

  const output = [points[0]];
  simplify(0, points.length - 1, points, output);
  output.push(points[points.length - 1]);
  return output;
}

function buildMarchingSquaresPath(field, width, height, threshold = 0.5, tolerance = 0.45) {
  const segments = [];

  function edgePoint(edgeName, x, y, topLeft, topRight, bottomRight, bottomLeft) {
    switch (edgeName) {
      case 'top': {
        const t = lerpEdge(topLeft, topRight, threshold);
        return { x: x + t, y };
      }
      case 'right': {
        const t = lerpEdge(topRight, bottomRight, threshold);
        return { x: x + 1, y: y + t };
      }
      case 'bottom': {
        const t = lerpEdge(bottomLeft, bottomRight, threshold);
        return { x: x + t, y: y + 1 };
      }
      case 'left': {
        const t = lerpEdge(topLeft, bottomLeft, threshold);
        return { x, y: y + t };
      }
      default:
        throw new Error(`Unknown edge ${edgeName}`);
    }
  }

  const cases = {
    0: [],
    1: [['left', 'bottom']],
    2: [['bottom', 'right']],
    3: [['left', 'right']],
    4: [['top', 'right']],
    5: [['top', 'right'], ['left', 'bottom']],
    6: [['top', 'bottom']],
    7: [['top', 'left']],
    8: [['top', 'left']],
    9: [['top', 'bottom']],
    10: [['top', 'left'], ['bottom', 'right']],
    11: [['top', 'right']],
    12: [['left', 'right']],
    13: [['bottom', 'right']],
    14: [['left', 'bottom']],
    15: [],
  };

  for (let y = 0; y < height - 1; y += 1) {
    for (let x = 0; x < width - 1; x += 1) {
      const topLeft = field[y * width + x];
      const topRight = field[y * width + x + 1];
      const bottomLeft = field[(y + 1) * width + x];
      const bottomRight = field[(y + 1) * width + x + 1];

      const state =
        (topLeft >= threshold ? 8 : 0) |
        (topRight >= threshold ? 4 : 0) |
        (bottomRight >= threshold ? 2 : 0) |
        (bottomLeft >= threshold ? 1 : 0);

      const cellSegments = cases[state];
      if (!cellSegments || cellSegments.length === 0) continue;

      for (const [edgeStart, edgeEnd] of cellSegments) {
        segments.push({
          start: edgePoint(edgeStart, x, y, topLeft, topRight, bottomRight, bottomLeft),
          end: edgePoint(edgeEnd, x, y, topLeft, topRight, bottomRight, bottomLeft),
        });
      }
    }
  }

  const adjacency = new Map();
  const used = new Array(segments.length).fill(false);

  function addAdjacency(point, segmentIndex) {
    const key = pointKey(point);
    if (!adjacency.has(key)) adjacency.set(key, []);
    adjacency.get(key).push(segmentIndex);
  }

  segments.forEach((segment, index) => {
    addAdjacency(segment.start, index);
    addAdjacency(segment.end, index);
  });

  const loops = [];

  for (let segmentIndex = 0; segmentIndex < segments.length; segmentIndex += 1) {
    if (used[segmentIndex]) continue;

    const loop = [];
    used[segmentIndex] = true;
    const startSegment = segments[segmentIndex];
    const startKey = pointKey(startSegment.start);
    let currentPoint = startSegment.end;
    let currentKey = pointKey(currentPoint);

    loop.push(startSegment.start, startSegment.end);

    while (currentKey !== startKey) {
      const candidateIndexes = adjacency.get(currentKey) || [];
      let nextIndex = -1;

      for (const candidateIndex of candidateIndexes) {
        if (!used[candidateIndex]) {
          nextIndex = candidateIndex;
          break;
        }
      }

      if (nextIndex === -1) break;

      used[nextIndex] = true;
      const nextSegment = segments[nextIndex];
      const startMatches = pointKey(nextSegment.start) === currentKey;
      currentPoint = startMatches ? nextSegment.end : nextSegment.start;
      currentKey = pointKey(currentPoint);
      loop.push(currentPoint);
    }

    if (loop.length >= 4) {
      const simplified = simplifyDouglasPeucker(loop, tolerance);
      if (simplified.length >= 4) loops.push(simplified);
    }
  }

  return loops
    .map((loop) => {
      const [firstPoint, ...restPoints] = loop;
      const commands = [`M${firstPoint.x.toFixed(2)} ${firstPoint.y.toFixed(2)}`];
      for (const point of restPoints) {
        commands.push(`L${point.x.toFixed(2)} ${point.y.toFixed(2)}`);
      }
      commands.push('Z');
      return commands.join(' ');
    })
    .join(' ');
}

function boundsFromPixels(pixelIndexes, width, height) {
  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;

  for (const pixelIndex of pixelIndexes) {
    const x = pixelIndex % width;
    const y = Math.floor(pixelIndex / width);
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  };
}

function scaleBounds(bounds, scale) {
  return {
    minX: bounds.minX / scale,
    minY: bounds.minY / scale,
    maxX: bounds.maxX / scale,
    maxY: bounds.maxY / scale,
    width: bounds.width / scale,
    height: bounds.height / scale,
  };
}

function transformPath(pathData, { scale = 1, translateX = 0, translateY = 0 } = {}) {
  return pathData.replace(/-?\d+(\.\d+)? -?\d+(\.\d+)?/g, (match) => {
    const [x, y] = match.split(' ').map(Number);
    const transformedX = x * scale + translateX;
    const transformedY = y * scale + translateY;
    return `${transformedX.toFixed(2)} ${transformedY.toFixed(2)}`;
  });
}

function createLogoSvg({
  width,
  height,
  iconPath,
  textPath,
  textFill,
  gradientStops,
  gradientId,
  extraDefs = '',
}) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" fill="none" shape-rendering="geometricPrecision">
  <defs>
    <linearGradient id="${gradientId}" x1="23%" y1="8%" x2="78%" y2="88%">
      <stop offset="0%" stop-color="${gradientStops.start}" />
      <stop offset="55%" stop-color="${gradientStops.mid}" />
      <stop offset="100%" stop-color="${gradientStops.end}" />
    </linearGradient>
    ${extraDefs}
  </defs>
  <path d="${iconPath}" fill="url(#${gradientId})" fill-rule="evenodd" clip-rule="evenodd" />
  <path d="${textPath}" fill="${textFill}" fill-rule="evenodd" clip-rule="evenodd" />
</svg>
`;
}

function createSingleShapeSvg({ width, height, pathData, fill, gradientStops, gradientId }) {
  const defs = gradientStops
    ? `<linearGradient id="${gradientId}" x1="23%" y1="8%" x2="78%" y2="88%">
      <stop offset="0%" stop-color="${gradientStops.start}" />
      <stop offset="55%" stop-color="${gradientStops.mid}" />
      <stop offset="100%" stop-color="${gradientStops.end}" />
    </linearGradient>`
    : '';
  const actualFill = gradientStops ? `url(#${gradientId})` : fill;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" fill="none" shape-rendering="geometricPrecision">
  <defs>${defs}</defs>
  <path d="${pathData}" fill="${actualFill}" fill-rule="evenodd" clip-rule="evenodd" />
</svg>
`;
}

async function writeSvgAndPng(svgName, svgContent, pngName, pngWidth, pngHeight) {
  const svgPath = path.join(BRAND_DIR, svgName);
  const pngPath = path.join(BRAND_DIR, pngName);

  await fs.writeFile(svgPath, svgContent, 'utf8');
  await sharp(Buffer.from(svgContent))
    .resize({ width: pngWidth, height: pngHeight, fit: 'fill' })
    .png()
    .toFile(pngPath);
}

async function traceSingleShape(sourcePath, { traceScale = 1, tolerance = 0.45 } = {}) {
  const source = sharp(sourcePath);
  const metadata = await source.metadata();
  const originalWidth = metadata.width;
  const originalHeight = metadata.height;
  const raster = source
    .ensureAlpha()
    .resize({
      width: Math.round(originalWidth * traceScale),
      height: Math.round(originalHeight * traceScale),
      kernel: sharp.kernel.lanczos3,
      fit: 'fill',
    });

  const { data: raw, info } = await raster.raw().toBuffer({ resolveWithObject: true });
  const width = info.width;
  const height = info.height;
  const field = new Float32Array(width * height);
  const pixels = [];

  for (let index = 0; index < width * height; index += 1) {
    const alpha = raw[index * 4 + 3];
    if (alpha <= 10) continue;
    field[index] = alpha / 255;
    pixels.push(index);
  }

  const traceBounds = boundsFromPixels(pixels, width, height);
  const tracedPath = buildMarchingSquaresPath(field, width, height, 0.5, tolerance * traceScale);
  const pathData = traceScale === 1
    ? tracedPath
    : transformPath(tracedPath, { scale: 1 / traceScale });
  return {
    raw,
    width,
    height,
    bounds: scaleBounds(traceBounds, traceScale),
    traceBounds,
    originalWidth,
    originalHeight,
    pathData,
    pixels,
  };
}

async function main() {
  const logoOnly = await traceSingleShape(LOGO_ONLY_SOURCE, { traceScale: TRACE_SCALE, tolerance: TRACE_TOLERANCE });
  const iconOnly = await traceSingleShape(ICON_ONLY_SOURCE, { traceScale: TRACE_SCALE, tolerance: TRACE_TOLERANCE });
  const fullLogoMeta = await sharp(FULL_LOGO_SOURCE).metadata();
  const originalWidth = fullLogoMeta.width;
  const originalHeight = fullLogoMeta.height;
  const { data: raw, info } = await sharp(FULL_LOGO_SOURCE)
    .ensureAlpha()
    .resize({
      width: Math.round(originalWidth * TRACE_SCALE),
      height: Math.round(originalHeight * TRACE_SCALE),
      kernel: sharp.kernel.lanczos3,
      fit: 'fill',
    })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const width = info.width;
  const height = info.height;
  const alphaThreshold = 10;
  const mask = new Uint8Array(width * height);
  const labels = new Int32Array(width * height);
  const components = [];
  const directions = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];

  for (let index = 0; index < width * height; index += 1) {
    mask[index] = raw[index * 4 + 3] > alphaThreshold ? 1 : 0;
  }

  let currentLabel = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const pixelIndex = y * width + x;
      if (!mask[pixelIndex] || labels[pixelIndex] !== 0) continue;

      currentLabel += 1;
      const queue = [pixelIndex];
      labels[pixelIndex] = currentLabel;
      let queueIndex = 0;

      const component = {
        id: currentLabel,
        minX: x,
        maxX: x,
        minY: y,
        maxY: y,
        pixels: [],
      };

      while (queueIndex < queue.length) {
        const currentPixel = queue[queueIndex];
        queueIndex += 1;
        component.pixels.push(currentPixel);

        const currentX = currentPixel % width;
        const currentY = Math.floor(currentPixel / width);
        if (currentX < component.minX) component.minX = currentX;
        if (currentY < component.minY) component.minY = currentY;
        if (currentX > component.maxX) component.maxX = currentX;
        if (currentY > component.maxY) component.maxY = currentY;

        for (const [dx, dy] of directions) {
          const nextX = currentX + dx;
          const nextY = currentY + dy;
          if (nextX < 0 || nextY < 0 || nextX >= width || nextY >= height) continue;
          const nextIndex = nextY * width + nextX;
          if (!mask[nextIndex] || labels[nextIndex] !== 0) continue;
          labels[nextIndex] = currentLabel;
          queue.push(nextIndex);
        }
      }

      components.push(component);
    }
  }

  const iconComponents = components.filter((component) => component.maxX < 620 * TRACE_SCALE && component.pixels.length > 100 * TRACE_SCALE);
  const textComponents = components.filter((component) => component.minX > 580 * TRACE_SCALE && component.pixels.length > 20 * TRACE_SCALE);

  function buildFieldFromComponents(selectedComponents) {
    const selectedLabels = new Set(selectedComponents.map((component) => component.id));
    const field = new Float32Array(width * height);
    const pixels = [];

    for (let index = 0; index < labels.length; index += 1) {
      if (!selectedLabels.has(labels[index])) continue;
      field[index] = raw[index * 4 + 3] / 255;
      pixels.push(index);
    }

    const traceBounds = boundsFromPixels(pixels, width, height);
    return { field, pixels, traceBounds, bounds: scaleBounds(traceBounds, TRACE_SCALE) };
  }

  const icon = buildFieldFromComponents(iconComponents);
  const text = buildFieldFromComponents(textComponents);

  const tracedIconPath = buildMarchingSquaresPath(icon.field, width, height, 0.5, TRACE_TOLERANCE * TRACE_SCALE);
  const tracedTextPath = buildMarchingSquaresPath(text.field, width, height, 0.5, TRACE_TOLERANCE * TRACE_SCALE);
  const iconPathFull = transformPath(tracedIconPath, { scale: 1 / TRACE_SCALE });
  const textPathFull = transformPath(tracedTextPath, { scale: 1 / TRACE_SCALE });

  const gradientStartIndexes = [];
  const gradientMidIndexes = [];
  const gradientEndIndexes = [];

  for (const pixelIndex of icon.pixels) {
    const x = pixelIndex % width;
    const y = Math.floor(pixelIndex / width);
    if (x <= icon.traceBounds.minX + icon.traceBounds.width * 0.4 && y <= icon.traceBounds.minY + icon.traceBounds.height * 0.35) {
      gradientStartIndexes.push(pixelIndex);
    }
    if (
      x >= icon.traceBounds.minX + icon.traceBounds.width * 0.28 &&
      x <= icon.traceBounds.minX + icon.traceBounds.width * 0.72 &&
      y >= icon.traceBounds.minY + icon.traceBounds.height * 0.28 &&
      y <= icon.traceBounds.minY + icon.traceBounds.height * 0.72
    ) {
      gradientMidIndexes.push(pixelIndex);
    }
    if (x >= icon.traceBounds.minX + icon.traceBounds.width * 0.58 && y >= icon.traceBounds.minY + icon.traceBounds.height * 0.58) {
      gradientEndIndexes.push(pixelIndex);
    }
  }

  const gradientStops = {
    start: averageColor(raw, width, gradientStartIndexes),
    mid: averageColor(raw, width, gradientMidIndexes),
    end: averageColor(raw, width, gradientEndIndexes),
  };

  const textFill = averageColor(raw, width, text.pixels);
  const logoOnlyFill = averageColor(logoOnly.raw, logoOnly.width, logoOnly.pixels);
  const iconOnlyGradientStops = {
    start: averageColor(
      iconOnly.raw,
      iconOnly.width,
      iconOnly.pixels.filter((pixelIndex) => {
        const x = pixelIndex % iconOnly.width;
        const y = Math.floor(pixelIndex / iconOnly.width);
        return (
          x <= iconOnly.bounds.minX + iconOnly.bounds.width * 0.4 &&
          y <= iconOnly.bounds.minY + iconOnly.bounds.height * 0.35
        );
      }),
    ),
    mid: averageColor(
      iconOnly.raw,
      iconOnly.width,
      iconOnly.pixels.filter((pixelIndex) => {
        const x = pixelIndex % iconOnly.width;
        const y = Math.floor(pixelIndex / iconOnly.width);
        return (
          x >= iconOnly.bounds.minX + iconOnly.bounds.width * 0.28 &&
          x <= iconOnly.bounds.minX + iconOnly.bounds.width * 0.72 &&
          y >= iconOnly.bounds.minY + iconOnly.bounds.height * 0.28 &&
          y <= iconOnly.bounds.minY + iconOnly.bounds.height * 0.72
        );
      }),
    ),
    end: averageColor(
      iconOnly.raw,
      iconOnly.width,
      iconOnly.pixels.filter((pixelIndex) => {
        const x = pixelIndex % iconOnly.width;
        const y = Math.floor(pixelIndex / iconOnly.width);
        return x >= iconOnly.bounds.minX + iconOnly.bounds.width * 0.58 && y >= iconOnly.bounds.minY + iconOnly.bounds.height * 0.58;
      }),
    ),
  };

  const primarySvg = createLogoSvg({
    width: FULL_WIDTH,
    height: FULL_HEIGHT,
    iconPath: iconPathFull,
    textPath: textPathFull,
    textFill,
    gradientStops,
    gradientId: 'navigateWealthPrimaryGradient',
  });

  const reversedSvg = createLogoSvg({
    width: FULL_WIDTH,
    height: FULL_HEIGHT,
    iconPath: iconPathFull,
    textPath: textPathFull,
    textFill: '#ffffff',
    gradientStops,
    gradientId: 'navigateWealthReversedGradient',
  });

  const brandSvg = createLogoSvg({
    width: FULL_WIDTH,
    height: FULL_HEIGHT,
    iconPath: iconPathFull,
    textPath: textPathFull,
    textFill: '#ffffff',
    gradientStops,
    gradientId: 'navigateWealthBrandGradient',
  });

  const monochromeCombinedPath = `${iconPathFull} ${textPathFull}`;
  const monochromeSvg = createSingleShapeSvg({
    width: FULL_WIDTH,
    height: FULL_HEIGHT,
    pathData: monochromeCombinedPath,
    fill: textFill,
  });

  const logoOnlyPrimarySvg = createSingleShapeSvg({
    width: LOGO_ONLY_WIDTH,
    height: LOGO_ONLY_HEIGHT,
    pathData: logoOnly.pathData,
    fill: logoOnlyFill,
  });

  const logoOnlyDarkSvg = createSingleShapeSvg({
    width: LOGO_ONLY_WIDTH,
    height: LOGO_ONLY_HEIGHT,
    pathData: logoOnly.pathData,
    fill: '#ffffff',
  });

  const logoOnlyBrandSvg = createSingleShapeSvg({
    width: LOGO_ONLY_WIDTH,
    height: LOGO_ONLY_HEIGHT,
    pathData: logoOnly.pathData,
    fill: '#ffffff',
  });

  const iconOnlyPrimarySvg = createSingleShapeSvg({
    width: ICON_ONLY_WIDTH,
    height: ICON_ONLY_HEIGHT,
    pathData: iconOnly.pathData,
    gradientStops: iconOnlyGradientStops,
    gradientId: 'navigateWealthIconOnlyPrimaryGradient',
  });

  const iconOnlyDarkSvg = createSingleShapeSvg({
    width: ICON_ONLY_WIDTH,
    height: ICON_ONLY_HEIGHT,
    pathData: iconOnly.pathData,
    gradientStops: iconOnlyGradientStops,
    gradientId: 'navigateWealthIconOnlyDarkGradient',
  });

  const iconOnlyBrandSvg = createSingleShapeSvg({
    width: ICON_ONLY_WIDTH,
    height: ICON_ONLY_HEIGHT,
    pathData: iconOnly.pathData,
    gradientStops: iconOnlyGradientStops,
    gradientId: 'navigateWealthIconOnlyBrandGradient',
  });

  const iconScale = Math.min(
    (ICON_CANVAS.width - ICON_CANVAS.paddingX * 2) / icon.bounds.width,
    (ICON_CANVAS.height - ICON_CANVAS.paddingY * 2) / icon.bounds.height,
  );
  const iconTranslateX =
    (ICON_CANVAS.width - icon.bounds.width * iconScale) / 2 - icon.bounds.minX * iconScale;
  const iconTranslateY =
    (ICON_CANVAS.height - icon.bounds.height * iconScale) / 2 - icon.bounds.minY * iconScale;
  const paddedIconPath = transformPath(iconPathFull, {
    scale: iconScale,
    translateX: iconTranslateX,
    translateY: iconTranslateY,
  });

  const iconSvg = createSingleShapeSvg({
    width: ICON_CANVAS.width,
    height: ICON_CANVAS.height,
    pathData: paddedIconPath,
    gradientStops,
    gradientId: 'navigateWealthIconGradient',
  });

  const socialScale = Math.min(
    (SOCIAL_CANVAS.width - SOCIAL_CANVAS.padding * 2) / icon.bounds.width,
    (SOCIAL_CANVAS.height - SOCIAL_CANVAS.padding * 2) / icon.bounds.height,
  );
  const socialTranslateX =
    (SOCIAL_CANVAS.width - icon.bounds.width * socialScale) / 2 - icon.bounds.minX * socialScale;
  const socialTranslateY =
    (SOCIAL_CANVAS.height - icon.bounds.height * socialScale) / 2 - icon.bounds.minY * socialScale;
  const socialIconPath = transformPath(iconPathFull, {
    scale: socialScale,
    translateX: socialTranslateX,
    translateY: socialTranslateY,
  });

  const socialSvg = createSingleShapeSvg({
    width: SOCIAL_CANVAS.width,
    height: SOCIAL_CANVAS.height,
    pathData: socialIconPath,
    gradientStops,
    gradientId: 'navigateWealthSocialGradient',
  });

  await writeSvgAndPng(
    'navigate-wealth-primary.svg',
    primarySvg,
    'navigate-wealth-primary.png',
    PRIMARY_OUTPUT_WIDTH,
    Math.round((PRIMARY_OUTPUT_WIDTH / FULL_WIDTH) * FULL_HEIGHT),
  );

  await writeSvgAndPng(
    'navigate-wealth-reversed.svg',
    reversedSvg,
    'navigate-wealth-reversed.png',
    PRIMARY_OUTPUT_WIDTH,
    Math.round((PRIMARY_OUTPUT_WIDTH / FULL_WIDTH) * FULL_HEIGHT),
  );

  await writeSvgAndPng(
    'navigate-wealth-brand.svg',
    brandSvg,
    'navigate-wealth-brand.png',
    PRIMARY_OUTPUT_WIDTH,
    Math.round((PRIMARY_OUTPUT_WIDTH / FULL_WIDTH) * FULL_HEIGHT),
  );

  await writeSvgAndPng(
    'navigate-wealth-icon-padded.svg',
    iconSvg,
    'navigate-wealth-icon-padded.png',
    ICON_CANVAS.width * 2,
    ICON_CANVAS.height * 2,
  );

  await writeSvgAndPng(
    'navigate-wealth-social.svg',
    socialSvg,
    'navigate-wealth-social.png',
    SOCIAL_CANVAS.width,
    SOCIAL_CANVAS.height,
  );

  await writeSvgAndPng(
    'navigate-wealth-monochrome.svg',
    monochromeSvg,
    'navigate-wealth-monochrome.png',
    PRIMARY_OUTPUT_WIDTH,
    Math.round((PRIMARY_OUTPUT_WIDTH / FULL_WIDTH) * FULL_HEIGHT),
  );

  await writeSvgAndPng(
    'navigate-wealth-logo-only-light.svg',
    logoOnlyPrimarySvg,
    'navigate-wealth-logo-only-light.png',
    3408,
    896,
  );

  await writeSvgAndPng(
    'navigate-wealth-logo-only-dark.svg',
    logoOnlyDarkSvg,
    'navigate-wealth-logo-only-dark.png',
    3408,
    896,
  );

  await writeSvgAndPng(
    'navigate-wealth-logo-only-brand.svg',
    logoOnlyBrandSvg,
    'navigate-wealth-logo-only-brand.png',
    3408,
    896,
  );

  await writeSvgAndPng(
    'navigate-wealth-icon-only-light.svg',
    iconOnlyPrimarySvg,
    'navigate-wealth-icon-only-light.png',
    ICON_ONLY_WIDTH * 4,
    ICON_ONLY_HEIGHT * 4,
  );

  await writeSvgAndPng(
    'navigate-wealth-icon-only-dark.svg',
    iconOnlyDarkSvg,
    'navigate-wealth-icon-only-dark.png',
    ICON_ONLY_WIDTH * 4,
    ICON_ONLY_HEIGHT * 4,
  );

  await writeSvgAndPng(
    'navigate-wealth-icon-only-brand.svg',
    iconOnlyBrandSvg,
    'navigate-wealth-icon-only-brand.png',
    ICON_ONLY_WIDTH * 4,
    ICON_ONLY_HEIGHT * 4,
  );

  const summary = {
    gradientStops,
    iconOnlyGradientStops,
    textFill,
    logoOnlyFill,
    iconBounds: icon.bounds,
    textBounds: text.bounds,
    logoOnlyBounds: logoOnly.bounds,
    iconOnlyBounds: iconOnly.bounds,
    iconComponents: iconComponents.length,
    textComponents: textComponents.length,
  };

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
