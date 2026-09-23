'use client';

import { useState, useMemo } from 'react';
import { ChevronDown, ChevronRight, Filter, Search } from 'lucide-react';
import { Switch } from '@/components/ui/Switch';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/Popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/Tooltip';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { cn } from '@/lib/utils';
import type {
  IntegrationPolicyRow,
  PolicyDecision,
  ToolPolicyRow,
} from '../types';
import { IntegrationLogo } from './IntegrationRow';

type AccessMode = 'enable-all' | 'select-specific';
type SortBy = 'popular' | 'alpha';

type FilterState = {
  authType: Set<'oauth' | 'api-key'>;
  status: Set<'enabled' | 'disabled'>;
  type: Set<'built-in' | 'custom'>;
  needsConfig: boolean;
};

const EMPTY_FILTER: FilterState = {
  authType: new Set(),
  status: new Set(),
  type: new Set(),
  needsConfig: false,
};

type UnifiedRow = (IntegrationPolicyRow | ToolPolicyRow) & {
  kind: 'integration' | 'tool';
};

type Props = {
  scope: 'msp' | 'tenant';
  integrations: IntegrationPolicyRow[];
  tools: ToolPolicyRow[];
  draftIntegrations: Record<string, PolicyDecision | null>;
  draftTools: Record<string, PolicyDecision | null>;
  onIntegrationChange: (id: string, denied: boolean) => void;
  onToolChange: (id: string, denied: boolean) => void;
  savingLocked: boolean;
};

// Prototype demo counts — replace with real API data when available.
const DEMO_CONNECTED_COUNTS: Record<string, number> = {
  google_calendar: 4,
  gmail: 4,
  google_drive: 3,
  slack: 6,
  linear: 2,
  notion: 1,
  github: 2,
};

const POPULARITY_ORDER = [
  'slack',
  'google_drive',
  'gmail',
  'google_calendar',
  'github',
  'notion',
  'linear',
  'microsoft_365',
  'asana',
  'salesforce',
];

function isFilterEmpty(f: FilterState) {
  return (
    f.authType.size === 0 &&
    f.status.size === 0 &&
    f.type.size === 0 &&
    !f.needsConfig
  );
}

function activeFilterCount(f: FilterState) {
  return (
    f.authType.size + f.status.size + f.type.size + (f.needsConfig ? 1 : 0)
  );
}

