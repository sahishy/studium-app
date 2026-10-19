export type LinkProfile = { rttMs: number; jitterMs: number; stallMs?: number };
export class OrderedLink {
  dueAt = 0;
  timer: ReturnType<typeof setTimeout> | null = null;
  queue: Array<{ dueAt: number; deliver: () => void }> = [];
  constructor(public profile: () => LinkProfile, public random = Math.random) {}
  send(deliver: () => void) {
    const p = this.profile();
    const delay = Math.max(0, p.rttMs / 2 + (this.random() * 2 - 1) * p.jitterMs + (p.stallMs ?? 0));
    this.dueAt = Math.max(this.dueAt, Date.now() + delay);
    this.queue.push({ dueAt: this.dueAt, deliver });
    this.arm();
  }
  private arm() {
    if (this.timer || !this.queue.length) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      const now = Date.now();
      while (this.queue.length && this.queue[0].dueAt <= now) this.queue.shift()!.deliver();
      this.arm();
    }, Math.max(1, this.queue[0].dueAt - Date.now()));
  }
  close() { if (this.timer) clearTimeout(this.timer); this.timer = null; this.queue = []; }
}
