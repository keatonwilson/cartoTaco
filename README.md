# 🌮 CartoTaco

An interactive map-based application for exploring taco establishments in Tucson, AZ. Discover local taco shops, food trucks, and stands with detailed information on menu items, salsas, spice levels, and specialty offerings.

![CartoTaco Logo](/static/color_light_bg.png)

## 🚀 Features

- **Interactive Map with Clustering**: Visualize all taco establishments with automatic marker clustering
- **Search & Filter**: Find spots by name, protein type, establishment type, spice level, open status, and favorites
- **Mobile-First Responsive Design**: Bottom sheet cards, swipe gestures, and optimized layouts for all screen sizes
- **Detailed Information Cards**: Rich data visualizations including radar charts, spice gauges, and specialty carousels
- **User Authentication**: Email/password auth via Supabase with protected routes
- **Favorites System**: Save spots with a heart icon, filter by favorites, dedicated favorites page
- **Taco Trail Route Builder**: Plan multi-stop taco crawls with walking/driving directions via Mapbox Directions API
- **Spot Comparison Mode**: Compare up to 3 establishments side-by-side with shareable URLs at `/compare`
- **Taste Profile & Personalization**: k-NN based recommendations from your favorites, 13 taste archetypes
- **Onboarding Tour**: 7-step guided tour for first-time users
- **Dark Mode**: Light/dark/auto themes with time-based automatic switching
- **Directions Deep-Link**: Smart links to Apple Maps (iOS), Google Maps (Android), or Google Maps web
- **New Spots Badge**: Notification badge for recently added establishments
- **Community Location Submissions**: Geocoded submission form with moderation queue
- **Contact Information**: Direct links to phone, website, Instagram, and Facebook
- **Specialty Highlights**: Discover unique specialty items at each location
- **Salsa & Spice Analysis**: Compare salsa varieties and heat levels with context
- **Performance Optimized**: 60-70% faster load times with single-query database view

## 🔧 Tech Stack

