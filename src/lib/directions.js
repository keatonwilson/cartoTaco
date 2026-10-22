// Directions to a spot in whatever maps app the device has: Apple Maps on
// iOS, a geo: intent on Android, Google Maps on the web.

/**
 * @param {{ latitude: number, longitude: number, name: string }} spot
 * @param {string} [userAgent]
 */
export function directionsUrl({ latitude, longitude, name }, userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : '') {
  const encodedName = encodeURIComponent(name || '');
  if (/iPad|iPhone|iPod/.test(userAgent)) {
    return `maps://?q=${encodedName}&ll=${latitude},${longitude}`;
  }
  if (/android/i.test(userAgent)) {
    return `geo:${latitude},${longitude}?q=${latitude},${longitude}(${encodedName})`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
}

/** Open directions in a new tab, or hand off to the native maps app */
export function openDirections(spot) {
  window.open(directionsUrl(spot), '_blank');
}
