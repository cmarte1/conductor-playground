'use client';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { KeyRound, Power, RefreshCw, Server, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/Table';
import { cn } from '@/lib/utils';
import { SelectMenu } from '../tools/SelectMenu';
import {
  KeyStatusBadge,
  RowActionsMenu,
  SortableHead,
  nextSort,
  type SortState,
  type StatusTone,
} from './KeyTableParts';

// MCP servers: one list for what used to be "Shared MCP servers" (prototype)
// and "MCP Inventory" (production). A server is the parent; its credentials are
// children managed from the server's drill-in. Workspace-wide permission to use
// custom MCP stays in Integration policies; Disable here manages one server.
// Local design sandbox: demo data only; checks are simulated, tokens discarded.

type McpCredential = {
  id: string;
  label: string;
  scope: 'workspace' | 'personal';
  addedBy: string;
};

type McpServer = {
  id: string;
  name: string;
  url: string;
  status: 'active' | 'unreachable' | 'checking';
  lastChecked: string;
  addedBy: string;
  addedAt: string;
  enabled: boolean;
  credentials: McpCredential[];
};

type SortKey = 'name' | 'status' | 'credentials' | 'lastChecked';

const CURRENT_USER = 'Chris Marte';
const QA_ADMIN = 'qa+msp1.msp.admin@hatzqa.com';

// Modelled on the three servers the real MCP inventory shows for the QA tenant,
// plus one healthy server so every state is visible.
const DEMO_SERVERS: McpServer[] = [
  {
    id: 'mcp-reporting',
    name: 'internal_reporting',
    url: 'https://mcp.reports.hatzqa.com/mcp',
    status: 'active',
    lastChecked: '3 hours ago',
    addedBy: CURRENT_USER,
    addedAt: 'Sep 12, 2026',
    enabled: true,
    credentials: [
      { id: 'c1', label: 'Reporting service token', scope: 'workspace', addedBy: CURRENT_USER },
      { id: 'c2', label: "Nick's read-only token", scope: 'personal', addedBy: 'Nick Kim' },
    ],
  },
  {
    id: 'mcp-acme-g2',
    name: 'acme_crm_g2_d3',
    url: 'https://working-became-readings-opera.trycloudflare.com/mcp',
    status: 'unreachable',
    lastChecked: '2 months ago',
    addedBy: QA_ADMIN,
    addedAt: 'Jul 24, 2026',
    enabled: true,
    credentials: [
      { id: 'c3', label: 'Acme CRM API token', scope: 'workspace', addedBy: QA_ADMIN },
    ],
  },
  {
    id: 'mcp-acme-g6',
    name: 'acme_crm_g6_d3',
    url: 'https://twenty-recipe-ruled-likes.trycloudflare.com/mcp',
    status: 'unreachable',
    lastChecked: '2 months ago',
    addedBy: QA_ADMIN,
    addedAt: 'Jul 24, 2026',
    enabled: true,
    credentials: [],
  },
  {
    id: 'mcp-e2e',
    name: 'e2e_custom',
    url: 'https://geographical-descending-cats-ask.trycloudflare.com/mcp',
    status: 'unreachable',
    lastChecked: '2 months ago',
    addedBy: QA_ADMIN,
    addedAt: 'Jul 27, 2026',
    enabled: false,
    credentials: [],
  },
];

function statusOf(server: McpServer): { label: string; tone: StatusTone } {
  if (!server.enabled) return { label: 'Disabled', tone: 'neutral' };
  if (server.status === 'checking') return { label: 'Checking', tone: 'busy' };
  if (server.status === 'unreachable') return { label: 'Unreachable', tone: 'warning' };
  return { label: 'Active', tone: 'active' };
}

function credentialSummary(server: McpServer): { text: string; muted: boolean } {
  const count = server.credentials.length;
  if (!count) return { text: 'No credential', muted: true };
  if (count === 1 && server.credentials[0].scope === 'workspace')
    return { text: 'Shared with workspace', muted: false };
  return { text: `${count} credentials`, muted: false };
}

const UNIT_MS: Record<string, number> = { minute: 60e3, hour: 3.6e6, day: 8.64e7, month: 2.6e9 };
const checkedRank = (server: McpServer) => {
  if (server.lastChecked === 'Just now') return Date.now();
  const m = server.lastChecked.match(/^(\d+)\s+(minute|hour|day|month)s?\s+ago$/);
  return m ? Date.now() - Number(m[1]) * UNIT_MS[m[2]] : 0;
};

const sortValue: Record<SortKey, (s: McpServer) => string | number> = {
  name: (s) => s.name.toLowerCase(),
  status: (s) => statusOf(s).label,
  credentials: (s) => s.credentials.length,
  lastChecked: checkedRank,
};

/** Demo reachability: tunnel URLs from old QA runs stay down; everything else answers. */
const simulateReachable = (url: string) => !url.includes('trycloudflare.com');

export function McpServersSection({
  title,
  description,
  addRequest,
  emptyState,
}: {
  title: string;
  description: string;
  /** Increment to open the Add MCP server dialog from outside (menu, Integrations link). */
  addRequest: number;
  emptyState: (onAdd: () => void) => ReactNode;
}) {
  const [servers, setServers] = useState<McpServer[]>(DEMO_SERVERS);
  const [sort, setSort] = useState<SortState<SortKey>>({ key: 'name', dir: 'asc' });
  const [addOpen, setAddOpen] = useState(false);
  const [manageId, setManageId] = useState<string | null>(null);
  const [removing, setRemoving] = useState<McpServer | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  useEffect(() => {
    if (addRequest > 0) setAddOpen(true);
  }, [addRequest]);

  const update = (id: string, patch: (s: McpServer) => McpServer) =>
    setServers((prev) => prev.map((s) => (s.id === id ? patch(s) : s)));

  const testConnection = (server: McpServer) => {
    update(server.id, (s) => ({ ...s, status: 'checking' }));
    timers.current.push(
      setTimeout(() => {
        update(server.id, (s) => ({
          ...s,
          status: simulateReachable(s.url) ? 'active' : 'unreachable',
          lastChecked: 'Just now',
        }));
      }, 1500)
    );
  };

  const rows = useMemo(() => {
    const value = sortValue[sort.key];
    return [...servers].sort((a, b) => {
      const [x, y] = [value(a), value(b)];
      const order = x < y ? -1 : x > y ? 1 : 0;
      return sort.dir === 'asc' ? order : -order;
    });
  }, [servers, sort]);

  const onSort = (key: SortKey) =>
    setSort((prev) => nextSort(prev, key, ['credentials', 'lastChecked']));

  const managed = servers.find((s) => s.id === manageId) ?? null;

  return (
    <section className="rounded-xl border bg-background px-4 pb-6 pt-4 shadow-sm">
      <h5 className="text-sm font-medium text-foreground">{title}</h5>
      <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
      <div className="mt-4">
        {!servers.length ? (
          emptyState(() => setAddOpen(true))
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <SortableHead label="Server" column="name" sort={sort} onSort={onSort} className="w-[44%]" />
                <SortableHead label="Status" column="status" sort={sort} onSort={onSort} />
                <SortableHead label="Credentials" column="credentials" sort={sort} onSort={onSort} />
                <SortableHead label="Last checked" column="lastChecked" sort={sort} onSort={onSort} />
                <TableHead className="h-10 w-12 px-3">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((server) => {
                const status = statusOf(server);
                const creds = credentialSummary(server);
                return (
                  <TableRow
                    key={server.id}
                    onClick={() => setManageId(server.id)}
                    className="cursor-pointer"
                  >
                    <TableCell className="px-3 py-3">
                      <div className="flex items-center gap-3">
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-white shadow-sm ring-1 ring-black/[0.06]">
                          <Server className="size-4 text-muted-foreground" aria-hidden="true" />
                        </span>
                        <div className="min-w-0">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setManageId(server.id);
                            }}
                            className="block max-w-full truncate text-left text-sm text-foreground underline-offset-4 hover:underline"
                          >
                            {server.name}
                          </button>
                          <span className="block truncate font-mono text-xs text-muted-foreground">
                            {server.url}
                          </span>
                          <span className="block truncate text-xs text-muted-foreground">
                            added by {server.addedBy}, {server.addedAt.replace(/, \d{4}$/, '')}
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
                        creds.muted ? 'text-muted-foreground/70' : 'text-muted-foreground'
                      )}
                    >
                      {creds.text}
                    </TableCell>
                    <TableCell className="px-3 py-3 text-sm text-muted-foreground">
                      {server.lastChecked}
                    </TableCell>
                    <TableCell className="px-3 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <RowActionsMenu
                        label={server.name}
                        actions={[
                          {
                            label: 'Test connection',
                            icon: RefreshCw,
                            onSelect: () => testConnection(server),
                          },
                          {
                            label: 'Manage credentials',
                            icon: KeyRound,
                            onSelect: () => setManageId(server.id),
                          },
                          {
                            label: server.enabled ? 'Disable' : 'Enable',
                            icon: Power,
                            onSelect: () => update(server.id, (s) => ({ ...s, enabled: !s.enabled })),
                          },
                          {
                            label: 'Remove',
                            icon: Trash2,
                            destructive: true,
                            onSelect: () => setRemoving(server),
                          },
                        ]}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      <AddMcpServerDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onAdded={(server) => {
          setServers((prev) => [server, ...prev]);
          testConnection(server);
        }}
      />

      <ManageServerDialog
        server={managed}
        onClose={() => setManageId(null)}
        onTest={() => managed && testConnection(managed)}
        onChange={(patch) => managed && update(managed.id, patch)}
      />

      <Dialog open={Boolean(removing)} onOpenChange={(open) => !open && setRemoving(null)}>
        <DialogContent className="max-w-md">
          <DialogTitle>Remove {removing?.name}?</DialogTitle>
          <DialogDescription>
            Agents lose the tools this server provides, and its{' '}
            {removing?.credentials.length === 1
              ? 'credential is'
              : `${removing?.credentials.length ?? 0} credentials are`}{' '}
            deleted. This can&apos;t be undone.
          </DialogDescription>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setRemoving(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="text-white hover:text-white"
              onClick={() => {
                setServers((prev) => prev.filter((s) => s.id !== removing?.id));
                setRemoving(null);
              }}
            >
              Remove server
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function validateServerUrl(value: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return 'Enter a valid HTTPS server URL.';
  }
  if (parsed.protocol !== 'https:') return 'Server URL must use HTTPS.';
  if (parsed.username || parsed.password || parsed.search)
    return "Don't put passwords, tokens, or query parameters in the URL. Add them as a credential.";
  return null;
}

function AddMcpServerDialog({
  open,
  onOpenChange,
  onAdded,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdded: (server: McpServer) => void;
}) {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [token, setToken] = useState('');
  const [error, setError] = useState('');

  const close = (next: boolean) => {
    if (!next) {
      setName('');
      setUrl('');
      setToken('');
      setError('');
    }
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-w-[560px]">
        <DialogHeader className="space-y-[9px]">
          <DialogTitle>Add MCP server</DialogTitle>
          <DialogDescription className="pr-6">
            Connect a server so agents in this workspace can use its tools. We&apos;ll check
            that it responds as soon as you add it.
          </DialogDescription>
        </DialogHeader>
        <form
          className="mt-2 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            const problem = validateServerUrl(url.trim());
            if (problem) return setError(problem);
            onAdded({
              id: crypto.randomUUID(),
              name: name.trim(),
              url: url.trim(),
              status: 'checking',
              lastChecked: 'Just now',
              addedBy: CURRENT_USER,
              addedAt: new Date().toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              }),
              enabled: true,
              credentials: token.trim()
                ? [
                    {
                      id: crypto.randomUUID(),
                      label: `${name.trim()} token`,
                      scope: 'workspace',
                      addedBy: CURRENT_USER,
                    },
                  ]
                : [],
            });
            close(false);
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="mcp-server-name">Name</Label>
            <Input
              id="mcp-server-name"
              autoFocus
              placeholder="e.g. Internal reporting"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="mcp-server-url">Server URL</Label>
            <Input
              id="mcp-server-url"
              type="url"
              placeholder="https://your-service.example/mcp"
              value={url}
              aria-invalid={Boolean(error)}
              onChange={(e) => {
                setUrl(e.target.value);
                setError('');
              }}
            />
            {error && (
              <p role="alert" className="text-xs text-destructive">
                {error}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="mcp-server-token">
              Credential <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="mcp-server-token"
              type="password"
              autoComplete="off"
              placeholder="Bearer token or API key"
              value={token}
              onChange={(e) => setToken(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Shared with the workspace. You can add more credentials later.
            </p>
          </div>
          <div className="flex justify-end pt-1">
            <Button type="submit" disabled={!name.trim() || !url.trim()}>
              Add server
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ManageServerDialog({
  server,
  onClose,
  onTest,
  onChange,
}: {
  server: McpServer | null;
  onClose: () => void;
  onTest: () => void;
  onChange: (patch: (s: McpServer) => McpServer) => void;
}) {
  const [label, setLabel] = useState('');
  const [token, setToken] = useState('');
  const [scope, setScope] = useState<'workspace' | 'personal'>('workspace');
  const [adding, setAdding] = useState(false);

  const resetForm = () => {
    setLabel('');
    setToken('');
    setScope('workspace');
    setAdding(false);
  };

  const status = server ? statusOf(server) : null;

  return (
    <Dialog
      open={Boolean(server)}
      onOpenChange={(open) => {
        if (!open) {
          resetForm();
          onClose();
        }
      }}
    >
      <DialogContent className="max-w-[640px]">
        {server && status && (
          <>
            <DialogHeader className="space-y-[9px]">
              <DialogTitle className="flex items-center gap-2">
                <Server className="size-4 text-muted-foreground" aria-hidden="true" />
                {server.name}
                <KeyStatusBadge tone={status.tone}>{status.label}</KeyStatusBadge>
              </DialogTitle>
              <DialogDescription className="pr-6">
                <span className="font-mono text-xs">{server.url}</span>
                <br />
                Checked {server.lastChecked === 'Just now' ? 'just now' : server.lastChecked}.
                {server.status === 'unreachable' &&
                  ' The server didn’t respond. It may be down, or the URL may have changed.'}
              </DialogDescription>
            </DialogHeader>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                disabled={server.status === 'checking' || !server.enabled}
                onClick={onTest}
              >
                <RefreshCw className="size-3.5" aria-hidden="true" />
                Test connection
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => onChange((s) => ({ ...s, enabled: !s.enabled }))}
              >
                <Power className="size-3.5" aria-hidden="true" />
                {server.enabled ? 'Disable server' : 'Enable server'}
              </Button>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-foreground">Credentials</p>
                {!adding && (
                  <Button variant="outline" size="sm" onClick={() => setAdding(true)}>
                    Add credential
                  </Button>
                )}
              </div>
              <div className="divide-y rounded-lg border">
                {server.credentials.map((cred) => (
                  <div key={cred.id} className="flex items-center gap-3 px-3 py-2.5">
                    <KeyRound className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-foreground">{cred.label}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {cred.scope === 'workspace' ? 'Shared with workspace' : 'Personal'} · added
                        by {cred.addedBy}
                      </p>
                    </div>
                    <button
                      type="button"
                      aria-label={`Remove ${cred.label}`}
                      className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-destructive"
                      onClick={() =>
                        onChange((s) => ({
                          ...s,
                          credentials: s.credentials.filter((c) => c.id !== cred.id),
                        }))
                      }
                    >
                      <Trash2 className="size-4" aria-hidden="true" />
                    </button>
                  </div>
                ))}
                {!server.credentials.length && !adding && (
                  <p className="px-3 py-4 text-sm text-muted-foreground">
                    No credential yet. Agents can only use this server if it accepts
                    unauthenticated requests.
                  </p>
                )}
                {adding && (
                  <form
                    className="space-y-3 p-3"
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!label.trim() || !token.trim()) return;
                      onChange((s) => ({
                        ...s,
                        credentials: [
                          ...s.credentials,
                          {
                            id: crypto.randomUUID(),
                            label: label.trim(),
                            scope,
                            addedBy: CURRENT_USER,
                          },
                        ],
                      }));
                      resetForm();
                    }}
                  >
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="mcp-cred-label">Label</Label>
                        <Input
                          id="mcp-cred-label"
                          autoFocus
                          placeholder="e.g. Service token"
                          value={label}
                          onChange={(e) => setLabel(e.target.value)}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="mcp-cred-scope">Who can use it</Label>
                        <SelectMenu
                          id="mcp-cred-scope"
                          value={scope}
                          onChange={(value) => setScope(value === 'personal' ? 'personal' : 'workspace')}
                          placeholder="Choose"
                          options={[
                            { value: 'workspace', label: 'Everyone in the workspace' },
                            { value: 'personal', label: 'Just me' },
                          ]}
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="mcp-cred-token">Token</Label>
                      <Input
                        id="mcp-cred-token"
                        type="password"
                        autoComplete="off"
                        placeholder="Bearer token or API key"
                        value={token}
                        onChange={(e) => setToken(e.target.value)}
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="ghost" size="sm" onClick={resetForm}>
                        Cancel
                      </Button>
                      <Button type="submit" size="sm" disabled={!label.trim() || !token.trim()}>
                        Save credential
                      </Button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
