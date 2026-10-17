import { displayOdds, slipOdds, slipPick, type SlipLeg } from '../../../packages/parlay/slip';
export function saveSlipImage(legs: SlipLeg[]) {
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 320 + legs.length * 150;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw Error('Image export is unavailable.');
  ctx.fillStyle = '#00141e';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#ff123e';
  ctx.fillRect(0, 0, 1080, 12);
  ctx.fillStyle = '#fff';
  ctx.font = '900 42px Arial';
  ctx.fillText('DOWN & DISTANCE', 48, 80);
  ctx.font = '700 30px Arial';
  ctx.fillText(`MY PARLAY · ${legs.length} LEGS`, 48, 130);
  legs.forEach((leg, i) => {
    const y = 190 + i * 150;
    ctx.fillStyle = '#fff';
    ctx.font = '700 30px Arial';
    ctx.fillText(leg.playerName ?? leg.teamId ?? 'Game', 48, y, 970);
    ctx.fillStyle = '#b8cbd6';
    ctx.font = '24px Arial';
    ctx.fillText(slipPick(leg), 48, y + 40, 970);
    ctx.fillText(
      `${leg.teamId ?? ''}   ${displayOdds(leg.odds)}   LAB SCORE ${leg.trend?.trendScore ?? '—'}`,
      48,
      y + 78,
      970,
    );
  });
  ctx.fillStyle = '#fff';
  ctx.font = '700 30px Arial';
  ctx.fillText(`Estimated combined odds: ${displayOdds(slipOdds(legs))}`, 48, canvas.height - 115);
  ctx.fillStyle = '#b8cbd6';
  ctx.font = '22px Arial';
  ctx.fillText(
    `Generated ${new Date().toISOString().slice(0, 10)} · Odds and availability may change.`,
    48,
    canvas.height - 65,
  );
  ctx.fillText('downdistance.com/parlay-lab', 48, canvas.height - 30);
  const link = document.createElement('a');
  link.download = `down-distance-parlay-${Date.now()}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
}
