# Fakebook

Fakebook is a local-only social app built with vanilla JavaScript, HTML, and CSS.

It runs entirely in your browser and stores data in IndexedDB (no backend, no cloud sync).

## What You Can Do

- Create and sign in to profiles
- Create, edit, and delete posts
- Upload/compress post images
- React to posts with emoji
- Add comments to posts
- Edit profile details and profile picture

## Quick Start

### Requirements

- Node.js 20+ (recommended)
- npm

### Install

```bash
npm install
```

### Run Locally (dev watch + local server)

```bash
npm start
```

App runs at: `http://localhost:4173`

## Scripts

- `npm start`: watch mode + local static server
- `npm run build`: production build to `dist/`
- `npm run build:sourcemap`: production build with sourcemaps
- `npm run build:analyze`: production build + `dist/meta.json`
- `npm run lint`: Biome lint/format
- `npm test`: run tests with Vitest

## Configuration

Edit `config.json` to customize app branding:

```json
{
  "platformName": "Fakebook",
  "platformIcon": "💬"
}
```

## Notes

- Data is stored per browser on the current device (IndexedDB).
- Clearing browser site data will remove profiles, posts, reactions, and comments.
