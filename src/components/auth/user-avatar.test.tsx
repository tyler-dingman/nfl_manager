import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import UserAvatar from './user-avatar';

test('user avatar renders the authenticated profile image when present', () => {
  const html = renderToStaticMarkup(
    <UserAvatar src="https://lh3.googleusercontent.com/a/example" name="Tyler Fan" />,
  );
  assert.match(html, /data-user-avatar/);
  assert.match(html, /Tyler Fan profile photo/);
});

test('user avatar renders the generic fallback when no image is present', () => {
  const html = renderToStaticMarkup(<UserAvatar src={null} name="Tyler Fan" />);
  assert.match(html, /data-avatar-fallback/);
  assert.doesNotMatch(html, /<img/);
});
