import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: 'e2e',
  webServer: { command: 'npm run preview -- --port 4173', port: 4173, reuseExistingServer: true },
  use: { baseURL: 'http://localhost:4173' },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }, { name: 'webkit', use: { browserName: 'webkit' } }],
})
