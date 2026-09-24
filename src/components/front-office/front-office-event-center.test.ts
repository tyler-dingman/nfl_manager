import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const component = readFileSync('src/components/front-office/front-office-event-center.tsx', 'utf8');
const css = readFileSync('src/app/globals.css', 'utf8');

test('News drawer is portaled and floating surfaces are mutually exclusive', () => {
  assert.match(component, /createPortal\(drawer, document\.body\)/);
  assert.match(component, /\{!open && !draftActive \? \(/);
  assert.match(component, /notification && !open/);
  assert.match(css, /\.fo-wire-backdrop\s*\{[^}]*inset:\s*0;[^}]*z-index:\s*1990/s);
  assert.match(css, /\.fo-wire-panel\s*\{[^}]*z-index:\s*2000;[^}]*align-self:\s*stretch/s);
});

test('News drawer uses a compact dark newswire presentation', () => {
  assert.match(component, /draftActive \? 'Draft Trade Hub' : 'News'/);
  assert.doesNotMatch(component, /<span>Front Office<\/span>/);
  assert.match(css, /\.fo-wire-panel\s*\{[^}]*background:\s*var\(--fo-panel\)/s);
  assert.match(css, /\.fo-wire-list \.fo-news-row\s*\{[^}]*min-height:\s*76px/s);
  assert.match(css, /-webkit-line-clamp:\s*2/);
});

test('News classification excludes messages and reserves Breaking for major stories', () => {
  assert.match(component, /event\.type !== 'welcome_message'/);
  assert.match(component, /importanceScore \?\? 0\) >= 90/);
  assert.match(component, /return categoryFromText\(event\) \?\? 'ROSTER'/);
});
