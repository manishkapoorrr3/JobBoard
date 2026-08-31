'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabase } from '@/lib/supabase-client';
import { RequireRecruiter } from '@/lib/auth-guards';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { JOB_CATEGORIES, JobCategory, LOCATION_TYPES, LocationType, NCR_CITIES, EDUCATION_OPTIONS, SHIFT_OPTIONS, LANGUAGE_OPTIONS } from '@/lib/types';

function PostJobInner() {
  const supabase = getSupabase();
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    company_name: '',
    role_title: '',
    category: '' as JobCategory | '',
    location: '',
    location_type: '' as LocationType | '',
    city_name: '',
    city: '',
    area: '',
    salary_range: '',
    salary_min: '',
    salary_max: '',
    experience_required: '',
    job_description: '',
    contact_email_or_phone: '',
    education: '',
    shift: '',
    cab: false,
    languages: '',
    whatsapp_number: '',
    hr_phone: '',
    openings: '',
  });

  function set(key: keyof typeof form, value: string | boolean) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.company_name.trim()) return toast.error('Company name is required.');
    if (!form.role_title.trim()) return toast.error('Role title is required.');
    if (!form.category) return toast.error('Please choose a category.');
    if (!form.location_type) return toast.error('Please choose a location type.');
    if (form.location_type === 'Other City' && !form.city_name.trim()) return toast.error('Please enter the city name.');
    if (!form.salary_range.trim()) return toast.error('Salary range is required.');
    if (!form.experience_required.trim()) return toast.error('Experience required is required.');
    if (!form.job_description.trim()) return toast.error('Job description is required.');
    if (!form.contact_email_or_phone.trim()) return toast.error('Contact email or phone is required.');

    setSaving(true);
    const { error } = await supabase.from('jobs').insert({
      company_name: form.company_name.trim(),
      role_title: form.role_title.trim(),
      category: form.category,
      location: form.location.trim() || form.area.trim(),
      location_type: form.location_type,
      city_name: form.location_type === 'Other City' ? form.city_name.trim() : null,
      city: form.location_type === 'Delhi NCR' ? form.city || null : (form.location_type === 'Remote' ? 'Remote' : null),
      area: form.area.trim() || null,
      salary_range: form.salary_range.trim(),
      salary_min: parseInt(form.salary_min) || null,
      salary_max: parseInt(form.salary_max) || null,
      experience_required: form.experience_required.trim(),
      job_description: form.job_description.trim(),
      contact_email_or_phone: form.contact_email_or_phone.trim(),
      education: form.education || null,
      shift: form.shift || null,
      cab: form.cab,
      languages: form.languages || null,
      whatsapp_number: form.whatsapp_number.replace(/\D/g, '') || null,
      hr_phone: form.hr_phone.replace(/\D/g, '') || null,
      openings: parseInt(form.openings) || null,
      status: 'live',
    });
    setSaving(false);
    if (error) return toast.error('Could not submit your listing. Please try again.');

    toast.success('Job posted! It is now live.');
    router.push('/jobs');
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold text-slate-900">Post a job</h1>
      <p className="mt-1 text-sm text-slate-600">Free for now. Your listing goes live immediately.</p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="company">Company name *</Label>
            <Input id="company" value={form.company_name} onChange={(e) => set('company_name', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="role">Role title *</Label>
            <Input id="role" value={form.role_title} onChange={(e) => set('role_title', e.target.value)} />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Category *</Label>
            <Select value={form.category} onValueChange={(v) => set('category', v)}>
              <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
              <SelectContent>
                {JOB_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Location type *</Label>
            <Select value={form.location_type} onValueChange={(v) => set('location_type', v)}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                {LOCATION_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        {form.location_type === 'Delhi NCR' && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>City</Label>
              <Select value={form.city} onValueChange={(v) => set('city', v)}>
                <SelectTrigger><SelectValue placeholder="Select city" /></SelectTrigger>
                <SelectContent>
                  {NCR_CITIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="area">Area</Label>
              <Input id="area" value={form.area} onChange={(e) => set('area', e.target.value)} placeholder="e.g. Sector 62" />
            </div>
          </div>
        )}

        {form.location_type === 'Other City' && (
          <div className="space-y-1.5">
            <Label htmlFor="cityName">City name *</Label>
            <Input id="cityName" value={form.city_name} onChange={(e) => set('city_name', e.target.value)} placeholder="e.g. Mumbai" />
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="salary">Salary range *</Label>
            <Input id="salary" value={form.salary_range} onChange={(e) => set('salary_range', e.target.value)} placeholder="e.g. Rs 18,000-25,000" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="salMin">Salary min (INR)</Label>
            <Input id="salMin" type="number" value={form.salary_min} onChange={(e) => set('salary_min', e.target.value)} placeholder="18000" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="salMax">Salary max (INR)</Label>
            <Input id="salMax" type="number" value={form.salary_max} onChange={(e) => set('salary_max', e.target.value)} placeholder="25000" />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="exp">Experience required *</Label>
            <Input id="exp" value={form.experience_required} onChange={(e) => set('experience_required', e.target.value)} placeholder="e.g. 0-2 years" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="contact">Contact email or phone *</Label>
            <Input id="contact" value={form.contact_email_or_phone} onChange={(e) => set('contact_email_or_phone', e.target.value)} placeholder="hr@company.com or +91..." />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label>Education</Label>
            <Select value={form.education} onValueChange={(v) => set('education', v)}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                {EDUCATION_OPTIONS.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Shift</Label>
            <Select value={form.shift} onValueChange={(v) => set('shift', v)}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                {SHIFT_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Languages</Label>
            <Select value={form.languages} onValueChange={(v) => set('languages', v)}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                {LANGUAGE_OPTIONS.map((l) => <SelectItem key={l} value={l}>{l === 'both' ? 'English & Hindi' : l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="wa">WhatsApp number</Label>
            <Input id="wa" value={form.whatsapp_number} onChange={(e) => set('whatsapp_number', e.target.value)} placeholder="10-digit mobile" maxLength={10} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="hr">HR phone (optional)</Label>
            <Input id="hr" value={form.hr_phone} onChange={(e) => set('hr_phone', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="openings">Openings</Label>
            <Input id="openings" type="number" value={form.openings} onChange={(e) => set('openings', e.target.value)} placeholder="e.g. 10" />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Checkbox checked={form.cab} onCheckedChange={(v) => set('cab', v === true)} id="cab" />
          <Label htmlFor="cab" className="cursor-pointer">Cab pickup & drop provided</Label>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="desc">Job description *</Label>
          <Textarea id="desc" value={form.job_description} onChange={(e) => set('job_description', e.target.value)} rows={5} />
        </div>

        <Button type="submit" disabled={saving} className="w-full">
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Post job (free)
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
