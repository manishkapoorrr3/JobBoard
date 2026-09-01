'use client';
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
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [accountType, setAccountType] = useState<AccountType>('job_seeker');
  const [submitting, setSubmitting] = useState(false);

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
    if (!fullName.trim()) return toast.error('Please enter your full name.');

    if (accountType === 'job_seeker') {
      if (!/^\d{10}$/.test(phone.replace(/\D/g, ''))) return toast.error('Please enter a valid 10-digit Indian mobile number.');
      if (password.length < 6) return toast.error('Password must be at least 6 characters.');
      if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return toast.error('Please enter a valid email address.');
    } else {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return toast.error('Please enter a valid email address.');
      if (password.length < 6) return toast.error('Password must be at least 6 characters.');
    }

    setSubmitting(true);
    const signupEmail = email.trim() || `${phone.replace(/\D/g, '')}@phone.ncrwalkin`;
    const { data, error } = await supabase.auth.signUp({
      email: signupEmail,
      password,
      options: { data: { full_name: fullName.trim(), account_type: accountType, phone: phone.replace(/\D/g, '') || undefined } },
    });
    if (error) {
      setSubmitting(false);
      toast.error(authMessage(error.message));
      return;
    }

    const userId = data.user?.id;
    if (userId) {
      const { error: profileErr } = await supabase.from('profiles').insert({
        user_id: userId,
        full_name: fullName.trim(),
        phone: phone.replace(/\D/g, '') || null,
        account_type: accountType,
        skills: [],
        domain_experience: [],
      });
      if (profileErr) console.warn('profile insert failed', profileErr);
    }

    toast.success('Account created!');
    router.push(accountType === 'recruiter' ? '/walkins/new' : '/walkins');
  }

  const isSeeker = accountType === 'job_seeker';

  return (
    <div className="mx-auto max-w-md">
      <h1 className="text-2xl font-bold text-slate-900">Create your account</h1>
      <p className="mt-1 text-sm text-slate-600">
        Already have an account?{' '}
        <Link href="/login" className="font-medium text-emerald-600 hover:underline">Log in</Link>
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="name">Full name</Label>
          <Input id="name" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your full name" autoComplete="name" />
        </div>

        <div className="space-y-1.5">
          <Label>I am a...</Label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setAccountType('job_seeker')}
              className={`rounded-lg border p-3 text-left transition-colors ${
                isSeeker ? 'border-emerald-600 bg-emerald-50 ring-1 ring-emerald-600' : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <span className="block text-sm font-semibold text-slate-900">Job Seeker</span>
              <span className="block text-xs text-slate-500">Find BPO walk-ins</span>
            </button>
            <button
              type="button"
              onClick={() => setAccountType('recruiter')}
              className={`rounded-lg border p-3 text-left transition-colors ${
                !isSeeker ? 'border-blue-600 bg-blue-50 ring-1 ring-blue-600' : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <span className="block text-sm font-semibold text-slate-900">Recruiter / HR</span>
              <span className="block text-xs text-slate-500">Post walk-ins (Rs 499)</span>
            </button>
          </div>
        </div>

        {isSeeker ? (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="phone">Phone number (10-digit) *</Label>
              <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="98XXXXXXXX" maxLength={10} inputMode="numeric" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email (optional)</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" />
              <p className="text-xs text-slate-500">If you skip email, we use your phone as login.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" autoComplete="new-password" />
            </div>
          </>
        ) : (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email *</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="hr@company.com" autoComplete="email" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password *</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" autoComplete="new-password" />
            </div>
          </>
        )}

        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Create account
        </Button>
      </form>

      <p className="mt-4 text-center text-xs text-slate-500">
        You can browse and apply on WhatsApp without an account. Sign up only to save jobs or post listings.
      </p>
    </div>
  );
}
