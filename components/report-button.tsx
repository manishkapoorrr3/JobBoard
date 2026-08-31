'use client';
// Report button — opens a small dialog to flag a job or walk-in.
import { useState } from 'react';
import { getSupabase } from '@/lib/supabase-client';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Flag, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const REASONS = ['Fake listing', 'Spam', 'Wrong information', 'Other'] as const;

export function ReportButton({ jobId, walkinId }: { jobId?: string; walkinId?: string }) {
  const supabase = getSupabase();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<string>('');
  const [detail, setDetail] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (!user) return toast.error('Please log in to report a listing.');
    if (!reason) return toast.error('Please choose a reason.');
    if (!jobId && !walkinId) return toast.error('Nothing to report.');

    setSubmitting(true);
    const { error } = await supabase.from('reports').insert({
      job_id: jobId ?? null,
      walkin_id: walkinId ?? null,
      reason,
      detail: detail.trim() || null,
    });
    setSubmitting(false);
    if (error) return toast.error('Could not submit your report. Please try again.');

    toast.success('Thanks, we\'ll review this.');
    setOpen(false);
    setReason('');
    setDetail('');
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
          aria-label="Report"
          className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-red-600"
        >
          <Flag className="h-4 w-4" />
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Report this listing</DialogTitle>
          <DialogDescription>
            Help us keep listings accurate. Reports are reviewed by our team and are not shown publicly.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Reason</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger><SelectValue placeholder="Choose a reason" /></SelectTrigger>
              <SelectContent>
                {REASONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="detail">Details (optional)</Label>
            <Textarea
              id="detail"
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
              rows={3}
              placeholder="Add any extra context..."
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit} disabled={submitting}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Submit report
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
