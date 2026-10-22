import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { listen, speechSupported, describeVoiceError } from './voice.js';

// A stand-in for the browser's SpeechRecognition that tests drive by hand
class FakeRecognition {
  static instances = [];
  static throwOnStart = null;

  constructor() {
    this.started = false;
    this.stopped = false;
    this.aborted = false;
    FakeRecognition.instances.push(this);
  }
  start() {
    if (FakeRecognition.throwOnStart) throw FakeRecognition.throwOnStart;
    this.started = true;
  }
  stop() { this.stopped = true; }
  abort() { this.aborted = true; }

  // Browser events
  say(text, isFinal) {
    this.onresult?.({ results: [Object.assign([{ transcript: text }], { isFinal })] });
  }
  end() { this.onend?.(); }
  fail(error) { this.onerror?.({ error }); }
}

const latest = () => FakeRecognition.instances.at(-1);

function session() {
  const calls = { results: [], errors: [], ends: 0 };
  const stop = listen({
    onResult: (text, isFinal) => calls.results.push([text, isFinal]),
    onError: (code) => calls.errors.push(code),
    onEnd: () => calls.ends++
  });
  return { calls, stop, recognition: latest() };
}

beforeEach(() => {
  vi.useFakeTimers();
  FakeRecognition.instances = [];
  FakeRecognition.throwOnStart = null;
  globalThis.window = { webkitSpeechRecognition: FakeRecognition };
  globalThis.navigator ??= { language: 'en-US' };
});

afterEach(() => {
  // Close anything a test left open, so it can't leak into the next one
  listen({});
  delete globalThis.window;
  vi.useRealTimers();
});

describe('listen', () => {
  it('streams the transcript and ends on the final result without waiting for the browser', () => {
    const { calls, recognition } = session();
    recognition.say('spicy', false);
    recognition.say('spicy pork', true);
    expect(calls.results).toEqual([['spicy', false], ['spicy pork', true]]);
    expect(calls.ends).toBe(1);
    expect(recognition.stopped).toBe(true);
  });

  it('works again after a session the browser never ended (Safari)', () => {
    const first = session();
    first.recognition.say('birria', true); // no `end` event ever arrives

    const second = session();
    expect(second.recognition).not.toBe(first.recognition);
    expect(second.recognition.started).toBe(true);
    second.recognition.say('al pastor', true);
    expect(second.calls.results).toEqual([['al pastor', true]]);
    expect(second.calls.ends).toBe(1);
  });

  it('aborts a session still in progress when a new one starts', () => {
    const first = session();
    first.recognition.say('car', false);

    const second = session();
    expect(first.recognition.aborted).toBe(true);
    expect(first.calls.ends).toBe(1);

    // Late events from the old session go nowhere
    first.recognition.say('carnitas', true);
    first.recognition.end();
    expect(first.calls.results).toEqual([['car', false]]);
    expect(first.calls.ends).toBe(1);
    expect(second.calls.ends).toBe(0);
  });

  it('ends exactly once whatever order the browser fires events in', () => {
    const { calls, recognition } = session();
    recognition.fail('network');
    recognition.end();
    expect(calls.errors).toEqual(['network']);
    expect(calls.ends).toBe(1);
  });

  it('reports silence when the browser ends with nothing heard', () => {
    const { calls, recognition } = session();
    recognition.end();
    expect(calls.errors).toEqual(['no-speech']);
    expect(calls.ends).toBe(1);
  });

  it('recovers when the browser refuses to start', () => {
    FakeRecognition.throwOnStart = Object.assign(new Error('already started'), { name: 'InvalidStateError' });
    const { calls } = session();
    expect(calls.errors).toEqual(['start-failed']);
    expect(calls.ends).toBe(1);

    FakeRecognition.throwOnStart = null;
    const next = session();
    expect(next.recognition.started).toBe(true);
  });

  it('gives up on a session that never finishes', () => {
    const { calls, recognition } = session();
    recognition.say('tacos', false);
    vi.advanceTimersByTime(15000);
    expect(calls.ends).toBe(1);
    expect(recognition.stopped).toBe(true);
  });

  it('stops early when asked', () => {
    const { calls, stop, recognition } = session();
    stop();
    stop();
    expect(recognition.stopped).toBe(true);
    expect(calls.ends).toBe(1);
  });

  it('says so when speech recognition is missing', () => {
    globalThis.window = {};
    expect(speechSupported()).toBe(false);
    const { calls } = session();
    expect(calls.errors).toEqual(['unsupported']);
    expect(calls.ends).toBe(1);
  });
});

describe('describeVoiceError', () => {
  it('stays quiet for an abort and explains the rest', () => {
    expect(describeVoiceError('aborted')).toBeNull();
    expect(describeVoiceError('no-speech')).toMatch(/catch/);
    expect(describeVoiceError('not-allowed')).toMatch(/blocked/);
  });
});
