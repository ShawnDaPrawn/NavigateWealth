/**
 * A PDF page as a viewer shows it — the CropBox, turned by /Rotate.
 *
 * Field positions are stored against that view: the studio and the signing
 * screen both render pages with pdf.js, which applies the CropBox and the
 * page's rotation. pdf-lib, which writes the signed PDF and reads form
 * widgets, works in raw user space (the MediaBox, unrotated). Mixing the two
 * put burned-in values and auto-mapped fields in the wrong place on any page
 * that is rotated or cropped.
 *
 * "Display space" here is the viewed page with its origin at the BOTTOM-left
 * and y up (PDF convention), `width` × `height` points.
 */

export interface PageBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PageFrame {
  /** Viewed width and height, in points. */
  width: number;
  height: number;
  /** Clockwise rotation applied by the viewer: 0, 90, 180 or 270. */
  rotation: 0 | 90 | 180 | 270;
  /**
   * Display space → user space, as a PDF `cm` matrix [a b c d e f]:
   * userX = a·u + c·v + e, userY = b·u + d·v + f.
   */
  matrix: [number, number, number, number, number, number];
  /** User space → display space. */
  toDisplay: (userX: number, userY: number) => { u: number; v: number };
}

/** Normalise any rotation to 0/90/180/270. */
export function normaliseRotation(angle: number): 0 | 90 | 180 | 270 {
  const r = (((Math.round(angle / 90) * 90) % 360) + 360) % 360;
  return r as 0 | 90 | 180 | 270;
}

export function pageFrame(crop: PageBox, rotationAngle: number): PageFrame {
  const rotation = normaliseRotation(rotationAngle);
  const { x: cx, y: cy, width: cw, height: ch } = crop;
  switch (rotation) {
    case 90:
      return {
        width: ch,
        height: cw,
        rotation,
        matrix: [0, 1, -1, 0, cx + cw, cy],
        toDisplay: (px, py) => ({ u: py - cy, v: cw - (px - cx) }),
      };
    case 180:
      return {
        width: cw,
        height: ch,
        rotation,
        matrix: [-1, 0, 0, -1, cx + cw, cy + ch],
        toDisplay: (px, py) => ({ u: cw - (px - cx), v: ch - (py - cy) }),
      };
    case 270:
      return {
        width: ch,
        height: cw,
        rotation,
        matrix: [0, -1, 1, 0, cx, cy + ch],
        toDisplay: (px, py) => ({ u: ch - (py - cy), v: px - cx }),
      };
    default:
      return {
        width: cw,
        height: ch,
        rotation: 0,
        matrix: [1, 0, 0, 1, cx, cy],
        toDisplay: (px, py) => ({ u: px - cx, v: py - cy }),
      };
  }
}

/**
 * A stored field rectangle (x/y percent of the VIEWED page, top-left origin;
 * width/height in points) in display space, bottom-left origin.
 */
export function fieldRectInDisplay(
  frame: Pick<PageFrame, 'width' | 'height'>,
  field: { x: number; y: number; width: number; height: number },
): { x: number; y: number; w: number; h: number } {
  const x = (field.x / 100) * frame.width;
  const top = (field.y / 100) * frame.height;
  return { x, y: frame.height - top - field.height, w: field.width, h: field.height };
}
