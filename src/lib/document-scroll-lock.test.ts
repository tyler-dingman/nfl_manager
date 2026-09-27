import assert from 'node:assert/strict';
import test from 'node:test';
import { lockDocumentScroll } from './document-scroll-lock';

test('overlapping overlays release in either order without leaving the page locked', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const body = { style: { overflow: 'auto' } };
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { body } });
  try {
    const first = lockDocumentScroll();
    const second = lockDocumentScroll();
    first();
    assert.equal(body.style.overflow, 'hidden');
    second();
    assert.equal(body.style.overflow, 'auto');
    first(); // Cleanup is idempotent, including Strict Mode/unmount paths.
    assert.equal(body.style.overflow, 'auto');
    const third = lockDocumentScroll();
    const fourth = lockDocumentScroll();
    fourth();
    assert.equal(body.style.overflow, 'hidden');
    third();
    assert.equal(body.style.overflow, 'auto');
  } finally {
    if (original) Object.defineProperty(globalThis, 'document', original);
    else Reflect.deleteProperty(globalThis, 'document');
  }
});
