export const getReadableTextColor = (hexColor: string): '#ffffff' | '#0f172a' => {
  const normalized = hexColor.trim().replace('#', '');
  const hex =
    normalized.length === 3
      ? normalized
          .split('')
          .map((char) => char + char)
          .join('')
      : normalized;

  if (hex.length !== 6) {
    return '#ffffff';
  }

  const red = Number.parseInt(hex.slice(0, 2), 16);
  const green = Number.parseInt(hex.slice(2, 4), 16);
  const blue = Number.parseInt(hex.slice(4, 6), 16);

  const yiq = (red * 299 + green * 587 + blue * 114) / 1000;
  return yiq >= 170 ? '#0f172a' : '#ffffff';
};

if (process.env.NODE_ENV !== 'production') {
  const dark = getReadableTextColor('#111827');
  const light = getReadableTextColor('#f8fafc');
  // eslint-disable-next-line no-console
  console.assert(dark === '#ffffff', 'Expected white text for dark colors');
  // eslint-disable-next-line no-console
  console.assert(light === '#0f172a', 'Expected dark text for light colors');
}
