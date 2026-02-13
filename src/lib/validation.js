/**
 * Form validation utilities for location submissions
 * Client-side validation for UX - server-side validation enforced by database constraints
 */

/**
 * Validates establishment name
 * @param {string} name - Establishment name
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateName(name) {
	if (!name || name.trim().length === 0) {
		return { valid: false, error: 'Name is required' };
	}
	if (name.trim().length < 3) {
		return { valid: false, error: 'Name must be at least 3 characters' };
	}
	if (name.length > 100) {
		return { valid: false, error: 'Name must be 100 characters or less' };
	}
	return { valid: true };
}

/**
 * Validates establishment type
 * @param {string} type - Establishment type
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateType(type) {
	const validTypes = ['Brick and Mortar', 'Stand', 'Truck'];
	if (!type) {
		return { valid: false, error: 'Type is required' };
	}
	if (!validTypes.includes(type)) {
		return { valid: false, error: 'Invalid establishment type' };
	}
	return { valid: true };
}

/**
 * Validates address
 * @param {string} address - Street address
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateAddress(address) {
	if (!address || address.trim().length === 0) {
		return { valid: false, error: 'Address is required' };
	}
	if (address.trim().length < 10) {
		return { valid: false, error: 'Please enter a complete address' };
	}
	return { valid: true };
}

/**
 * Validates short description
 * @param {string} description - Short description
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateShortDescription(description) {
	if (!description || description.trim().length === 0) {
		return { valid: false, error: 'Short description is required' };
	}
	if (description.trim().length < 10) {
		return { valid: false, error: 'Description must be at least 10 characters' };
	}
	if (description.length > 150) {
		return { valid: false, error: 'Description must be 150 characters or less' };
	}
	return { valid: true };
}

/**
 * Validates long description (optional)
 * @param {string} description - Long description
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateLongDescription(description) {
	if (!description) {
		return { valid: true }; // Optional field
	}
	if (description.length > 500) {
		return { valid: false, error: 'Long description must be 500 characters or less' };
	}
	return { valid: true };
}

/**
 * Validates phone number (Tucson format)
 * @param {string} phone - Phone number
 * @returns {{ valid: boolean, error?: string }}
 */
export function validatePhone(phone) {
	if (!phone) {
		return { valid: true }; // Optional field
	}
	// Accept formats: (520) 123-4567, 520-123-4567, 5201234567
	const phoneRegex = /^(\(?\d{3}\)?[\s.-]?)?\d{3}[\s.-]?\d{4}$/;
	if (!phoneRegex.test(phone)) {
		return { valid: false, error: 'Invalid phone format. Use: (520) 123-4567' };
	}
	return { valid: true };
}

