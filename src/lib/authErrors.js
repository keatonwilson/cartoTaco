/**
 * Translates Supabase auth errors into user-facing copy.
 *
 * Supabase surfaces raw strings like "email rate limit exceeded" straight from
 * GoTrue. Those are fine in a console and confusing in a signup form, so this
 * maps the ones users can actually hit to something actionable.
 */

const FALLBACK_MESSAGE = 'Something went wrong. Please try again.';

export const EMAIL_RATE_LIMIT_MESSAGE =
	"We've sent out as many confirmation emails as we can right now. Please wait a few minutes and try again.";

const GENERIC_RATE_LIMIT_MESSAGE = 'Too many attempts. Please wait a few minutes and try again.';

/**
 * Normalizes an error into a lowercase message string for matching
 * @param {any} error - Supabase auth error (or anything thrown)
 * @returns {string}
 */
function messageOf(error) {
	return String(error?.message ?? error ?? '').toLowerCase();
}

/**
 * True when the failure is specifically the confirmation-email send cap.
 * Covers the project-wide hourly cap and the per-address resend cooldown.
 * @param {any} error - Supabase auth error
 * @returns {boolean}
 */
export function isEmailRateLimitError(error) {
	if (!error) return false;
	if (error.code === 'over_email_send_rate_limit') return true;

	const message = messageOf(error);
	return message.includes('email rate limit') || message.includes('only request this after');
}

/**
 * True for any rate limit, email-related or not (HTTP 429).
 * @param {any} error - Supabase auth error
 * @returns {boolean}
 */
export function isRateLimitError(error) {
	if (!error) return false;
	if (isEmailRateLimitError(error)) return true;
	if (error.code === 'over_request_rate_limit') return true;
	if (error.status === 429) return true;

	return messageOf(error).includes('rate limit');
}

/**
 * Converts a Supabase auth error into a message safe to show a user.
 * @param {any} error - Supabase auth error, or null
 * @param {string} fallback - Message used when the error isn't recognized and carries no message of its own
 * @returns {string|null} - Friendly message, or null when there is no error
 */
export function friendlyAuthError(error, fallback = FALLBACK_MESSAGE) {
	if (!error) return null;

	if (isEmailRateLimitError(error)) return EMAIL_RATE_LIMIT_MESSAGE;
	if (isRateLimitError(error)) return GENERIC_RATE_LIMIT_MESSAGE;

	const message = messageOf(error);

	if (error.code === 'user_already_exists' || message.includes('already registered')) {
		return 'An account with that email already exists. Try signing in instead.';
	}

	if (error.code === 'weak_password' || message.includes('password should be at least')) {
		return 'That password is too short. Please use at least 6 characters.';
	}

	if (message.includes('unable to validate email address') || message.includes('invalid email')) {
		return "That email address doesn't look right. Double-check it and try again.";
	}

	return error?.message || fallback;
}
