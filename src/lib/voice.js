// src/lib/voice.js
// Speech-to-text through the browser's Web Speech API: free, on-device or
// browser-vendor hosted, no key. Chrome, Edge and Safari have it; Firefox
// doesn't, so callers hide the mic when speechSupported() is false.

function recognitionClass() {
  if (typeof window === 'undefined') return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

export function speechSupported() {
  return recognitionClass() !== null;
}

// The session in progress, if any. Browsers allow one at a time: starting a
// second while the first is still winding down throws in Chrome and silently
// records nothing in Safari, so a new listen() aborts the old one first.
let current = null;

// Give up on a session that never ends on its own. Safari sometimes never
// fires `end` after a result, which would leave the mic stuck "listening".
const WATCHDOG_MS = 15000;

/**
 * Listen for one utterance.
 *
 * The session is over (and `onEnd` called, exactly once) as soon as a final
 * transcript arrives, on any error, when stopped, or after WATCHDOG_MS,
 * without waiting for the browser's own `end` event, which isn't reliable.
 * Events from a finished session are ignored.
 *
 * @param {object} handlers
 * @param {(text: string, isFinal: boolean) => void} handlers.onResult - the
 *   transcript so far, called again as it firms up
 * @param {() => void} [handlers.onEnd] - listening stopped, for any reason
 * @param {(error: string) => void} [handlers.onError] - e.g. 'not-allowed'
 *   when the mic permission is refused, 'no-speech' after silence
 * @param {string} [handlers.lang] - defaults to the browser's language
 * @returns {() => void} stop listening early
 */
export function listen({ onResult, onEnd, onError, lang } = {}) {
  const Recognition = recognitionClass();
  if (!Recognition) {
    onError?.('unsupported');
    onEnd?.();
    return () => {};
  }

  current?.abort();

  const recognition = new Recognition();
  recognition.lang = lang || navigator.language || 'en-US';
  recognition.interimResults = true;
  recognition.continuous = false;
  recognition.maxAlternatives = 1;

  let done = false;
  let heard = false;
  let watchdog = null;

  function finish({ abort = false } = {}) {
    if (done) return;
    done = true;
    clearTimeout(watchdog);
    recognition.onresult = recognition.onerror = recognition.onend = null;
    try {
      if (abort) recognition.abort();
      else recognition.stop();
    } catch {
      // already stopped
    }
    if (current?.recognition === recognition) current = null;
    onEnd?.();
  }

  recognition.onresult = (event) => {
    let text = '';
    let isFinal = true;
    for (const result of event.results) {
      text += result[0].transcript;
      isFinal = isFinal && result.isFinal;
    }
    text = text.trim();
    if (text) heard = true;
    onResult?.(text, isFinal);
    if (isFinal) finish();
  };
  recognition.onerror = (event) => {
    onError?.(event.error);
    finish({ abort: true });
  };
  recognition.onend = () => {
    if (!heard) onError?.('no-speech');
    finish();
  };

  current = { recognition, abort: () => finish({ abort: true }) };

  try {
    recognition.start();
  } catch (error) {
    onError?.(error?.name === 'NotAllowedError' ? 'not-allowed' : 'start-failed');
    finish({ abort: true });
    return () => {};
  }

  watchdog = setTimeout(() => finish(), WATCHDOG_MS);
  return () => finish();
}

/** A readable reason for a recognition error code, or null to stay quiet. */
export function describeVoiceError(code) {
  switch (code) {
    case 'not-allowed':
    case 'service-not-allowed':
      return 'Microphone access is blocked. Allow it in your browser settings to search by voice.';
    case 'audio-capture':
      return 'No microphone found.';
    case 'network':
      return 'Voice search needs a connection.';
    case 'no-speech':
      return 'Didn’t catch that. Tap the mic and try again.';
    case 'aborted':
      return null;
    default:
      return 'Voice search stopped. Try again or type instead.';
  }
}
