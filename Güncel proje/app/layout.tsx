import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'Kentsel | Fizibilite', description: 'Kentsel dönüşüm fizibilite ve teklif çalışma alanı' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="tr"><body>{children}</body></html>;
}
