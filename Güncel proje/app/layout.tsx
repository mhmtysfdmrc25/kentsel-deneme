import type { Metadata } from 'next';
import './globals.css';
import { ProjectProvider } from '@/components/project-context';
export const metadata: Metadata = { title: 'Kentsel | Fizibilite', description: 'Kentsel dönüşüm fizibilite ve teklif çalışma alanı' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="tr"><body><ProjectProvider>{children}</ProjectProvider></body></html>;
}
