/**
 * Supabase operations for location submissions
 * Handles creating and querying user submissions
 */

import { supabaseBrowser, getAuthenticatedUser } from './supabaseBrowser';

/**
 * Submit a new location for admin review
 * @param {object} submissionData - Complete submission data
 * @returns {Promise<{ success: boolean, data?: object, error?: string }>}
 */
export async function submitLocation(submissionData) {
	try {
		const { user, error: authError } = await getAuthenticatedUser();
		if (authError) {
			return { success: false, error: 'You must be logged in to submit a location' };
		}

		// Prepare submission data
		const submission = {
			user_id: user.id,
			name: submissionData.name?.trim(),
			type: submissionData.type,
			address: submissionData.address?.trim(),
			latitude: submissionData.latitude,
			longitude: submissionData.longitude,
			short_description: submissionData.short_description?.trim(),
			long_description: submissionData.long_description?.trim() || null,
			phone: submissionData.phone?.trim() || null,
			website: submissionData.website?.trim() || null,
			instagram: submissionData.instagram?.trim() || null,
			facebook: submissionData.facebook?.trim() || null,
			hours: submissionData.hours || null,
			status: 'pending'
		};

		// Insert into database
		const { data, error } = await supabaseBrowser
			.from('location_submissions')
			.insert([submission])
			.select()
			.single();

		if (error) {
			console.error('Submission error:', error);
			return {
				success: false,
				error: `Failed to submit location: ${error.message}`
			};
		}

		return {
			success: true,
			data
		};
	} catch (error) {
		console.error('Unexpected submission error:', error);
		return {
			success: false,
			error: 'An unexpected error occurred. Please try again.'
		};
	}
}

/**
 * Get all submissions for the current user
 * @param {string} status - Optional status filter ('pending', 'approved', 'rejected')
 * @returns {Promise<{ success: boolean, data?: array, error?: string }>}
 */
export async function getUserSubmissions(status = null) {
	try {
		const { user, error: authError } = await getAuthenticatedUser();
		if (authError) {
			return { success: false, error: 'You must be logged in to view submissions' };
		}

		// Build query
		let query = supabaseBrowser
			.from('location_submissions')
			.select('*')
			.eq('user_id', user.id)
			.order('submitted_at', { ascending: false });

		// Apply status filter if provided
		if (status) {
			query = query.eq('status', status);
		}

		const { data, error } = await query;

		if (error) {
			console.error('Query error:', error);
			return {
				success: false,
				error: `Failed to fetch submissions: ${error.message}`
			};
		}

		return {
			success: true,
			data: data || []
		};
	} catch (error) {
		console.error('Unexpected query error:', error);
		return {
			success: false,
			error: 'An unexpected error occurred. Please try again.'
		};
	}
}

/**
 * Get a single submission by ID (must belong to current user)
 * @param {string} submissionId - Submission UUID
 * @returns {Promise<{ success: boolean, data?: object, error?: string }>}
 */
export async function getSubmissionById(submissionId) {
	try {
		const { user, error: authError } = await getAuthenticatedUser();
		if (authError) {
			return { success: false, error: 'You must be logged in to view this submission' };
		}

		const { data, error } = await supabaseBrowser
			.from('location_submissions')
			.select('*')
			.eq('id', submissionId)
			.eq('user_id', user.id)
			.single();

		if (error) {
			console.error('Query error:', error);
			return {
				success: false,
				error: `Failed to fetch submission: ${error.message}`
			};
		}

		return {
			success: true,
			data
		};
	} catch (error) {
		console.error('Unexpected query error:', error);
		return {
			success: false,
			error: 'An unexpected error occurred. Please try again.'
		};
	}
}

/**
 * Update a pending submission (only allowed for pending status)
 * @param {string} submissionId - Submission UUID
 * @param {object} updates - Fields to update
 * @returns {Promise<{ success: boolean, data?: object, error?: string }>}
 */
export async function updateSubmission(submissionId, updates) {
	try {
		const { user, error: authError } = await getAuthenticatedUser();
		if (authError) {
			return { success: false, error: 'You must be logged in to update a submission' };
		}

		// RLS policy will enforce user_id and pending status
		const { data, error } = await supabaseBrowser
			.from('location_submissions')
			.update(updates)
			.eq('id', submissionId)
			.eq('user_id', user.id)
			.eq('status', 'pending')
			.select()
			.single();

		if (error) {
			console.error('Update error:', error);
			return {
				success: false,
				error: `Failed to update submission: ${error.message}`
			};
		}

		return {
			success: true,
			data
		};
	} catch (error) {
		console.error('Unexpected update error:', error);
		return {
			success: false,
			error: 'An unexpected error occurred. Please try again.'
		};
	}
}

/**
 * Delete a pending submission (only allowed for pending status)
 * @param {string} submissionId - Submission UUID
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
export async function deleteSubmission(submissionId) {
	try {
		const { user, error: authError } = await getAuthenticatedUser();
		if (authError) {
			return { success: false, error: 'You must be logged in to delete a submission' };
		}

		// RLS policy will enforce user_id and pending status
		const { error } = await supabaseBrowser
			.from('location_submissions')
			.delete()
			.eq('id', submissionId)
			.eq('user_id', user.id)
			.eq('status', 'pending');

		if (error) {
			console.error('Delete error:', error);
			return {
				success: false,
				error: `Failed to delete submission: ${error.message}`
			};
		}

		return {
			success: true
		};
	} catch (error) {
		console.error('Unexpected delete error:', error);
		return {
			success: false,
			error: 'An unexpected error occurred. Please try again.'
		};
	}
}

/**
 * Get submission statistics for current user
 * @returns {Promise<{ success: boolean, stats?: object, error?: string }>}
 */
export async function getUserSubmissionStats() {
	try {
		const { user, error: authError } = await getAuthenticatedUser();
		if (authError) {
			return { success: false, error: 'You must be logged in to view statistics' };
		}

		// Get all user submissions
		const { data, error } = await supabaseBrowser
			.from('location_submissions')
			.select('status')
			.eq('user_id', user.id);

		if (error) {
			console.error('Query error:', error);
			return {
				success: false,
				error: `Failed to fetch statistics: ${error.message}`
			};
		}

		// Calculate stats
		const stats = {
			total: data.length,
			pending: data.filter((s) => s.status === 'pending').length,
			approved: data.filter((s) => s.status === 'approved').length,
			rejected: data.filter((s) => s.status === 'rejected').length
		};

		return {
			success: true,
			stats
		};
	} catch (error) {
		console.error('Unexpected error:', error);
		return {
			success: false,
			error: 'An unexpected error occurred. Please try again.'
		};
	}
}
