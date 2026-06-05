# Guide screenshots

This folder holds annotated screenshots referenced from `content/guides/*.mdx`.

Files are generated automatically by `npm run guide:screenshots` (Playwright). Do not edit them by hand — they will be overwritten on the next capture.

To regenerate:

```bash
# one-time install of browser binaries
npx playwright install chromium

# capture all shots against staging.hrhandle.com
npm run guide:screenshots
```

See `scripts/screenshot-config.ts` to add or change individual shots.
