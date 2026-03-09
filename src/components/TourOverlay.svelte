<script>
	import { tick } from 'svelte';
	import { browser } from '$app/environment';
	import { isMobile } from '$lib/deviceDetection.js';
	import {
		tourActive,
		tourStep,
		TOUR_STEPS,
		nextStep,
		prevStep,
		endTour
	} from '$lib/tourStore.js';

	let spotlightStyle = '';
	let tooltipStyle = '';
	let arrowClass = '';
	let isModal = false;

	// Recalculate position when step changes
	$: if ($tourActive && browser) {
		positionTooltip($tourStep);
	}

	async function positionTooltip(stepIndex) {
		await tick();
		const step = TOUR_STEPS[stepIndex];

		if (!step || !step.target) {
			// Centered modal for steps without a target
			isModal = true;
			spotlightStyle = 'display: none;';
			tooltipStyle = 'position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);';
			arrowClass = '';
			return;
		}

		isModal = false;
		const el = document.querySelector(step.target);
		if (!el) {
			// Fallback to modal if target not found
			isModal = true;
			spotlightStyle = 'display: none;';
			tooltipStyle = 'position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);';
			arrowClass = '';
			return;
		}

		const rect = el.getBoundingClientRect();
		const pad = 8;

		// Spotlight position
		spotlightStyle = `
			top: ${rect.top - pad}px;
			left: ${rect.left - pad}px;
			width: ${rect.width + pad * 2}px;
			height: ${rect.height + pad * 2}px;
		`;

		// Determine tooltip position
		const tooltipWidth = $isMobile ? 280 : 320;
		const tooltipHeight = 180;
		const vw = window.innerWidth;
		const vh = window.innerHeight;

		// Prefer bottom, then top, then right, then left
		const spaceBelow = vh - rect.bottom;
		const spaceAbove = rect.top;

		let top, left;

		if (!$isMobile && spaceBelow > tooltipHeight + 20) {
			// Place below
			top = rect.bottom + pad + 12;
			left = Math.max(12, Math.min(rect.left + rect.width / 2 - tooltipWidth / 2, vw - tooltipWidth - 12));
			arrowClass = 'arrow-top';
		} else if (!$isMobile && spaceAbove > tooltipHeight + 20) {
			// Place above
			top = rect.top - pad - tooltipHeight - 12;
			left = Math.max(12, Math.min(rect.left + rect.width / 2 - tooltipWidth / 2, vw - tooltipWidth - 12));
			arrowClass = 'arrow-bottom';
		} else if ($isMobile) {
			// Mobile: center horizontally, place below or above
			if (spaceBelow > tooltipHeight + 20) {
				top = rect.bottom + pad + 12;
				arrowClass = 'arrow-top';
			} else {
				top = rect.top - pad - tooltipHeight - 12;
				arrowClass = 'arrow-bottom';
			}
			left = Math.max(12, (vw - tooltipWidth) / 2);
		} else {
			// Fallback: below
			top = rect.bottom + pad + 12;
			left = Math.max(12, Math.min(rect.left + rect.width / 2 - tooltipWidth / 2, vw - tooltipWidth - 12));
			arrowClass = 'arrow-top';
		}

		tooltipStyle = `position: fixed; top: ${top}px; left: ${left}px; width: ${tooltipWidth}px;`;
	}

	function handleResize() {
		if ($tourActive) {
			positionTooltip($tourStep);
		}
	}

	function handleKeydown(e) {
		if (!$tourActive) return;
		if (e.key === 'Escape') {
			endTour();
		} else if (e.key === 'ArrowRight') {
			nextStep();
		} else if (e.key === 'ArrowLeft') {
			prevStep();
		}
	}

	function handleOverlayClick(e) {
		// Only close if clicking the overlay background itself
		if (e.target === e.currentTarget) {
			endTour();
		}
	}
</script>

<svelte:window on:resize={handleResize} on:keydown={handleKeydown} />

