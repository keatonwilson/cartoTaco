<script>
	import { fly, fade } from 'svelte/transition';
	import { toasts, dismissToast } from '$lib/toastStore';
	import CheckCircle from 'phosphor-svelte/lib/CheckCircle';
	import WarningCircle from 'phosphor-svelte/lib/WarningCircle';
	import Info from 'phosphor-svelte/lib/Info';
	import X from 'phosphor-svelte/lib/X';
</script>

<div class="toast-host" aria-live="polite" aria-atomic="false">
	{#each $toasts as t (t.id)}
		<div
			class="toast toast-{t.kind}"
			role="status"
			in:fly={{ y: 12, duration: 180 }}
			out:fade={{ duration: 140 }}
		>
			{#if t.kind === 'success'}
				<CheckCircle size={18} weight="fill" />
			{:else if t.kind === 'error'}
				<WarningCircle size={18} weight="fill" />
			{:else}
				<Info size={18} weight="fill" />
			{/if}
			<span class="message">{t.message}</span>
			<button
				class="close"
				on:click={() => dismissToast(t.id)}
				aria-label="Dismiss"
			>
				<X size={14} />
			</button>
		</div>
	{/each}
</div>

<style>
	.toast-host {
		position: fixed;
		bottom: 1rem;
		left: 50%;
		transform: translateX(-50%);
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		z-index: 10000;
		pointer-events: none;
		max-width: calc(100vw - 2rem);
	}

	.toast {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.625rem 0.875rem;
		border-radius: 0.5rem;
		background: white;
		color: #111827;
		font-size: 0.875rem;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
		border: 1px solid #e5e7eb;
		pointer-events: auto;
		max-width: 420px;
	}

	:global(.dark) .toast {
		background: #1f2937;
		color: #f3f4f6;
		border-color: #374151;
		box-shadow: 0 4px 14px rgba(0, 0, 0, 0.4);
	}

	.toast-success { border-color: #10b981; color: #065f46; }
	.toast-error   { border-color: #ef4444; color: #991b1b; }
	.toast-info    { border-color: #FE795D; color: #9a3412; }

	:global(.dark) .toast-success { color: #6ee7b7; }
	:global(.dark) .toast-error   { color: #fca5a5; }
	:global(.dark) .toast-info    { color: #FFB199; }

	.message {
		flex: 1;
		line-height: 1.35;
	}

	.close {
		background: transparent;
		border: none;
		color: inherit;
		cursor: pointer;
		opacity: 0.6;
		display: flex;
		align-items: center;
		padding: 2px;
	}

	.close:hover { opacity: 1; }
</style>
