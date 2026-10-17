# 🌮 CartoTaco

An interactive map-based application for exploring taco establishments in Tucson, AZ. Discover local taco shops, food trucks, and stands with detailed information on menu items, salsas, spice levels, and specialty offerings.

![CartoTaco Logo](static/color_light_bg.png)

## 🚀 Features

- **Interactive Map with Clustering**: Visualize all taco establishments with automatic marker clustering
- **Search & Filter**: Find spots by name, protein type, establishment type, spice level, open status, and favorites
- **Mobile-First Responsive Design**: Bottom sheet cards, swipe gestures, and optimized layouts for all screen sizes
- **Detailed Information Cards**: Rich data visualizations including radar charts, spice gauges, and specialty carousels
- **User Authentication**: Email/password auth via Supabase with protected routes
- **Favorites System**: Save spots with a heart icon, filter by favorites, dedicated favorites page
- **Taco Trail Route Builder**: Plan multi-stop taco crawls with walking/cycling/driving directions via Mapbox Directions API
- **Spot Comparison Mode**: Compare up to 3 establishments side-by-side with shareable URLs at `/compare`
- **Taste Profile & Personalization**: k-NN based recommendations from your favorites, 13 taste archetypes
- **Taco Summit**: Shareable ranked-choice group vote — share a link, everyone ranks their picks, Borda count reveals the winner with a live rank-distribution chart at `/vote/[id]`
- **Surprise Me**: One-tap random spot selection that respects active filters
- **Onboarding Tour**: 11-step guided tour for first-time users
- **Dark Mode**: Light/dark/auto themes with time-based automatic switching
- **Directions Deep-Link**: Smart links to Apple Maps (iOS), Google Maps (Android), or Google Maps web
- **New Spots Badge**: Notification badge for recently added establishments
- **Map Lenses**: Switch the map between spots, heat, salsa count, and density views
- **Tucson Taco Census**: City-wide stats dashboard at `/census`
- **Vibe Votes**: Four one-tap votes per spot (Heat Legit, Authentic, Value, Vibe) instead of star ratings
- **Public Profiles**: Username, bio, and avatar at `/u/[username]`
- **Pending & Closed Spots**: Unvetted, web-scraped spots and permanently closed ones are shown but clearly marked
- **Community Location Submissions**: Geocoded submission form with moderation queue
- **Contact Information**: Direct links to phone, website, Instagram, and Facebook
- **Specialty Highlights**: Discover unique specialty items at each location
- **Salsa & Spice Analysis**: Compare salsa varieties and heat levels with context
- **Performance Optimized**: 60-70% faster load times with single-query database view

## 🔧 Tech Stack

- **Frontend**: [SvelteKit](https://kit.svelte.dev/) v2 with [Vite](https://vitejs.dev/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/) with CSS-variable design tokens and [Phosphor](https://phosphoricons.com/) icons
- **Backend**: [Supabase](https://supabase.com/) for database, authentication, and SSR (`@supabase/ssr`)
- **Mapping**: [Mapbox GL](https://docs.mapbox.com/mapbox-gl-js/api/) with geocoding and directions
- **Data Visualization**: [ECharts](https://echarts.apache.org/)
- **Testing**: [Vitest](https://vitest.dev/)
- **Deployment**: [Vercel](https://vercel.com/) with adapter-vercel; GitHub Actions for CI and database migrations

## 📋 Prerequisites

Before you begin, ensure you have:

- [Node.js](https://nodejs.org/) 24 (see `.nvmrc`)
- [pnpm](https://pnpm.io/) package manager
- A Supabase account for backend services
- A Mapbox account for map rendering

## 🔑 Environment Variables

Copy `.env.example` to `.env` and fill in:

```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_MAPBOX_KEY=your_mapbox_api_key
```

## 🏗️ Installation

1. Clone the repository
   ```bash
   git clone <repository-url>
   cd cartoTaco
   ```

2. Install dependencies
   ```bash
   pnpm install
   ```

3. Start the development server
   ```bash
   pnpm dev
   ```

4. Open your browser and navigate to `http://localhost:5175`

## 🧪 Development Commands

- `pnpm dev` - Start development server
- `pnpm build` - Build for production
- `pnpm preview` - Preview production build
- `pnpm check` - Run Svelte type checking
- `pnpm check:watch` - Run type checking in watch mode
- `pnpm test` - Run unit tests (vitest)
- `pnpm test:watch` - Run tests in watch mode

## 📚 Documentation

- **[CLAUDE.md](CLAUDE.md)** - Architecture reference: stores, components, routes, mapping, migrations
- **[Deployment](docs/DEPLOYMENT.md)** - Branch flow, CI/CD, migrations, secrets, rollback
- **[Improvements Roadmap](docs/IMPROVEMENTS.md)** - Shipped and planned features
- **[User Submissions](docs/USER_SUBMISSIONS.md)** - Submission design and approval process
- **[Unvetted Spots](docs/UNVETTED_SPOTS_PLAN.md)** - Pending-spot design (scraping pipeline lives in `cartoTacoMenuExtract`)

## 📁 Project Structure

```
src/
├── components/          # Svelte components (Card, FilterBar, charts, trays, ...)
├── lib/                 # Stores, Mapbox rendering, Supabase clients, utilities, unit tests
├── routes/              # SvelteKit routes
│   ├── +page.svelte     # Main map page
│   ├── census/          # City-wide stats dashboard
│   ├── compare/         # Spot comparison (shareable via ?ids=)
│   ├── vote/            # Taco Summit creation and voting
│   ├── u/[username]/    # Public profiles
│   ├── (auth)/          # Login, signup, email confirmation
│   └── (protected)/     # Favorites, profile, submit (requires auth)
├── app.css              # Global styles and design tokens
docs/                    # Feature documentation
supabase/migrations/     # Database migrations, applied by CI
schema/                  # Canonical sites_complete view definition
```

[CLAUDE.md](CLAUDE.md) has the file-by-file breakdown.

## 🗃️ Database Setup

The application uses Supabase with the following main tables:

- `sites` - Basic information about taco establishments
- `descriptions` - Short and long descriptions for each location
- `menu` - Menu item data and ratings
- `hours` - Operating hours information
- `salsa` - Salsa varieties and heat levels
- `protein` - Protein options and ratings
- `item_spec`, `protein_spec`, `salsa_spec` - Specialty item information
- `sites_complete` - Optimized view joining all site-related tables
- `profiles`, `user_favorites`, `vibe_votes`, `location_submissions` - User data, protected by row-level security
- `group_sessions`, `group_votes` - Taco Summit sessions and ballots

### Running Migrations

Migrations are applied by CI: merge to `staging` to apply them there, then `staging` → `main` to ship. Never run SQL in the Supabase editor by hand — CI then believes the migration never ran.

- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) — the full branch/deploy/migration workflow
- [supabase/migrations/README.md](supabase/migrations/README.md) — writing a migration
- [CLAUDE.md](CLAUDE.md) — what each migration does

For a brand-new database, point `supabase db push --db-url` at it once to run them all in order.

## 🌟 Roadmap

See [docs/IMPROVEMENTS.md](docs/IMPROVEMENTS.md) for what has shipped and what's planned. Next up: geo-fenced check-ins and aficionado tiers.

## 🤝 Contributing

Branch off `staging`, open a PR into `staging`, and verify on the staging deploy; `staging` → `main` ships it. CI runs `pnpm check`, `pnpm test`, and `pnpm build` on every PR. See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).
