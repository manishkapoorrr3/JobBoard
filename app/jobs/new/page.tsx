'use client';
// Post a job — recruiters only. Status starts as "pending" (admin approves).
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
import { JOB_CATEGORIES, JobCategory, LOCATION_TYPES, LocationType } from '@/lib/types';

function PostJobInner() {
  const supabase = getSupabase();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    company_name: '',
    role_title: '',
    category: '' as JobCategory | '',
    location: '',
    location_type: '' as LocationType | '',
    city_name: '',
    salary_range: '',
    experience_required: '',
    job_description: '',
    contact_email_or_phone: '',
  });

  function set(key: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // Validate required fields.
    for (const [k, v] of Object.entries(form)) {
      if (!v.trim()) return toast.error('Please fill in all fields.');
    }
    if (!form.category) return toast.error('Please choose a category.');
    if (!form.location_type) return toast.error('Please choose a location type.');
    if (form.location_type === 'Other City' && !form.city_name.trim())
      return toast.error('Please enter the city name for "Other City".');

    setSaving(true);
    // status defaults to "pending" in the database; we do not send it.
    const { error } = await supabase.from('jobs').insert({
      company_name: form.company_name.trim(),
      role_title: form.role_title.trim(),
      category: form.category,
      location: form.location.trim(),
      location_type: form.location_type,
      city_name: form.location_type === 'Other City' ? form.city_name.trim() : null,
      salary_range: form.salary_range.trim(),
      experience_required: form.experience_required.trim(),
      job_description: form.job_description.trim(),
      contact_email_or_phone: form.contact_email_or_phone.trim(),
    });
    setSaving(false);
    if (error) return toast.error('Could not submit your listing. Please try again.');

    toast.success('Job submitted! It will be reviewed before going live.');
    setForm({
      company_name: '',
      role_title: '',
      category: '',
      location: '',
      location_type: '',
      city_name: '',
      salary_range: '',
      experience_required: '',
      job_description: '',
      contact_email_or_phone: '',
    });
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold text-slate-900">Post a job</h1>

      {/* Admin-approval note */}
      <div className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
        <p>Your listing will be reviewed before going live (usually within 24-48 hours).</p>
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
                {JOB_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="loc">Location / area</Label>
            <Input id="loc" value={form.location} onChange={(e) => set('location', e.target.value)} placeholder="e.g. Noida Sector 62" />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Location type</Label>
            <Select value={form.location_type} onValueChange={(v) => set('location_type', v)}>
              <SelectTrigger><SelectValue placeholder="Select location type" /></SelectTrigger>
              <SelectContent>
                {LOCATION_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="city">City name {form.location_type === 'Other City' ? '(required)' : '(if Other City)'}</Label>
            <Input
              id="city"
              value={form.city_name}
              onChange={(e) => set('city_name', e.target.value)}
              placeholder="e.g. Mumbai"
              disabled={form.location_type !== 'Other City'}
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="salary">Salary range</Label>
            <Input id="salary" value={form.salary_range} onChange={(e) => set('salary_range', e.target.value)} placeholder="e.g. ₹18,000 - ₹25,000" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="exp">Experience required</Label>
            <Input id="exp" value={form.experience_required} onChange={(e) => set('experience_required', e.target.value)} placeholder="e.g. 0-2 years" />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="desc">Job description</Label>
          <Textarea id="desc" value={form.job_description} onChange={(e) => set('job_description', e.target.value)} rows={5} placeholder="Roles, responsibilities, requirements..." />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="contact">Contact email or phone</Label>
          <Input id="contact" value={form.contact_email_or_phone} onChange={(e) => set('contact_email_or_phone', e.target.value)} placeholder="hr@company.com or +91 ..." />
        </div>

        <Button type="submit" disabled={saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Submit for review
        </Button>
      </form>
    </div>
  );
}

export default function PostJobPage() {
  return (
    <RequireRecruiter>
      <PostJobInner />
    </RequireRecruiter>
  );
}
