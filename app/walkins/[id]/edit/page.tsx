'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { getSupabase } from '@/lib/supabase-client';
import { useAuth } from '@/lib/auth-context';
import { RequireRecruiter } from '@/lib/auth-guards';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { Loader2, ArrowLeft, Inbox, Save } from 'lucide-react';
import { NCR_CITIES, EDUCATION_OPTIONS, SHIFT_OPTIONS, LANGUAGE_OPTIONS, Walkin } from '@/lib/types';
import { localISODate } from '@/lib/format';

function EditWalkinInner() {
  const supabase = getSupabase();
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    company_name: '',
    role_title: '',
    category: '',
    city: '',
    area: '',
    addressLine: '',
    walkin_date: '',
    walkin_start_time: '',
    walkin_end_time: '',
    salary_min: '',
    salary_max: '',
    education: '',
    shift: '',
    cab: false,
    languages: '',
    whatsapp_number: '',
    hr_phone: '',
    openings: '',
    description: '',
  });

  function set(key: keyof typeof form, value: string | boolean) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('walkins')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      const walkin = data as Walkin | null;
      if (!walkin || walkin.posted_by_user_id !== user?.id) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      const [start, end] = (walkin.walkin_time || '').split(' - ');
      setForm({
        company_name: walkin.company_name || '',
        role_title: walkin.role_title || '',
        category: walkin.category || '',
        city: walkin.city || '',
        area: walkin.area || '',
        addressLine: walkin.location_address || '',
        walkin_date: walkin.walkin_date || '',
        walkin_start_time: start || '',
        walkin_end_time: end || '',
        salary_min: walkin.salary_min != null ? String(walkin.salary_min) : '',
        salary_max: walkin.salary_max != null ? String(walkin.salary_max) : '',
        education: walkin.education || '',
        shift: walkin.shift || '',
        cab: !!walkin.cab,
        languages: walkin.languages || '',
        whatsapp_number: walkin.whatsapp_number || '',
        hr_phone: walkin.hr_phone || '',
        openings: walkin.openings != null ? String(walkin.openings) : '',
        description: walkin.description || '',
      });
      setLoading(false);
    })();
  }, [supabase, id, user]);

  function validate(): string | null {
    if (!form.company_name.trim()) return 'Company name is required.';
    if (!form.role_title.trim()) return 'Role title is required.';
    if (!form.category) return 'Please choose a category.';
    if (!form.city) return 'Please choose a city.';
    if (!form.area.trim()) return 'Area is required (e.g. Sector 62).';
    if (!form.addressLine.trim()) return 'Address is required.';
    if (!form.walkin_date) return 'Walk-in date is required.';
    if (form.walkin_date < localISODate()) return 'Walk-in date cannot be in the past.';
    if (!form.walkin_start_time.trim()) return 'Start time is required.';
    if (!form.salary_min || !form.salary_max) return 'Salary range is required.';
    const salMin = parseInt(form.salary_min);
    const salMax = parseInt(form.salary_max);
    if (!Number.isFinite(salMin) || !Number.isFinite(salMax) || salMin <= 0 || salMax <= 0) {
      return 'Salary must be positive numbers.';
    }
    if (salMin > salMax) return 'Minimum salary cannot be greater than maximum salary.';
    if (!form.education) return 'Please choose minimum education.';
    if (!form.shift) return 'Please choose shift type.';
    if (!form.languages) return 'Please choose language requirement.';
    if (!/^\d{10}$/.test(form.whatsapp_number.replace(/\D/g, ''))) return 'WhatsApp number must be a valid 10-digit Indian mobile.';
    if (!form.description.trim()) return 'Description is required.';
    return null;
  }

  async function handleSave() {
    const err = validate();
    if (err) return toast.error(err);

    setSaving(true);
    const { error } = await supabase
      .from('walkins')
      .update({
        company_name: form.company_name.trim(),
        role_title: form.role_title.trim(),
        category: form.category,
        city: form.city,
        area: form.area.trim(),
        location_address: form.addressLine.trim(),
        walkin_date: form.walkin_date,
        walkin_time: [form.walkin_start_time.trim(), form.walkin_end_time.trim()].filter(Boolean).join(' - '),
        salary_min: parseInt(form.salary_min) || null,
        salary_max: parseInt(form.salary_max) || null,
        education: form.education || null,
        shift: form.shift || null,
        cab: form.cab,
        languages: form.languages || null,
        whatsapp_number: form.whatsapp_number.replace(/\D/g, ''),
        hr_phone: form.hr_phone.replace(/\D/g, '') || null,
        openings: parseInt(form.openings) || null,
        description: form.description.trim(),
      })
      .eq('id', id);
    setSaving(false);

    if (error) return toast.error('Could not update your listing. Please try again.');

    toast.success('Listing updated!');
    router.push('/dashboard');
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Inbox className="h-8 w-8 text-slate-300" />
        <p className="mt-2 text-slate-600">This walk-in doesn&apos;t exist or isn&apos;t yours.</p>
        <Link href="/dashboard" className="mt-4">
          <Button variant="outline"><ArrowLeft className="mr-2 h-4 w-4" />Back to dashboard</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/dashboard" className="inline-flex items-center text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft className="mr-1 h-4 w-4" />Back to dashboard
      </Link>
      <h1 className="mt-3 text-2xl font-bold text-slate-900">Edit walk-in interview</h1>
      <p className="mt-1 text-sm text-slate-600">
        Update your listing details. This does not change its status or payment.
      </p>

      <form onSubmit={(e) => { e.preventDefault(); handleSave(); }} className="mt-6 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="company">Company name *</Label>
            <Input id="company" value={form.company_name} onChange={(e) => set('company_name', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="role">Role title *</Label>
            <Input id="role" value={form.role_title} onChange={(e) => set('role_title', e.target.value)} placeholder="e.g. Customer Care Executive" />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Category *</Label>
            <Select value={form.category} onValueChange={(v) => set('category', v)}>
              <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Voice">Voice</SelectItem>
                <SelectItem value="Non-Voice">Non-Voice</SelectItem>
                <SelectItem value="Semi-Voice">Semi-Voice</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>City *</Label>
            <Select value={form.city} onValueChange={(v) => set('city', v)}>
              <SelectTrigger><SelectValue placeholder="Select city" /></SelectTrigger>
              <SelectContent>
                {NCR_CITIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="area">Area *</Label>
            <Input id="area" value={form.area} onChange={(e) => set('area', e.target.value)} placeholder="e.g. Sector 62" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="address">Address line *</Label>
            <Input id="address" value={form.addressLine} onChange={(e) => set('addressLine', e.target.value)} placeholder="Full venue address" />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="date">Walk-in date *</Label>
            <Input id="date" type="date" value={form.walkin_date} onChange={(e) => set('walkin_date', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="startTime">Start time *</Label>
            <Input id="startTime" type="time" value={form.walkin_start_time} onChange={(e) => set('walkin_start_time', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="endTime">End time</Label>
            <Input id="endTime" type="time" value={form.walkin_end_time} onChange={(e) => set('walkin_end_time', e.target.value)} />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="salMin">Salary min (INR) *</Label>
            <Input id="salMin" type="number" value={form.salary_min} onChange={(e) => set('salary_min', e.target.value)} placeholder="e.g. 15000" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="salMax">Salary max (INR) *</Label>
            <Input id="salMax" type="number" value={form.salary_max} onChange={(e) => set('salary_max', e.target.value)} placeholder="e.g. 22000" />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label>Education *</Label>
            <Select value={form.education} onValueChange={(v) => set('education', v)}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                {EDUCATION_OPTIONS.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Shift *</Label>
            <Select value={form.shift} onValueChange={(v) => set('shift', v)}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                {SHIFT_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Languages *</Label>
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
            <Label htmlFor="wa">WhatsApp number *</Label>
            <Input id="wa" value={form.whatsapp_number} onChange={(e) => set('whatsapp_number', e.target.value)} placeholder="10-digit mobile" maxLength={10} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="hr">HR phone (optional)</Label>
            <Input id="hr" value={form.hr_phone} onChange={(e) => set('hr_phone', e.target.value)} placeholder="Alternate phone" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="openings">Openings (optional)</Label>
            <Input id="openings" type="number" value={form.openings} onChange={(e) => set('openings', e.target.value)} placeholder="e.g. 10" />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Checkbox checked={form.cab} onCheckedChange={(v) => set('cab', v === true)} id="cab" />
          <Label htmlFor="cab" className="cursor-pointer">Cab pickup & drop provided</Label>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="desc">Description *</Label>
          <Textarea id="desc" value={form.description} onChange={(e) => set('description', e.target.value)} rows={5} placeholder="Process details, week off, incentives, what to carry (CV + Aadhaar)..." />
        </div>

        <Button type="submit" disabled={saving} className="w-full">
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          <Save className="mr-2 h-4 w-4" />Save changes
        </Button>
      </form>
    </div>
  );
}

export default function EditWalkinPage() {
  return (
    <RequireRecruiter>
      <EditWalkinInner />
    </RequireRecruiter>
  );
}
