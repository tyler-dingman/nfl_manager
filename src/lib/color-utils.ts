const normalizeHexColor = (hexColor: string) => {
  const normalized = hexColor.trim().replace('#', '');
  return normalized.length === 3
    ? normalized
        .split('')
        .map((char) => char + char)
        .join('')
    : normalized;
};

const hexToRgb = (hexColor: string) => {
  const hex = normalizeHexColor(hexColor);

  if (hex.length !== 6) {
    return null;
  }

  const channels = [
    Number.parseInt(hex.slice(0, 2), 16),
    Number.parseInt(hex.slice(2, 4), 16),
    Number.parseInt(hex.slice(4, 6), 16),
  ] as const;
  return channels.every(Number.isFinite) ? channels : null;
};

export const getRelativeLuminance = (hexColor: string) => {
  const rgb = hexToRgb(hexColor);
  if (!rgb) return 0;
  const [red, green, blue] = rgb.map((value) => {
    const channel = value / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
};

export const getContrastRatio = (first: string, second: string) => {
  const firstLuminance = getRelativeLuminance(first);
  const secondLuminance = getRelativeLuminance(second);
  const lighter = Math.max(firstLuminance, secondLuminance);
  const darker = Math.min(firstLuminance, secondLuminance);
  return (lighter + 0.05) / (darker + 0.05);
};

const mixHexColors = (start: string, end: string, amount: number) => {
  const from = hexToRgb(start);
  const to = hexToRgb(end);
  if (!from || !to) return start;
  const ratio = Math.max(0, Math.min(1, amount));
  const channels = from.map((value, index) => Math.round(value + (to[index] - value) * ratio));
  return `#${channels.map((value) => value.toString(16).padStart(2, '0')).join('')}`;
};

export const getReadableTextColor = (hexColor: string): '#ffffff' | '#000000' =>
  getContrastRatio('#ffffff', hexColor) >= 4.5 ? '#ffffff' : '#000000';

export const ensureAccessibleTextColor = (
  preferredColor: string,
  backgroundColor: string,
  minimumRatio = 4.5,
) => {
  if (getContrastRatio(preferredColor, backgroundColor) >= minimumRatio) return preferredColor;

  const target =
    getContrastRatio('#ffffff', backgroundColor) >= minimumRatio ? '#ffffff' : '#000000';
  for (let step = 1; step <= 20; step += 1) {
    const candidate = mixHexColors(preferredColor, target, step / 20);
    if (getContrastRatio(candidate, backgroundColor) >= minimumRatio) return candidate;
  }

  return target;
};

export const lightenHexColor = (hexColor: string, amount = 0.12): string => {
  const hex = normalizeHexColor(hexColor);

  if (hex.length !== 6) {
    return hexColor;
  }

  const mix = (channel: number) =>
    Math.round(channel + (255 - channel) * Math.max(0, Math.min(1, amount)));

  const red = mix(Number.parseInt(hex.slice(0, 2), 16));
  const green = mix(Number.parseInt(hex.slice(2, 4), 16));
  const blue = mix(Number.parseInt(hex.slice(4, 6), 16));

  return `#${[red, green, blue].map((value) => value.toString(16).padStart(2, '0')).join('')}`;
};

if (process.env.NODE_ENV !== 'production') {
  const dark = getReadableTextColor('#111827');
  const light = getReadableTextColor('#f8fafc');
  const lighterRed = lightenHexColor('#b91c1c', 0.2);
  // eslint-disable-next-line no-console
  console.assert(dark === '#ffffff', 'Expected white text for dark colors');
  // eslint-disable-next-line no-console
  console.assert(light === '#000000', 'Expected dark text for light colors');
  // eslint-disable-next-line no-console
  console.assert(lighterRed !== '#b91c1c', 'Expected lightened color to differ from source');
}
