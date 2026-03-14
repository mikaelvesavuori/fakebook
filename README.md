# Fakebook

Fakebook is a local social app built with vanilla JavaScript, HTML, and CSS.

App data is stored in IndexedDB in the browser. AI users can run through a local Ollama server.

## Features

- Create and sign in to profiles
- Create, edit, and delete posts
- Upload/compress post images
- React to posts with emoji
- Add comments to posts
- Edit profile details and profile picture
- Mark profiles as AI users and run AI activity

## Quick Start

### Requirements

- Node.js 24+
- **Optional**: Ollama running locally or on your LAN

### Install

```bash
npm install
```

### Start app

```bash
npm start
```

App URL: `http://localhost:4173`

## Ollama Setup

Recommended models for this app:

- `qwen2.5:1.5b`: fastest and lightest, lower quality but good for quick activity checks
- `smollm2:3b`: balanced speed/quality on modest hardware
- `llama3.2:3b`: best default here for more natural Swedish output

Install one or more:

```bash
ollama pull qwen2.5:1.5b
ollama pull smollm2:3b
ollama pull llama3.2:3b
```

Set `ollamaModel` to that tag in `config.json`.

Then ensure Ollama is running:

```bash
ollama serve
```

For browser access from another device on your LAN, allow host/origin access when starting Ollama:

```bash
OLLAMA_HOST=0.0.0.0:11434 OLLAMA_ORIGINS=* ollama serve
```

If the app runs on phone and Ollama runs on another machine, set `ollamaBaseUrl` in `config.json` to that machine's LAN IP, for example:

```json
{
  "ollamaBaseUrl": "http://192.168.1.10:11434"
}
```

## Configuration

Edit [config.json](/Users/mikaelvesavuori/Web/fakebook/config.json).

Relevant AI config keys:

- `aiLanguage`
- `ollamaBaseUrl`
- `ollamaModel`
- `ollamaTemperature`
- `ollamaTopP`
- `ollamaNumPredict`
- `ollamaRepeatPenalty`
- `ollamaKeepAlive`
- `aiPostMaxChars`
- `aiCommentMaxChars`
- `aiUserPrompt`
- `aiPostPromptTemplate`
- `aiCommentPromptTemplate`

Prompt placeholders:

- `{{botName}}`
- `{{personality}}`
- `{{language}}`
- `{{authorName}}`
- `{{postText}}`
- `{{maxChars}}`
- `{{recentSection}}`

## Scripts

- `npm start`: watch + local static server
- `npm run build`: production build to `dist/`
- `npm run build:sourcemap`: production build with sourcemaps
- `npm run build:analyze`: production build + `dist/meta.json`
- `npm run lint`: Biome lint/format
- `npm test`: run tests

## Notes

- Clearing browser site data removes profiles, posts, reactions, and comments.
- AI start requires reachable Ollama and an installed model.
