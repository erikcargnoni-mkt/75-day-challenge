import { describe, it, expect } from 'vitest';
import { parseDecimal } from './bits';

/**
 * These exist because `type="number"` silently ate every comma, which made
 * decimals impossible to enter on any phone set to a comma-decimal locale.
 * The comma cases below are the regression.
 */
describe('parseDecimal', () => {
  it('accepts a comma separator', () => {
    expect(parseDecimal('75,4')).toBe(75.4);
    expect(parseDecimal('60,25')).toBe(60.25);
  });

  it('accepts a dot separator', () => {
    expect(parseDecimal('75.4')).toBe(75.4);
  });

  it('reads whole numbers', () => {
    expect(parseDecimal('75')).toBe(75);
  });

  it('treats a trailing separator as the number so far', () => {
    // The state a field passes through between "75" and "75,4".
    expect(parseDecimal('75,')).toBe(75);
    expect(parseDecimal('75.')).toBe(75);
  });

  it('reads a leading separator', () => {
    expect(parseDecimal(',5')).toBe(0.5);
    expect(parseDecimal('.5')).toBe(0.5);
  });

  it('ignores surrounding whitespace', () => {
    expect(parseDecimal(' 75,4 ')).toBe(75.4);
  });

  it('returns null for nothing enterable yet', () => {
    expect(parseDecimal('')).toBeNull();
    expect(parseDecimal('   ')).toBeNull();
    expect(parseDecimal(',')).toBeNull();
    expect(parseDecimal('.')).toBeNull();
  });

  it('rejects text and stray symbols instead of coercing them', () => {
    expect(parseDecimal('abc')).toBeNull();
    expect(parseDecimal('75kg')).toBeNull();
    expect(parseDecimal('-75')).toBeNull();
    expect(parseDecimal('1e3')).toBeNull();
    expect(parseDecimal('75,4,2')).toBeNull();
    expect(parseDecimal('75.4.2')).toBeNull();
  });

  it('never returns NaN or Infinity', () => {
    for (const s of ['', '.', ',', 'abc', '1e999', '--5', '75,,4']) {
      const n = parseDecimal(s);
      expect(n === null || Number.isFinite(n)).toBe(true);
    }
  });
});
