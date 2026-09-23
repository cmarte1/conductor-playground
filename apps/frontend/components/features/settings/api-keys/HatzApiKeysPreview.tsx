'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Plus, Trash2 } from 'lucide-react';
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
import {
  KeyCrossLink,
  KeySearchInput,
  KeyStatusBadge,
  RowActionsMenu,
  SecretKeyChip,
  SortableHead,
  nextSort,
  type SortState,
} from '@/components/features/settings/admin-access-settings/KeyTableParts';

// Hatz API keys: keys Hatz *issues* so your own code can call Hatz as you.
// Create → shown once → Done, the pattern for issued keys. Built on the same
// table parts as Vault's provider keys so the two read as one system.
// Local design sandbox: demo data only, no key is minted or stored.

type HatzKey = {
  id: string;
  name: string;
  preview: string;
  createdAt: number;
  expiresAt: number;
  lastUsed: string;
};

type SortKey = 'name' | 'status' | 'created' | 'expires' | 'lastUsed';

const EXPIRY_YEARS = 2;
const now = () => Date.now();

const DEMO_KEYS: HatzKey[] = [
  {
    id: 'hk-1',
    name: 'Zapier automation',
    preview: 'hatz_3f9a...c21e',
    createdAt: Date.parse('2026-09-03T15:00:00'),
    expiresAt: Date.parse('2028-09-03T15:00:00'),
    lastUsed: '2 hours ago',
  },
  {
    id: 'hk-2',
    name: 'Local scripts',
    preview: 'hatz_81bd...07fa',
    createdAt: Date.parse('2026-08-12T10:30:00'),
    expiresAt: Date.parse('2028-08-12T10:30:00'),
    lastUsed: 'Sep 18, 2026',
  },
  {
    id: 'hk-3',
    name: 'Old CI pipeline',
    preview: 'hatz_c0e4...9b13',
    createdAt: Date.parse('2024-07-30T09:00:00'),
    expiresAt: Date.parse('2026-07-30T09:00:00'),
    lastUsed: 'Jul 29, 2026',
  },
];

const formatDate = (time: number) =>
  new Date(time).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

const isExpired = (key: HatzKey) => key.expiresAt <= now();

/** Demo secret only; nothing here authenticates against Hatz. */
function generateDemoKey() {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return `hatz_${Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')}`;
}

const sortValue: Record<SortKey, (key: HatzKey) => string | number> = {
  name: (key) => key.name.toLowerCase(),
  status: (key) => (isExpired(key) ? 1 : 0),
  created: (key) => key.createdAt,
  expires: (key) => key.expiresAt,
  lastUsed: (key) => key.lastUsed,
};

