import { describe, expect, it } from 'vitest';
import {
  addMoney,
  formatMoney,
  formatMoneyCompact,
  fromMajorUnits,
  money,
  multiplyMoney,
  percentOf,
  sumMoney,
  toMajorUnits,
} from '@/lib/util/money';

describe('money', () => {
  it('keeps amounts as integer minor units', () => {
    expect(money(12_950).amount).toBe(12_950);
    expect(money(12_950.6).amount).toBe(12_951);
  });

  it('normalises the currency code', () => {
    expect(money(100, 'usd').currency).toBe('USD');
  });
});

describe('major/minor conversion', () => {
  it('round-trips without floating point drift', () => {
    expect(fromMajorUnits(1234.56).amount).toBe(123_456);
    expect(toMajorUnits(money(123_456))).toBe(1234.56);
  });

  it('handles the classic 0.1 + 0.2 case', () => {
    // 19.99 * 100 is 1998.9999... in binary floating point.
    expect(fromMajorUnits(19.99).amount).toBe(1999);
    expect(fromMajorUnits(0.1 + 0.2).amount).toBe(30);
  });
});

describe('arithmetic', () => {
  it('adds and sums', () => {
    expect(addMoney(money(1000), money(250)).amount).toBe(1250);
    expect(sumMoney([money(1000), money(250), money(5)]).amount).toBe(1255);
  });

  it('sums an empty list to zero in the given currency', () => {
    expect(sumMoney([], 'EUR')).toEqual({ amount: 0, currency: 'EUR' });
  });

  it('refuses to mix currencies', () => {
    expect(() => addMoney(money(100, 'USD'), money(100, 'EUR'))).toThrow(TypeError);
  });

  it('multiplies and takes percentages with half-up rounding', () => {
    expect(multiplyMoney(money(1050), 3).amount).toBe(3150);
    expect(percentOf(money(10_000), 11.5).amount).toBe(1150);
    expect(percentOf(money(333), 50).amount).toBe(167);
  });
});

describe('formatting', () => {
  it('always shows cents in the full format', () => {
    expect(formatMoney(money(65_000))).toBe('$650.00');
    expect(formatMoney(money(65_050))).toBe('$650.50');
  });

  it('drops trailing cents when the amount is whole', () => {
    expect(formatMoneyCompact(money(65_000))).toBe('$650');
    expect(formatMoneyCompact(money(65_050))).toBe('$650.50');
  });
});
