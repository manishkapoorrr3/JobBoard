'use client';
// Redirects to a given path once the auth state is known.
// While loading, shows a spinner so we don't flash protected content.
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import { useEffect, ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

export function LoadingGate({ children }: { children: ReactNode }) {
  const { loading } = useAuth();
  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }
  return <>{children}</>;
}

// Wrap a page that requires login. If not logged in, redirect to /login.
export function RequireAuth({ children }: { children: ReactNode }) {
  const { loading, user } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [loading, user, router]);
  if (loading || !user) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }
  return <>{children}</>;
}

// Wrap a page that requires a recruiter account. Job seekers are sent to /jobs.
export function RequireRecruiter({ children }: { children: ReactNode }) {
  const { loading, user, profile } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (!loading && !user) router.replace('/login');
    else if (!loading && user && profile && profile.account_type !== 'recruiter') {
      router.replace('/jobs');
    }
  }, [loading, user, profile, router]);

  if (loading || !user || !profile || profile.account_type !== 'recruiter') {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }
  return <>{children}</>;
}
