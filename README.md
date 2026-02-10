# 🌮 CartoTaco

An interactive map-based application for exploring taco establishments in Tucson, AZ. Discover local taco shops, food trucks, and stands with detailed information on menu items, salsas, spice levels, and specialty offerings.

![CartoTaco Logo](/static/color_light_bg.png)

## 🚀 Features

- **Interactive Map with Clustering**: Visualize all taco establishments with automatic marker clustering
- **Search & Filter**: Find spots by name, protein type, spice level, open status, and more
- **Detailed Information Cards**: Explore each location's offerings with rich data visualizations
- **Enhanced Charts**: Interactive radar charts with tooltips explaining menu distributions
- **Contact Information**: Direct links to phone, website, Instagram, and Facebook
- **Specialty Highlights**: Discover unique specialty items at each location
- **Salsa & Spice Analysis**: Compare salsa varieties and heat levels with context
- **Performance Optimized**: 60-70% faster load times with single-query database view

## 🔧 Tech Stack

- **Frontend**: [SvelteKit](https://kit.svelte.dev/) with [Vite](https://vitejs.dev/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Backend**: [Supabase](https://supabase.com/) for database and authentication
- **Mapping**: [Mapbox GL](https://docs.mapbox.com/mapbox-gl-js/api/)
- **Data Visualization**: [Chart.js](https://www.chartjs.org/) and [ECharts](https://echarts.apache.org/)

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

4. Open your browser and navigate to `http://localhost:5173`

## 🧪 Development Commands

- `pnpm dev` - Start development server
- `pnpm build` - Build for production
- `pnpm preview` - Preview production build
- `pnpm check` - Run type checking

## 📚 Documentation

Detailed documentation for all features:

- **[Improvements Roadmap](docs/IMPROVEMENTS.md)** - Planned features and enhancements
- **[Query Optimization](docs/QUERY_OPTIMIZATION.md)** - Database view implementation
- **[Search & Filter](docs/SEARCH_FILTER.md)** - Filter system documentation
- **[Marker Clustering](docs/MARKER_CLUSTERING.md)** - Clustering implementation
- **[Visualization Improvements](docs/VISUALIZATION_IMPROVEMENTS.md)** - Chart and UI enhancements

## 📚 Project Structure

```
src/
├── components/      # Reusable UI components
│   ├── Card.svelte  # Popup card for establishment details
│   ├── FilterBar.svelte  # Search and filter UI
│   ├── ContactInfo.svelte  # Contact information display
│   ├── RadarChart.svelte  # Chart for menu and protein data
│   └── ...
├── lib/             # Utilities, stores, and data handling
│   ├── dataWrangling.js  # Data transformation utilities
│   ├── mapping.js   # Map rendering with clustering
│   ├── stores.js    # Svelte stores for state management
│   └── supabase.js  # Supabase client configuration
├── routes/          # SvelteKit routes and pages
│   ├── +page.svelte # Main page
│   ├── Map.svelte   # Map component
│   └── ...
├── app.css         # Global styles
docs/                # Feature documentation
migrations/          # Database migrations
```

## 🗃️ Database Setup

The application uses Supabase with the following main tables:

- `sites` - Basic information about taco establishments (includes contact fields)
- `descriptions` - Short and long descriptions for each location
- `menu` - Menu item data and ratings
- `hours` - Operating hours information
- `salsa` - Salsa varieties and heat levels
- `protein` - Protein options and ratings
- `summaries` - Aggregated statistics across establishments
- `item_spec`, `protein_spec`, `salsa_spec` - Specialty item information
- `sites_complete` - Optimized view joining all site-related tables

### Running Migrations

After setting up your Supabase project, run the migrations in order:

1. `migrations/002_add_contact_and_social_fields.sql` - Adds contact/social fields
2. `migrations/001_create_sites_view.sql` - Creates optimized view

See [migrations/README.md](migrations/README.md) for detailed instructions.

## 🌟 Roadmap

See [docs/IMPROVEMENTS.md](docs/IMPROVEMENTS.md) for the complete feature roadmap.

**Next Up:**
- Mobile responsive overhaul
- User authentication for saving favorite locations
- Ratings and review system
- Taco trail route builder

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
