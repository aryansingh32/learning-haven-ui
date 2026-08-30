import { describe, it, expect } from 'vitest';
import { coursePricing, formatRupees, type CatalogCourse } from './catalog-utils';

const base: CatalogCourse = { id: 'c1', title: 'DSA Interview Track' };

describe('formatRupees', () => {
  it('converts paise to a rupee string with Indian grouping', () => {
    expect(formatRupees(499900)).toBe('₹4,999');
    expect(formatRupees(100)).toBe('₹1');
    expect(formatRupees(0)).toBe('₹0');
  });
});

describe('coursePricing', () => {
  it('reports an explicitly free course as free', () => {
    expect(coursePricing({ ...base, is_free: true })).toEqual({ kind: 'free' });
  });

  it('reports a free course as free even when a price is set', () => {
    // is_free is the switch the backend also honours when refusing a purchase.
    expect(coursePricing({ ...base, is_free: true, price_inr: 49900 })).toEqual({ kind: 'free' });
  });

  it('reports an owned course as owned regardless of price', () => {
    expect(coursePricing({ ...base, price_inr: 49900 }, true)).toEqual({ kind: 'owned' });
  });

  it('treats a non-premium course with no price as free', () => {
    expect(coursePricing(base)).toEqual({ kind: 'free' });
  });

  it('treats a premium course with no standalone price as plan-only', () => {
    expect(coursePricing({ ...base, is_premium: true })).toEqual({ kind: 'plan_only' });
  });

  it('formats a paid course without a discount', () => {
    expect(coursePricing({ ...base, price_inr: 49900 })).toEqual({
      kind: 'paid',
      price: '₹499',
      originalPrice: null,
      discountPercent: null,
    });
  });

  it('formats a paid course with a struck-through original price and percentage', () => {
    expect(coursePricing({ ...base, price_inr: 49900, original_price_inr: 99900 })).toEqual({
      kind: 'paid',
      price: '₹499',
      originalPrice: '₹999',
      discountPercent: 50,
    });
  });

  it('ignores an original price that is not above the live price', () => {
    expect(coursePricing({ ...base, price_inr: 49900, original_price_inr: 49900 })).toEqual({
      kind: 'paid',
      price: '₹499',
      originalPrice: null,
      discountPercent: null,
    });
  });

  it('treats a zero or negative price as not individually purchasable', () => {
    expect(coursePricing({ ...base, price_inr: 0, is_premium: true })).toEqual({ kind: 'plan_only' });
    expect(coursePricing({ ...base, price_inr: 0 })).toEqual({ kind: 'free' });
  });
});
