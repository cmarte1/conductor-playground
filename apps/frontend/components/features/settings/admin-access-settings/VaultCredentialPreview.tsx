'use client';

import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react';
import { ArrowRight, ChevronDown, Info, KeyRound, Trash2 } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/Popover';
import { AddApiKeyDialog } from './AddApiKeyDialog';
import { McpServersSection } from './McpServersSection';
import {
  ApiKeyIllustration,
  McpServerIllustration,
  SharedCredentialIllustration,
} from './VaultEmptyIllustrations';
import { CredentialProviderLogo } from './CredentialProviderLogo';
import { FloatingNotice, LogoTile, StatusPill, type Notice } from '../tools/ToolCard';
import Link from 'next/link';
import { ApiKeysTable, CURRENT_USER } from './ApiKeysTable';
import { KeyCrossLink } from './KeyTableParts';
import {
  ShareAccessPanel,
  ShareConfirmActions,
  ShareConfirmBody,
  audienceOf,
  needsShareConfirmation,
  peopleCount,
  peopleLabel,
  runsAsOf,
  shareConfirmTitle,
  type CredentialKind,
  type RunsAs,
  type ShareAudience,
} from './credentialSharing';

// What you do in each section, said once. `section` sits under the section title;
// `menu` is the one-line version for the Add credential menu (it has to fit one row).
// `section` also says what sharing does there, since that differs by section:
// keys add access; shared connections and MCP credentials replace people's own.
const CREDENTIAL_TYPE_COPY = {
  apiKey: {
    section:
      'Paste a key from a service like OpenAI or Stripe so agents can use it. Sharing adds access; no one can view the key.',
    menu: 'Paste a key from OpenAI, Stripe, and more',
  },
  connection: {
    section:
      "Connect a tool once with a shared account. Sharing replaces each person's own connection, so their actions run as that account.",
    menu: 'Connect a tool once with a shared account',
  },
  mcp: {
    section:
      "Connect a server your team runs to give agents new tools. A shared credential replaces each person's own sign-in to it.",
    menu: 'Connect a server that adds new tools',
  },
} as const;

/** Header status for the credential modal; replaces the old connection banner. */
function EditorStatusPill({ item, busy }: { item: PreviewCredential; busy: boolean }) {
  if (!item.enabled) return <StatusPill tone="neutral">Disabled</StatusPill>;
  if (busy) return <StatusPill tone="neutral">Checking…</StatusPill>;
  if (item.state === 'failed') return <StatusPill tone="warning">Needs review</StatusPill>;
  if (item.state === 'connected') return <StatusPill tone="success">Connected</StatusPill>;
  return <StatusPill tone="neutral">Not tested</StatusPill>;
}

/** One line on who loses access, then the permanence. */
function deleteImpact(item: PreviewCredential | null): string {
  if (!item) return "This can't be undone.";
  const audience = audienceOf(item);
  const people = audience.workspace
    ? `Everyone in the workspace (${peopleLabel(peopleCount(audience))})`
    : audience.roles.length
      ? `${audience.roles.join(', ')} (${peopleLabel(peopleCount(audience))})`
      : '';
  const names = [people, ...audience.agents].filter(Boolean);
  if (!names.length) return "Nothing else uses this yet. This can't be undone.";
  const who =
    names.length === 1
      ? names[0]
      : names.length === 2
        ? `${names[0]} and ${names[1]}`
        : `${names[0]} and ${names.length - 1} others`;
  return `${who} will lose access right away. This can't be undone.`;
}

type EmptyStateProps = {
  illustration: ReactNode;
  title: string;
  body: string;
  action?: { label: string; onClick: () => void };
};

function EmptyState({ illustration, title, body, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center py-8 text-center">
      {illustration}
      <p className="mt-4 text-sm font-medium text-foreground">{title}</p>
      <p className="mt-1.5 max-w-xs text-sm leading-relaxed text-muted-foreground">{body}</p>
      {action && (
        <Button
          size="sm"
          className="mt-4 h-8 bg-[#171717] text-white hover:bg-[#171717]/85"
          onClick={action.onClick}
        >
          {action.label}
        </Button>
      )}
    </div>
  );
}

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/Dialog';
import { cn } from '@/lib/utils';

