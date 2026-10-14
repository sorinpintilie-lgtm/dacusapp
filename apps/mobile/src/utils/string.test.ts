import { describe, expect, it } from 'vitest';

import { productCount } from './string';

describe('productCount', () => {
  it('follows Romanian plural rules', () => {
    expect(productCount(1)).toBe('1 produs');
    expect(productCount(4)).toBe('4 produse');
    expect(productCount(19)).toBe('19 produse');
    expect(productCount(20)).toBe('20 de produse');
    expect(productCount(101)).toBe('101 produse');
    expect(productCount(200)).toBe('200 de produse');
    expect(productCount(3360)).toBe('3.360 de produse');
    expect(productCount(0)).toBe('0 produse');
  });
});
