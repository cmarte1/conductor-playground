'use client';
import type { ReactNode } from 'react';
import {
  ChevronDown,
  ChevronsUpDown,
  ChevronUp,
  Loader2,
  MoreHorizontal,
  Search,
  type LucideIcon,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu';
import { Input } from '@/components/ui/Input';
import { TableHead } from '@/components/ui/Table';
import { cn } from '@/lib/utils';

// Shared pieces for key tables (Vault provider keys, Hatz API keys) so both
// read as one system: sortable headers, status badge, masked key chip, row menu.

export type SortState<K extends string> = { key: K; dir: 'asc' | 'desc' };

export function SortableHead<K extends string>({
  label,
  column,
  sort,
  onSort,
  className,
}: {
  label: string;
  column: K;
  sort: SortState<K>;
  onSort: (key: K) => void;
  className?: string;
}) {
  const active = sort.key === column;
  const Icon = !active ? ChevronsUpDown : sort.dir === 'asc' ? ChevronUp : ChevronDown;
  return (
    <TableHead
      className={cn('h-10 px-3 text-xs font-normal text-muted-foreground', className)}
      aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <button
        type="button"
        onClick={() => onSort(column)}
        className="inline-flex items-center gap-1 transition-colors hover:text-foreground"
      >
        {label}
        <Icon className={cn('size-3', !active && 'opacity-60')} aria-hidden="true" />
      </button>
    </TableHead>
  );
}

/** Flip direction on the same column; newest-first style columns start descending. */
export function nextSort<K extends string>(
  prev: SortState<K>,
  key: K,
  descFirst: readonly K[] = []
): SortState<K> {
  if (prev.key === key) return { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' };
  return { key, dir: descFirst.includes(key) ? 'desc' : 'asc' };
}

export type StatusTone = 'active' | 'neutral' | 'warning' | 'busy';

const toneClasses: Record<StatusTone, string> = {
  active: 'bg-[#EEF5E9] text-[#5B8A3C]',
  neutral: 'bg-neutral-100 text-neutral-500',
  warning: 'bg-amber-50 text-amber-700',
  busy: 'bg-neutral-100 text-neutral-600',
};

export function KeyStatusBadge({ tone, children }: { tone: StatusTone; children: ReactNode }) {
  return (
    <span
      role="status"
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium transition-colors duration-300',
        toneClasses[tone]
      )}
    >
      {tone === 'busy' && <Loader2 className="size-3 animate-spin" aria-hidden="true" />}
      {children}
    </span>
  );
}

export function SecretKeyChip({ children }: { children: ReactNode }) {
  return (
    <code className="rounded bg-muted/70 px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
      {children}
    </code>
  );
}

export type RowAction = {
  label: string;
  icon: LucideIcon;
  onSelect: () => void;
  destructive?: boolean;
};

export function RowActionsMenu({ label, actions }: { label: string; actions: RowAction[] }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`More actions for ${label}`}
          className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <MoreHorizontal className="size-4" aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        {actions.map(({ label: actionLabel, icon: Icon, onSelect, destructive }) => (
          <DropdownMenuItem
            key={actionLabel}
            className={cn(destructive && 'text-destructive focus:text-destructive')}
            onSelect={onSelect}
          >
            <Icon className="size-4" aria-hidden="true" />
            {actionLabel}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function KeySearchInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="relative w-64">
      <Search
        className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
      <Input
        aria-label="Search keys"
        placeholder="Search keys…"
        className="h-9 pl-9"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

/** Centred one-liner under a key table pointing to the other kind of key. */
export function KeyCrossLink({ children }: { children: ReactNode }) {
  return <p className="pt-4 text-center text-sm text-muted-foreground">{children}</p>;
}
