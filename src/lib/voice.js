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

/**
 * Listen for one utterance.
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

  const recognition = new Recognition();
  recognition.lang = lang || navigator.language || 'en-US';
  recognition.interimResults = true;
  recognition.continuous = false;
  recognition.maxAlternatives = 1;

  recognition.onresult = (event) => {
    let text = '';
    let isFinal = true;
    for (const result of event.results) {
      text += result[0].transcript;
      isFinal = isFinal && result.isFinal;
    }
    onResult?.(text.trim(), isFinal);
  };
  recognition.onerror = (event) => onError?.(event.error);
  recognition.onend = () => onEnd?.();

  recognition.start();
  return () => recognition.stop();
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
    case 'aborted':
      return null;
    default:
      return 'Voice search stopped. Try again or type instead.';
  }
}
