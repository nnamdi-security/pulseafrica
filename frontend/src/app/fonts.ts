import { Fraunces, Inter, Space_Mono } from 'next/font/google';

/* The three typefaces of DESIGN_SYSTEM.md, self-hosted at build time. Each sets a CSS
   variable that the theme's font-serif / font-sans / font-mono use. */
export const fraunces = Fraunces({ subsets: ['latin'], axes: ['opsz'], variable: '--font-fraunces', display: 'swap' });
export const inter = Inter({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-inter', display: 'swap' });
export const spaceMono = Space_Mono({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-space-mono',
  display: 'swap',
});
