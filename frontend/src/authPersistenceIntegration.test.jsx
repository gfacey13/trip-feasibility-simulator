import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('./services/supabaseClient', () => ({ supabase: null }));
import App from './App';

afterEach(() => vi.unstubAllGlobals());

describe('guest access with account persistence', () => {
  it('keeps analysis available without configuration and never reads device-saved trips', () => {
    const getItem = vi.fn(() => JSON.stringify({ destination: 'Private saved destination' }));
    vi.stubGlobal('localStorage', { getItem });
    const html = renderToStaticMarkup(createElement(App));
    expect(html).toContain('Calculate Feasibility');
    expect(html).toContain('Please log in to view your saved trips.');
    expect(html).toContain('Account access isn’t set up yet.');
    expect(html).not.toContain('Private saved destination');
    expect(getItem).not.toHaveBeenCalled();
  });
});
