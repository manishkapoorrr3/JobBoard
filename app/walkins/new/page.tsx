'use client';
// Post a walk-in interview — recruiters only. Status starts as "pending".
import { useState } from 'react';
import { getSupabase } from '@/lib/supabase-client';
import { RequireRecruiter } from '@/lib/auth-guards';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2, ShieldCheck } from 'lucide-react';
import { JOB_CATEGORIES, JobCategory } from '@/lib/types';

function PostWalkinInner() {
  const supabase = getSupabase();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    company_name: '',
    role_title: '',
    category: '' as JobCategory | '',
    walkin_date: '',
    walkin_time: '',
    location_address: '',
    contact_person: '',
  });

  function set(key: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    for (const [k, v] of Object.entries(form)) {
      if (k !== 'contact_person' && !v.trim()) return toast.error('Please fill in all required fields.');
    }
    if (!form.category) return toast.error('Please choose a category.');

    setSaving(true);
    const { error } = await supabase.from('walkins').insert({
      company_name: form.company_name.trim(),
      role_title: form.role_title.trim(),
      category: form.category,
      walkin_date: form.walkin_date,
      walkin_time: form.walkin_time.trim(),
      location_address: form.location_address.trim(),
      contact_person: form.contact_person.trim() || null,
    });
    setSaving(false);
    if (error) return toast.error('Could not submit your walk-in. Please try again.');

    toast.success('Walk-in submitted! It will be reviewed before going live.');
    setForm({
      company_name: '',
      role_title: '',
      category: '',
      walkin_date: '',
      walkin_time: '',
      location_address: '',
      contact_person: '',
    });
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold text-slate-900">Post a walk-in interview</h1>

      <div className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
        <div className="space-y-1">
          <p>Walk-in interviews should be physical, in-person events in Delhi NCR only.</p>
          <p>Your listing will be reviewed before going live (usually within 24-48 hours).</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="company">Company name</Label>
            <Input id="company" value={form.company_name} onChange={(e) => set('company_name', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="role">Role title</Label>
            <Input id="role" value={form.role_title} onChange={(e) => set('role_title', e.target.value)} />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Category</Label>
            <Select value={form.category} onValueChange={(v) => set('category', v)}>
              <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
              <SelectContent>
                {JOB_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="contact">Contact person (optional)</Label>
            <Input id="contact" value={form.contact_person} onChange={(e) => set('contact_person', e.target.value)} placeholder="HR name" />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="date">Walk-in date</Label>
            <Input id="date" type="date" value={form.walkin_date} onChange={(e) => set('walkin_date', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="time">Walk-in time</Label>
            <Input id="time" value={form.walkin_time} onChange={(e) => set('walkin_time', e.target.value)} placeholder="e.g. 10:00 AM - 2:00 PM" />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="addr">Location address</Label>
          <Textarea id="addr" value={form.location_address} onChange={(e) => set('location_address', e.target.value)} rows={2} placeholder="Full venue address" />
        </div>

        <Button type="submit" disabled={saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Submit for review
        </Button>
      </form>
    </div>
  );
}

export default function PostWalkinPage() {
  return (
    <RequireRecruiter>
      <PostWalkinInner />
    </RequireRecruiter>
  );
}
