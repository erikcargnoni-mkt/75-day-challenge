import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { initialState, logPeriodStart, setWeight, startChallenge } from '../core/challenge';
import { addDays, type ISODate } from '../core/date';
import { weightTrend } from '../core/insights';
import { DEFAULT_PROFILE } from '../core/types';
import { WeightChart } from './WeightChart';

/**
 * Geometry smoke tests. An SVG chart fails loudly in the data layer and silently
 * in the path layer — one NaN coordinate and the line simply vanishes with no
 * error anywhere. These render the real component and check the numbers.
 */

const START: ISODate = '2026-03-01';

function trendFrom(kgs: number[]) {
  let s = logPeriodStart(
    startChallenge(initialState({ ...DEFAULT_PROFILE, weightKg: 60 }), START),
    START,
  );
  kgs.forEach((kg, i) => (s = setWeight(s, addDays(START, i), kg)));
  return weightTrend(s);
}

const render = (kgs: number[]) => renderToStaticMarkup(<WeightChart trend={trendFrom(kgs)} />);

describe('WeightChart', () => {
  it('renders nothing below two readings', () => {
    expect(render([])).toBe('');
    expect(render([60])).toBe('');
  });

  it('emits no NaN or Infinity anywhere in the markup', () => {
    const html = render([60, 60.4, 59.8, 61.2, 60.1, 59.9, 60.6, 61.4, 60.2]);
    expect(html).not.toMatch(/NaN|Infinity/);
  });

  it('survives a completely flat series without dividing by zero', () => {
    // Identical readings make the data range zero — the domain floor covers it.
    const html = render([60, 60, 60, 60, 60, 60, 60, 60]);
    expect(html).not.toMatch(/NaN|Infinity/);
    expect(html).toContain('avg-line');
  });

  it('keeps every plotted point inside the viewBox', () => {
    const html = render([55, 70, 61, 58, 66, 62, 59, 64]);
    const coords = [...html.matchAll(/[ML](-?[\d.]+) (-?[\d.]+)/g)];
    expect(coords.length).toBeGreaterThan(0);
    for (const [, x, y] of coords) {
      expect(Number(x)).toBeGreaterThanOrEqual(0);
      expect(Number(x)).toBeLessThanOrEqual(520);
      expect(Number(y)).toBeGreaterThanOrEqual(0);
      expect(Number(y)).toBeLessThanOrEqual(180);
    }
  });

  it('draws the average line only once seven readings exist', () => {
    expect(render([60, 61, 62, 63, 64, 65])).not.toMatch(/class="avg-line" d="M/);
    expect(render([60, 61, 62, 63, 64, 65, 66])).toMatch(/class="avg-line" d="M/);
  });

  it('labels both series so identity is never colour alone', () => {
    const html = render([60, 61, 62, 63, 64, 65, 66]);
    expect(html).toContain('7-day average');
    expect(html).toContain('Daily reading');
  });

  it('carries a text alternative for screen readers', () => {
    expect(render([60, 61])).toMatch(/aria-label="Weight from .+ to .+"/);
  });
});
