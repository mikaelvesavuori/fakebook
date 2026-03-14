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

### Create local config

```bash
cp config.example.json config.json
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
- `llama3.2:3b`: very capable small model

Install one or more:

```bash
ollama pull qwen2.5:1.5b
ollama pull smollm2:3b
ollama pull llama3.2:3b
```

Set `ollamaModel` to that tag in your local `config.json`.

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

Create a local `config.json` from [config.example.json](/Users/mikaelvesavuori/Web/fakebook/config.example.json), then edit `config.json`.

All current user-editable keys:

- `platformName` (string): app name shown in header and browser title.
- `platformIcon` (string): icon/emoji shown next to app name.
- `profileImageMaxBytesKb` (number, default `280`, allowed `64-2048`): max compressed profile image size in KB.
- `postImageMaxBytesKb` (number, default `1024`, allowed `128-4096`): max compressed size per post image in KB.
- `postImagesTotalMaxBytesKb` (number, default `10240`, allowed `512-51200`): max total compressed image size for all images in a single post in KB.
- `aiLanguage` (string): target language instruction used in prompts (for example `sv` or `en`).
- `ollamaBaseUrl` (string): Ollama server URL (for example `http://127.0.0.1:11434`).
- `ollamaModel` (string): Ollama model tag to use (for example `llama3.2:3b`).
- `ollamaTemperature` (number, default `0.75`, allowed `0-2`): generation creativity.
- `ollamaTopP` (number, default `0.95`, allowed `0-1`): nucleus sampling.
- `ollamaNumPredict` (number, default `220`, allowed `16-512`): max generated tokens.
- `ollamaRepeatPenalty` (number, default `1.05`, allowed `1-1.5`): repetition control.
- `ollamaKeepAlive` (string, default `10m`): Ollama model keep-alive setting.
- `aiPostMaxChars` (number, default `260`, allowed `60-1200`): max post length requested from AI.
- `aiCommentMaxChars` (number, default `180`, allowed `40-600`): max comment length requested from AI.
- `aiUserPrompt` (string or string[]): base system/persona prompt.
- `aiPostPromptTemplate` (string or string[]): template used when AI users generate posts.
- `aiCommentPromptTemplate` (string or string[]): template used when AI users generate comments.

Prompt placeholders:

- `{{botName}}`
- `{{personality}}`
- `{{language}}`
- `{{authorName}}`
- `{{postText}}`
- `{{maxChars}}`
- `{{recentSection}}`

If you pass prompts as arrays, lines are joined with newlines internally.

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
