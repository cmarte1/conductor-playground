'use client';
import { useMemo, useState, type ReactNode } from 'react';
import { Ban, CirclePlay, Trash2 } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/Table';
import { cn } from '@/lib/utils';
import {
  KeySearchInput,
  KeyStatusBadge,
  RowActionsMenu,
  SortableHead,
  nextSort,
  type SortState,
  type StatusTone,
} from './KeyTableParts';
import { CredentialProviderLogo } from './CredentialProviderLogo';
import type { PreviewCredential } from './VaultCredentialPreview';

// Provider API keys table on the app's Table primitives. Columns answer the
// list's jobs: is it working (Status), who relies on it (Used by), is it stale
// (Last used), who do I ask (the "added by" subline). The masked secret lives
// in the key's detail view, not here.

export const CURRENT_USER = 'Chris Marte';
/** Prototype stand-in: the current user is a workspace admin. */
export const CURRENT_USER_IS_ADMIN = true;

type SortKey = 'name' | 'status' | 'usedBy' | 'lastUsed' | 'created';

const createdByOf = (item: PreviewCredential) => item.createdBy ?? CURRENT_USER;
const createdTime = (item: PreviewCredential) => {
  const time = item.createdAt ? Date.parse(item.createdAt) : NaN;
  return Number.isNaN(time) ? 0 : time;
};
const formatCreated = (item: PreviewCredential) => {
  const time = createdTime(item);
  return time
    ? new Date(time).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : '';
};

const UNIT_MS: Record<string, number> = { minute: 60e3, hour: 3.6e6, day: 8.64e7 };
/** Sort rank for "12 minutes ago" / "Sep 20, 2026" / "Never" (never = oldest). */
const lastUsedTime = (item: PreviewCredential) => {
  const value = item.lastUsed ?? 'Never';
  const relative = value.match(/^(\d+)\s+(minute|hour|day)s?\s+ago$/);
  if (relative) return Date.now() - Number(relative[1]) * UNIT_MS[relative[2]];
  const time = Date.parse(value);
  return Number.isNaN(time) ? 0 : time;
};
const usedByLabel = (item: PreviewCredential) =>
  item.agents.length
    ? `${item.agents.length} agent${item.agents.length === 1 ? '' : 's'}`
    : 'Not in use';

/** Masked preview only; the prototype never holds a real secret. */
export function maskedKey(item: PreviewCredential) {
  if (item.keyPreview) return item.keyPreview;
  const hex = item.id.replace(/[^a-f0-9]/gi, '').toLowerCase().padEnd(8, '0');
  const prefix = (item.service ?? 'OpenAI') === 'OpenAI' ? 'sk-proj' : 'apikey';
  return `${prefix}_${hex.slice(0, 4)}...${hex.slice(-4)}`;
}

function statusOf(item: PreviewCredential): { label: string; tone: StatusTone } {
  if (!item.enabled) return { label: 'Inactive', tone: 'neutral' };
  if (item.state === 'failed') return { label: 'Needs review', tone: 'warning' };
  if (item.state === 'testing') return { label: 'Checking', tone: 'busy' };
  if (item.state === 'untested') return { label: 'Not tested', tone: 'neutral' };
  return { label: 'Active', tone: 'active' };
}

const sortValue: Record<SortKey, (item: PreviewCredential) => string | number> = {
  name: (item) => item.name.toLowerCase(),
  status: (item) => statusOf(item).label,
  usedBy: (item) => item.agents.length,
  lastUsed: lastUsedTime,
  created: createdTime,
};

