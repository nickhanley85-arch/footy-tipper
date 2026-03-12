# Footy Tipper

Static AFL tipping app with generated round data.

## Run locally

Install Node.js 18 or newer, then run:

```bash
npm run build
npm run serve
```

Open `http://localhost:4173`.

## Project structure

- `index.html`: app entry point
- `app.js`: UI rendering and interactions
- `styles.css`: presentation
- `data/raw-matches.json`: editable raw round inputs
- `scripts/generate-tips.js`: builds derived tip output
- `data/matches.json`: generated app data
- `preview_smoke_test.js`: headless interaction smoke test

## Update the round data

1. Edit `data/raw-matches.json`.
2. Run `npm run build`.
3. Commit the updated files.

## Deploy to GitHub and Netlify

1. Create a GitHub repository and push this folder.
2. In Netlify, choose `Add new site` and import the GitHub repo.
3. Use these settings:

```text
Build command: npm run build
Publish directory: .
```

Netlify will regenerate `data/matches.json` during each deploy and host the app as a static site.

## Verify before deploy

Run:

```bash
npm run test:preview
```

This checks the main interactive flows in a headless browser.
