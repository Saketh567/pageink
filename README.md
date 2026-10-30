# PageInk

An iPad-first web app (PWA) for marking up real web pages with Apple Pencil. Import a page, then ink, highlight and annotate it directly, instead of screenshotting and drawing on the screenshot. Everything is stored on the device and works offline.

**Version 1.0.0** includes: installable app, pressure-sensitive pen, highlighter, eraser, undo/redo, local autosave, import from a web address or a saved file, and a library you can organise with collections, tags, pins, search and sorting, in four themes with your choice of accent colour. Anchored highlights and notes, export and sharing are next; see [PLAN.md](PLAN.md).

## Run it

```
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests
npm run e2e        # browser tests (run `npx playwright install chromium webkit` once)
npm run build
```

Add `?debug=1` to the URL for an on-screen Pencil event log and a console.

## Deploy

Push to GitHub and import the repo in Vercel (framework: Vite, no settings needed). Every push to `main` deploys to production and every other branch gets a preview URL you can open on the iPad. Then use Share > Add to Home Screen.

## Docs

- [PLAN.md](PLAN.md): full build plan and roadmap
- [docs/PHASE-3.md](docs/PHASE-3.md): Phase 3 spec (living marks: anchored highlights, notes, margin lane, spotlight, study sheet)
- [docs/DECISIONS.md](docs/DECISIONS.md): key technical decisions
- [docs/IPAD-CHECKLIST.md](docs/IPAD-CHECKLIST.md): what to test on the iPad
