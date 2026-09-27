/** Shared ownership prevents one closing overlay from leaving another's stale lock behind. */
const locks = new Set<symbol>();
let previousOverflow = '';
export function lockDocumentScroll() {
  const token = Symbol('scroll-lock');
  if (!locks.size) previousOverflow = document.body.style.overflow;
  locks.add(token);
  document.body.style.overflow = 'hidden';
  return () => {
    if (!locks.delete(token)) return;
    if (!locks.size) document.body.style.overflow = previousOverflow;
  };
}
