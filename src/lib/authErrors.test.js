import { describe, it, expect } from 'vitest';
import {
	friendlyAuthError,
	isEmailRateLimitError,
	isRateLimitError,
	EMAIL_RATE_LIMIT_MESSAGE
} from './authErrors.js';

describe('isEmailRateLimitError', () => {
	it('matches the GoTrue error code', () => {
		expect(isEmailRateLimitError({ code: 'over_email_send_rate_limit' })).toBe(true);
	});

	it('matches the raw message Supabase returns', () => {
		expect(isEmailRateLimitError({ message: 'email rate limit exceeded' })).toBe(true);
	});

	it('matches the per-address resend cooldown', () => {
		expect(
			isEmailRateLimitError({
				message: 'For security purposes, you can only request this after 51 seconds.'
			})
		).toBe(true);
	});

	it('ignores unrelated errors', () => {
		expect(isEmailRateLimitError({ message: 'Invalid login credentials' })).toBe(false);
		expect(isEmailRateLimitError(null)).toBe(false);
	});
});

describe('isRateLimitError', () => {
	it('covers non-email rate limits', () => {
		expect(isRateLimitError({ status: 429, message: 'Too many requests' })).toBe(true);
		expect(isRateLimitError({ code: 'over_request_rate_limit' })).toBe(true);
	});

	it('ignores unrelated errors', () => {
		expect(isRateLimitError({ status: 400, message: 'Bad request' })).toBe(false);
	});
});

describe('friendlyAuthError', () => {
	it('returns null when there is no error', () => {
		expect(friendlyAuthError(null)).toBe(null);
		expect(friendlyAuthError(undefined)).toBe(null);
	});

	it('replaces the raw rate limit string', () => {
		const result = friendlyAuthError({ message: 'email rate limit exceeded', status: 429 });
		expect(result).toBe(EMAIL_RATE_LIMIT_MESSAGE);
		expect(result).not.toContain('rate limit exceeded');
	});

	it('distinguishes a generic 429 from the email cap', () => {
		expect(friendlyAuthError({ status: 429, message: 'Too many requests' })).toBe(
			'Too many attempts. Please wait a few minutes and try again.'
		);
	});

	it('handles a duplicate account', () => {
		expect(friendlyAuthError({ message: 'User already registered' })).toMatch(/already exists/);
		expect(friendlyAuthError({ code: 'user_already_exists' })).toMatch(/already exists/);
	});

	it('handles a short password', () => {
		expect(
			friendlyAuthError({ message: 'Password should be at least 6 characters' })
		).toMatch(/at least 6 characters/);
	});

	it('handles an unusable email address', () => {
		expect(friendlyAuthError({ message: 'Unable to validate email address: invalid format' })).toMatch(
			/doesn't look right/
		);
	});

	it('passes through messages it does not recognize', () => {
		expect(friendlyAuthError({ message: 'Signups not allowed for this instance' })).toBe(
			'Signups not allowed for this instance'
		);
	});

	it('falls back when the error carries no message', () => {
		expect(friendlyAuthError({})).toBe('Something went wrong. Please try again.');
		expect(friendlyAuthError({}, 'Could not create your account.')).toBe(
			'Could not create your account.'
		);
	});
});
