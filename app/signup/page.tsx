'use client';
// Signup page: full name, email, password, account type.
// On success, creates a profile row and redirects by account type.
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getSupabase } from '@/lib/supabase-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { AccountType } from '@/lib/types';
import { Loader2 } from 'lucide-react';

export default function SignupPage() {
  const router = useRouter();
  const supabase = getSupabase();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [accountType, setAccountType] = useState<AccountType>('job_seeker');
  const [submitting, setSubmitting] = useState(false);

  // Translate Supabase auth errors into plain messages.
  function authMessage(msg: string): string {
    const m = msg.toLowerCase();
    if (m.includes('already') || m.includes('already registered')) return 'An account with this email already exists.';
    if (m.includes('password')) return 'Password must be at least 6 characters.';
    if (m.includes('invalid email') || m.includes('email')) return 'Please enter a valid email address.';
    if (m.includes('rate limit')) return 'Too many attempts. Please wait a minute and try again.';
    return msg || 'Could not create your account. Please try again.';
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // Basic client-side validation.
    if (!fullName.trim()) return toast.error('Please enter your full name.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return toast.error('Please enter a valid email address.');
    if (password.length < 6) return toast.error('Password must be at least 6 characters.');

    setSubmitting(true);
    // 1. Create the auth account. We pass account_type + full_name in user_metadata
    //    so they're available immediately, then also write a profiles row.
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { full_name: fullName.trim(), account_type: accountType } },
    });
    if (error) {
      setSubmitting(false);
      toast.error(authMessage(error.message));
      return;
    }

    // 2. Create the profile row (linked to the new auth user).
    const userId = data.user?.id;
    if (userId) {
      const { error: profileErr } = await supabase.from('profiles').insert({
        user_id: userId,
        full_name: fullName.trim(),
        account_type: accountType,
        skills: [],
        domain_experience: [],
      });
      if (profileErr) {
        // Non-fatal: the user can still edit their profile later.
        console.warn('profile insert failed', profileErr);
      }
    }

    toast.success('Account created!');
    // 3. Redirect by account type.
    router.push(accountType === 'recruiter' ? '/jobs/new' : '/profile/edit');
  }

  return (
    <div className="mx-auto max-w-md">
      <h1 className="text-2xl font-bold text-slate-900">Create your account</h1>
      <p className="mt-1 text-sm text-slate-600">
        Already have an account?{' '}
        <Link href="/login" className="font-medium text-blue-600 hover:underline">Log in</Link>
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="name">Full name</Label>
          <Input id="name" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your full name" autoComplete="name" />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" autoComplete="new-password" />
        </div>

        <div className="space-y-1.5">
          <Label>I am a...</Label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setAccountType('job_seeker')}
              className={`rounded-lg border p-3 text-left transition-colors ${
                accountType === 'job_seeker'
                  ? 'border-blue-600 bg-blue-50 ring-1 ring-blue-600'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <span className="block text-sm font-semibold text-slate-900">Job Seeker</span>
              <span className="block text-xs text-slate-500">Find jobs & walk-ins</span>
            </button>
            <button
              type="button"
              onClick={() => setAccountType('recruiter')}
              className={`rounded-lg border p-3 text-left transition-colors ${
                accountType === 'recruiter'
                  ? 'border-emerald-600 bg-emerald-50 ring-1 ring-emerald-600'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <span className="block text-sm font-semibold text-slate-900">Recruiter / HR</span>
              <span className="block text-xs text-slate-500">Post jobs & walk-ins</span>
            </button>
          </div>
        </div>

        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Create account
        </Button>
      </form>
    </div>
  );
}
