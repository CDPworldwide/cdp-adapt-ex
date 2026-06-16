# Frontend

It is built with **Angular 20**, **Tailwind CSS**, and **Angular Material**.

## 🚀 Getting Started

### 1. Prerequisites
- **Node.js**: v20+ (v24 verified)
- **npm**: v10+
- **API Client**: This frontend depends on a local API client located in the `../client` directory. Ensure the client is built before starting the frontend.

### 2. Setup
1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Configure Environment**:
   Copy the example environment file and update it with your local backend URL:
   ```bash
   cp src/environments/environment-example.ts src/environments/environment.development.ts
   cp .env.example .env
   ```
   **CRITICAL**: Open `src/environments/environment.development.ts` and set the `baseUrl` to match your running backend.
   - If running via `uv run fastapi dev`, the default is usually `http://localhost:8000`.
   - Set `aiServerUrl` to your AI server domain. Ask CDP AI calls this service directly, so chat and follow-up requests do not go through the backend `baseUrl`.
   - If the AI server has `AI_SERVER_API_KEY` configured, set `aiServerApiKey` locally or `AI_SERVER_API_KEY`/`FRONTEND_AI_SERVER_API_KEY` in `.env`/CI.
   - If your backend has `API_KEY` configured, also set `apiKey` and `apiKeyHeaderName` so frontend requests include the required header.
   - Optional analytics and error reporting are disabled by default. Set PostHog and Sentry values in `.env` or the environment files when you need local telemetry.

### 3. Build the API Client (CRITICAL)
If you haven't built the client yet, or if the backend API has changed:
```bash
cd ../client
npm install
npm run build
cd ../frontend
```

## 🛠 Development

### Start Development Server
```bash
npm start
```
Navigate to `http://localhost:4200/`. The app will automatically reload if you change any of the source files.

### Code Scaffolding
Run `ng generate component component-name` to generate a new component.

## 🏗 Architecture

The application follows a modular architecture based on Angular best practices, divided into three main layers:

```text
src/app/
├── core/               # Singleton services and universal components
│   ├── footer/         # Global footer component
│   └── header/         # Global header component
├── features/           # Main application features
│   ├── ask-cdp-ai/     # AI Chat
│   ├── city-detail/    # Location details
│   ├── hazard-map/     # Map view with hazard layers
│   ├── main-search/    # Search landing page
│   └── maps/           # Global map views
└── shared/             # Reusable UI components, pipes, and services
    ├── components/     # UI widgets (buttons, modals, etc.)
    ├── icons/          # Custom SVG icon components
    └── services/       # Shared business logic and API wrappers
```

### 1. Core Layer (`src/app/core/`)
Contains singleton services and components that are instantiated once per application lifecycle.
- **Components**: `HeaderComponent`, `FooterComponent`.
- **Services**: AI interaction services.

### 2. Feature Layer (`src/app/features/`)
Each directory here represents a specific functional area of the application.
- `ask-cdp-ai/`: The AI chat for querying city data and hazard information.
- `main-search/`: The primary search landing page, integrating location suggestions and map selection.
- `city-detail/` & `location-card/`: Detailed views and summary cards for specific cities or locations.
- `maps/` & `hazard-map/`: Map-based visualizations for global location data and specific environmental hazards.

### 3. Shared Layer (`src/app/shared/`)
Contains reusable components, directives, and services used across multiple features.
- **Components**: UI building blocks like buttons, spinners, and modals.
- **Icons**: Custom SVG icons managed as standalone Angular components in `src/app/shared/icons/`.
- **Services**: Shared utilities like `LocationService`, `LanguageService`, and `GoogleMapsLoaderService`.

### API Integration
The frontend consumes an auto-generated TypeScript client located in the `client/` directory (at the project root).
- **Package**: `@pac-api/client` (imported as a local dependency in `package.json`).
- **Usage**: The frontend uses this client to interact with the FastAPI backend.
- **CRITICAL**: Do not manually edit files in the `client/` directory. Use the `client/scripts/generate.sh` script to update it when the backend schema changes.

## 🧪 Testing
- **Unit Tests**: `npm test` (interactive) or `npm run test:ci` (headless).
- **Style Check**: We use Prettier for formatting. Ensure your code is formatted before committing.

## 🎨 Styling & UI
- **Tailwind CSS**: We use Tailwind utility classes for almost all styling. Avoid custom CSS in `.css` files unless absolutely necessary.
- **Design Tokens**: Follow the custom tokens defined in `tailwind.config.js`.
  - **Colors**: Use the numeric scale for neutrals (e.g., `text-cdp-neutral-08`).
- **Icons**: Custom SVG icons are located in `src/app/shared/icons/`. Use them as Angular components (e.g., `<app-info-icon>`).

## 🌐 Internationalization (i18n)
We use `@ngx-translate/core`.
- **Do not** hardcode text in templates.
- Add new strings to `src/assets/i18n/en.json`.
- Use the `translate` pipe: `{{ 'key.name' | translate }}`.
