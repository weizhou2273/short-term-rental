import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GA_ID, trackGa } from '@/lib/google-analytics';
import { trackMeta } from '@/lib/meta-pixel';

// The helpers run in the browser; give them a bare window.
type FakeWindow = { dataLayer?: unknown[]; gtag?: unknown; __wkGaReady?: boolean; fbq?: (...a: unknown[]) => void };
let win: FakeWindow;
beforeEach(() => {
  win = {};
  vi.stubGlobal('window', win);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const pushed = () => (win.dataLayer ?? []).map((args) => Array.from(args as ArrayLike<unknown>));

describe('Google Analytics', () => {
  it('uses the W&K Reserve property', () => {
    expect(GA_ID).toBe('G-QK3CL1J712');
  });

  it('configures the property once, before any event, even if gtag.js has not loaded yet', () => {
    trackGa('view_item', { items: [{ item_id: 'minsi-pond' }] });
    trackGa('check_availability', { item_id: 'minsi-pond', nights: 2 });
    const calls = pushed();
    expect(calls[0]![0]).toBe('js');
    expect(calls[1]).toEqual(['config', 'G-QK3CL1J712']);
    expect(calls.slice(2)).toEqual([
      ['event', 'view_item', { items: [{ item_id: 'minsi-pond' }] }],
      ['event', 'check_availability', { item_id: 'minsi-pond', nights: 2 }],
    ]);
  });

  it('never throws', () => {
    win.gtag = () => {
      throw new Error('blocked');
    };
    win.__wkGaReady = true;
    expect(() => trackGa('search')).not.toThrow();
  });
});

describe('Meta Pixel', () => {
  it('waits for the pixel instead of dropping an event sent while the page starts', () => {
    vi.useFakeTimers();
    trackMeta('ViewContent', { content_ids: ['minsi-pond'] });
    const fbq = vi.fn();
    vi.advanceTimersByTime(500);
    win.fbq = fbq;
    vi.advanceTimersByTime(300);
    expect(fbq).toHaveBeenCalledOnce();
    expect(fbq).toHaveBeenCalledWith('track', 'ViewContent', { content_ids: ['minsi-pond'] });
  });

  it('gives up quietly when the pixel is blocked', () => {
    vi.useFakeTimers();
    trackMeta('AddToCart');
    vi.advanceTimersByTime(10_000);
    const fbq = vi.fn();
    win.fbq = fbq;
    vi.advanceTimersByTime(10_000);
    expect(fbq).not.toHaveBeenCalled();
  });
});
