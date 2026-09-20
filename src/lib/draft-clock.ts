/** Monotonic simulation time. Pauses/speed changes settle elapsed time first. */
export class DraftClock {
  remainingMs: number;
  private last: number;
  constructor(
    durationSeconds: number,
    now: number,
    private running = false,
    private rate = 1,
  ) {
    this.remainingMs = durationSeconds * 1000;
    this.last = now;
  }
  tick(now: number) {
    if (this.running)
      this.remainingMs = Math.max(0, this.remainingMs - Math.max(0, now - this.last) * this.rate);
    this.last = now;
    return this.remainingMs;
  }
  configure(now: number, running: boolean, rate: number) {
    this.tick(now);
    this.running = running;
    this.rate = rate;
  }
}