- **Frontend**: [SvelteKit](https://kit.svelte.dev/) v2 with [Vite](https://vitejs.dev/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/) with [Flowbite Svelte](https://flowbite-svelte.com/) UI components
- **Backend**: [Supabase](https://supabase.com/) for database, authentication, and SSR (`@supabase/ssr`)
- **Mapping**: [Mapbox GL](https://docs.mapbox.com/mapbox-gl-js/api/) with geocoding and directions
- **Data Visualization**: [ECharts](https://echarts.apache.org/), [Chart.js](https://www.chartjs.org/), and [svg-gauge](https://github.com/nicollash/svg-gauge)
- **Testing**: [Vitest](https://vitest.dev/)
- **Deployment**: [Vercel](https://vercel.com/) with adapter-vercel

## 📋 Prerequisites

Before you begin, ensure you have:

- [Node.js](https://nodejs.org/) (v16 or newer)
- [pnpm](https://pnpm.io/) package manager
- A Supabase account for backend services
- A Mapbox account for map rendering

## 🔑 Environment Variables

Create a `.env` file in the root directory with the following variables:

```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_MAPBOX_KEY=your_mapbox_api_key
```

## 🏗️ Installation

1. Clone the repository
   ```bash
   git clone https://github.com/keatonwilson/cartoTaco.git
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

Detailed documentation for all features:

- **[Improvements Roadmap](docs/IMPROVEMENTS.md)** - Planned features and enhancements
- **[Query Optimization](docs/QUERY_OPTIMIZATION.md)** - Database view implementation
- **[Search & Filter](docs/SEARCH_FILTER.md)** - Filter system documentation
- **[Marker Clustering](docs/MARKER_CLUSTERING.md)** - Clustering implementation
- **[Visualization Improvements](docs/VISUALIZATION_IMPROVEMENTS.md)** - Chart and UI enhancements
- **[User Submissions](docs/USER_SUBMISSIONS.md)** - Location submission feature design

## 📁 Project Structure

```
src/
├── components/              # UI components
│   ├── Card.svelte          # Popup/bottom-sheet card for establishment details
│   ├── ComparisonTray.svelte # Floating tray for spot comparison selection
│   ├── FilterBar.svelte     # Search and filter controls
│   ├── TasteProfile.svelte  # Personal taste profile visualization
│   ├── TourOverlay.svelte   # Onboarding tour overlay
│   ├── TrailTray.svelte     # Taco trail route builder interface
│   ├── RadarChart.svelte    # Menu/protein distribution chart (ECharts)
│   ├── SpiceGauge.svelte    # Heat level gauge (svg-gauge)
│   ├── NewSpotsBadge.svelte # Recently added spots notification
│   ├── DirectionsButton.svelte # Native maps deep-link
│   ├── FavoriteButton.svelte   # Heart toggle for favorites
│   ├── Header.svelte        # App header with auth, theme, navigation
│   ├── ThemeToggle.svelte   # Dark/light/auto mode toggle
│   └── ...                  # ContactInfo, HoursOpen, SpecCarousel, etc.
├── lib/                     # Stores, utilities, and data handling
│   ├── stores.js            # Core data stores (tacoStore, processedTacoData, filteredTacoData)
│   ├── authStore.js         # Authentication state
│   ├── favoritesStore.js    # Favorites state
│   ├── trailStore.js        # Trail builder state
│   ├── comparisonStore.js   # Spot comparison state
│   ├── tasteProfileStore.js # k-NN taste profile derivation
│   ├── tourStore.js         # Onboarding tour state
│   ├── uiStore.js           # UI state (filter panel, mobile nav)
│   ├── newSpotsStore.js     # New spots notification state
│   ├── mapping.js           # Mapbox GL rendering with clustering
│   ├── mapStore.js          # Mapbox map instance holder
│   ├── dataWrangling.js     # Data transformation utilities
│   ├── supabase.js          # Supabase server client
│   ├── supabaseBrowser.js   # Supabase browser client (SSR cookie support)
│   └── ...                  # geocoding, validation, theme, deviceDetection
├── routes/                  # SvelteKit routes
│   ├── +page.svelte         # Main map page
│   ├── Map.svelte           # Map component
│   ├── compare/             # Spot comparison page (shareable via ?ids=)
│   ├── (auth)/              # Login, signup, email confirmation
│   └── (protected)/         # Favorites, profile, submit (requires auth)
├── app.css                  # Global styles
docs/                        # Feature documentation
migrations/                  # Database migrations (001-020)
schema/                      # Canonical view definitions
```

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

### Running Migrations

After setting up your Supabase project, run the 20 migrations in order. See [CLAUDE.md](CLAUDE.md) for the full migration list and [migrations/README.md](migrations/README.md) for detailed instructions.

## 🌟 Roadmap

See [docs/IMPROVEMENTS.md](docs/IMPROVEMENTS.md) for the complete feature roadmap.

**Completed:**
- ✅ Query optimization (60-70% faster load times)
- ✅ Search and filter system
- ✅ Marker clustering
- ✅ Mobile-first responsive design
- ✅ User authentication & favorites
- ✅ Community location submissions
- ✅ Dark mode with auto switching
- ✅ Taco trail route builder
- ✅ Spot comparison mode
- ✅ Taste profile & personalization
- ✅ Onboarding tour
- ✅ Directions deep-link
- ✅ New spots badge
- ✅ Vercel deployment

**Next Up:**
- "Surprise Me" random spot picker
- Taco Tuesday Tracker
- Tucson Taco Census stats page
- Community ratings & reviews
- PWA support
- Accessibility audit

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 📬 Contact

[Keaton Wilson](keatonwilson@me.com)

Project Link: [https://github.com/keatonwilson/cartoTaco](https://github.com/keatonwilson/cartoTaco)
