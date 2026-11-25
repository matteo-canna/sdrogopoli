import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Percorso base per GitHub Pages (https://matteo-canna.github.io/sdrogopoli/)
  base: '/sdrogopoli/',
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
