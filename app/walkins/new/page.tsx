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
import { Loader2, Eye, CheckCircle2, MessageCircle } from 'lucide-react';
import { NCR_CITIES, EDUCATION_OPTIONS, SHIFT_OPTIONS, LANGUAGE_OPTIONS } from '@/lib/types';
import { formatSalaryFull, formatWalkinDate } from '@/lib/format';

const RAZORPAY_KEY = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
const PRICE = 499;

function PostWalkinInner() {
  const supabase = getSupabase();
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [paying, setPaying] = useState(false);
  const [createdId, setCreatedId] = useState<string | null>(null);

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

  function validate(): string | null {
    if (!form.company_name.trim()) return 'Company name is required.';
    if (!form.role_title.trim()) return 'Role title is required.';
    if (!form.category) return 'Please choose a category.';
    if (!form.city) return 'Please choose a city.';
    if (!form.area.trim()) return 'Area is required (e.g. Sector 62).';
    if (!form.addressLine.trim()) return 'Address is required.';
    if (!form.walkin_date) return 'Walk-in date is required.';
    if (!form.walkin_start_time.trim()) return 'Start time is required.';
    if (!form.salary_min || !form.salary_max) return 'Salary range is required.';
    if (!form.education) return 'Please choose minimum education.';
    if (!form.shift) return 'Please choose shift type.';
    if (!form.languages) return 'Please choose language requirement.';
    if (!/^\d{10}$/.test(form.whatsapp_number.replace(/\D/g, ''))) return 'WhatsApp number must be a valid 10-digit Indian mobile.';
    if (!form.description.trim()) return 'Description is required.';
    return null;
  }

  async function handleSaveDraft() {
    const err = validate();
    if (err) return toast.error(err);

    setSaving(true);
    const { data, error } = await supabase.from('walkins').insert({
      company_name: form.company_name.trim(),
      role_title: form.role_title.trim(),
      category: form.category,
      city: form.city,
      area: form.area.trim(),
      location_address: form.addressLine.trim(),
      walkin_date: form.walkin_date,
      walkin_time: `${form.walkin_start_time.trim()} - ${form.walkin_end_time.trim()}`.trim(),
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
      contact_person: null,
      status: 'draft',
    }).select('id').single();
    setSaving(false);

    if (error) return toast.error('Could not save your listing. Please try again.');
    setCreatedId(data.id);
    setShowPreview(true);
  }

  async function handlePay() {
    if (!createdId) return;
    setPaying(true);

    if (RAZORPAY_KEY) {
      // Load Razorpay checkout script
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => {
        const rzp = new (window as any).Razorpay({
          key: RAZORPAY_KEY,
          amount: PRICE * 100,
          currency: 'INR',
          name: 'NCR Walk-in',
          description: 'Walk-in listing — 7 days',
          handler: async () => {
            await activateListing();
          },
          modal: { ondismiss: () => setPaying(false) },
        });
        rzp.open();
      };
      script.onerror = () => {
        toast.error('Could not load payment gateway. Try Demo pay.');
        setPaying(false);
      };
      document.body.appendChild(script);
    } else {
      // Demo pay — no real payment, just activate
      await activateListing();
    }
  }

  async function activateListing() {
    if (!createdId) return;
    const paidUntil = new Date();
    paidUntil.setDate(paidUntil.getDate() + 7);

    const { error } = await supabase
      .from('walkins')
      .update({ status: 'live', paid_until: paidUntil.toISOString() })
      .eq('id', createdId);

    setPaying(false);
    if (error) return toast.error('Payment received but listing activation failed. Please contact support.');

    toast.success('Your walk-in is live!');
    router.push('/walkins');
  }

  if (showPreview && createdId) {
    return (
      <div className="mx-auto max-w-2xl space-y-5">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-2 text-emerald-600">
            <CheckCircle2 className="h-5 w-5" />
            <span className="font-semibold">Listing saved — preview</span>
          </div>
          <p className="mt-1 text-sm text-slate-600">Review your listing below, then pay Rs {PRICE} to make it live for 7 days.</p>
        </div>

        {/* Preview card */}
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="font-semibold text-slate-900">{form.role_title}</h3>
          <p className="text-sm text-slate-600">{form.company_name}</p>
          <p className="mt-2 text-lg font-bold text-emerald-700">{formatSalaryFull(parseInt(form.salary_min) || null, parseInt(form.salary_max) || null)}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {[form.category, form.shift, form.cab && 'Cab', form.education].filter(Boolean).map((c) => (
              <span key={c as string} className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">{c as string}</span>
            ))}
          </div>
          <p className="mt-3 text-sm text-slate-600">
            {formatWalkinDate(form.walkin_date)} {form.walkin_start_time} - {form.walkin_end_time} | {form.city}, {form.area}
          </p>
          <p className="mt-2 text-sm text-slate-700">{form.description}</p>
        </div>

        {/* Payment */}
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-slate-900">Pay Rs {PRICE}</p>
              <p className="text-sm text-slate-600">Listing goes live instantly. Visible for 7 days.</p>
            </div>
            <Button onClick={handlePay} disabled={paying} className="bg-emerald-600 text-white hover:bg-emerald-700">
              {paying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {RAZORPAY_KEY ? `Pay Rs ${PRICE}` : `Demo pay Rs ${PRICE}`}
            </Button>
          </div>
          {!RAZORPAY_KEY && (
            <p className="mt-2 text-xs text-amber-600">
              Demo mode: no real payment will be charged. Set NEXT_PUBLIC_RAZORPAY_KEY_ID to enable Razorpay Checkout.
            </p>
          )}
        </div>

        <Button variant="outline" onClick={() => setShowPreview(false)} className="w-full">
          <Eye className="mr-2 h-4 w-4" />Edit listing
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold text-slate-900">Post a walk-in interview</h1>
      <p className="mt-1 text-sm text-slate-600">
        Rs {PRICE} for 7 days. Your listing goes live instantly after payment.
      </p>

      <form onSubmit={(e) => { e.preventDefault(); handleSaveDraft(); }} className="mt-6 space-y-4">
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
          <Eye className="mr-2 h-4 w-4" />Preview &amp; Continue
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
