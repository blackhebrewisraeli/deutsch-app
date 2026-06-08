import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('sound', () => {
  let createOscillator;
  let createGain;
  let resume;
  let sound;

  beforeEach(async () => {
    vi.resetModules();
    createOscillator = vi.fn(() => ({
      type: 'sine',
      frequency: { value: 0 },
      connect: vi.fn().mockReturnThis(),
      start: vi.fn(),
      stop: vi.fn(),
    }));
    createGain = vi.fn(() => ({
      gain: {
        setValueAtTime: vi.fn(),
        linearRampToValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
      connect: vi.fn().mockReturnThis(),
    }));
    resume = vi.fn();
    class MockAudioContext {
      constructor() {
        this.state = 'running';
        this.currentTime = 0;
        this.destination = {};
      }
      createOscillator = createOscillator;
      createGain = createGain;
      resume = resume;
    }
    window.AudioContext = MockAudioContext;
    window.webkitAudioContext = MockAudioContext;
    sound = await import('./sound');
    sound.setSoundEnabled(false);
  });

  afterEach(() => {
    delete window.AudioContext;
    delete window.webkitAudioContext;
  });

  it('playCorrect is a no-op when sound is disabled', () => {
    sound.setSoundEnabled(false);
    sound.playCorrect();
    expect(createOscillator).not.toHaveBeenCalled();
  });

  it('playCorrect schedules oscillators when enabled', () => {
    sound.setSoundEnabled(true);
    sound.playCorrect();
    expect(createOscillator).toHaveBeenCalled();
    expect(createGain).toHaveBeenCalled();
  });

  it('resumes a suspended AudioContext before playing', () => {
    class SuspendedContext {
      constructor() {
        this.state = 'suspended';
        this.currentTime = 0;
        this.destination = {};
      }
      createOscillator = createOscillator;
      createGain = createGain;
      resume = resume;
    }
    window.AudioContext = SuspendedContext;
    window.webkitAudioContext = SuspendedContext;
    sound.setSoundEnabled(true);
    sound.playLevelUp();
    expect(resume).toHaveBeenCalled();
  });

  it('playAchievement and playGoalMet do not throw when AudioContext is unavailable', async () => {
    delete window.AudioContext;
    delete window.webkitAudioContext;
    vi.resetModules();
    const mod = await import('./sound');
    mod.setSoundEnabled(true);
    expect(() => mod.playAchievement()).not.toThrow();
    expect(() => mod.playGoalMet()).not.toThrow();
  });
});
