import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { OwnershipIcon, type OwnershipIconName } from '@/components/ui/ownership-icon';
import {
  ownershipProjectIcons,
  ownershipSectionIcons,
  ownershipLabelIcons,
} from './ownership-icons';
import { PROJECTS } from '@/features/ownership/model';
const manifest = JSON.parse(
  readFileSync('public/assets/down-and-distance-ownership-icons/manifest.json', 'utf8'),
) as { count: number; icons: { name: OwnershipIconName; path: string }[] };
test('every manifest SVG renders inline with original geometry and stroke contract', () => {
  assert.equal(manifest.icons.length, 90);
  for (const icon of manifest.icons) {
    const html = renderToStaticMarkup(createElement(OwnershipIcon, { name: icon.name, size: 22 }));
    for (const attr of [
      'viewBox="0 0 24 24"',
      'fill="none"',
      'stroke="currentColor"',
      'stroke-width="1.75"',
      'stroke-linecap="round"',
      'stroke-linejoin="round"',
      'width="22"',
      'height="22"',
      'aria-hidden="true"',
      'focusable="false"',
    ])
      assert(html.includes(attr), `${icon.name}: ${attr}`);
    const raw = readFileSync(
      `public/assets/down-and-distance-ownership-icons/${icon.path}`,
      'utf8',
    );
    for (const match of raw.matchAll(/\bd="([^"]+)"/g))
      assert(html.includes(`d="${match[1]}"`), icon.name);
    assert.equal(
      (html.match(/<(path|circle|rect|ellipse|line|polyline|polygon)\b/g) ?? []).length,
      (raw.match(/<(path|circle|rect|ellipse|line|polyline|polygon)\b/g) ?? []).length,
      icon.name,
    );
  }
});
test('projects, sections and labels only map to supplied icons', () => {
  const names = new Set(manifest.icons.map((i) => i.name));
  for (const name of [
    ...Object.values(ownershipProjectIcons),
    ...Object.values(ownershipSectionIcons),
    ...Object.values(ownershipLabelIcons),
  ])
    assert(names.has(name), name);
  for (const project of PROJECTS) assert(project.id in ownershipProjectIcons, project.id);
  assert.equal(Object.keys(ownershipSectionIcons).length, 7);
});
test('meaningful icons support accessible labels and caller classes', () => {
  const html = renderToStaticMarkup(
    createElement(OwnershipIcon, {
      name: 'legacy',
      'aria-label': 'Ownership history',
      className: 'accent',
      size: 20,
    }),
  );
  assert(html.includes('role="img"'));
  assert(html.includes('aria-label="Ownership history"'));
  assert(!html.includes('aria-hidden="true"'));
  assert(html.includes('class="accent"'));
});
