import { create } from 'qrcode';
import { describe, expect, it } from 'vitest';

import { buildQrShape, type QrShape } from './qrShape';

// Paints the path back into a grid, counting how many runs cover each module.
const rasterize = ({ path, dimension }: QrShape) => {
  const grid = new Array<number>(dimension * dimension).fill(0);
  for (const match of path.matchAll(/M(\d+) (\d+)h(\d+)v1h-(\d+)z/g)) {
    const [x, y, width, back] = match.slice(1).map(Number) as [number, number, number, number];
    expect(back).toBe(width);
    for (let col = x; col < x + width; col += 1) {
      grid[y * dimension + col] = (grid[y * dimension + col] ?? 0) + 1;
    }
  }
  return grid;
};

describe('buildQrShape', () => {
  it.each(['DACUS-0001', 'loyalty:5f2c9a1e-7d3b-4c8e-9a61-0b7e2d4f8c13', 'ăîșțâ Dacus'])(
    'draws every dark module of %s exactly once, inside the quiet zone',
    (value) => {
      const quietZone = 4;
      const shape = buildQrShape(value, quietZone);
      const { size, data } = create(value, { errorCorrectionLevel: 'M' }).modules;

      expect(shape.dimension).toBe(size + quietZone * 2);

      const expected = new Array<number>(shape.dimension * shape.dimension).fill(0);
      for (let row = 0; row < size; row += 1) {
        for (let col = 0; col < size; col += 1) {
          expected[(row + quietZone) * shape.dimension + col + quietZone] = data[row * size + col] ? 1 : 0;
        }
      }
      expect(rasterize(shape)).toEqual(expected);
    },
  );

  it('supports codes without a quiet zone', () => {
    const shape = buildQrShape('DACUS', 0);
    expect(shape.path.startsWith('M0 0h7v1h-7z')).toBe(true);
  });
});
