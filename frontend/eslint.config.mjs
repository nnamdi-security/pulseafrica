import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // Stated, not detected: eslint-plugin-react's detection doesn't run on ESLint 10
    settings: { react: { version: '19.3' } },
  },
  {
    // Colours come from the theme in src/styles/globals.css, never from raw values in components
    // (DESIGN_SYSTEM.md). The theme file itself is CSS, so this never fires there.
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/**/*.test.{ts,tsx}', 'src/lib/api/schema.d.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'Literal[value=/#[0-9a-fA-F]{3,8}\\b/]',
          message: 'Use a theme colour (bg-navy, text-gold, …) instead of a raw hex value.',
        },
        {
          selector: 'TemplateElement[value.raw=/#[0-9a-fA-F]{3,8}\\b/]',
          message: 'Use a theme colour (bg-navy, text-gold, …) instead of a raw hex value.',
        },
        {
          selector: 'Literal[value=/rgba?\\(/]',
          message: 'Use a theme colour with an opacity (text-parchment/65) instead of rgb().',
        },
      ],
    },
  },
  globalIgnores(['.next/**', 'out/**', 'next-env.d.ts', 'coverage/**']),
]);