export function ApiKeysTable({
  credentials,
  search,
  onSearchChange,
  onOpen,
  onToggleActive,
  onDelete,
  emptyState,
}: {
  credentials: PreviewCredential[];
  search: string;
  onSearchChange: (value: string) => void;
  onOpen: (item: PreviewCredential) => void;
  onToggleActive: (item: PreviewCredential) => void;
  onDelete: (item: PreviewCredential) => void;
  /** Shown when there are no keys at all (not for an empty search). */
  emptyState: ReactNode;
}) {
  const [sort, setSort] = useState<SortState<SortKey>>({ key: 'created', dir: 'desc' });
  const onSort = (key: SortKey) =>
    setSort((prev) => nextSort(prev, key, ['created', 'usedBy', 'lastUsed']));

  const query = search.trim().toLowerCase();
  const rows = useMemo(() => {
    const matches = credentials.filter((item) =>
      [item.name, item.service ?? 'OpenAI', createdByOf(item), ...item.agents]
        .join(' ')
        .toLowerCase()
        .includes(query)
    );
    const value = sortValue[sort.key];
    return [...matches].sort((a, b) => {
      const [x, y] = [value(a), value(b)];
      const order = x < y ? -1 : x > y ? 1 : 0;
      return sort.dir === 'asc' ? order : -order;
    });
  }, [credentials, query, sort]);

  if (!credentials.length) return <>{emptyState}</>;

  return (
    <div className="space-y-3">
      <KeySearchInput value={search} onChange={onSearchChange} />
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <SortableHead label="Name" column="name" sort={sort} onSort={onSort} className="w-[42%]" />
            <SortableHead label="Status" column="status" sort={sort} onSort={onSort} />
            <SortableHead label="Used by" column="usedBy" sort={sort} onSort={onSort} />
            <SortableHead label="Last used" column="lastUsed" sort={sort} onSort={onSort} />
            <TableHead className="h-10 w-12 px-3">
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((item) => {
            const status = statusOf(item);
            // Keys belong to the workspace: the creator and admins can change them.
            const editable = CURRENT_USER_IS_ADMIN || createdByOf(item) === CURRENT_USER;
            return (
              <TableRow
                key={item.id}
                onClick={editable ? () => onOpen(item) : undefined}
                className={cn(editable ? 'cursor-pointer' : 'hover:bg-transparent')}
              >
                <TableCell className="px-3 py-3">
                  <div className="flex items-center gap-3">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-white shadow-sm ring-1 ring-black/[0.06]">
                      <CredentialProviderLogo service={item.service ?? 'OpenAI'} size={18} />
                    </span>
                    <div className="min-w-0">
                      {editable ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpen(item);
                          }}
                          className="block max-w-full truncate text-left text-sm text-foreground underline-offset-4 hover:underline"
                        >
                          {item.name}
                        </button>
                      ) : (
                        <span className="block truncate text-sm text-foreground">{item.name}</span>
                      )}
                      <span className="block truncate text-xs text-muted-foreground">
                        {item.service ?? 'OpenAI'} · added by {createdByOf(item)}
                        {formatCreated(item) && `, ${formatCreated(item)}`}
                      </span>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="px-3 py-3">
                  <KeyStatusBadge tone={status.tone}>{status.label}</KeyStatusBadge>
                </TableCell>
                <TableCell
                  className={cn(
                    'px-3 py-3 text-sm',
                    item.agents.length ? 'text-muted-foreground' : 'text-muted-foreground/70'
                  )}
                  title={item.agents.join(', ') || undefined}
                >
                  {usedByLabel(item)}
                </TableCell>
                <TableCell className="px-3 py-3 text-sm text-muted-foreground">
                  {item.lastUsed ?? 'Never'}
                </TableCell>
                <TableCell
                  className="px-3 py-3 text-right"
                  onClick={(e) => e.stopPropagation()}
                >
                  {editable && (
                    <RowActionsMenu
                      label={item.name}
                      actions={[
                        {
                          label: item.enabled ? 'Deactivate' : 'Activate',
                          icon: item.enabled ? Ban : CirclePlay,
                          onSelect: () => onToggleActive(item),
                        },
                        {
                          label: 'Delete',
                          icon: Trash2,
                          destructive: true,
                          onSelect: () => onDelete(item),
                        },
                      ]}
                    />
                  )}
                </TableCell>
              </TableRow>
            );
          })}
          {!rows.length && (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                No keys match “{search.trim()}”.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
