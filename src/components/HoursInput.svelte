<script>
	import { createEventDispatcher } from 'svelte';

	const dispatch = createEventDispatcher();

	// Days of the week
	const daysOfWeek = [
		'monday',
		'tuesday',
		'wednesday',
		'thursday',
		'friday',
		'saturday',
		'sunday'
	];

	// Hours state: { monday: { open: '08:00', close: '20:00', closed: false }, ... }
	export let hours = {};

	// Initialize hours if empty
	if (Object.keys(hours).length === 0) {
		daysOfWeek.forEach((day) => {
			hours[day] = { open: '08:00', close: '20:00', closed: false };
		});
	}

	// Toggle closed status for a day
	function toggleClosed(day) {
		hours[day].closed = !hours[day].closed;
		dispatchChange();
	}

	// Update opening/closing time
	function updateTime(day, field, value) {
		hours[day][field] = value;
		dispatchChange();
	}

	// Copy hours to all days
	function copyToAll(sourceDay) {
		const sourceHours = hours[sourceDay];
		daysOfWeek.forEach((day) => {
			if (day !== sourceDay) {
				hours[day] = { ...sourceHours };
			}
		});
		dispatchChange();
	}

	// Dispatch change event to parent
	function dispatchChange() {
		// Filter out closed days and convert to JSONB format
		const formattedHours = {};
		daysOfWeek.forEach((day) => {
			if (!hours[day].closed) {
				formattedHours[day] = {
					open: hours[day].open,
					close: hours[day].close
				};
			}
		});

		dispatch('change', formattedHours);
	}

	// Capitalize first letter
	function capitalize(str) {
		return str.charAt(0).toUpperCase() + str.slice(1);
	}
</script>

<div class="hours-input">
	<div class="hours-header">
		<h3>Operating Hours</h3>
		<p class="help-text">Leave a day unchecked if closed</p>
	</div>

	<div class="hours-grid">
		{#each daysOfWeek as day}
			<div class="day-row" class:closed={hours[day].closed}>
				<div class="day-header">
					<label class="checkbox-label">
						<input
							type="checkbox"
							checked={!hours[day].closed}
							on:change={() => toggleClosed(day)}
						/>
						<span class="day-name">{capitalize(day)}</span>
					</label>

					{#if !hours[day].closed}
						<button
							type="button"
							class="copy-btn"
							on:click={() => copyToAll(day)}
							title="Copy to all days"
						>
							Copy to all
						</button>
					{/if}
				</div>

				{#if !hours[day].closed}
					<div class="time-inputs">
						<div class="time-group">
							<label for="{day}-open">Open</label>
							<input
								id="{day}-open"
								type="time"
								value={hours[day].open}
								on:change={(e) => updateTime(day, 'open', e.target.value)}
							/>
						</div>

						<span class="separator">-</span>

						<div class="time-group">
							<label for="{day}-close">Close</label>
							<input
								id="{day}-close"
								type="time"
								value={hours[day].close}
								on:change={(e) => updateTime(day, 'close', e.target.value)}
							/>
						</div>
					</div>
				{:else}
					<div class="closed-indicator">Closed</div>
				{/if}
			</div>
		{/each}
	</div>
</div>

<style>
	.hours-input {
		margin: 1.5rem 0;
	}

	.hours-header {
		margin-bottom: 1rem;
	}

	.hours-header h3 {
		font-size: 1.125rem;
		font-weight: 600;
		color: #111827;
		margin: 0 0 0.25rem 0;
	}

	.help-text {
		font-size: 0.875rem;
		color: #6b7280;
		margin: 0;
	}

	.hours-grid {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.day-row {
		border: 1px solid #e5e7eb;
		border-radius: 8px;
		padding: 0.75rem 1rem;
		background: white;
		transition: all 0.2s;
	}

	.day-row.closed {
		background: #f9fafb;
		opacity: 0.6;
	}

	.day-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.5rem;
	}

	.checkbox-label {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		cursor: pointer;
		font-weight: 500;
		color: #111827;
	}

	.checkbox-label input[type='checkbox'] {
		width: 18px;
		height: 18px;
		cursor: pointer;
		accent-color: #fe795d;
	}

	.day-name {
		font-size: 1rem;
	}

	.copy-btn {
		background: none;
		border: 1px solid #d1d5db;
		padding: 0.25rem 0.75rem;
		border-radius: 4px;
		font-size: 0.75rem;
		color: #6b7280;
		cursor: pointer;
		transition: all 0.2s;
	}

	.copy-btn:hover {
		background: #f3f4f6;
		color: #111827;
	}

	.time-inputs {
		display: flex;
		align-items: center;
		gap: 1rem;
	}

	.time-group {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		flex: 1;
	}

	.time-group label {
		font-size: 0.75rem;
		font-weight: 500;
		color: #6b7280;
		text-transform: uppercase;
		letter-spacing: 0.025em;
	}

	.time-group input[type='time'] {
		padding: 0.5rem;
		border: 1px solid #d1d5db;
		border-radius: 6px;
		font-size: 0.875rem;
		color: #111827;
		transition: all 0.2s;
	}

	.time-group input[type='time']:focus {
		outline: none;
		border-color: #fe795d;
		box-shadow: 0 0 0 3px rgba(254, 121, 93, 0.1);
	}

	.separator {
		font-size: 1.25rem;
		color: #9ca3af;
		margin-top: 1.25rem;
	}

	.closed-indicator {
		font-size: 0.875rem;
		color: #9ca3af;
		font-style: italic;
		padding: 0.5rem 0;
	}

	/* Dark mode support */
	:global(.dark) .hours-header h3 {
		color: #f9fafb;
	}

	:global(.dark) .help-text {
		color: #9ca3af;
	}

	:global(.dark) .day-row {
		background: #1f2937;
		border-color: #374151;
	}

	:global(.dark) .day-row.closed {
		background: #111827;
	}

	:global(.dark) .checkbox-label {
		color: #f9fafb;
	}

	:global(.dark) .copy-btn {
		border-color: #4b5563;
		color: #9ca3af;
	}

	:global(.dark) .copy-btn:hover {
		background: #374151;
		color: #f9fafb;
	}

	:global(.dark) .time-group label {
		color: #9ca3af;
	}

	:global(.dark) .time-group input[type='time'] {
		background: #111827;
		border-color: #4b5563;
		color: #f9fafb;
	}

	:global(.dark) .closed-indicator {
		color: #6b7280;
	}

	/* Mobile responsive */
	@media (max-width: 640px) {
		.day-header {
			flex-direction: column;
			align-items: flex-start;
			gap: 0.5rem;
		}

		.time-inputs {
			flex-direction: column;
			gap: 0.5rem;
		}

		.separator {
			display: none;
		}
	}
</style>
