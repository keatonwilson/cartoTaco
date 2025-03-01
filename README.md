# 🌮 CartoTaco

An interactive map-based application for exploring taco establishments in Tucson, AZ. Discover local taco shops, food trucks, and stands with detailed information on menu items, salsas, spice levels, and specialty offerings.

![CartoTaco Logo](/static/color_light_bg.png)

## 🚀 Features

- **Interactive Map**: Visualize all taco establishments in the Tucson area
- **Detailed Information Cards**: Explore each location's offerings in detail
- **Data Visualization**: View radar charts for menu items and proteins
- **Specialty Highlights**: Discover unique specialty items at each location
- **Salsa & Spice Analysis**: Compare salsa varieties and heat levels
- **Hours & Type Information**: Filter by establishment type and hours

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

## 📚 Project Structure

```
src/
├── components/      # Reusable UI components
│   ├── Card.svelte  # Popup card for establishment details
│   ├── RadarChart.svelte  # Chart for menu and protein data
│   └── ...
├── lib/             # Utilities, stores, and data handling
│   ├── dataWrangling.js  # Data transformation utilities
│   ├── mapping.js   # Map rendering functionality
│   ├── stores.js    # Svelte stores for state management
│   └── supabase.js  # Supabase client configuration
├── routes/          # SvelteKit routes and pages
│   ├── +page.svelte # Main page
│   ├── Map.svelte   # Map component
│   └── ...
└── app.css         # Global styles
```

## 🗃️ Database Schema

The application uses Supabase with the following main tables:

- `sites` - Basic information about taco establishments
- `descriptions` - Short and long descriptions for each location
- `menu` - Menu item data and ratings
- `hours` - Operating hours information
- `salsa` - Salsa varieties and heat levels
- `protein` - Protein options and ratings
- `summaries` - Aggregated statistics across establishments
- `item_spec`, `protein_spec`, `salsa_spec` - Specialty item information

## 🌟 Features in Development

- User authentication for saving favorite locations
- Filtering and search functionality
- Ratings and review system
- Mobile optimization
- Offline capability
- Additional data visualizations

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
