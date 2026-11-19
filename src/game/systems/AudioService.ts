import type { GameState } from '../types/GameState';
import type { PlatformAdapter } from '../types/PlatformTypes';

export type SfxName =
  | 'click'
  | 'collect'
  | 'success'
  | 'error'
  | 'upgrade'
  | 'purchase';

interface ToneConfig {
  freq: number;
  delay: number;
  duration: number;
  type?: OscillatorType;
  volume?: number;
}

const SFX_PATTERNS: Record<SfxName, ToneConfig[]> = {
  click: [{ freq: 620, delay: 0, duration: 0.05, type: 'triangle', volume: 0.05 }],
  collect: [
    { freq: 880, delay: 0, duration: 0.09, type: 'sine', volume: 0.09 },
    { freq: 1318, delay: 0.06, duration: 0.12, type: 'sine', volume: 0.08 },
  ],
  success: [
    { freq: 523, delay: 0, duration: 0.12, type: 'triangle', volume: 0.08 },
    { freq: 659, delay: 0.09, duration: 0.12, type: 'triangle', volume: 0.08 },
    { freq: 784, delay: 0.18, duration: 0.2, type: 'triangle', volume: 0.09 },
  ],
  error: [{ freq: 196, delay: 0, duration: 0.16, type: 'sawtooth', volume: 0.05 }],
  upgrade: [
    { freq: 659, delay: 0, duration: 0.1, type: 'triangle', volume: 0.08 },
    { freq: 880, delay: 0.08, duration: 0.1, type: 'triangle', volume: 0.08 },
    { freq: 1108, delay: 0.16, duration: 0.16, type: 'triangle', volume: 0.08 },
  ],
  purchase: [
    { freq: 440, delay: 0, duration: 0.1, type: 'sine', volume: 0.08 },
    { freq: 660, delay: 0.08, duration: 0.16, type: 'sine', volume: 0.08 },
  ],
};

const MUSIC_NOTES = [523.25, 587.33, 659.25, 783.99, 880, 783.99, 659.25, 587.33];
const MUSIC_INTERVAL_MS = 480;

type AudioContextConstructor = new () => AudioContext;

function audioContextConstructor(): AudioContextConstructor | null {
  if (typeof window === 'undefined') return null;
  const scope = window as unknown as {
    AudioContext?: AudioContextConstructor;
    webkitAudioContext?: AudioContextConstructor;
  };
  return scope.AudioContext ?? scope.webkitAudioContext ?? null;
}

export class AudioService {
  private context: AudioContext | null = null;
  private musicTimer: ReturnType<typeof setInterval> | null = null;
  private musicStep = 0;
  private paused = false;
  private platformMuted: boolean;

  constructor(
    private readonly state: GameState,
    platform: PlatformAdapter,
  ) {
    this.platformMuted = !platform.isAudioEnabled();
  }

  unlock(): void {
    const context = this.ensureContext();
    if (!context) return;
    if (context.state === 'suspended') {
      void context.resume();
    }
    if (this.state.settings.music) {
      this.startMusic();
    }
  }

  sfx(name: SfxName): void {
    if (!this.state.settings.sfx || this.platformMuted || this.paused) return;
    const context = this.ensureContext();
    if (!context) return;
    if (context.state === 'suspended') {
      void context.resume();
    }
    const pattern = SFX_PATTERNS[name];
    for (const tone of pattern) {
      this.playTone(tone);
    }
  }

  applySettings(): void {
    if (this.state.settings.music) {
      this.startMusic();
    } else {
      this.stopMusic();
    }
  }

  setPlatformAudio(enabled: boolean): void {
    this.platformMuted = !enabled;
    if (this.platformMuted) {
      this.stopMusic();
    } else if (this.state.settings.music) {
      this.startMusic();
    }
  }

  pause(): void {
    if (this.paused) return;
    this.paused = true;
    this.stopMusic();
    if (this.context && this.context.state === 'running') {
      void this.context.suspend();
    }
  }

  resume(): void {
    if (!this.paused) return;
    this.paused = false;
    if (this.context && this.context.state === 'suspended') {
      void this.context.resume();
    }
    if (this.state.settings.music) {
      this.startMusic();
    }
  }

  private ensureContext(): AudioContext | null {
    if (this.context) return this.context;
    const Ctor = audioContextConstructor();
    if (!Ctor) return null;
    try {
      this.context = new Ctor();
      return this.context;
    } catch (error) {
      console.warn('[AudioService] AudioContext unavailable', error);
      return null;
    }
  }

  private playTone(tone: ToneConfig): void {
    const context = this.context;
    if (!context) return;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const startAt = context.currentTime + tone.delay;
    const volume = tone.volume ?? 0.06;

    oscillator.type = tone.type ?? 'sine';
    oscillator.frequency.setValueAtTime(tone.freq, startAt);
    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.exponentialRampToValueAtTime(volume, startAt + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + tone.duration);

    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(startAt);
    oscillator.stop(startAt + tone.duration + 0.05);
  }

  private startMusic(): void {
    if (this.musicTimer !== null) return;
    if (!this.state.settings.music || this.platformMuted || this.paused) return;
    const context = this.ensureContext();
    if (!context) return;
    const tick = (): void => {
      if (!this.state.settings.music || this.platformMuted || this.paused) {
        this.stopMusic();
        return;
      }
      const freq = MUSIC_NOTES[this.musicStep % MUSIC_NOTES.length];
      this.musicStep += 1;
      this.playTone({
        freq,
        delay: 0,
        duration: 0.55,
        type: 'triangle',
        volume: 0.025,
      });
      if (this.musicStep % 4 === 0) {
        this.playTone({
          freq: freq / 2,
          delay: 0,
          duration: 1.1,
          type: 'sine',
          volume: 0.012,
        });
      }
    };
    tick();
    this.musicTimer = setInterval(tick, MUSIC_INTERVAL_MS);
  }

  private stopMusic(): void {
    if (this.musicTimer === null) return;
    clearInterval(this.musicTimer);
    this.musicTimer = null;
  }
}
