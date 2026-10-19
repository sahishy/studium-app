export class RoomLatency {
  counters: Record<string, number> = {};
  samples: Record<string, number[]> = {};
  lastReportAt = Date.now();
  count(name: string) { this.counters[name] = (this.counters[name] ?? 0) + 1; }
  sample(name: string, value: number) {
    if (!Number.isFinite(value)) return;
    const samples = this.samples[name] ??= [];
    samples.push(Math.max(0, value));
    if (samples.length > 256) samples.shift();
  }
  report(roomId: string, modeId: string, version: number, build: string, force = false, lifecycle: Record<string, unknown> = {}) {
    if (!force && Date.now() - this.lastReportAt < 30_000) return;
    this.lastReportAt = Date.now();
    const timing = Object.fromEntries(Object.entries(this.samples).map(([key, samples]) => {
      const sorted = [...samples].sort((a, b) => a - b);
      return [key, { count: sorted.length, p50: sorted[Math.floor(sorted.length * .5)], p95: sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * .95) - 1)] }];
    }));
    console.info("studium.latency", { roomId, modeId, version, build, ...lifecycle, counters: this.counters, timing });

  }
}
