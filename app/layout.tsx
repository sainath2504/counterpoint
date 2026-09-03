import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  metadataBase: new URL(
    'https://counterpoint-decision-lab.polite-heron-9888.chatgpt.site',
  ),
  title: 'Counterpoint — Decision studio',
  description:
    'Challenge the recommendation. Inspect evidence, test assumptions, and replay decisions in an auditable AI decision lab.',
  openGraph: {
    title: 'Counterpoint — Decision studio',
    description:
      'Good decisions survive a little opposition. Inspect evidence, test assumptions, and keep the proof.',
    images: [
      {
        url: '/og.png',
        width: 1731,
        height: 909,
        alt: 'Counterpoint — evidence, trade-offs, decisions',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Counterpoint — Decision studio',
    description: 'Good decisions survive a little opposition.',
    images: ['/og.png'],
  },
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
