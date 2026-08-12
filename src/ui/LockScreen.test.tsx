import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { LockProvider } from '../state/useLock';
import { LockScreen } from './LockScreen';

/**
 * Render smoke tests. The lock screen is the one surface that must never fail
 * to draw — a crash here is not a broken screen, it is being shut out of your
 * own data with no way back.
 */
const render = () =>
  renderToStaticMarkup(
    <LockProvider>
      <LockScreen />
    </LockProvider>,
  );

describe('LockScreen', () => {
  it('renders without a lock configured', () => {
    expect(() => render()).not.toThrow();
  });

  it('offers a full keypad', () => {
    const html = render();
    for (const d of ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']) {
      expect(html).toContain(`>${d}</button>`);
    }
  });

  it('shows one dot per PIN digit and none filled', () => {
    const html = render();
    const dots = html.match(/<i class="(on)?"><\/i>/g) ?? [];
    expect(dots).toHaveLength(6);
    expect(html).not.toContain('<i class="on">');
  });

  it('never renders PIN material into the markup', () => {
    expect(render()).not.toMatch(/salt|hash|iterations/i);
  });

  it('disables the biometric key when none is registered', () => {
    // No credential configured, so that key must not be pressable.
    expect(render()).toMatch(/<button[^>]*disabled[^>]*aria-label="Unlock with Face ID"/);
  });

  it('carries an accessible label for the entry state', () => {
    expect(render()).toContain('aria-label="0 of 6 digits entered"');
  });
});
