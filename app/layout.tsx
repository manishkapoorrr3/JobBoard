import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { AuthProvider } from '@/lib/auth-context';
import { Header } from '@/components/header';
import { Footer } from '@/components/footer';
import { Toaster } from '@/components/ui/sonner';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'BPO Walk-in Noida, Gurgaon, Greater Noida Today | NCR Walk-in',
  description:
    "Today's BPO walk-in interviews in Delhi NCR. Voice and non-voice process, night shift, cab, 10th/12th/grad. Apply on WhatsApp.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AuthProvider>
          <div className="min-h-screen bg-slate-50 text-slate-900">
            <Header />
            <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
            <Footer />
          </div>
          <Toaster richColors position="top-center" />
        </AuthProvider>
      </body>
    </html>
  );
}
