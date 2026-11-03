import type { Metadata } from 'next';
import '../src/styles.css';

export const metadata: Metadata = {
  title: 'VELOCITY Motor Co. — For the love of the drive.',
  description: 'Discover remarkable cars, compare your favourites and arrange your next drive with VELOCITY Motor Co.',
  icons: { icon: '/favicon.svg', shortcut: '/favicon.svg' },
};

const themeBeforePaint = `(function(){var theme='light';try{theme=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}catch(e){}try{var saved=localStorage.getItem('velocity.theme.v1');if(saved==='light'||saved==='dark')theme=saved;}catch(e){}document.documentElement.dataset.theme=theme;document.documentElement.style.colorScheme=theme;})();`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{ __html: themeBeforePaint }}/></head><body>{children}</body></html>;
}