{#if $tourActive}
	<div class="tour-overlay" on:click={handleOverlayClick}>
		<!-- Spotlight cutout -->
		{#if !isModal}
			<div class="tour-spotlight" style={spotlightStyle}></div>
		{/if}

		<!-- Tooltip / Modal -->
		<div class="tour-tooltip {arrowClass}" class:tour-modal={isModal} style={tooltipStyle}>
			<h3 class="tour-title">{TOUR_STEPS[$tourStep].title}</h3>
			<p class="tour-description">{TOUR_STEPS[$tourStep].description}</p>

			<div class="tour-footer">
				<span class="tour-counter">{$tourStep + 1} / {TOUR_STEPS.length}</span>
				<div class="tour-buttons">
					{#if $tourStep > 0}
						<button class="tour-btn tour-btn-back" on:click={prevStep}>Back</button>
					{/if}
					<button class="tour-btn tour-btn-skip" on:click={endTour}>Skip</button>
					<button class="tour-btn tour-btn-next" on:click={nextStep}>
						{$tourStep === TOUR_STEPS.length - 1 ? "Let's Go!" : 'Next'}
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}

<style>
	.tour-overlay {
		position: fixed;
		inset: 0;
		z-index: 20000;
		background: rgba(0, 0, 0, 0.5);
	}

	.tour-spotlight {
		position: fixed;
		border-radius: 8px;
		box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.5);
		z-index: 20001;
		pointer-events: none;
		transition: all 0.3s ease;
	}

	.tour-tooltip {
		position: fixed;
		background: white;
		border: 2px solid #FE795D;
		border-radius: 8px;
		padding: 1.25rem;
		z-index: 20002;
		box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
		max-width: 320px;
		animation: tourFadeIn 0.25s ease-out;
	}

	:global(.dark) .tour-tooltip {
		background: #1f2937;
		border-color: #FE795D;
		box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
	}

	.tour-modal {
		max-width: 380px;
		text-align: center;
	}

	@keyframes tourFadeIn {
		from {
			opacity: 0;
			transform: translateY(8px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	/* CSS arrows */
	.tour-tooltip.arrow-top::before {
		content: '';
		position: absolute;
		top: -10px;
		left: 50%;
		transform: translateX(-50%);
		border-left: 10px solid transparent;
		border-right: 10px solid transparent;
		border-bottom: 10px solid #FE795D;
	}
	.tour-tooltip.arrow-top::after {
		content: '';
		position: absolute;
		top: -7px;
		left: 50%;
		transform: translateX(-50%);
		border-left: 8px solid transparent;
		border-right: 8px solid transparent;
		border-bottom: 8px solid white;
	}
	:global(.dark) .tour-tooltip.arrow-top::after {
		border-bottom-color: #1f2937;
	}

	.tour-tooltip.arrow-bottom::before {
		content: '';
		position: absolute;
		bottom: -10px;
		left: 50%;
		transform: translateX(-50%);
		border-left: 10px solid transparent;
		border-right: 10px solid transparent;
		border-top: 10px solid #FE795D;
	}
	.tour-tooltip.arrow-bottom::after {
		content: '';
		position: absolute;
		bottom: -7px;
		left: 50%;
		transform: translateX(-50%);
		border-left: 8px solid transparent;
		border-right: 8px solid transparent;
		border-top: 8px solid white;
	}
	:global(.dark) .tour-tooltip.arrow-bottom::after {
		border-top-color: #1f2937;
	}

	.tour-title {
		margin: 0 0 0.5rem 0;
		font-size: 1.1rem;
		font-weight: 700;
		color: #FE795D;
	}

	.tour-description {
		margin: 0 0 1rem 0;
		font-size: 0.875rem;
		line-height: 1.5;
		color: #374151;
	}

	:global(.dark) .tour-description {
		color: #d1d5db;
	}

	.tour-footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.tour-counter {
		font-size: 0.75rem;
		color: #9ca3af;
		font-weight: 500;
	}

	.tour-buttons {
		display: flex;
		gap: 0.5rem;
	}

	.tour-btn {
		padding: 0.375rem 0.75rem;
		border-radius: 6px;
		font-size: 0.8rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s;
		border: none;
	}

	.tour-btn-back {
		background: #f3f4f6;
		color: #374151;
	}

	:global(.dark) .tour-btn-back {
		background: #374151;
		color: #d1d5db;
	}

	.tour-btn-back:hover {
		background: #e5e7eb;
	}

	:global(.dark) .tour-btn-back:hover {
		background: #4b5563;
	}

	.tour-btn-skip {
		background: transparent;
		color: #9ca3af;
	}

	.tour-btn-skip:hover {
		color: #6b7280;
	}

	.tour-btn-next {
		background: #FE795D;
		color: white;
	}

	.tour-btn-next:hover {
		background: #EF562F;
	}
</style>
