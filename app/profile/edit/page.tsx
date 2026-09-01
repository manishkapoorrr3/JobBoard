'use client';
// Job seeker profile edit page.
// Fields: full name, phone, experience years, skills (multi-select),
// domain experience (multi-select), current location, resume link.
import { useEffect, useState } from 'react';
import { getSupabase } from '@/lib/supabase-client';
import { useAuth } from '@/lib/auth-context';
import { RequireAuth } from '@/lib/auth-guards';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { SKILL_OPTIONS, DOMAIN_OPTIONS } from '@/lib/types';
import { cn } from '@/lib/utils';

function ProfileEditInner() {
  const supabase = getSupabase();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [experienceYears, setExperienceYears] = useState('0');
  const [skills, setSkills] = useState<string[]>([]);
  const [domains, setDomains] = useState<string[]>([]);
  const [currentLocation, setCurrentLocation] = useState('');
  const [resumeLink, setResumeLink] = useState('');

  // Load the existing profile once.
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      if (data) {
        setFullName(data.full_name ?? '');
        setPhone(data.phone ?? '');
        setExperienceYears(String(data.experience_years ?? 0));
        setSkills(data.skills ?? []);
        setDomains(data.domain_experience ?? []);
        setCurrentLocation(data.current_location ?? '');
        setResumeLink(data.resume_link ?? '');
      }
      setLoading(false);
    })();
  }, [supabase, user]);

  function toggle(list: string[], value: string, setter: (v: string[]) => void) {
    setter(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (!fullName.trim()) return toast.error('Please enter your full name.');
    if (resumeLink && !/^https?:\/\//i.test(resumeLink)) return toast.error('Resume link should start with http:// or https://');

    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: fullName.trim(),
        phone: phone.trim() || null,
        experience_years: Number(experienceYears) || 0,
        skills,
        domain_experience: domains,
        current_location: currentLocation.trim() || null,
        resume_link: resumeLink.trim() || null,
      })
      .eq('user_id', user.id);
    setSaving(false);
    if (error) return toast.error('Could not save your profile. Please try again.');
    toast.success('Profile saved.');
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold text-slate-900">Your profile</h1>
      <p className="mt-1 text-sm text-slate-600">
        This helps us match you with relevant jobs. It&apos;s for your own reference — not public.
      </p>

      <form onSubmit={handleSave} className="mt-6 space-y-6">
        {/* Basic details */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="name">Full name</Label>
            <Input id="name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="phone">Phone (optional)</Label>
            <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 ..." />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="exp">Experience (years)</Label>
            <Input id="exp" type="number" min="0" max="50" value={experienceYears} onChange={(e) => setExperienceYears(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="loc">Current location</Label>
            <Input id="loc" value={currentLocation} onChange={(e) => setCurrentLocation(e.target.value)} placeholder="e.g. Noida Sector 62" />
          </div>
        </div>

        {/* Domain experience — multi-select */}
        <div className="space-y-2">
          <Label>Domain experience</Label>
          <p className="text-xs text-slate-500">Select all that apply.</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {DOMAIN_OPTIONS.map((d) => {
              const checked = domains.includes(d);
              return (
                <label
                  key={d}
                  className={cn(
                    'flex cursor-pointer items-center gap-2 rounded-lg border p-3 text-sm transition-colors',
                    checked ? 'border-blue-600 bg-blue-50' : 'border-slate-200 hover:border-slate-300'
                  )}
                >
                  <Checkbox checked={checked} onCheckedChange={() => toggle(domains, d, setDomains)} />
                  <span className="text-slate-700">{d}</span>
                </label>
              );
            })}
          </div>
        </div>

        {/* Skills — multi-select */}
        <div className="space-y-2">
          <Label>Skills</Label>
          <p className="text-xs text-slate-500">Select all that apply.</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {SKILL_OPTIONS.map((s) => {
              const checked = skills.includes(s);
              return (
                <label
                  key={s}
                  className={cn(
                    'flex cursor-pointer items-center gap-2 rounded-lg border p-3 text-sm transition-colors',
                    checked ? 'border-blue-600 bg-blue-50' : 'border-slate-200 hover:border-slate-300'
                  )}
                >
                  <Checkbox checked={checked} onCheckedChange={() => toggle(skills, s, setSkills)} />
                  <span className="text-slate-700">{s}</span>
                </label>
              );
            })}
          </div>
        </div>

        {/* Resume link */}
        <div className="space-y-1.5">
          <Label htmlFor="resume">Resume link (optional)</Label>
          <Input id="resume" value={resumeLink} onChange={(e) => setResumeLink(e.target.value)} placeholder="https://drive.google.com/..." />
          <p className="text-xs text-slate-500">A public Google Drive or Dropbox link works best.</p>
        </div>

        <Button type="submit" disabled={saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save profile
        </Button>
      </form>
    </div>
  );
}

export default function ProfileEditPage() {
  return (
    <RequireAuth>
      <ProfileEditInner />
    </RequireAuth>
  );
}
