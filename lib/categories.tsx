// Helpers for category-colored badges and filter tabs.
import { JobCategory, BPO_CATEGORIES, FINANCE_CATEGORIES } from './types';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

// Map each category to a Tailwind color class for quick visual scanning.
// BPO -> blue tones, Finance/BFSI -> green tones.
export function categoryBadgeClass(category: JobCategory): string {
  const isBpo = BPO_CATEGORIES.includes(category);
  const isFinance = FINANCE_CATEGORIES.includes(category);
  if (isBpo) return 'bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-100';
  if (isFinance) return 'bg-emerald-100 text-emerald-800 border-emerald-200 hover:bg-emerald-100';
  return 'bg-slate-100 text-slate-800 border-slate-200 hover:bg-slate-100';
}

export function CategoryBadge({ category }: { category: JobCategory }) {
  return (
    <Badge variant="outline" className={cn('font-medium', categoryBadgeClass(category))}>
      {category}
    </Badge>
  );
}

// A single filter tab button. `active` controls the highlighted style.
export function FilterTab({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors whitespace-nowrap',
        active
          ? 'bg-slate-900 text-white'
          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
      )}
    >
      {label}
    </button>
  );
}
