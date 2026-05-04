<script>
	import { goto } from '$app/navigation';
	import Flame from 'phosphor-svelte/lib/Flame';
	import SealCheck from 'phosphor-svelte/lib/SealCheck';
	import HandCoins from 'phosphor-svelte/lib/HandCoins';
	import Sparkle from 'phosphor-svelte/lib/Sparkle';
	import { isAuthenticated } from '$lib/authStore';
	import {
		userVibeVoteKeys,
		vibeCountsByEst,
		loadVibeCounts,
		toggleVibeVote
	} from '$lib/vibeVotesStore';

	export let estId;
	export let compact = false;

	const DIMENSIONS = [
		{ key: 'heat_legit', icon: Flame,     label: 'Heat Legit', tooltip: 'The spice level is for real' },
		{ key: 'authentic',  icon: SealCheck, label: 'Authentic',  tooltip: 'Tastes traditional / legit' },
		{ key: 'value',      icon: HandCoins, label: 'Value',      tooltip: 'Worth what you pay' },
		{ key: 'vibe',       icon: Sparkle,   label: 'Vibe',       tooltip: 'Great atmosphere & feel' }
	];

	let toggling = new Set();

	$: if (estId != null) loadVibeCounts(estId);
	$: counts = $vibeCountsByEst.get(estId) || { heat_legit: 0, authentic: 0, value: 0, vibe: 0 };

	function isActive(dim) {
		return $userVibeVoteKeys.has(`${estId}:${dim}`);
	}

	async function handleClick(dim) {
		if (!$isAuthenticated) {
			goto('/login?redirect=/');
			return;
		}
		if (toggling.has(dim)) return;
		toggling = new Set(toggling).add(dim);
		try {
			await toggleVibeVote(estId, dim);
		} finally {
			toggling = new Set([...toggling].filter(d => d !== dim));
		}
	}
</script>

<div class="vibe-votes" class:compact data-tour="vibe">
	{#each DIMENSIONS as { key, icon: Icon, label, tooltip } (key)}
		{@const active = isActive(key)}
		{@const count = counts[key] || 0}
		<button
			type="button"
			class="vibe-chip"
			class:active
			disabled={toggling.has(key)}
			on:click={() => handleClick(key)}
			title={$isAuthenticated
				? `${label} — ${tooltip}${active ? ' (tap to remove your vote)' : ''}`
				: `${label} — ${tooltip} (sign in to vote)`}
			aria-label={`${label}: ${tooltip}. ${count} vote${count === 1 ? '' : 's'}.${active ? ' You voted.' : ''}`}
			aria-pressed={active}
		>
			<Icon size={compact ? 14 : 16} weight={active ? 'fill' : 'regular'} class="vibe-icon" />
			<span class="label">{label}</span>
			<span class="count">{count}</span>
		</button>
	{/each}
</div>

<style>
	.vibe-votes {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		padding: 4px 0;
	}

	.vibe-chip {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		padding: 4px 9px;
		border: 1px solid #e5e7eb;
		border-radius: 999px;
		background: #f9fafb;
		color: #374151;
		font-size: 12px;
		font-weight: 500;
		cursor: pointer;
		transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
		-webkit-tap-highlight-color: transparent;
		user-select: none;
	}

	.vibe-chip :global(.vibe-icon) {
		flex-shrink: 0;
		color: currentColor;
	}

	.vibe-chip .count {
		font-variant-numeric: tabular-nums;
		font-weight: 600;
		color: #6b7280;
		min-width: 14px;
		text-align: right;
	}

	.vibe-chip.active {
		background: rgba(254, 121, 93, 0.12);
		color: #FE795D;
		border-color: #FE795D;
	}

	.vibe-chip.active .count {
		color: #FE795D;
	}

	@media (hover: hover) {
		.vibe-chip:hover:not(:disabled):not(.active) {
			border-color: #FE795D;
			color: #FE795D;
		}
	}

	.vibe-chip:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	:global(.dark) .vibe-chip {
		background: #374151;
		border-color: #4b5563;
		color: #d1d5db;
	}

	:global(.dark) .vibe-chip .count {
		color: #9ca3af;
	}

	:global(.dark) .vibe-chip.active {
		background: rgba(254, 121, 93, 0.18);
		color: #FE795D;
		border-color: #FE795D;
	}

	:global(.dark) .vibe-chip.active .count {
		color: #FE795D;
	}

	/* Compact: hide label text on tight desktop strips, keep icon + count */
	.vibe-votes.compact .vibe-chip {
		padding: 3px 7px;
		font-size: 11px;
	}

	.vibe-votes.compact .label {
		display: none;
	}

	/* Mobile: keep labels visible — they're how users learn what each chip means.
	   Tighten padding so all four still fit comfortably. */
	@media (max-width: 480px) {
		.vibe-chip {
			padding: 4px 8px;
			font-size: 11px;
			gap: 4px;
		}
	}
</style>
