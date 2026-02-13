<script>
	import { goto } from '$app/navigation';
	import LocationPicker from '../../../components/LocationPicker.svelte';
	import HoursInput from '../../../components/HoursInput.svelte';
	import { geocodeAddress } from '$lib/geocoding.js';
	import { validateSubmissionForm } from '$lib/validation.js';
	import { submitLocation } from '$lib/submissions.js';

	export let data;

	// Form state
	let formData = {
		name: '',
		type: 'Brick and Mortar',
		address: '',
		latitude: null,
		longitude: null,
		short_description: '',
		long_description: '',
		phone: '',
		website: '',
		instagram: '',
		facebook: '',
		hours: {}
	};

	// UI state
	let errors = {};
	let isGeocoding = false;
	let isSubmitting = false;
	let geocodingError = '';
	let showSuccessMessage = false;
	let addressGeocoded = false;

	// Character counts
	$: nameCount = formData.name.length;
	$: shortDescCount = formData.short_description.length;
	$: longDescCount = formData.long_description.length;

	// Handle geocoding
	async function handleGeocode() {
		if (!formData.address || formData.address.trim().length === 0) {
			geocodingError = 'Please enter an address first';
			return;
		}

		isGeocoding = true;
		geocodingError = '';

		const result = await geocodeAddress(formData.address);

		if (result.success) {
			formData.latitude = result.data.latitude;
			formData.longitude = result.data.longitude;
			formData.address = result.data.formattedAddress; // Use formatted address
			addressGeocoded = true;
			geocodingError = '';
		} else {
			geocodingError = result.error;
			addressGeocoded = false;
		}

		isGeocoding = false;
	}

	// Handle location picker changes
	function handleLocationChange(event) {
		formData.latitude = event.latitude;
		formData.longitude = event.longitude;
	}

	// Handle hours input changes
	function handleHoursChange(event) {
		formData.hours = event.detail;
	}

	// Handle form submission
	async function handleSubmit(e) {
		e.preventDefault();

		// Validate form
		const validation = validateSubmissionForm(formData);
		if (!validation.valid) {
			errors = validation.errors;
			window.scrollTo({ top: 0, behavior: 'smooth' });
			return;
		}

		// Check if location was geocoded
		if (!addressGeocoded) {
			geocodingError = 'Please click "Find Location" to geocode the address';
			return;
		}

		// Submit to database
		isSubmitting = true;
		errors = {};

		const result = await submitLocation(formData);

		if (result.success) {
			showSuccessMessage = true;

			// Reset form
			formData = {
				name: '',
				type: 'Brick and Mortar',
				address: '',
				latitude: null,
				longitude: null,
				short_description: '',
				long_description: '',
				phone: '',
				website: '',
				instagram: '',
				facebook: '',
				hours: {}
			};
			addressGeocoded = false;

			// Scroll to top to show success message
			window.scrollTo({ top: 0, behavior: 'smooth' });

			// Redirect to profile after 3 seconds
			setTimeout(() => {
				goto('/profile');
			}, 3000);
		} else {
			errors.submit = result.error;
			window.scrollTo({ top: 0, behavior: 'smooth' });
		}

		isSubmitting = false;
	}
</script>

<svelte:head>
	<title>Submit Location - CartoTaco</title>
</svelte:head>