export function HatzApiKeysPreview() {
  const [keys, setKeys] = useState<HatzKey[]>(DEMO_KEYS);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortState<SortKey>>({ key: 'created', dir: 'desc' });
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [created, setCreated] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  // The new row joins the table only once the modal closes (Done or ✕).
  const [pendingKey, setPendingKey] = useState<HatzKey | null>(null);
  const [revoking, setRevoking] = useState<HatzKey | null>(null);

  const onSort = (key: SortKey) =>
    setSort((prev) => nextSort(prev, key, ['created', 'expires']));

  const rows = useMemo(() => {
    const query = search.trim().toLowerCase();
    const matches = keys.filter((key) =>
      `${key.name} ${key.preview}`.toLowerCase().includes(query)
    );
    const value = sortValue[sort.key];
    return [...matches].sort((a, b) => {
      const [x, y] = [value(a), value(b)];
      const order = x < y ? -1 : x > y ? 1 : 0;
      return sort.dir === 'asc' ? order : -order;
    });
  }, [keys, search, sort]);

  const openCreate = () => {
    setName('');
    setCreated(null);
    setCopied(false);
    setCreateOpen(true);
  };

  const createKey = () => {
    const secret = generateDemoKey();
    const createdAt = now();
    setPendingKey({
      id: crypto.randomUUID(),
      name: name.trim(),
      preview: `${secret.slice(0, 9)}...${secret.slice(-4)}`,
      createdAt,
      expiresAt: new Date(createdAt).setFullYear(new Date(createdAt).getFullYear() + EXPIRY_YEARS),
      lastUsed: 'Never',
    });
    setCreated(secret);
  };

  const onCreateOpenChange = (open: boolean) => {
    setCreateOpen(open);
    if (open || !pendingKey) return;
    const added = pendingKey;
    setKeys((prev) => [added, ...prev]);
    setPendingKey(null);
  };

  const copyKey = async () => {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(created);
      setCopied(true);
    } catch (error) {
      // Clipboard can be blocked (permissions, insecure context); the key stays selectable.
      console.error('Copy to clipboard failed:', error);
    }
  };

  return (
    <div className="space-y-5">
      {/* Button bottom-aligns with the subcopy, not the title. */}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">Hatz API keys</h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Keys that let your own apps and scripts call Hatz as you.
          </p>
        </div>
        {/* Hatz purple primary, matching Vault's "Add credential". */}
        <Button className="gap-1.5" onClick={openCreate}>
          <Plus className="size-4" aria-hidden="true" />
          Create key
        </Button>
      </header>

      <section className="rounded-xl border bg-background px-4 pb-6 pt-4 shadow-sm">
        <div className="space-y-3">
          <KeySearchInput value={search} onChange={setSearch} />
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <SortableHead label="Name" column="name" sort={sort} onSort={onSort} className="w-[26%]" />
                <SortableHead label="Status" column="status" sort={sort} onSort={onSort} />
                <TableHead className="h-10 px-3 text-xs font-normal text-muted-foreground">
                  Secret key
                </TableHead>
                <SortableHead label="Created" column="created" sort={sort} onSort={onSort} />
                <SortableHead label="Expires" column="expires" sort={sort} onSort={onSort} />
                <SortableHead label="Last used" column="lastUsed" sort={sort} onSort={onSort} />
                <TableHead className="h-10 w-12 px-3">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((key) => (
                <TableRow key={key.id} className="hover:bg-transparent">
                  <TableCell className="px-3 py-3 text-sm text-foreground">{key.name}</TableCell>
                  <TableCell className="px-3 py-3">
                    {isExpired(key) ? (
                      <KeyStatusBadge tone="neutral">Expired</KeyStatusBadge>
                    ) : (
                      <KeyStatusBadge tone="active">Active</KeyStatusBadge>
                    )}
                  </TableCell>
                  <TableCell className="px-3 py-3">
                    <SecretKeyChip>{key.preview}</SecretKeyChip>
                  </TableCell>
                  <TableCell className="px-3 py-3 text-sm text-muted-foreground">
                    {formatDate(key.createdAt)}
                  </TableCell>
                  <TableCell className="px-3 py-3 text-sm text-muted-foreground">
                    {formatDate(key.expiresAt)}
                  </TableCell>
                  <TableCell className="px-3 py-3 text-sm text-muted-foreground">
                    {key.lastUsed}
                  </TableCell>
                  <TableCell className="px-3 py-3 text-right">
                    <RowActionsMenu
                      label={key.name}
                      actions={[
                        {
                          label: 'Revoke',
                          icon: Trash2,
                          destructive: true,
                          onSelect: () => setRevoking(key),
                        },
                      ]}
                    />
                  </TableCell>
                </TableRow>
              ))}
              {!rows.length && (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                    {keys.length
                      ? `No keys match “${search.trim()}”.`
                      : 'No Hatz API keys yet. Create one to call Hatz from your own code.'}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          <KeyCrossLink>
            Adding a key from OpenAI, Anthropic, or another service?{' '}
            <Link
              href="/workspace/tools?tab=vault"
              className="text-info-500 underline-offset-4 hover:text-info-500/80 hover:underline"
            >
              Go to Vault →
            </Link>
          </KeyCrossLink>
        </div>
      </section>

      {/* Create → shown once → Done */}
      <Dialog open={createOpen} onOpenChange={onCreateOpenChange}>
        <DialogContent className="max-w-[560px]">
          {created ? (
            <>
              <DialogHeader className="space-y-[9px]">
                <DialogTitle>API key created</DialogTitle>
                <DialogDescription className="pr-6">
                  Copy this value now. For security reasons it will only be shown once.
                </DialogDescription>
              </DialogHeader>
              <div className="flex items-center gap-2">
                {/* Two-row field; the key wraps inside it and never reflows when the button label changes. */}
                <code className="flex min-h-14 min-w-0 flex-1 items-center break-all rounded-md border bg-background px-3 py-2 font-mono text-xs leading-relaxed text-foreground">
                  {created}
                </code>
                {/* Fixed width fits both "Copy" and "Copied". */}
                <Button variant="outline" size="sm" className="w-20 shrink-0" onClick={copyKey}>
                  {copied ? 'Copied' : 'Copy'}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Treat API keys like passwords. Rotate if exposed.
              </p>
              <div className="flex justify-end">
                <Button
                  className="bg-[#171717] text-white hover:bg-[#171717]/85"
                  onClick={() => onCreateOpenChange(false)}
                >
                  Done
                </Button>
              </div>
            </>
          ) : (
            <>
              <DialogHeader className="space-y-[9px]">
                <DialogTitle>Create API key</DialogTitle>
                <DialogDescription className="pr-6">
                  API keys are organization-scoped and remain active even after the creator is
                  removed.
                </DialogDescription>
              </DialogHeader>
              {/* mt-2 on top of the dialog's 16px gap: subcopy -> label is 24px */}
              <form
                className="mt-2 space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (name.trim()) createKey();
                }}
              >
                <div className="space-y-2">
                  <Label htmlFor="hatz-key-name">Key name</Label>
                  <Input
                    id="hatz-key-name"
                    autoFocus
                    placeholder="e.g. Production key"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div className="flex justify-end">
                  <Button
                    type="submit"
                    disabled={!name.trim()}
                    className="bg-[#171717] text-white hover:bg-[#171717]/85"
                  >
                    Create key
                  </Button>
                </div>
              </form>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Revoke confirmation */}
      <Dialog open={Boolean(revoking)} onOpenChange={(open) => !open && setRevoking(null)}>
        <DialogContent className="max-w-md">
          <DialogTitle>Revoke this key?</DialogTitle>
          <DialogDescription>
            Anything using {revoking?.name ?? 'this key'} will stop working immediately. This
            can&apos;t be undone.
          </DialogDescription>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setRevoking(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="text-white hover:text-white"
              onClick={() => {
                setKeys((prev) => prev.filter((key) => key.id !== revoking?.id));
                setRevoking(null);
              }}
            >
              Revoke key
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
