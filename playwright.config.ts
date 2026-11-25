// Test end-to-end nel browser: si lanciano dopo la build con `npm run e2e`.
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  timeout: 240_000,
  retries: 0,
  reporter: process.env.CI ? [['list'], ['github']] : 'list',
  use: {
    baseURL: 'http://localhost:4180/sdrogopoli/',
    trace: 'off',
    // le prove leggono i testi in italiano; quella in inglese (lingua.spec.ts) cambia lingua da sé
    locale: 'it-IT',
  },
  webServer: {
    command: 'npx vite preview --port 4180 --strictPort',
    url: 'http://localhost:4180/sdrogopoli/',
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    { name: 'computer', use: { ...devices['Desktop Chrome'] }, testIgnore: /telefono/ },
    { name: 'telefono', use: { ...devices['Pixel 7'] }, testMatch: /telefono/ },
  ],
});
