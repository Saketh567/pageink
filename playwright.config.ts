import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: 'e2e',
  // in CI, failures become annotations on the run (readable without logging in) as well as the normal list
  reporter: process.env.CI ? [['list'], ['github']] : 'list',
  webServer: { command: 'npm run preview -- --port 4173', port: 4173, reuseExistingServer: true },
  use: { baseURL: 'http://localhost:4173', serviceWorkers: 'block' },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }, { name: 'webkit', use: { browserName: 'webkit' } }],
})
