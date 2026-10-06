import { create } from 'qrcode';

export type QrShape = {
  /** SVG path of the dark modules, in module units. */
  path: string;
  /** Side length in modules, quiet zone included. */
  dimension: number;
};

/**
 * Encodes `value` as a QR code on the device and returns its dark modules as a single path.
 * Horizontal runs are merged, and one path (instead of a shape per module) avoids seams between cells.
 */
export const buildQrShape = (value: string, quietZone = 4): QrShape => {
  const { size, data } = create(value, { errorCorrectionLevel: 'M' }).modules;
  let path = '';

  for (let row = 0; row < size; row += 1) {
    let col = 0;
    while (col < size) {
      if (!data[row * size + col]) {
        col += 1;
        continue;
      }
      const start = col;
      while (col < size && data[row * size + col]) col += 1;
      path += `M${start + quietZone} ${row + quietZone}h${col - start}v1h${start - col}z`;
    }
  }

  return { path, dimension: size + quietZone * 2 };
};
