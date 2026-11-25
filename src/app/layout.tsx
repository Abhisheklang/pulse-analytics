import { FlagValues as FlagValuesScript } from 'flags/react';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { headers } from 'next/headers';
import { connection } from 'next/server';
import { Suspense } from 'react';
import { getConfig } from '@/lib/config';
import { getFlagValues } from '@/lib/flags';
import { getBaseUrl } from '@/lib/get-base-url';
import { Providers } from './Providers';
import '@pulselytics/react-zen/styles.full.css';
import './global.css';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

export default async function ({ children }) {
  if (process.env.DISABLE_UI) {
    return (
      <html>
        <body></body>
      </html>
    );
  }

  // Force request-time rendering so config reflects runtime env, not build-time env.
  await connection();

  const config = getConfig();
  const flags = await getFlagValues();

  return (
    <html lang="en" className={`${inter.className} ${inter.variable}`}>
      <head>
        <link rel="icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
        <link rel="manifest" href="/site.webmanifest" crossOrigin="use-credentials" />
        <link rel="mask-icon" href="/safari-pinned-tab.svg" color="#4f46e5" />
        <meta name="msapplication-TileColor" content="#4f46e5" />
        <meta name="theme-color" content="#fafafa" media="(prefers-color-scheme: light)" />
        <meta name="theme-color" content="#2f2f2f" media="(prefers-color-scheme: dark)" />
        <meta name="robots" content="noindex,nofollow" />
        {/* Apply the saved Pulse colour preset and animation preference
            before first paint (no flash of the wrong theme or motion). */}
        <script>
          {`(function(){try{var v=localStorage.getItem('pulse.color-theme');if(v){var t=JSON.parse(v);if(typeof t==='string'&&t){document.documentElement.setAttribute('data-pulse-theme',t);}}var a=localStorage.getItem('pulse.animations');var off=false;if(a){off=JSON.parse(a)==='off';}else if(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches){off=true;}document.documentElement.setAttribute('data-pulse-motion',off?'off':'on');}catch(e){}})();`}
        </script>
      </head>
      <body>
        <Suspense>
          <Providers config={config} flags={flags}>
            {children}
          </Providers>
        </Suspense>
        <FlagValuesScript values={flags} />
      </body>
    </html>
  );
}

export async function generateMetadata(): Promise<Metadata> {
  const headerStore = await headers();

  return {
    metadataBase: getBaseUrl(headerStore),
    title: {
      template: '%s | Pulse',
      default: 'Pulse',
    },
    description: 'Pulse Analytics — Know your traffic. Guard their privacy.',
  };
}
