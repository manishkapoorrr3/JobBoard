'use client';
// Bookmark / save button for job cards. Toggles save state.
// Only meaningful for logged-in job seekers (caller controls visibility).
import { useEffect, useState } from 'react';
import { getSupabase } from '@/lib/supabase-client';
import { useAuth } from '@/lib/auth-context';
import { Bookmark } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export function SaveButton({ jobId }: { jobId: string }) {
  const supabase = getSupabase();
  const { user } = useAuth();
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  // Check if this job is already saved by the current user.
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from('saved_jobs')
        .select('job_id')
        .eq('user_id', user.id)
        .eq('job_id', jobId)
        .maybeSingle();
      setSaved(!!data);
    })();
  }, [supabase, user, jobId]);

  async function toggle() {
    if (!user) return;
    setBusy(true);
    if (saved) {
      const { error } = await supabase
        .from('saved_jobs')
        .delete()
        .eq('user_id', user.id)
        .eq('job_id', jobId);
      setBusy(false);
      if (error) return toast.error('Could not remove bookmark.');
      setSaved(false);
      toast.success('Removed from saved.');
    } else {
      const { error } = await supabase
        .from('saved_jobs')
        .insert({ user_id: user.id, job_id: jobId });
      setBusy(false);
      if (error) return toast.error('Could not save this job.');
      setSaved(true);
      toast.success('Saved.');
    }
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggle();
      }}
      disabled={busy}
      aria-label={saved ? 'Unsave' : 'Save'}
      className={cn(
        'rounded-md p-1.5 transition-colors',
        saved ? 'text-blue-600 hover:bg-blue-50' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'
      )}
    >
      <Bookmark className="h-4 w-4" fill={saved ? 'currentColor' : 'none'} />
    </button>
  );
}
