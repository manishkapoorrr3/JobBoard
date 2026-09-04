'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Footprints, LogOut, Menu } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

export function Header() {
  const { user, profile, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    router.push('/');
  };

  const isRecruiter = profile?.account_type === 'recruiter';

  const links: { href: string; label: string }[] = [
    { href: '/walkins', label: 'Walk-ins' },
    { href: '/jobs', label: 'Jobs' },
  ];
  if (isRecruiter) {
    links.push({ href: '/walkins/new', label: 'Post walk-in Rs 100' });
    links.push({ href: '/dashboard', label: 'My Listings' });
  }
  if (user && !isRecruiter) {
    links.push({ href: '/profile/saved', label: 'Saved' });
  }

  const navLink = (href: string, label: string) => (
    <Link
      key={href}
      href={href}
      onClick={() => setMobileOpen(false)}
      className={cn(
        'text-sm font-medium transition-colors hover:text-slate-900',
        pathname === href || pathname.startsWith(href + '/')
          ? 'text-slate-900'
          : 'text-slate-500'
      )}
    >
      {label}
    </Link>
  );

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2 font-bold text-slate-900">
          <Footprints className="h-5 w-5 text-emerald-600" />
          <span className="hidden sm:inline">NCR Walk-in</span>
          <span className="sm:hidden">NCR</span>
        </Link>

        <nav className="hidden items-center gap-5 md:flex">
          {links.map((l) => navLink(l.href, l.label))}
          {user ? (
            <>
              <Link href="/profile/edit" className="text-sm font-medium text-slate-500 hover:text-slate-900">
                Profile
              </Link>
              <Button variant="ghost" size="sm" onClick={handleSignOut} className="text-slate-500">
                <LogOut className="mr-1.5 h-4 w-4" />
                Logout
              </Button>
            </>
          ) : (
            <>
              <Link href="/login" className="text-sm font-medium text-slate-500 hover:text-slate-900">
                Login
              </Link>
              <Link href="/signup">
                <Button size="sm">Sign up</Button>
              </Link>
            </>
          )}
        </nav>

        <button className="md:hidden" onClick={() => setMobileOpen((o) => !o)} aria-label="Toggle menu">
          <Menu className="h-6 w-6 text-slate-700" />
        </button>
      </div>

      {mobileOpen && (
        <nav className="flex flex-col gap-3 border-b border-slate-200 bg-white px-4 py-3 md:hidden">
          {links.map((l) => navLink(l.href, l.label))}
          {user ? (
            <>
              <Link href="/profile/edit" onClick={() => setMobileOpen(false)} className="text-sm font-medium text-slate-500 hover:text-slate-900">
                Profile
              </Link>
              <Button variant="ghost" size="sm" onClick={handleSignOut} className="justify-start px-0 text-slate-500">
                <LogOut className="mr-1.5 h-4 w-4" />
                Logout
              </Button>
            </>
          ) : (
            <>
              <Link href="/login" onClick={() => setMobileOpen(false)} className="text-sm font-medium text-slate-500 hover:text-slate-900">
                Login
              </Link>
              <Link href="/signup" onClick={() => setMobileOpen(false)}>
                <Button size="sm" className="w-full">Sign up</Button>
              </Link>
            </>
          )}
        </nav>
      )}
    </header>
  );
}