/**
 * Validates URL format
 * @param {string} url - URL to validate
 * @param {string} fieldName - Field name for error message
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateUrl(url, fieldName = 'URL') {
	if (!url) {
		return { valid: true }; // Optional field
	}
	try {
		new URL(url);
		return { valid: true };
	} catch {
		return { valid: false, error: `Invalid ${fieldName} format. Must start with http:// or https://` };
	}
}

/**
 * Validates Instagram handle
 * @param {string} handle - Instagram handle (with or without @)
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateInstagram(handle) {
	if (!handle) {
		return { valid: true }; // Optional field
	}
	// Remove @ if present
	const cleaned = handle.replace('@', '');
	// Instagram usernames: 1-30 chars, alphanumeric + underscores/periods
	const instagramRegex = /^[a-zA-Z0-9._]{1,30}$/;
	if (!instagramRegex.test(cleaned)) {
		return { valid: false, error: 'Invalid Instagram handle. Use @username or username' };
	}
	return { valid: true };
}

/**
 * Validates Facebook page name/URL
 * @param {string} facebook - Facebook page name or URL
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateFacebook(facebook) {
	if (!facebook) {
		return { valid: true }; // Optional field
	}
	// Accept either full URL or just page name
	if (facebook.includes('facebook.com/')) {
		return validateUrl(facebook, 'Facebook URL');
	}
	// Just a page name - allow alphanumeric, dots, dashes
	const pageNameRegex = /^[a-zA-Z0-9.-]+$/;
	if (!pageNameRegex.test(facebook)) {
		return { valid: false, error: 'Invalid Facebook page. Use page name or full URL' };
	}
	return { valid: true };
}

/**
 * Validates coordinates
 * @param {number} latitude - Latitude
 * @param {number} longitude - Longitude
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateCoordinates(latitude, longitude) {
	if (latitude === null || latitude === undefined) {
		return { valid: false, error: 'Latitude is required' };
	}
	if (longitude === null || longitude === undefined) {
		return { valid: false, error: 'Longitude is required' };
	}
	if (latitude < -90 || latitude > 90) {
		return { valid: false, error: 'Latitude must be between -90 and 90' };
	}
	if (longitude < -180 || longitude > 180) {
		return { valid: false, error: 'Longitude must be between -180 and 180' };
	}
	// Rough check for Tucson area (31.5°N - 32.5°N, 111.5°W - 110.5°W)
	if (latitude < 31.5 || latitude > 33.0) {
		return { valid: false, error: 'Location appears to be outside Tucson area' };
	}
	if (longitude < -111.5 || longitude > -110.5) {
		return { valid: false, error: 'Location appears to be outside Tucson area' };
	}
	return { valid: true };
}

/**
 * Validates time format (HH:MM)
 * @param {string} time - Time string
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateTime(time) {
	if (!time) {
		return { valid: true }; // Optional
	}
	const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
	if (!timeRegex.test(time)) {
		return { valid: false, error: 'Invalid time format. Use HH:MM (e.g., 08:00)' };
	}
	return { valid: true };
}

/**
 * Validates hours object for a single day
 * @param {object} dayHours - { open: string, close: string }
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateDayHours(dayHours) {
	if (!dayHours) {
		return { valid: true }; // Closed day
	}
	const { open, close } = dayHours;

	const openValidation = validateTime(open);
	if (!openValidation.valid) {
		return { valid: false, error: `Opening time: ${openValidation.error}` };
	}

	const closeValidation = validateTime(close);
	if (!closeValidation.valid) {
		return { valid: false, error: `Closing time: ${closeValidation.error}` };
	}

	// Check that close is after open
	if (open && close) {
		const [openHour, openMin] = open.split(':').map(Number);
		const [closeHour, closeMin] = close.split(':').map(Number);
		const openMinutes = openHour * 60 + openMin;
		const closeMinutes = closeHour * 60 + closeMin;

		if (closeMinutes <= openMinutes) {
			return { valid: false, error: 'Closing time must be after opening time' };
		}
	}

	return { valid: true };
}

/**
 * Validates entire submission form
 * @param {object} formData - Complete form data
 * @returns {{ valid: boolean, errors: object }}
 */
export function validateSubmissionForm(formData) {
	const errors = {};

	// Required fields
	const nameValidation = validateName(formData.name);
	if (!nameValidation.valid) errors.name = nameValidation.error;

	const typeValidation = validateType(formData.type);
	if (!typeValidation.valid) errors.type = typeValidation.error;

	const addressValidation = validateAddress(formData.address);
	if (!addressValidation.valid) errors.address = addressValidation.error;

	const shortDescValidation = validateShortDescription(formData.short_description);
	if (!shortDescValidation.valid) errors.short_description = shortDescValidation.error;

	const coordsValidation = validateCoordinates(formData.latitude, formData.longitude);
	if (!coordsValidation.valid) errors.coordinates = coordsValidation.error;

	// Optional fields
	const longDescValidation = validateLongDescription(formData.long_description);
	if (!longDescValidation.valid) errors.long_description = longDescValidation.error;

	const phoneValidation = validatePhone(formData.phone);
	if (!phoneValidation.valid) errors.phone = phoneValidation.error;

	const websiteValidation = validateUrl(formData.website, 'Website');
	if (!websiteValidation.valid) errors.website = websiteValidation.error;

	const instagramValidation = validateInstagram(formData.instagram);
	if (!instagramValidation.valid) errors.instagram = instagramValidation.error;

	const facebookValidation = validateFacebook(formData.facebook);
	if (!facebookValidation.valid) errors.facebook = facebookValidation.error;

	return {
		valid: Object.keys(errors).length === 0,
		errors
	};
}
