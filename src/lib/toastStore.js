/**
 * Toast notifications — small, non-blocking confirmations and errors.
 * Mounted once via <ToastHost /> in +layout.svelte.
 */

import { writable } from 'svelte/store';

export const toasts = writable([]);

let nextId = 1;

/**
 * Push a toast.
 * @param {string} message
 * @param {{ kind?: 'success'|'error'|'info', duration?: number }} [opts]
 */
export function pushToast(message, { kind = 'info', duration = 3500 } = {}) {
	const id = nextId++;
	toasts.update(list => [...list, { id, message, kind }]);
	if (duration > 0) {
		setTimeout(() => dismissToast(id), duration);
	}
	return id;
}

export function dismissToast(id) {
	toasts.update(list => list.filter(t => t.id !== id));
}

export const toast = {
	success: (msg, opts) => pushToast(msg, { ...opts, kind: 'success' }),
	error: (msg, opts) => pushToast(msg, { ...opts, kind: 'error' }),
	info: (msg, opts) => pushToast(msg, { ...opts, kind: 'info' })
};