<div class="submit-page">
	<div class="container">
		<div class="header">
			<h1>Submit New Location</h1>
			<p class="subtitle">
				Help us grow CartoTaco! Submit a taco establishment you love and we'll review it for
				addition to the map.
			</p>
		</div>

		{#if showSuccessMessage}
			<div class="success-message">
				<svg
					class="icon"
					xmlns="http://www.w3.org/2000/svg"
					viewBox="0 0 24 24"
					fill="currentColor"
				>
					<path
						fill-rule="evenodd"
						d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.814a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z"
						clip-rule="evenodd"
					/>
				</svg>
				<div>
					<h3>Submission Received!</h3>
					<p>Thanks for your submission! We'll review it and add it to the map soon.</p>
					<p class="redirect-note">Redirecting to your profile...</p>
				</div>
			</div>
		{/if}

		{#if errors.submit}
			<div class="error-message">
				<svg
					class="icon"
					xmlns="http://www.w3.org/2000/svg"
					viewBox="0 0 24 24"
					fill="currentColor"
				>
					<path
						fill-rule="evenodd"
						d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zm-1.72 6.97a.75.75 0 10-1.06 1.06L10.94 12l-1.72 1.72a.75.75 0 101.06 1.06L12 13.06l1.72 1.72a.75.75 0 101.06-1.06L13.06 12l1.72-1.72a.75.75 0 10-1.06-1.06L12 10.94l-1.72-1.72z"
						clip-rule="evenodd"
					/>
				</svg>
				<div>
					<h3>Submission Failed</h3>
					<p>{errors.submit}</p>
				</div>
			</div>
		{/if}

		<form on:submit={handleSubmit} class="submission-form">
			<!-- Basic Information Section -->
			<section class="form-section">
				<h2>Basic Information</h2>

				<div class="form-group">
					<label for="name">
						Establishment Name <span class="required">*</span>
					</label>
					<input
						id="name"
						type="text"
						bind:value={formData.name}
						placeholder="e.g., El Güero Canelo"
						maxlength="100"
						class:error={errors.name}
						required
					/>
					<div class="field-footer">
						{#if errors.name}
							<span class="error-text">{errors.name}</span>
						{/if}
						<span class="char-count">{nameCount}/100</span>
					</div>
				</div>

				<div class="form-group">
					<label for="type">
						Type <span class="required">*</span>
					</label>
					<select id="type" bind:value={formData.type} required>
						<option value="Brick and Mortar">Brick and Mortar</option>
						<option value="Stand">Stand</option>
						<option value="Truck">Truck</option>
					</select>
				</div>

				<div class="form-group">
					<label for="short-description">
						Short Description <span class="required">*</span>
					</label>
					<input
						id="short-description"
						type="text"
						bind:value={formData.short_description}
						placeholder="One-line description of what makes this place special"
						maxlength="150"
						class:error={errors.short_description}
						required
					/>
					<div class="field-footer">
						{#if errors.short_description}
							<span class="error-text">{errors.short_description}</span>
						{/if}
						<span class="char-count">{shortDescCount}/150</span>
					</div>
				</div>

				<div class="form-group">
					<label for="long-description">Long Description (Optional)</label>
					<textarea
						id="long-description"
						bind:value={formData.long_description}
						placeholder="More detailed description, specialties, history, etc."
						maxlength="500"
						rows="4"
						class:error={errors.long_description}
					/>
					<div class="field-footer">
						{#if errors.long_description}
							<span class="error-text">{errors.long_description}</span>
						{/if}
						<span class="char-count">{longDescCount}/500</span>
					</div>
				</div>
			</section>

			<!-- Location Section -->
			<section class="form-section">
				<h2>Location</h2>

				<div class="form-group">
					<label for="address">
						Address <span class="required">*</span>
					</label>
					<div class="address-input-group">
						<input
							id="address"
							type="text"
							bind:value={formData.address}
							placeholder="123 Main St, Tucson, AZ 85701"
							class:error={errors.address}
							on:input={() => (addressGeocoded = false)}
							required
						/>
						<button
							type="button"
							class="geocode-btn"
							on:click={handleGeocode}
							disabled={isGeocoding || !formData.address}
						>
							{isGeocoding ? 'Finding...' : 'Find Location'}
						</button>
					</div>
					{#if errors.address}
						<span class="error-text">{errors.address}</span>
					{/if}
					{#if geocodingError}
						<span class="error-text">{geocodingError}</span>
					{/if}
					{#if addressGeocoded}
						<span class="success-text">✓ Location found!</span>
					{/if}
				</div>

				{#if formData.latitude && formData.longitude}
					<LocationPicker
						bind:latitude={formData.latitude}
						bind:longitude={formData.longitude}
						onLocationChange={handleLocationChange}
					/>

					<div class="coordinates-display">
						<div class="coord">
							<span class="label">Latitude:</span>
							<span class="value">{formData.latitude.toFixed(6)}</span>
						</div>
						<div class="coord">
							<span class="label">Longitude:</span>
							<span class="value">{formData.longitude.toFixed(6)}</span>
						</div>
					</div>
				{/if}

				{#if errors.coordinates}
					<span class="error-text">{errors.coordinates}</span>
				{/if}
			</section>

			<!-- Contact Information Section -->
			<section class="form-section">
				<h2>Contact Information (Optional)</h2>

				<div class="form-group">
					<label for="phone">Phone Number</label>
					<input
						id="phone"
						type="tel"
						bind:value={formData.phone}
						placeholder="(520) 123-4567"
						class:error={errors.phone}
					/>
					{#if errors.phone}
						<span class="error-text">{errors.phone}</span>
					{/if}
				</div>

				<div class="form-group">
					<label for="website">Website</label>
					<input
						id="website"
						type="url"
						bind:value={formData.website}
						placeholder="https://example.com"
						class:error={errors.website}
					/>
					{#if errors.website}
						<span class="error-text">{errors.website}</span>
					{/if}
				</div>

				<div class="form-group">
					<label for="instagram">Instagram</label>
					<input
						id="instagram"
						type="text"
						bind:value={formData.instagram}
						placeholder="@username or username"
						class:error={errors.instagram}
					/>
					{#if errors.instagram}
						<span class="error-text">{errors.instagram}</span>
					{/if}
				</div>

				<div class="form-group">
					<label for="facebook">Facebook</label>
					<input
						id="facebook"
						type="text"
						bind:value={formData.facebook}
						placeholder="Page name or full URL"
						class:error={errors.facebook}
					/>
					{#if errors.facebook}
						<span class="error-text">{errors.facebook}</span>
					{/if}
				</div>
			</section>

			<!-- Operating Hours Section -->
			<section class="form-section">
				<HoursInput bind:hours={formData.hours} on:change={handleHoursChange} />
			</section>

			<!-- Submit Button -->
			<div class="form-actions">
				<button type="submit" class="submit-btn" disabled={isSubmitting}>
					{isSubmitting ? 'Submitting...' : 'Submit for Review'}
				</button>
				<button type="button" class="cancel-btn" on:click={() => goto('/profile')}>
					Cancel
				</button>
			</div>
		</form>
	</div>
</div>

<style>
	.submit-page {
		min-height: 100vh;
		background: linear-gradient(135deg, #fef3c7 0%, #fca5a5 100%);
		padding: 6rem 1rem 2rem 1rem; /* Extra top padding to clear sticky header */
		transition: background 0.3s ease;
	}

	:global(.dark) .submit-page {
		background: linear-gradient(135deg, #1f2937 0%, #111827 100%);
	}

	.container {
		max-width: 700px;
		margin: 0 auto;
	}

	.header {
		text-align: center;
		margin-bottom: 2rem;
	}

	.header h1 {
		font-size: 2.5rem;
		font-weight: 700;
		color: #111827;
		margin: 0 0 0.5rem 0;
	}

	:global(.dark) .header h1 {
		color: #f9fafb;
	}

	.subtitle {
		font-size: 1rem;
		color: #4b5563;
		margin: 0;
		line-height: 1.5;
	}

	:global(.dark) .subtitle {
		color: #d1d5db;
	}

	.success-message,
	.error-message {
		display: flex;
		gap: 1rem;
		padding: 1rem 1.5rem;
		border-radius: 8px;
		margin-bottom: 2rem;
	}

	.success-message {
		background: #d1fae5;
		border: 2px solid #10b981;
	}

	.error-message {
		background: #fee2e2;
		border: 2px solid #ef4444;
	}

	.success-message .icon {
		width: 28px;
		height: 28px;
		color: #10b981;
		flex-shrink: 0;
	}

	.error-message .icon {
		width: 28px;
		height: 28px;
		color: #ef4444;
		flex-shrink: 0;
	}

	.success-message h3,
	.error-message h3 {
		margin: 0 0 0.25rem 0;
		font-size: 1.125rem;
		font-weight: 600;
	}

	.success-message h3 {
		color: #065f46;
	}

	.error-message h3 {
		color: #991b1b;
	}

	.success-message p,
	.error-message p {
		margin: 0;
		font-size: 0.875rem;
	}

	.success-message p {
		color: #047857;
	}

	.error-message p {
		color: #b91c1c;
	}

	.redirect-note {
		margin-top: 0.5rem !important;
		font-style: italic;
	}

	.submission-form {
		background: white;
		border-radius: 12px;
		padding: 2rem;
		box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
	}

	:global(.dark) .submission-form {
		background: #1f2937;
		box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
	}

	.form-section {
		margin-bottom: 2.5rem;
		padding-bottom: 2rem;
		border-bottom: 1px solid #e5e7eb;
	}

	.form-section:last-of-type {
		border-bottom: none;
	}

	.form-section h2 {
		font-size: 1.5rem;
		font-weight: 600;
		color: #111827;
		margin: 0 0 1.5rem 0;
	}

	:global(.dark) .form-section h2 {
		color: #f9fafb;
	}

	.form-group {
		margin-bottom: 1.5rem;
	}

	.form-group label {
		display: block;
		font-size: 0.875rem;
		font-weight: 500;
		color: #374151;
		margin-bottom: 0.5rem;
	}

	:global(.dark) .form-group label {
		color: #d1d5db;
	}

	.required {
		color: #ef4444;
	}

	.form-group input[type='text'],
	.form-group input[type='tel'],
	.form-group input[type='url'],
	.form-group textarea,
	.form-group select {
		width: 100%;
		padding: 0.75rem;
		border: 1px solid #d1d5db;
		border-radius: 6px;
		font-size: 1rem;
		color: #111827;
		background: white;
		transition: all 0.2s;
	}

	:global(.dark) .form-group input[type='text'],
	:global(.dark) .form-group input[type='tel'],
	:global(.dark) .form-group input[type='url'],
	:global(.dark) .form-group textarea,
	:global(.dark) .form-group select {
		background: #111827;
		border-color: #4b5563;
		color: #f9fafb;
	}

	.form-group input:focus,
	.form-group textarea:focus,
	.form-group select:focus {
		outline: none;
		border-color: #fe795d;
		box-shadow: 0 0 0 3px rgba(254, 121, 93, 0.1);
	}

	.form-group input.error,
	.form-group textarea.error {
		border-color: #ef4444;
	}

	.field-footer {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-top: 0.25rem;
	}

	.error-text {
		display: block;
		font-size: 0.875rem;
		color: #ef4444;
		margin-top: 0.25rem;
	}

	.success-text {
		display: block;
		font-size: 0.875rem;
		color: #10b981;
		margin-top: 0.25rem;
		font-weight: 500;
	}

	.char-count {
		font-size: 0.75rem;
		color: #9ca3af;
	}

	.address-input-group {
		display: flex;
		gap: 0.5rem;
	}

	.address-input-group input {
		flex: 1;
	}

	.geocode-btn {
		background: #fe795d;
		color: white;
		border: none;
		padding: 0.75rem 1.5rem;
		border-radius: 6px;
		font-size: 0.875rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s;
		white-space: nowrap;
	}

	.geocode-btn:hover:not(:disabled) {
		background: #fe6a4a;
	}

	.geocode-btn:disabled {
		background: #d1d5db;
		cursor: not-allowed;
	}

	.coordinates-display {
		display: flex;
		gap: 2rem;
		margin-top: 1rem;
		padding: 0.75rem 1rem;
		background: #f9fafb;
		border-radius: 6px;
	}

	:global(.dark) .coordinates-display {
		background: #111827;
	}

	.coord {
		display: flex;
		gap: 0.5rem;
		font-size: 0.875rem;
	}

	.coord .label {
		font-weight: 500;
		color: #6b7280;
	}

	:global(.dark) .coord .label {
		color: #9ca3af;
	}

	.coord .value {
		color: #111827;
		font-family: monospace;
	}

	:global(.dark) .coord .value {
		color: #f9fafb;
	}

	.form-actions {
		display: flex;
		gap: 1rem;
		justify-content: center;
		margin-top: 2rem;
	}

	.submit-btn {
		background: #fe795d;
		color: white;
		border: none;
		padding: 0.875rem 2rem;
		border-radius: 8px;
		font-size: 1rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s;
	}

	.submit-btn:hover:not(:disabled) {
		background: #fe6a4a;
		transform: translateY(-1px);
		box-shadow: 0 4px 6px rgba(254, 121, 93, 0.3);
	}

	.submit-btn:disabled {
		background: #d1d5db;
		cursor: not-allowed;
		transform: none;
	}

	.cancel-btn {
		background: white;
		color: #6b7280;
		border: 1px solid #d1d5db;
		padding: 0.875rem 2rem;
		border-radius: 8px;
		font-size: 1rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s;
	}

	.cancel-btn:hover {
		background: #f9fafb;
		color: #111827;
	}

	/* Mobile responsive */
	@media (max-width: 640px) {
		.submit-page {
			padding: 5rem 0.5rem 1rem 0.5rem; /* Extra top padding for mobile */
		}

		.header h1 {
			font-size: 2rem;
		}

		.submission-form {
			padding: 1.5rem 1rem;
		}

		.address-input-group {
			flex-direction: column;
		}

		.geocode-btn {
			width: 100%;
		}

		.coordinates-display {
			flex-direction: column;
			gap: 0.5rem;
		}

		.form-actions {
			flex-direction: column;
		}

		.submit-btn,
		.cancel-btn {
			width: 100%;
		}
	}
</style>