type ConnectionState = 'untested' | 'testing' | 'connected' | 'failed';
type Section = 'Connection' | 'Access' | 'Details';
export interface PreviewCredential {
  id: string;
  /** Provider API key (default) or shared connection. */
  kind?: CredentialKind;
  service?: string;
  createdAt?: string;
  modifiedAt?: string;
  /** Who besides the owner can use it. Agents live in `agents`. */
  sharing?: { workspace: boolean; roles: string[] };
  /** The account the connection check reported. */
  runsAs?: RunsAs;
  /** Defaults to the current user; only the creator can edit a key. */
  createdBy?: string;
  /** Masked preview shown in the key's detail view; never a real secret. */
  keyPreview?: string;
  /** Human-readable last use, e.g. "2 hours ago" or "Never". */
  lastUsed?: string;
  name: string;
  organization: string;
  state: ConnectionState;
  enabled: boolean;
  agents: string[];
  activity: string[];
}
// The signed-in demo user owns new credentials.
const CURRENT_TEAMMATE = { name: 'Chris Marte', email: 'cmarte@hatz.ai' };
export const INITIAL_PREVIEW_CREDENTIALS: PreviewCredential[] = [
  {
    id: 'demo-openai-01',
    name: 'OpenAI account',
    organization: '',
    state: 'connected',
    enabled: true,
    agents: ['Research assistant'],
    sharing: { workspace: false, roles: ['Engineering'] },
    createdAt: 'Sep 22, 2026, 10:14 AM',
    keyPreview: 'sk-proj_2224...47d6',
    lastUsed: '12 minutes ago',
    activity: [
      'Research assistant connected · Chris Marte',
      'Connection tested successfully · Chris Marte',
      'Credential created · Chris Marte',
    ],
  },
  ...(
    [
      ['demo-anthropic-01', 'Nick - Test', 'Anthropic', 'Nick Kim', 'Sep 22, 2026, 9:02 AM', 'sk-ant-_2220...3fa6', true, '1 hour ago', ['Customer success agent', 'Analytics reporter']],
      ['demo-openai-02', '1Password Key', 'OpenAI', 'Alex Kim', 'Sep 22, 2026, 8:40 AM', 'sk-proj_222b...d3b8', true, 'Sep 20, 2026', ['Analytics reporter']],
      ['demo-anthropic-02', 'Marco - test', 'Anthropic', 'Marco Marena', 'Sep 21, 2026, 4:18 PM', 'sk-ant-_2228...8f77', true, 'Never', []],
      ['demo-openai-03', 'Development Key', 'OpenAI', 'Alex Kim', 'Sep 17, 2026, 11:30 AM', 'sk-proj_222e...0455', false, 'Aug 30, 2026', []],
    ] as const
  ).map(([id, name, service, createdBy, createdAt, keyPreview, enabled, lastUsed, agents]) => ({
    id,
    name,
    service,
    createdBy,
    createdAt,
    keyPreview,
    lastUsed,
    organization: '',
    state: 'connected' as const,
    enabled,
    agents: [...agents],
    activity: [`Credential created · ${createdBy}`],
  })),
  // Shared connections. GitHub is the risky pattern on purpose: a personal
  // account shared with the whole workspace.
  ...(
    [
      ['demo-conn-github', 'GitHub (engineering)', 'GitHub', 'Jordan Lee', 'Sep 18, 2026, 2:10 PM', 'ghp_8Kq2...x91c', '5 minutes ago', { handle: '@jordanlee', kind: 'personal' }, { workspace: true, roles: [] }, ['Research assistant']],
      ['demo-conn-linear', 'Linear team bot', 'Linear', 'Nick Kim', 'Sep 12, 2026, 9:30 AM', 'lin_api_4f2a...77be', '1 hour ago', { handle: 'hatz-bot@hatz.ai', kind: 'service' }, { workspace: false, roles: ['Engineering', 'Workspace admins'] }, []],
      ['demo-conn-hubspot', 'HubSpot sales', 'HubSpot', 'Marco Marena', 'Sep 15, 2026, 11:05 AM', 'pat-na1-...3d0e', 'Sep 27, 2026', { handle: 'sales-ops@hatz.ai', kind: 'service' }, { workspace: false, roles: ['Sales', 'Customer success'] }, ['Customer success agent']],
    ] as const
  ).map(([id, name, service, createdBy, createdAt, keyPreview, lastUsed, runsAs, sharing, agents]) => ({
    id,
    kind: 'connection' as const,
    name,
    service,
    createdBy,
    createdAt,
    keyPreview,
    lastUsed,
    runsAs: { ...runsAs },
    sharing: { workspace: sharing.workspace, roles: [...sharing.roles] },
    organization: '',
    state: 'connected' as const,
    enabled: true,
    agents: [...agents],
    activity: [
      `Shared with ${sharing.workspace ? 'everyone in the workspace' : sharing.roles.join(', ')} · ${createdBy}`,
      `Connected as ${runsAs.handle} · ${createdBy}`,
      `Credential created · ${createdBy}`,
    ],
  })),
];

function ProviderIcon({ service = 'OpenAI' }: { service?: string }) {
  return (
    <span className="flex size-11 shrink-0 items-center justify-center rounded-xl border bg-background text-foreground">
      <CredentialProviderLogo service={service} size={28} />
    </span>
  );
}

