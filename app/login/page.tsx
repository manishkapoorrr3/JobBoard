'use client';
// Login page: email or phone sign-in, plus a "Forgot password?" flow.
// Phone accounts are stored as `${digits}@phone.ncrwalkin` (see signup), so phone
// login validates a 10-digit mobile and reconstructs that synthetic email.
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getSupabase } from '@/lib/supabase-client';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2, Mail, Phone } from 'lucide-react';

type Mode = 'email' | 'phone';
type View = 'login' | 'forgot';

export default function LoginPage() {
  const router = useRouter();
  const supabase = getSupabase();
  const { refreshProfile } = useAuth();
  const [view, setView] = useState<View>('login');
  const [mode, setMode] = useState<Mode>('email');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [resetEmail, setResetEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function authMessage(msg: string): string {
    const m = msg.toLowerCase();
    if (m.includes('invalid login') || m.includes('invalid credentials')) return 'Wrong credentials. Please try again.';
    if (m.includes('not confirmed')) return 'Please confirm your email first.';
    if (m.includes('rate limit')) return 'Too many attempts. Please wait a minute and try again.';
    return msg || 'Could not log in. Please try again.';
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    let signInEmail: string;
    if (mode === 'email') {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return toast.error('Please enter a valid email address.');
      signInEmail = email.trim();
    } else {
      const digits = phone.replace(/\D/g, '');
      if (!/^\d{10}$/.test(digits)) return toast.error('Please enter a valid 10-digit Indian mobile number.');
      signInEmail = `${digits}@phone.ncrwalkin`;
    }
    if (!password) return toast.error('Please enter your password.');

    setSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: signInEmail,
      password,
    });
    if (error) {
      setSubmitting(false);
      toast.error(authMessage(error.message));
      return;
    }

    await refreshProfile();
    toast.success('Logged in!');
    router.push('/');
  }

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(resetEmail.trim())) return toast.error('Please enter a valid email address.');

    setSubmitting(true);
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail.trim(), {
      redirectTo: `${origin}/login`,
    });
    setSubmitting(false);
    if (error) {
      toast.error(authMessage(error.message));
      return;
    }
    toast.success('If an account exists, a reset link has been sent to your email.');
    setView('login');
  }

  if (view === 'forgot') {
    return (
      <div className="mx-auto max-w-md">
        <h1 className="text-2xl font-bold text-slate-900">Reset your password</h1>
        <p className="mt-1 text-sm text-slate-600">
          Enter your account email and we&apos;ll send you a link to reset your password.
        </p>

        <form onSubmit={handleForgot} className="mt-6 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="resetEmail">Email</Label>
            <Input
              id="resetEmail"
              type="email"
              value={resetEmail}
              onChange={(e) => setResetEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
            />
          </div>
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Send reset link
          </Button>
        </form>

        <button
          type="button"
          onClick={() => setView('login')}
          className="mt-4 text-sm font-medium text-blue-600 hover:underline"
        >
          ← Back to log in
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md">
      <h1 className="text-2xl font-bold text-slate-900">Log in</h1>
      <p className="mt-1 text-sm text-slate-600">
        New here?{' '}
        <Link href="/signup" className="font-medium text-blue-600 hover:underline">Create an account</Link>
      </p>

      {/* Email / Phone toggle */}
      <div className="mt-6 grid grid-cols-2 gap-2 rounded-lg bg-slate-100 p-1">
        <button
          type="button"
          onClick={() => setMode('email')}
          className={`flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition ${
            mode === 'email' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <Mail className="h-4 w-4" />Email
        </button>
        <button
          type="button"
          onClick={() => setMode('phone')}
          className={`flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition ${
            mode === 'phone' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <Phone className="h-4 w-4" />Phone
        </button>
      </div>

      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        {mode === 'email' ? (
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
            />
          </div>
        ) : (
          <div className="space-y-1.5">
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="10-digit mobile"
              maxLength={10}
              autoComplete="tel"
            />
          </div>
        )}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <button
              type="button"
              onClick={() => setView('forgot')}
              className="text-xs font-medium text-blue-600 hover:underline"
            >
              Forgot password?
            </button>
          </div>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Your password"
            autoComplete="current-password"
          />
        </div>
        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Log in
        </Button>
      </form>
    </div>
  );
}
