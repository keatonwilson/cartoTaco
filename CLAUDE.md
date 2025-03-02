# CLAUDE.md - Development Guide

## Commands
- `pnpm dev` - Start development server
- `pnpm build` - Build for production
- `pnpm preview` - Preview production build
- `pnpm check` - Run svelte-check type checking
- `pnpm check:watch` - Run type checking in watch mode

## Tech Stack
- SvelteKit + Vite
- Tailwind CSS
- Supabase (backend)
- Mapbox GL (mapping)
- Chart.js/ECharts (data visualization)

## Code Style
- **Imports**: Use $lib alias for src/lib directory
- **Components**: PascalCase (Card.svelte, RadarChart.svelte)
- **Variables/Functions**: camelCase
- **TypeScript**: JS with TypeScript checking (not strict)
- **Stores**: Use Svelte stores for shared state
- **Error Handling**: Try/catch with console.error
- **Structure**:
  - src/components: Reusable UI components
  - src/lib: Utilities, stores, and data handling
  - src/routes: Pages and routing
  - static: Assets and images