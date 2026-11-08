// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';

vi.mock('./services/supabaseClient', () => ({ supabase: null }));
let root;
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  document.body.innerHTML = '<div id="test-root"></div>';
  root = createRoot(document.getElementById('test-root'));
  act(() => root.render(createElement(App)));
});
afterEach(() => {
  act(() => root.unmount());
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
});
function enter(id, value) {
  act(() => {
    const input = document.getElementById(id);
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}
function click(text) {
  const button = [...document.querySelectorAll('button')].find((node) => node.textContent === text);
  expect(button).toBeDefined();
  act(() => button.click());
}
const travelers = () => document.getElementById('travelers').value;

describe('traveler and hotel room synchronization', () => {
  it('counts added children immediately while keeping countries and child ages', () => {
    enter('travelers', '3');
    enter('hotelCountry', 'US');
    enter('guestNationality', 'US');
    click('Add child');
    expect(travelers()).toBe('4');
    enter('room-0-child-0', '0');
    expect(travelers()).toBe('4');
    expect(document.getElementById('hotelCountry').value).toBe('US');
    expect(document.getElementById('guestNationality').value).toBe('US');
    expect(document.getElementById('room-0-child-0').value).toBe('0');
    enter('budget', '5000');
    expect(travelers()).toBe('4');
    expect(document.getElementById('room-0-child-0').value).toBe('0');
    click('Remove child 1');
    expect(travelers()).toBe('3');
  });
  it('counts adults across added and removed rooms', () => {
    enter('travelers', '3');
    click('Add room');
    expect(travelers()).toBe('4');
    enter('room-adults-1', '2');
    expect(travelers()).toBe('5');
    click('Remove room 2');
    expect(travelers()).toBe('3');
  });
  it('keeps manual traveler edits usable and allocates larger totals across rooms', () => {
    enter('travelers', '9');
    expect(travelers()).toBe('9');
    expect(document.getElementById('room-adults-0').value).toBe('8');
    expect(document.getElementById('room-adults-1').value).toBe('1');
    enter('room-adults-0', '');
    expect(travelers()).toBe('9');
    enter('room-adults-0', '2');
    expect(travelers()).toBe('3');
  });
});