export function LangdockPoliciesSection({
  integrations,
  tools,
  draftIntegrations,
  draftTools,
  onIntegrationChange,
  onToolChange,
  savingLocked,
}: Props) {
  const [accessMode, setAccessMode] = useState<AccessMode>('enable-all');
  const [newActionsDefault, setNewActionsDefault] = useState(true);
  const [query, setQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortBy>('popular');
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTER);
  const [disabledSectionOpen, setDisabledSectionOpen] = useState(true);

  const allRows: UnifiedRow[] = useMemo(
    () => [
      ...integrations.map((r) => ({ ...r, kind: 'integration' as const })),
      ...tools.map((r) => ({ ...r, kind: 'tool' as const })),
    ],
    [integrations, tools]
  );

  const isRowEnabled = (row: UnifiedRow) => {
    const draft =
      row.kind === 'integration'
        ? draftIntegrations[row.id]
        : draftTools[row.id];
    if (row.lock !== null || draft === undefined)
      return row.effectiveDecision !== 'deny';
    return draft !== 'deny';
  };

  const handleToggle = (row: UnifiedRow, checked: boolean) => {
    if (row.kind === 'integration') onIntegrationChange(row.id, !checked);
    else onToolChange(row.id, !checked);
  };

  const toggleFilter = <T extends string>(set: Set<T>, value: T): Set<T> => {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    return next;
  };

  const sortRows = (rows: UnifiedRow[]) =>
    sortBy === 'alpha'
      ? [...rows].sort((a, b) => a.name.localeCompare(b.name))
      : [...rows].sort((a, b) => {
          const ai = POPULARITY_ORDER.indexOf(a.id);
          const bi = POPULARITY_ORDER.indexOf(b.id);
          if (ai === -1 && bi === -1) return a.name.localeCompare(b.name);
          if (ai === -1) return 1;
          if (bi === -1) return -1;
          return ai - bi;
        });

  const filteredAll = useMemo(() => {
    let rows = allRows;

    if (query.trim()) {
      const q = query.trim().toLowerCase();
      rows = rows.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.description.toLowerCase().includes(q)
      );
    }

    // Status filter
    if (filters.status.size > 0) {
      rows = rows.filter((r) => {
        const enabled = isRowEnabled(r);
        return (
          (filters.status.has('enabled') && enabled) ||
          (filters.status.has('disabled') && !enabled)
        );
      });
    }

    // Type filter — treat all DEMO_POLICY integrations as built-in; tools as built-in too
    if (filters.type.size > 0) {
      rows = rows.filter(
        (r) =>
          (filters.type.has('built-in') && r.kind === 'integration') ||
          (filters.type.has('custom') && r.kind === 'tool')
      );
    }

    return sortRows(rows);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allRows, query, filters, sortBy, draftIntegrations, draftTools]);

  const enabledRows = filteredAll.filter((r) =>
    accessMode === 'enable-all' ? true : isRowEnabled(r)
  );
  const disabledRows =
    accessMode === 'select-specific'
      ? filteredAll.filter((r) => !isRowEnabled(r))
      : [];

  const filterCount = activeFilterCount(filters);

  return (
    <div className="min-w-0 space-y-8">
      {/* ── Section 1: Manage built-in integrations ── */}
      <div>
        <h4 className="mb-1 text-sm font-medium text-foreground">
          Manage built-in integrations
        </h4>
        <p className="mb-4 text-sm text-muted-foreground">
          Admins always see all integrations. Toggle which built-in integrations
          are available to members and editors.
        </p>
        <div className="divide-y rounded-xl border">
          {/* New actions enabled by default */}
          <div className="flex items-center gap-4 px-5 py-4">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">
                New actions enabled by default
              </p>
              <p className="text-sm text-muted-foreground">
                Control whether new built-in integrations will be enabled by
                default in your workspace.
              </p>
            </div>
            <Switch
              checked={newActionsDefault}
              onCheckedChange={setNewActionsDefault}
              aria-label="New actions enabled by default"
            />
          </div>
          {/* Integration access — tab toggle */}
          <div className="flex items-center gap-4 px-5 py-4">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">Integration access</p>
              <p className="text-sm text-muted-foreground">
                Make all current and future built-in integrations available.
              </p>
            </div>
            <Tabs
              value={accessMode}
              onValueChange={(v) => setAccessMode(v as AccessMode)}
            >
              <TabsList>
                <TabsTrigger value="enable-all">Enable all</TabsTrigger>
                <TabsTrigger value="select-specific">
                  Select specific
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>
      </div>

      {/* ── Section 2: Manage all workspace integrations ── */}
      <div>
        <h4 className="mb-1 text-sm font-medium text-foreground">
          Manage all workspace integrations
        </h4>

        {/* Search + filter popover + sort */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <div className="relative w-56">
            <Search
              className="absolute left-3 top-2.5 size-4 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              placeholder="Search integrations..."
              className="pl-9"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search integrations"
            />
          </div>

          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className={cn('px-2.5', filterCount > 0 && 'border-foreground')}
                aria-label="Filter integrations"
              >
                <Filter className="size-4" aria-hidden="true" />
                {filterCount > 0 && (
                  <span className="ml-1 text-xs font-medium">
                    {filterCount}
                  </span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-56 p-4">
              <FilterPanel
                filters={filters}
                onToggleAuthType={(v) =>
                  setFilters((f) => ({
                    ...f,
                    authType: toggleFilter(f.authType, v),
                  }))
                }
                onToggleStatus={(v) =>
                  setFilters((f) => ({
                    ...f,
                    status: toggleFilter(f.status, v),
                  }))
                }
                onToggleType={(v) =>
                  setFilters((f) => ({ ...f, type: toggleFilter(f.type, v) }))
                }
                onToggleNeedsConfig={() =>
                  setFilters((f) => ({ ...f, needsConfig: !f.needsConfig }))
                }
                onClearAll={() => setFilters(EMPTY_FILTER)}
              />
            </PopoverContent>
          </Popover>

          <div className="ml-auto flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Sort by</span>
            <Select
              value={sortBy}
              onValueChange={(v) => setSortBy(v as SortBy)}
            >
              <SelectTrigger className="w-36 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="popular">Most popular</SelectItem>
                <SelectItem value="alpha">Alphabetical</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* List */}
        <section
          aria-label="Enabled integrations"
          className="mt-4 overflow-hidden rounded-xl border"
        >
          {/* ENABLED group header */}
          <div className="flex items-center gap-3 border-b bg-muted/30 px-5 py-2.5">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Enabled
            </span>
            <Badge
              variant="outline"
              aria-label="Enabled integration count"
              className="min-w-7 justify-center border-transparent bg-background px-2 py-0.5 font-medium tabular-nums"
            >
              {enabledRows.length}
            </Badge>
          </div>
          <div
            role="region"
            aria-label="Enabled integrations list"
            tabIndex={0}
            className="max-h-[504px] divide-y overflow-y-auto overscroll-contain focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
          >
            {enabledRows.map((row) => (
              <IntegrationPolicyListRow
                key={row.id}
                row={row}
                enabled
                accessMode={accessMode}
                savingLocked={savingLocked}
                connectedCount={DEMO_CONNECTED_COUNTS[row.id]}
                onToggle={(checked) => handleToggle(row, checked)}
              />
            ))}
            {enabledRows.length === 0 && (
              <div className="px-5 py-8 text-center">
                <p className="text-sm text-muted-foreground">
                  {query
                    ? `No enabled integrations match "${query}".`
                    : 'No integrations enabled.'}
                </p>
              </div>
            )}
          </div>
        </section>

        {/* DISABLED group — only in select-specific mode */}
        {accessMode === 'select-specific' && disabledRows.length > 0 && (
          <section
            aria-label="Disabled integrations"
            className="mt-4 overflow-hidden rounded-xl border"
          >
            <button
              type="button"
              className="flex w-full items-center gap-3 bg-muted/30 px-5 py-2.5 text-left"
              onClick={() => setDisabledSectionOpen((o) => !o)}
              aria-expanded={disabledSectionOpen}
            >
              {disabledSectionOpen ? (
                <ChevronDown
                  className="size-3.5 text-muted-foreground"
                  aria-hidden="true"
                />
              ) : (
                <ChevronRight
                  className="size-3.5 text-muted-foreground"
                  aria-hidden="true"
                />
              )}
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Disabled
              </span>
              <Badge
                variant="outline"
                aria-label="Disabled integration count"
                className="min-w-7 justify-center border-transparent bg-background px-2 py-0.5 font-medium tabular-nums"
              >
                {disabledRows.length}
              </Badge>
            </button>
            {disabledSectionOpen && (
              <div className="divide-y border-t">
                {disabledRows.map((row) => (
                  <IntegrationPolicyListRow
                    key={row.id}
                    row={row}
                    enabled={false}
                    accessMode={accessMode}
                    savingLocked={savingLocked}
                    connectedCount={DEMO_CONNECTED_COUNTS[row.id]}
                    onToggle={(checked) => handleToggle(row, checked)}
                  />
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}

// ── Filter popover panel ────────────────────────────────────────────────────

function FilterCheckbox({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: () => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm">
      <input
        type="checkbox"
        className="size-3.5 rounded"
        checked={checked}
        onChange={onChange}
      />
      {label}
    </label>
  );
}

function FilterPanel({
  filters,
  onToggleAuthType,
  onToggleStatus,
  onToggleType,
  onToggleNeedsConfig,
  onClearAll,
}: {
  filters: FilterState;
  onToggleAuthType: (v: 'oauth' | 'api-key') => void;
  onToggleStatus: (v: 'enabled' | 'disabled') => void;
  onToggleType: (v: 'built-in' | 'custom') => void;
  onToggleNeedsConfig: () => void;
  onClearAll: () => void;
}) {
  const section = (label: string, children: React.ReactNode) => (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      {children}
    </div>
  );

  return (
    <div className="space-y-4">
      {section(
        'Auth type',
        <>
          <FilterCheckbox
            checked={filters.authType.has('oauth')}
            label="OAuth"
            onChange={() => onToggleAuthType('oauth')}
          />
          <FilterCheckbox
            checked={filters.authType.has('api-key')}
            label="API key"
            onChange={() => onToggleAuthType('api-key')}
          />
        </>
      )}
      <hr />
      {section(
        'Status',
        <>
          <FilterCheckbox
            checked={filters.status.has('enabled')}
            label="Enabled"
            onChange={() => onToggleStatus('enabled')}
          />
          <FilterCheckbox
            checked={filters.status.has('disabled')}
            label="Disabled"
            onChange={() => onToggleStatus('disabled')}
          />
        </>
      )}
      <hr />
      {section(
        'Type',
        <>
          <FilterCheckbox
            checked={filters.type.has('built-in')}
            label="Built-in integrations"
            onChange={() => onToggleType('built-in')}
          />
          <FilterCheckbox
            checked={filters.type.has('custom')}
            label="Custom integrations"
            onChange={() => onToggleType('custom')}
          />
        </>
      )}
      <hr />
      {section(
        'Configuration',
        <FilterCheckbox
          checked={filters.needsConfig}
          label="Needs configuration"
          onChange={onToggleNeedsConfig}
        />
      )}
      {!isFilterEmpty(filters) && (
        <button
          type="button"
          className="text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground"
          onClick={onClearAll}
        >
          Clear all
        </button>
      )}
    </div>
  );
}

// ── Individual list row ─────────────────────────────────────────────────────

function IntegrationPolicyListRow({
  row,
  enabled,
  accessMode,
  savingLocked,
  connectedCount,
  onToggle,
}: {
  row: UnifiedRow;
  enabled: boolean;
  accessMode: AccessMode;
  savingLocked: boolean;
  connectedCount: number | undefined;
  onToggle: (checked: boolean) => void;
}) {
  const isLocked = row.lock !== null;
  const isDisabledToggle =
    isLocked || savingLocked || accessMode === 'enable-all';

  const tooltipContent = isLocked
    ? (row.lock?.message ?? 'Locked by policy.')
    : accessMode === 'enable-all'
      ? 'Enable all is active. Select specific above to configure individual integrations.'
      : null;

  return (
    <div className="flex h-[72px] items-center gap-4 px-5 py-4">
      <IntegrationLogo iconUrl={row.iconUrl} name={row.name} size={36} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{row.name}</p>
        <p className="truncate text-sm text-muted-foreground">
          {row.description}
        </p>
      </div>
      {connectedCount !== undefined && (
        <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
          <span
            className={cn(
              'size-1.5 rounded-full',
              connectedCount > 0 ? 'bg-green-500' : 'bg-muted-foreground/30'
            )}
            aria-hidden="true"
          />
          {connectedCount > 0 ? `${connectedCount} connected` : 'No accounts'}
        </span>
      )}
      <TooltipProvider delayDuration={100}>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="shrink-0">
              <Switch
                checked={enabled}
                disabled={isDisabledToggle}
                aria-label={`${row.name} access`}
                onCheckedChange={onToggle}
              />
            </span>
          </TooltipTrigger>
          {tooltipContent && (
            <TooltipContent className="max-w-56 text-center">
              {tooltipContent}
            </TooltipContent>
          )}
        </Tooltip>
      </TooltipProvider>
      {/* Row chevron removed: rows don't open a detail view yet. */}
    </div>
  );
}
