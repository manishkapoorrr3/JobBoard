'use client';
// Landing page — hero with search-style CTA and quick category links.
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { CategoryBadge } from '@/lib/categories';
import { JOB_CATEGORIES } from '@/lib/types';
import { Briefcase, MapPin, Calendar, ShieldCheck } from 'lucide-react';

export default function Home() {
  const { user, profile } = useAuth();
  const isRecruiter = profile?.account_type === 'recruiter';

  return (
    <div className="space-y-10">
      {/* Hero */}
      <section className="rounded-2xl bg-gradient-to-br from-blue-600 to-blue-800 px-6 py-12 text-white sm:px-10 sm:py-16">
        <div className="max-w-2xl">
          <h1 className="text-3xl font-bold leading-tight sm:text-4xl">
            Non Tech Jobs in Delhi NCR
          </h1>
          <p className="mt-3 text-blue-100 sm:text-lg">
            Voice, non-voice, semi-voice and finance operations roles — plus
            walk-in interviews. All listings are reviewed before going live.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/jobs">
              <Button size="lg" variant="secondary" className="bg-white text-blue-700 hover:bg-blue-50">
                <Briefcase className="mr-2 h-4 w-4" />
                Browse Jobs
              </Button>
            </Link>
            <Link href="/walkins">
              <Button size="lg" variant="outline" className="border-white/40 bg-transparent text-white hover:bg-white/10">
                <Calendar className="mr-2 h-4 w-4" />
                Walk-in Interviews
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Quick actions for logged-out users */}
      {!user && (
        <section className="grid gap-4 sm:grid-cols-2">
          <Link
            href="/signup"
            className="rounded-xl border border-slate-200 bg-white p-5 transition-shadow hover:shadow-md"
          >
            <h3 className="font-semibold text-slate-900">I&apos;m looking for a job</h3>
            <p className="mt-1 text-sm text-slate-600">
              Create a profile, browse jobs, save listings and get walk-in alerts.
            </p>
            <span className="mt-3 inline-block text-sm font-medium text-blue-600">
              Sign up as a job seeker →
            </span>
          </Link>
          <Link
            href="/signup"
            className="rounded-xl border border-slate-200 bg-white p-5 transition-shadow hover:shadow-md"
          >
            <h3 className="font-semibold text-slate-900">I&apos;m hiring</h3>
            <p className="mt-1 text-sm text-slate-600">
              Post jobs and walk-in interviews. Listings are reviewed before going live.
            </p>
            <span className="mt-3 inline-block text-sm font-medium text-emerald-600">
              Sign up as a recruiter →
            </span>
          </Link>
        </section>
      )}

      {/* Recruiter shortcut */}
      {user && isRecruiter && (
        <section className="grid gap-4 sm:grid-cols-2">
          <Link href="/jobs/new" className="rounded-xl border border-slate-200 bg-white p-5 transition-shadow hover:shadow-md">
            <h3 className="font-semibold text-slate-900">Post a Job</h3>
            <p className="mt-1 text-sm text-slate-600">Submit a new job listing for review.</p>
          </Link>
          <Link href="/walkins/new" className="rounded-xl border border-slate-200 bg-white p-5 transition-shadow hover:shadow-md">
            <h3 className="font-semibold text-slate-900">Post a Walk-in</h3>
            <p className="mt-1 text-sm text-slate-600">Schedule a walk-in interview event.</p>
          </Link>
        </section>
      )}

      {/* Categories overview */}
      <section>
        <h2 className="mb-3 text-lg font-semibold text-slate-900">Browse by category</h2>
        <div className="flex flex-wrap gap-2">
          {JOB_CATEGORIES.map((c) => (
            <Link key={c} href={`/jobs?category=${encodeURIComponent(c)}`}>
              <CategoryBadge category={c} />
            </Link>
          ))}
        </div>
      </section>

      {/* Trust note */}
      <section className="flex items-start gap-3 rounded-xl bg-slate-100 p-4 text-sm text-slate-600">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
        <p>
          Every job and walk-in listing is manually reviewed before it appears on
          the site, so you won&apos;t find fake posts here. See something off? Use
          the Report button on any listing.
        </p>
      </section>

      {/* Location note */}
      <section className="flex items-center gap-2 text-sm text-slate-500">
        <MapPin className="h-4 w-4" />
        Focused on Delhi NCR — Delhi, Noida, Greater Noida, Gurgaon, Ghaziabad, Faridabad.
      </section>
    </div>
  );
}
