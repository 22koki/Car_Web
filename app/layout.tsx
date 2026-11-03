import type { Metadata } from 'next';
import '../src/styles.css';

export const metadata: Metadata = {
  title: 'VELOCITY Motor Co. — For the love of the drive.',
  description: 'Discover remarkable cars, compare your favourites and arrange your next drive with VELOCITY Motor Co.',
  icons: { icon: '/favicon.svg', shortcut: '/favicon.svg' },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
