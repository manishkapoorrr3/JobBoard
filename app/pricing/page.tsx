import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Briefcase, Calendar, Zap } from 'lucide-react';

export const metadata = { title: 'Pricing — Post a Walk-in for Rs 499 | NCR Walk-in' };

export default function PricingPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-slate-900">Post a walk-in — Rs 499</h1>
        <p className="mt-2 text-slate-600">Your listing goes live instantly. Visible for 7 days across Delhi NCR.</p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex items-baseline gap-2">
          <span className="text-4xl font-bold text-emerald-700">Rs 499</span>
          <span className="text-slate-500">/ 7 days</span>
        </div>

        <ul className="mt-5 space-y-3">
          {[
            'Listing live instantly — no manual review',
            'Visible to all candidates across Delhi NCR',
            'WhatsApp apply button on your listing',
            'Big salary, shift, cab, city on the card',
            'Filters by city, category, shift, education',
            'Edit your listing anytime within 7 days',
            'Renew for another 7 days at Rs 499',
          ].map((f) => (
            <li key={f} className="flex items-start gap-2 text-sm text-slate-700">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
              {f}
            </li>
          ))}
        </ul>

        <Link href="/signup" className="mt-6 block">
          <Button className="w-full bg-emerald-600 text-white hover:bg-emerald-700">
            <Briefcase className="mr-2 h-4 w-4" />
            Get started — Post a walk-in
          </Button>
        </Link>
      </div>

      {/* Comparison */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <Calendar className="h-6 w-6 text-emerald-600" />
          <h3 className="mt-2 font-semibold text-slate-900">Walk-in listing</h3>
          <p className="text-2xl font-bold text-slate-900">Rs 499</p>
          <p className="text-sm text-slate-600">7 days, live instantly, WhatsApp apply</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <Briefcase className="h-6 w-6 text-blue-600" />
          <h3 className="mt-2 font-semibold text-slate-900">Regular job post</h3>
          <p className="text-2xl font-bold text-slate-900">Free</p>
          <p className="text-sm text-slate-600">Free for now during launch</p>
        </div>
      </div>

      {/* FAQ */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">FAQ</h2>
        <div className="space-y-3">
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <p className="font-medium text-slate-900">How long is my listing visible?</p>
            <p className="mt-1 text-sm text-slate-600">7 days from the date of payment. After that, it expires. You can renew for another 7 days at Rs 499.</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <p className="font-medium text-slate-900">Does my listing need approval?</p>
            <p className="mt-1 text-sm text-slate-600">No. Your listing goes live the moment you pay. We rely on community reporting to catch fake listings — fake walk-ins get removed.</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <p className="font-medium text-slate-900">What if my walk-in is reported?</p>
            <p className="mt-1 text-sm text-slate-600">If a listing receives 3 reports, it is automatically hidden pending review. You can contact us to resolve disputes.</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <p className="font-medium text-slate-900">Can I edit my listing after posting?</p>
            <p className="mt-1 text-sm text-slate-600">Yes. Log in, go to My Listings, and edit any field. Changes appear instantly.</p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">
        <Zap className="h-5 w-5 shrink-0" />
        <p>Ready to hire? Sign up as a recruiter and post in 2 minutes.</p>
      </div>
    </div>
  );
}