/** Local design sandbox only. No network calls, secret persistence, or real authorization. */
export function VaultCredentialPreview({
  testResult = 'success',
  credentials: providedCredentials,
  onCredentialsChange,
  openCredential,
  onViewConnections,
  addMcpRequest = 0,
}: {
  testResult?: string;
  credentials?: PreviewCredential[];
  onCredentialsChange?: Dispatch<SetStateAction<PreviewCredential[]>>;
  openCredential?: { id: string; request: number };
  onViewConnections?: () => void;
  /** Increment to open Add MCP server (e.g. from the Integrations "Don't see your tool?" link). */
  addMcpRequest?: number;
}) {
  const [localCredentials, setLocalCredentials] = useState<PreviewCredential[]>(
    INITIAL_PREVIEW_CREDENTIALS
  );
  const credentials = providedCredentials ?? localCredentials;
  const setCredentials = onCredentialsChange ?? setLocalCredentials;
  const [search, setSearch] = useState('');
  const [connectionSearch, setConnectionSearch] = useState('');
  const [addKeyOpen, setAddKeyOpen] = useState(false);
  const [addKind, setAddKind] = useState<CredentialKind>('apiKey');
  const [revealId, setRevealId] = useState<string | null>(null);
  const [mcpAddRequest, setMcpAddRequest] = useState(0);
  useEffect(() => {
    if (addMcpRequest > 0) setMcpAddRequest((n) => n + 1);
  }, [addMcpRequest]);
  // Remounts the dialog so every add starts fresh.
  const [addKeyVersion, setAddKeyVersion] = useState(0);
  const openAddKey = (kind: CredentialKind = 'apiKey') => {
    setAddKind(kind);
    setAddKeyVersion((v) => v + 1);
    setAddKeyOpen(true);
  };
  const [addedNotice, setAddedNotice] = useState<Notice | null>(null);
  useEffect(() => {
    if (!addedNotice) return;
    const timer = setTimeout(() => setAddedNotice(null), 4000);
    return () => clearTimeout(timer);
  }, [addedNotice]);
  const [editor, setEditor] = useState<PreviewCredential | null>(null);
  const [section, setSection] = useState<Section>('Connection');
  // A demo input is deliberately never copied into a credential record.
  const [secret, setSecret] = useState('');
  const [replacing, setReplacing] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  // Delete started from a card's menu (editor closed); falls back to the open editor.
  const [pendingDelete, setPendingDelete] = useState<PreviewCredential | null>(null);
  const deleteTarget = pendingDelete ?? editor;
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  // Access tab edits a draft; widening to everyone or sharing a personal account confirms first.
  const [accessDraft, setAccessDraft] = useState<ShareAudience | null>(null);
  const [accessVersion, setAccessVersion] = useState(0);
  const [confirmAccess, setConfirmAccess] = useState(false);
  const testTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handledOpenRequest = useRef<number | null>(null);
  useEffect(() => {
    if (
      !openCredential ||
      handledOpenRequest.current === openCredential.request
    )
      return;
    const item = credentials.find(
      (credential) => credential.id === openCredential.id
    );
    if (item) {
      setEditor(item);
      setSection('Connection');
      setAccessDraft(audienceOf(item));
      handledOpenRequest.current = openCredential.request;
    }
  }, [openCredential, credentials]);
  useEffect(
    () => () => {
      if (testTimer.current) clearTimeout(testTimer.current);
    },
    []
  );
  const saved = editor
    ? credentials.find((item) => item.id === editor.id)
    : undefined;
  const dirty = Boolean(
    editor &&
      (!saved ||
        secret ||
        editor.name !== saved.name ||
        editor.organization !== saved.organization)
  );
  const busy = editor?.state === 'testing';
  const editorKind: CredentialKind = editor?.kind ?? 'apiKey';
  const secretNoun = editorKind === 'apiKey' ? 'key' : 'token';
  const savedAudience = saved ? audienceOf(saved) : null;
  const accessDirty = Boolean(
    accessDraft &&
      savedAudience &&
      JSON.stringify(accessDraft) !== JSON.stringify(savedAudience)
  );

  function persist(next: PreviewCredential) {
    setEditor(next);
    setCredentials((items) =>
      items.some((item) => item.id === next.id)
        ? items.map((item) => (item.id === next.id ? next : item))
        : [next, ...items]
    );
  }
  function record(next: PreviewCredential, event: string) {
    const recorded = {
      ...next,
      createdAt: next.createdAt ?? new Date().toLocaleString(),
      modifiedAt: new Date().toLocaleString(),
      activity: [`${event} · Chris Marte · Just now`, ...next.activity],
    };
    persist(recorded);
    return recorded;
  }
  function closeEditor() {
    if (testTimer.current) clearTimeout(testTimer.current);
    setEditor(null);
    setSecret('');
    setError('');
    setReplacing(false);
    setConfirmDiscard(false);
  }
  function openEditor(item: PreviewCredential) {
    setEditor(item);
    setSection('Connection');
    setSecret('');
    setReplacing(false);
    setError('');
    setNotice('');
    setAccessDraft(audienceOf(item));
    setAccessVersion((v) => v + 1);
  }
  function applyAccess(next: ShareAudience) {
    if (!editor) return;
    const who = next.workspace
      ? 'everyone in the workspace'
      : next.roles.length
        ? next.roles.join(', ')
        : 'only the owner';
    record(
      { ...editor, agents: next.agents, sharing: { workspace: next.workspace, roles: next.roles } },
      `Access changed: ${who}${next.agents.length ? ` + ${next.agents.join(', ')}` : ''}`
    );
    setConfirmAccess(false);
    setNotice('Access updated.');
  }
  function save() {
    if (!editor) return;
    if (!editor.name.trim() || ((!saved || replacing) && !secret.trim())) {
      setError('Add a credential name and a demo API key before saving.');
      return;
    }
    const changedKey = !saved || replacing;
    const next = {
      ...editor,
      name: editor.name.trim(),
    };
    const recorded = record(
      next,
      !saved
        ? 'Credential created'
        : replacing
          ? 'Credential replaced; connection needs testing'
          : 'Credential details updated'
    );
    setSecret('');
    setReplacing(false);
    setError('');
    setNotice('Credential saved.');
    if (changedKey) {
      setSection('Connection');
      runTest(recorded);
    }
  }
  function testConnection() {
    if (!editor || !saved || dirty || !editor.enabled || busy) return;
    runTest(editor);
  }
  function runTest(current: PreviewCredential) {
    setEditor({ ...current, state: 'testing' });
    setNotice('');
    testTimer.current = setTimeout(() => {
      record(
        {
          ...current,
          state: testResult === 'failure' ? 'failed' : 'connected',
        },
        testResult === 'failure'
          ? 'Connection test failed'
          : 'Connection tested successfully'
      );
      testTimer.current = null;
    }, 850);
  }

  return (
    <div className="space-y-6">
      <div className="rounded-[15px] border bg-muted/40 p-0.5">
        <div className="flex flex-wrap items-center justify-between gap-4 px-4 py-3">
          <div>
            <h4 className="text-sm font-medium text-foreground">
              Saved credentials
            </h4>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Keys and connections your agents use to reach other services.
            </p>
          </div>
            <Popover>
              <PopoverTrigger asChild>
                <Button className="gap-2 pr-3.5">
                  Add credential
                  <ChevronDown className="size-3.5 opacity-70" aria-hidden="true" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-80 rounded-xl p-2">
                <button
                  type="button"
                  className="block w-full rounded-[3px] px-3 py-2 text-left transition-colors hover:bg-muted"
                  onClick={() => openAddKey('apiKey')}
                >
                  <p className="text-sm font-medium">Provider API key</p>
                  <p className="truncate text-xs text-muted-foreground">{CREDENTIAL_TYPE_COPY.apiKey.menu}</p>
                </button>
                <button
                  type="button"
                  className="block w-full rounded-[3px] px-3 py-2 text-left transition-colors hover:bg-muted"
                  onClick={() => openAddKey('connection')}
                >
                  <p className="text-sm font-medium">Shared connection</p>
                  <p className="truncate text-xs text-muted-foreground">{CREDENTIAL_TYPE_COPY.connection.menu}</p>
                </button>
                <button
                  type="button"
                  className="block w-full rounded-[3px] px-3 py-2 text-left transition-colors hover:bg-muted"
                  onClick={() => setMcpAddRequest((n) => n + 1)}
                >
                  <p className="text-sm font-medium">MCP server</p>
                  <p className="truncate text-xs text-muted-foreground">{CREDENTIAL_TYPE_COPY.mcp.menu}</p>
                </button>
              </PopoverContent>
            </Popover>
        </div>
        <div className="space-y-0.5">
          <section className="rounded-xl border bg-background px-4 pb-6 pt-4 shadow-sm">
            <h5 className="text-sm font-medium text-foreground">Provider API keys</h5>
            <p className="mt-0.5 text-sm text-muted-foreground">{CREDENTIAL_TYPE_COPY.apiKey.section}</p>
            <div className="mt-4">
              <ApiKeysTable
                credentials={credentials.filter((c) => (c.kind ?? 'apiKey') === 'apiKey')}
                revealId={revealId}
                search={search}
                onSearchChange={setSearch}
                onOpen={openEditor}
                onToggleActive={(item) =>
                  setCredentials((items) =>
                    items.map((c) => (c.id === item.id ? { ...c, enabled: !c.enabled } : c))
                  )
                }
                onDelete={(item) => {
                  setPendingDelete(item);
                  setConfirmDelete(true);
                }}
                emptyState={
                  <EmptyState
                    illustration={<ApiKeyIllustration />}
                    title="No provider API keys yet"
                    body="Paste a key from a service like OpenAI or Stripe so your agents can use it."
                    action={{ label: 'Add provider API key', onClick: () => openAddKey('apiKey') }}
                  />
                }
              />
              <KeyCrossLink>
                Need a key so your own code can call Hatz?{' '}
                <Link
                  href="/workspace/api-keys"
                  className="text-info-500 underline-offset-4 hover:text-info-500/80 hover:underline"
                >
                  Go to Hatz API keys →
                </Link>
              </KeyCrossLink>
            </div>
          </section>

          <section className="rounded-xl border bg-background px-4 pb-6 pt-4 shadow-sm">
            <h5 className="text-sm font-medium text-foreground">Shared connections</h5>
            <p className="mt-0.5 text-sm text-muted-foreground">{CREDENTIAL_TYPE_COPY.connection.section}</p>
            <div className="mt-4">
              <ApiKeysTable
                kind="connection"
                credentials={credentials.filter((c) => c.kind === 'connection')}
                revealId={revealId}
                search={connectionSearch}
                onSearchChange={setConnectionSearch}
                onOpen={openEditor}
                onToggleActive={(item) =>
                  setCredentials((items) =>
                    items.map((c) => (c.id === item.id ? { ...c, enabled: !c.enabled } : c))
                  )
                }
                onDelete={(item) => {
                  setPendingDelete(item);
                  setConfirmDelete(true);
                }}
                emptyState={
                  <EmptyState
                    illustration={<SharedCredentialIllustration />}
                    title="No shared connections yet"
                    body="Connect a tool once with a shared account so people don't each connect their own."
                    action={{ label: 'Add shared connection', onClick: () => openAddKey('connection') }}
                  />
                }
              />
            </div>
          </section>

          {/* One list for MCP servers; each server carries its credentials. */}
          <McpServersSection
            title="MCP servers"
            description={CREDENTIAL_TYPE_COPY.mcp.section}
            addRequest={mcpAddRequest}
            emptyState={(onAdd) => (
              <EmptyState
                illustration={<McpServerIllustration />}
                title="No MCP servers yet"
                body="Connect a server once and every agent in the workspace can use its tools."
                action={{ label: 'Add MCP server', onClick: onAdd }}
              />
            )}
          />

          <ManagedElsewhere />
        </div>
      </div>

      <AddApiKeyDialog
        key={addKeyVersion}
        kind={addKind}
        open={addKeyOpen}
        onOpenChange={setAddKeyOpen}
        currentUser={CURRENT_TEAMMATE}
        onAdded={(key) => {
          // The dialog already checked the key and collected agent access.
          const id = crypto.randomUUID();
          setRevealId(id);
          const { audience } = key;
          const sharedWith = audience.workspace
            ? 'everyone in the workspace'
            : audience.roles.join(', ');
          setCredentials((items) => [
            {
              id,
              kind: key.kind,
              runsAs: key.runsAs,
              sharing: { workspace: audience.workspace, roles: audience.roles },
              name: key.name,
              service: key.service,
              keyPreview: key.keyPreview,
              organization: key.organization,
              createdBy: CURRENT_USER,
              createdAt: new Date().toLocaleString('en-US', {
                dateStyle: 'medium',
                timeStyle: 'short',
              }),
              lastUsed: 'Never',
              state: 'connected',
              enabled: true,
              agents: audience.agents,
              activity: [
                ...(sharedWith ? [`Shared with ${sharedWith} · ${CURRENT_USER} · Just now`] : []),
                ...audience.agents.map((agent) => `${agent} connected · ${CURRENT_USER} · Just now`),
                `Connected as ${key.runsAs.handle} · ${CURRENT_USER} · Just now`,
                `Credential created · ${CURRENT_USER} · Just now`,
              ],
            },
            ...items,
          ]);
          // The top-center toast already confirmed the check; the new row is the confirmation now.
        }}
      />
      <FloatingNotice notice={addedNotice} />

      <Dialog
        open={Boolean(editor)}
        onOpenChange={(open) => {
          if (!open && !busy) {
            if (dirty) setConfirmDiscard(true);
            else closeEditor();
          }
        }}
      >
        <DialogContent
          className="flex h-[min(690px,90dvh)] w-[calc(100%-2rem)] max-w-[1000px] flex-col gap-0 overflow-hidden p-0"
          onEscapeKeyDown={(event) => {
            if (busy) event.preventDefault();
          }}
        >
          {editor && (
            <>
              <header className="flex shrink-0 items-center gap-4 border-b px-7 py-6 pr-14">
                <ProviderIcon service={editor.service} />
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-center gap-2">
                    <DialogTitle className="truncate text-base font-medium leading-6 tracking-normal">
                      {editor.name || 'OpenAI account'}
                    </DialogTitle>
                    {saved && <EditorStatusPill item={editor} busy={busy} />}
                  </div>
                  <DialogDescription className="mt-1">
                    {editor.service ?? 'OpenAI'}
                  </DialogDescription>
                </div>
                <span
                  role="status"
                  className="max-w-48 text-xs text-muted-foreground"
                >
                  {notice}
                </span>
                {saved && (
                  <Button
                    variant="outline"
                    size="icon-sm"
                    aria-label="Delete credential"
                    className="text-muted-foreground hover:text-destructive"
                    disabled={busy}
                    onClick={() => setConfirmDelete(true)}
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                  </Button>
                )}
                {/* Nothing to save: say so in text instead of a disabled button (n8n pattern). */}
                {saved && !dirty && !busy ? (
                  <span className="px-2 text-sm text-muted-foreground">Saved</span>
                ) : (
                  <Button size="sm" disabled={busy || !dirty} onClick={save}>
                    {busy ? 'Testing…' : 'Save'}
                  </Button>
                )}
              </header>
              <div className="flex min-h-0 flex-1 flex-col sm:flex-row">
                <nav
                  aria-label="Credential settings"
                  className="flex shrink-0 gap-1 p-5 sm:w-48 sm:flex-col sm:py-6"
                >
                  {(['Connection', 'Access', 'Details'] as const).map((tab) => (
                    <button
                      key={tab}
                      aria-current={section === tab ? 'page' : undefined}
                      onClick={() => setSection(tab)}
                      className={cn(
                        'rounded-md px-4 py-2.5 text-left text-sm transition-colors hover:bg-accent',
                        section === tab
                          ? 'bg-accent font-medium text-foreground'
                          : 'text-muted-foreground'
                      )}
                    >
                      {tab}
                    </button>
                  ))}
                </nav>
                <div className="min-h-0 flex-1 overflow-y-auto px-6 py-7 sm:px-9">
                  {section === 'Connection' && (
                    <div className="mx-auto max-w-2xl space-y-6">
                      {(editor.service ?? 'OpenAI') === 'OpenAI' && (
                        <div className="flex items-center gap-2 rounded-md border bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
                          <span>Need help filling out these fields?</span>
                          <a
                            href="https://platform.openai.com/api-keys"
                            target="_blank"
                            rel="noreferrer"
                            className="font-medium text-info-500 hover:text-info-500/80 underline-offset-4 hover:underline"
                          >
                            Open API keys ↗
                          </a>
                        </div>
                      )}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="credential-key">
                            {editorKind === 'apiKey' ? 'API key' : 'Access token'}{' '}
                            <span className="text-destructive">*</span>
                          </Label>
                          {saved && !replacing && (
                            <div className="flex items-center gap-1">
                              <Button
                                variant="link"
                                size="xs"
                                className="text-info-500 hover:text-info-500/80"
                                disabled={busy || dirty || !editor.enabled}
                                onClick={testConnection}
                              >
                                {busy ? 'Testing…' : 'Test connection'}
                              </Button>
                              <Button
                                variant="link"
                                size="xs"
                                className="text-info-500 hover:text-info-500/80"
                                disabled={busy}
                                onClick={() => setReplacing(true)}
                              >
                                Replace key
                              </Button>
                            </div>
                          )}
                        </div>
                        <Input
                          id="credential-key"
                          type="password"
                          autoComplete="off"
                          disabled={Boolean(saved && !replacing) || busy}
                          placeholder="Enter a demo API key"
                          value={
                            saved && !replacing ? 'demo-masked-value' : secret
                          }
                          onChange={(event) => setSecret(event.target.value)}
                        />
                        <p
                          className={cn(
                            'text-xs',
                            saved && !replacing && editor.state === 'failed'
                              ? 'text-destructive'
                              : 'text-muted-foreground'
                          )}
                        >
                          {saved && !replacing && editor.state === 'failed'
                            ? `${editor.service ?? 'OpenAI'} didn't accept this key. Replace it, then test again.`
                            : replacing
                            ? peopleCount(audienceOf(editor)) > 1
                              ? `The new ${secretNoun} changes the account for ${peopleLabel(peopleCount(audienceOf(editor)))}. Who has access stays the same.`
                              : `Who has access stays the same. Save the replacement and test it again.`
                            : saved
                              ? `Ending in ${editor.keyPreview?.slice(-4) ?? '••••'}. The full ${secretNoun} can't be displayed; replace it to make a change.`
                              : 'Use made-up text, not a real secret. This prototype discards the key on save.'}
                        </p>
                        {saved && !replacing && (
                          <p className="text-xs text-muted-foreground">
                            Runs as{' '}
                            <span className="font-medium text-foreground">{runsAsOf(editor).handle}</span>
                            {runsAsOf(editor).kind === 'personal'
                              ? ` · personal ${editor.service ?? 'OpenAI'} account`
                              : runsAsOf(editor).kind === 'service'
                                ? ' · service account'
                                : ''}
                          </p>
                        )}
                        {(!saved || replacing) && (
                          <Button
                            variant="ghost"
                            size="xs"
                            onClick={() =>
                              setSecret('sk-demo-not-a-real-credential')
                            }
                          >
                            Use demo key
                          </Button>
                        )}
                      </div>
                      {(editor.service ?? 'OpenAI') === 'OpenAI' && (
                        <>
                          <div className="space-y-2">
                            <Label htmlFor="credential-org">
                              Organization ID (optional)
                            </Label>
                            <Input
                              id="credential-org"
                              value={editor.organization}
                              disabled={busy}
                              placeholder="org-…"
                              onChange={(event) =>
                                setEditor({
                                  ...editor,
                                  organization: event.target.value,
                                })
                              }
                            />
                            <p className="text-xs text-muted-foreground">
                              Only required if you belong to multiple
                              organizations.
                            </p>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="credential-base-url">
                              Base URL
                            </Label>
                            <Input
                              id="credential-base-url"
                              value="https://api.openai.com/v1"
                              readOnly
                            />
                            <p className="text-xs text-muted-foreground">
                              This service uses a fixed endpoint.
                            </p>
                          </div>
                        </>
                      )}
                      {error && (
                        <p role="alert" className="text-sm text-destructive">
                          {error}
                        </p>
                      )}
                      {saved &&
                        editor.state === 'connected' &&
                        editor.enabled &&
                        !dirty && (
                          <div className="flex items-center justify-between gap-4 border-t pt-5">
                            <div>
                              <p className="text-sm font-medium">Who can use this?</p>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {audienceOf(editor).workspace || audienceOf(editor).roles.length || audienceOf(editor).agents.length
                                  ? `Shared with ${peopleLabel(peopleCount(audienceOf(editor)))}${audienceOf(editor).agents.length ? ` and ${audienceOf(editor).agents.length} agent${audienceOf(editor).agents.length === 1 ? '' : 's'}` : ''}.`
                                  : 'Only you so far.'}
                              </p>
                            </div>
                            <Button variant="outline" onClick={() => setSection('Access')}>
                              Manage access <ArrowRight className="size-4" aria-hidden="true" />
                            </Button>
                          </div>
                        )}
                    </div>
                  )}

                  {section === 'Access' && accessDraft && (
                    <div className="mx-auto max-w-xl space-y-5">
                      {!saved || editor.state !== 'connected' || !editor.enabled ? (
                        <p className="flex items-start gap-2 rounded-lg bg-muted p-3 text-sm text-muted-foreground">
                          <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                          Save and successfully test an enabled credential before sharing it.
                        </p>
                      ) : (
                        <>
                          <ShareAccessPanel
                            key={accessVersion}
                            kind={editorKind}
                            service={editor.service ?? 'OpenAI'}
                            runsAs={runsAsOf(editor)}
                            value={accessDraft}
                            onChange={setAccessDraft}
                            currentUserEmail={CURRENT_TEAMMATE.email}
                          />
                          <div className="flex justify-end gap-2">
                            {accessDirty && savedAudience && (
                              <Button
                                variant="outline"
                                onClick={() => {
                                  setAccessDraft(savedAudience);
                                  setAccessVersion((v) => v + 1);
                                }}
                              >
                                Reset
                              </Button>
                            )}
                            <Button
                              disabled={!accessDirty}
                              className="bg-[#171717] text-white hover:bg-[#171717]/85"
                              onClick={() => {
                                const widening =
                                  savedAudience !== null &&
                                  (peopleCount(accessDraft) > peopleCount(savedAudience) ||
                                    (accessDraft.workspace && !savedAudience.workspace));
                                if (widening && needsShareConfirmation(accessDraft, runsAsOf(editor)))
                                  setConfirmAccess(true);
                                else applyAccess(accessDraft);
                              }}
                            >
                              Save access
                            </Button>
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {section === 'Details' && (
                    <div className="space-y-6">
                      <dl className="grid grid-cols-[minmax(100px,180px)_1fr] gap-x-6 gap-y-6 text-sm leading-5 text-muted-foreground">
                        <dt>Created</dt>
                        <dd>
                          {saved
                            ? (editor.createdAt ?? '3 days ago')
                            : 'Not saved yet'}
                        </dd>
                        <dt>Last modified</dt>
                        <dd>
                          {saved
                            ? (editor.modifiedAt ?? '18 minutes ago')
                            : 'Not saved yet'}
                        </dd>
                        <dt>ID</dt>
                        <dd className="break-all font-mono text-xs">
                          {saved ? editor.id : 'Assigned after saving'}
                        </dd>
                      </dl>
                      <details className="pt-3">
                        <summary className="cursor-pointer text-sm text-muted-foreground">
                          Activity and controls
                        </summary>
                        <div className="mt-5 space-y-5">
                          <div className="space-y-2">
                            <Label htmlFor="credential-name">
                              Credential name
                            </Label>
                            <Input
                              id="credential-name"
                              value={editor.name}
                              disabled={busy}
                              onChange={(event) =>
                                setEditor({
                                  ...editor,
                                  name: event.target.value,
                                })
                              }
                            />
                          </div>
                          {saved && onViewConnections && (
                            <Button
                              variant="outline"
                              disabled={busy || dirty}
                              onClick={() => {
                                closeEditor();
                                onViewConnections();
                              }}
                            >
                              View in Connections
                            </Button>
                          )}
                          <div className="border-t pt-5">
                            <h3 className="mb-4 text-sm font-medium">
                              Activity
                            </h3>
                            {editor.activity.length ? (
                              <ol className="space-y-3">
                                {editor.activity.map((event, index) => (
                                  <li
                                    key={`${index}-${event}`}
                                    className="flex gap-3 text-xs text-muted-foreground"
                                  >
                                    <span className="mt-1 size-1.5 shrink-0 rounded-full bg-muted-foreground/50" />
                                    {event}
                                  </li>
                                ))}
                              </ol>
                            ) : (
                              <p className="text-sm text-muted-foreground">
                                Activity appears after saving.
                              </p>
                            )}
                          </div>
                          {saved && (
                            <div className="space-y-3 border-t pt-5">
                              <div className="flex items-center justify-between gap-3">
                                <p className="text-sm">
                                  {editor.enabled
                                    ? 'Pause use by all assigned agents.'
                                    : 'Enable this credential, then test it again.'}
                                </p>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  disabled={busy || dirty}
                                  onClick={() =>
                                    record(
                                      {
                                        ...editor,
                                        enabled: !editor.enabled,
                                        state: 'untested',
                                      },
                                      editor.enabled
                                        ? 'Credential disabled; future demo runs denied'
                                        : 'Credential enabled; test required'
                                    )
                                  }
                                >
                                  {editor.enabled
                                    ? 'Disable credential'
                                    : 'Enable credential'}
                                </Button>
                              </div>
                              <div className="flex items-center justify-between gap-3">
                                <p className="text-sm text-muted-foreground">
                                  Delete the credential and all agent
                                  assignments.
                                </p>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-destructive"
                                  disabled={busy || dirty}
                                  onClick={() => setConfirmDelete(true)}
                                >
                                  <Trash2 />
                                  Delete credential
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      </details>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={confirmDelete}
        onOpenChange={(open) => {
          setConfirmDelete(open);
          if (!open) setPendingDelete(null);
        }}
      >
        <DialogContent>
          <DialogTitle>Delete this credential?</DialogTitle>
          <DialogDescription>{deleteImpact(deleteTarget)}</DialogDescription>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setConfirmDelete(false);
                setPendingDelete(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              // The theme's destructive text token is dark red; force white for contrast on the red fill.
              className="text-white hover:text-white"
              onClick={() => {
                setCredentials((items) =>
                  items.filter((item) => item.id !== deleteTarget?.id)
                );
                setConfirmDelete(false);
                if (pendingDelete) setPendingDelete(null);
                else closeEditor();
              }}
            >
              Delete credential
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={confirmAccess} onOpenChange={setConfirmAccess}>
        <DialogContent className="max-w-[560px]">
          {editor && accessDraft && (
            <>
              <DialogTitle>{shareConfirmTitle(accessDraft, runsAsOf(editor))}</DialogTitle>
              <DialogDescription>
                {editor.name} · {editor.service ?? 'OpenAI'}
              </DialogDescription>
              <ShareConfirmBody
                kind={editorKind}
                service={editor.service ?? 'OpenAI'}
                runsAs={runsAsOf(editor)}
                audience={accessDraft}
              />
              <ShareConfirmActions
                audience={accessDraft}
                onBack={() => setConfirmAccess(false)}
                onConfirm={() => applyAccess(accessDraft)}
              />
            </>
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={confirmDiscard} onOpenChange={setConfirmDiscard}>
        <DialogContent>
          <DialogTitle>Discard unsaved changes?</DialogTitle>
          <DialogDescription>
            Your saved credential will not change. Any key entered here will be
            cleared.
          </DialogDescription>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setConfirmDiscard(false)}>
              Keep editing
            </Button>
            <Button onClick={closeEditor}>Discard changes</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Secrets that are set up where their job lives, listed here so every secret the
// workspace holds can be found in one place (the audit view). Read-only.
const MANAGED_ELSEWHERE = [
  {
    id: 'salesforce-app',
    logo: <CredentialProviderLogo service="Salesforce" size={20} />,
    name: 'Salesforce company sign-in app',
    detail: 'Client secret · everyone still signs in with their own account',
    where: 'Integration policies',
    href: '/workspace/integrations-and-tools',
  },
  {
    id: 'slack-agent',
    logo: <CredentialProviderLogo service="Slack" size={20} />,
    name: 'Slack Agent app',
    detail: 'Bot token and signing secret',
    where: 'Channels',
    href: '/workspace/channels',
  },
  {
    id: 'scim',
    logo: <KeyRound className="size-4 text-muted-foreground" aria-hidden="true" />,
    name: 'SCIM provisioning token',
    detail: 'Issued by Hatz for your identity provider',
    where: 'Admin console → SAML',
  },
];

function ManagedElsewhere() {
  return (
    <section className="rounded-xl border bg-background px-4 pb-2 pt-4 shadow-sm">
      <h5 className="text-sm font-medium text-foreground">Managed elsewhere</h5>
      <p className="mt-0.5 text-sm text-muted-foreground">
        Other secrets this workspace holds. They&apos;re set up where they&apos;re used and listed
        here so you can find every one.
      </p>
      <ul className="mt-2 divide-y divide-dashed">
        {MANAGED_ELSEWHERE.map((item) => (
          <li key={item.id} className="flex items-center gap-3 py-3">
            <LogoTile>{item.logo}</LogoTile>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-foreground">{item.name}</p>
              <p className="truncate text-xs text-muted-foreground">{item.detail}</p>
            </div>
            {item.href ? (
              <Link
                href={item.href}
                className="shrink-0 text-sm text-info-500 underline-offset-4 hover:text-info-500/80 hover:underline"
              >
                Managed in {item.where} →
              </Link>
            ) : (
              <span className="shrink-0 text-sm text-muted-foreground">Managed in {item.where}</span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
