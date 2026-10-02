// Shared local-time clock for the explicitly simulated tailgate preview.
export const nextSundayNoon = () => {
  const d = new Date();
  d.setDate(d.getDate() + ((7 - d.getDay()) % 7));
  d.setHours(12, 0, 0, 0);
  if (d.getTime() <= Date.now()) d.setDate(d.getDate() + 7);
  return d;
};
export const clock = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return [
    String(Math.floor(s / 3600)).padStart(2, '0'),
    String(Math.floor(s / 60) % 60).padStart(2, '0'),
    String(s % 60).padStart(2, '0'),
  ];
};
