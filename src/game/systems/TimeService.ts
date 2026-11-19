export class TimeService {
  constructor(private readonly clock: () => number = () => Date.now()) {}

  now(): number {
    return this.clock();
  }

  static secondsBetween(from: number, to: number): number {
    return Math.max(0, (to - from) / 1000);
  }
}
