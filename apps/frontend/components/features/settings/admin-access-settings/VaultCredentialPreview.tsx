'use client';

import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react';
import {
  Bot,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  KeyRound,
  Loader2,
  Search,
  Server,
  Share2,
  ShieldCheck,
  Trash2,
  XCircle,
  Info,
} from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/Popover';
import { CredentialServicePicker } from './CredentialServicePicker';
import { CredentialProviderLogo } from './CredentialProviderLogo';
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
  service?: string;
  createdAt?: string;
  modifiedAt?: string;
  teammates?: string[];
  name: string;
  organization: string;
  state: ConnectionState;
  enabled: boolean;
  agents: string[];
  activity: string[];
}
const AGENTS = [
  'Research assistant',
  'Customer success agent',
  'Analytics reporter',
];
export const INITIAL_PREVIEW_CREDENTIALS: PreviewCredential[] = [
  {
    id: 'demo-openai-01',
    name: 'OpenAI account',
    organization: '',
    state: 'connected',
    enabled: true,
    agents: ['Research assistant'],
    activity: [
      'Research assistant connected · Chris Marte',
      'Connection tested successfully · Chris Marte',
      'Credential created · Chris Marte',
    ],
  },
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
  onAddSharedCredential,
  onAddSharedMcp,
}: {
  testResult?: string;
  credentials?: PreviewCredential[];
  onCredentialsChange?: Dispatch<SetStateAction<PreviewCredential[]>>;
  openCredential?: { id: string; request: number };
  onViewConnections?: () => void;
  onAddSharedCredential?: () => void;
  onAddSharedMcp?: () => void;
}) {
  const [localCredentials, setLocalCredentials] = useState<PreviewCredential[]>(
    INITIAL_PREVIEW_CREDENTIALS
  );
  const credentials = providedCredentials ?? localCredentials;
  const setCredentials = onCredentialsChange ?? setLocalCredentials;
  const [search, setSearch] = useState('');
  const [picker, setPicker] = useState(false);
  const [pickerVersion, setPickerVersion] = useState(0);
  const [editor, setEditor] = useState<PreviewCredential | null>(null);
  const [section, setSection] = useState<Section>('Connection');
  // A demo input is deliberately never copied into a credential record.
  const [secret, setSecret] = useState('');
  const [replacing, setReplacing] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [agent, setAgent] = useState('');
  const [teammate, setTeammate] = useState('');
  const [agentAccessOpen, setAgentAccessOpen] = useState(false);
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
    setAgent('');
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
  const filtered = credentials.filter((item) =>
    `${item.name} ${item.service ?? 'OpenAI'}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h4 className="text-sm font-medium text-foreground">
          Saved credentials
        </h4>
        <Popover>
          <PopoverTrigger asChild>
            <Button className="gap-1.5">
              Add credential
              <ChevronDown className="size-3.5 opacity-70" aria-hidden="true" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-72 p-2">
            <button
              type="button"
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-muted"
              onClick={() => {
                setPickerVersion((v) => v + 1);
                setPicker(true);
              }}
            >
              <KeyRound className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <div>
                <p className="text-sm font-medium">Vault API key</p>
                <p className="text-xs text-muted-foreground">
                  Store an API key in the workspace vault
                </p>
              </div>
            </button>
            {onAddSharedCredential && (
              <button
                type="button"
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-muted"
                onClick={onAddSharedCredential}
              >
                <Share2 className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <div>
                  <p className="text-sm font-medium">Shared credential</p>
                  <p className="text-xs text-muted-foreground">
                    Connect a service for the whole workspace via OAuth
                  </p>
                </div>
              </button>
            )}
            {onAddSharedMcp && (
              <button
                type="button"
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-muted"
                onClick={onAddSharedMcp}
              >
                <Server className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <div>
                  <p className="text-sm font-medium">Shared MCP credential</p>
                  <p className="text-xs text-muted-foreground">
                    Share an MCP server credential across the workspace
                  </p>
                </div>
              </button>
            )}
          </PopoverContent>
        </Popover>
      </div>
      <div className="overflow-hidden rounded-xl border">
        <div className="grid grid-cols-[1fr_auto] bg-muted/30 px-5 py-3 text-xs font-medium text-muted-foreground">
          <span>Credential</span>
          <span>Connection</span>
        </div>
        {filtered.map((item) => (
          <button
            key={item.id}
            onClick={() => openEditor(item)}
            className="flex w-full items-center gap-4 border-t px-5 py-5 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
          >
            <ProviderIcon service={item.service} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{item.name}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {item.service ?? 'OpenAI'} API ·{' '}
                {item.agents.length
                  ? `${item.agents.length} agent${item.agents.length === 1 ? '' : 's'}`
                  : 'No agents connected'}{' '}
                · Managed by you
              </p>
            </div>
            <span className="rounded-md border px-2 py-1 text-xs">
              {!item.enabled
                ? 'Disabled'
                : item.state === 'connected'
                  ? 'Connected'
                  : item.state === 'failed'
                    ? 'Needs attention'
                    : 'Not tested'}
            </span>
            <ChevronRight className="size-4 text-muted-foreground" />
          </button>
        ))}
        {!filtered.length && (
          <div className="p-12 text-center text-sm text-muted-foreground">
            <KeyRound className="mx-auto mb-3 size-7" />
            {search
              ? 'No matching credentials.'
              : 'No credentials yet. Add one to get started.'}
          </div>
        )}
      </div>

      <CredentialServicePicker
        key={pickerVersion}
        open={picker}
        onOpenChange={setPicker}
        onSelect={(service) => {
          setPicker(false);
          openEditor({
            id: crypto.randomUUID(),
            name: `${service} account`,
            service,
            organization: '',
            state: 'untested',
            enabled: true,
            agents: [],
            activity: [],
          });
        }}
      />

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
                  <DialogTitle className="truncate text-base font-medium leading-6 tracking-normal">
                    {editor.name || 'OpenAI account'}
                  </DialogTitle>
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
                <Button size="sm" disabled={busy || !dirty} onClick={save}>
                  {busy ? 'Testing…' : saved && !dirty ? 'Saved' : 'Save'}
                </Button>
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
                      {saved && (
                        <div
                          role="status"
                          className={cn(
                            'rounded-lg border p-4',
                            editor.state === 'connected' &&
                              'border-success-500/30 bg-success-50 dark:bg-success-800/20',
                            editor.state === 'failed' &&
                              'border-destructive/40 bg-destructive/5'
                          )}
                        >
                          <div className="flex items-center gap-3">
                            {busy ? (
                              <Loader2 className="size-5 animate-spin" />
                            ) : editor.state === 'connected' ? (
                              <CheckCircle2 className="size-5" />
                            ) : editor.state === 'failed' ? (
                              <XCircle className="size-5" />
                            ) : (
                              <ShieldCheck className="size-5" />
                            )}
                            <span className="flex-1 text-sm font-medium">
                              {!editor.enabled
                                ? 'Credential disabled'
                                : busy
                                  ? 'Testing connection…'
                                  : editor.state === 'connected'
                                    ? 'Connection tested successfully'
                                    : editor.state === 'failed'
                                      ? `Could not connect to ${editor.service ?? 'OpenAI'}`
                                      : 'Saved, but not tested'}
                            </span>
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={busy || dirty || !editor.enabled}
                              onClick={testConnection}
                            >
                              {editor.state === 'untested'
                                ? 'Test connection'
                                : 'Retry'}
                            </Button>
                          </div>
                          <p className="mt-2 text-xs text-muted-foreground">
                            {!editor.enabled
                              ? 'Assigned agents cannot use this credential.'
                              : editor.state === 'failed'
                                ? 'The demo key was rejected. Replace the key, or change the test outcome in DialKit and retry.'
                                : editor.state === 'connected'
                                  ? 'Demo test passed. Agent access is granted separately.'
                                  : 'Tests are simulated. No request is made to OpenAI.'}
                          </p>
                        </div>
                      )}
                      {(editor.service ?? 'OpenAI') === 'OpenAI' && (
                        <div className="flex items-center gap-2 rounded-md border bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
                          <span>Need help filling out these fields?</span>
                          <a
                            href="https://platform.openai.com/api-keys"
                            target="_blank"
                            rel="noreferrer"
                            className="font-medium text-primary"
                          >
                            Open API keys ↗
                          </a>
                        </div>
                      )}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="credential-key">
                            API key <span className="text-destructive">*</span>
                          </Label>
                          {saved && !replacing && (
                            <Button
                              variant="link"
                              size="xs"
                              disabled={busy}
                              onClick={() => setReplacing(true)}
                            >
                              Replace key
                            </Button>
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
                        <p className="text-xs text-muted-foreground">
                          {replacing
                            ? 'Existing agent assignments stay in place. Save the replacement and test it again before the next demo run.'
                            : saved
                              ? 'The saved key cannot be displayed. Replace it to make a change.'
                              : 'Use made-up text, not a real secret. This prototype discards the key on save.'}
                        </p>
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
                              <p className="text-sm font-medium">
                                Ready to put this credential to work?
                              </p>
                              <p className="mt-1 text-xs text-muted-foreground">
                                Choose an agent that is allowed to use it.
                              </p>
                            </div>
                            <Button
                              variant="outline"
                              onClick={() => {
                                setSection('Access');
                                setAgentAccessOpen(true);
                              }}
                            >
                              Connect to agent <ChevronRight />
                            </Button>
                          </div>
                        )}
                    </div>
                  )}

                  {section === 'Access' && (
                    <div className="space-y-7">
                      <p className="flex items-start gap-2 text-sm leading-5 text-muted-foreground">
                        <Info className="mt-0.5 size-4 shrink-0" />
                        Sharing allows teammates to use this credential in
                        permitted skills. They cannot view the saved key. Agent
                        access is assigned separately.
                      </p>
                      <div className="flex gap-2">
                        <select
                          aria-label="Share with teammates"
                          className="h-11 min-w-0 flex-1 rounded-md border bg-background px-3 text-sm text-muted-foreground"
                          value={teammate}
                          onChange={(event) => setTeammate(event.target.value)}
                          disabled={!saved || busy || dirty}
                        >
                          <option value="">Share with teammates</option>
                          {['Alex Morgan', 'Jordan Lee', 'Sam Patel']
                            .filter((name) => !editor.teammates?.includes(name))
                            .map((name) => (
                              <option key={name}>{name}</option>
                            ))}
                        </select>
                        {teammate && (
                          <Button
                            disabled={!saved || busy || dirty}
                            onClick={() => {
                              record(
                                {
                                  ...editor,
                                  teammates: [
                                    ...(editor.teammates ?? []),
                                    teammate,
                                  ],
                                },
                                `Shared with ${teammate}`
                              );
                              setTeammate('');
                            }}
                          >
                            Share
                          </Button>
                        )}
                      </div>
                      <div className="flex items-center gap-3 py-1">
                        <span className="flex size-9 items-center justify-center rounded-full bg-muted text-xs font-medium">
                          CM
                        </span>
                        <div className="flex-1 text-sm">
                          Chris Marte{' '}
                          <span className="text-muted-foreground">(you)</span>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Can manage this credential
                          </p>
                        </div>
                        <span className="rounded border px-1.5 py-0.5 text-xs text-muted-foreground">
                          Owner
                        </span>
                      </div>
                      {editor.teammates?.map((name) => (
                        <div
                          key={name}
                          className="flex items-center gap-3 text-sm"
                        >
                          <span className="flex size-9 items-center justify-center rounded-full bg-muted text-xs">
                            {name
                              .split(' ')
                              .map((part) => part[0])
                              .join('')}
                          </span>
                          <span className="flex-1">{name}</span>
                          <span className="text-xs text-muted-foreground">
                            Can use
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label={`Remove teammate ${name}`}
                            disabled={busy || dirty}
                            onClick={() =>
                              record(
                                {
                                  ...editor,
                                  teammates: editor.teammates?.filter(
                                    (person) => person !== name
                                  ),
                                },
                                `Sharing removed for ${name}`
                              )
                            }
                          >
                            Remove
                          </Button>
                        </div>
                      ))}
                      <details
                        open={agentAccessOpen}
                        onToggle={(event) =>
                          setAgentAccessOpen(event.currentTarget.open)
                        }
                        className="border-t pt-5"
                      >
                        <summary className="cursor-pointer text-sm font-medium">
                          Agent access
                        </summary>
                        <div className="space-y-4 pt-5">
                          <div>
                            <h3 className="text-sm font-medium leading-5">
                              Agents with access
                            </h3>
                            <p className="mt-2 text-sm text-muted-foreground">
                              These agents can use the credential for a
                              supported
                              {editor.service ?? 'OpenAI'} action. The model
                              never sees the key.
                            </p>
                          </div>
                          {(!saved ||
                            dirty ||
                            editor.state !== 'connected' ||
                            !editor.enabled) && (
                            <p className="rounded-lg bg-muted p-3 text-sm">
                              Save and successfully test an enabled credential
                              before connecting an agent.
                            </p>
                          )}
                          <div className="flex gap-2">
                            <select
                              aria-label="Choose an agent"
                              className="h-10 min-w-0 flex-1 rounded-md border bg-background px-3 text-sm"
                              value={agent}
                              onChange={(event) => setAgent(event.target.value)}
                            >
                              <option value="">
                                Choose an eligible agent…
                              </option>
                              {AGENTS.filter(
                                (name) => !editor.agents.includes(name)
                              ).map((name) => (
                                <option key={name}>{name}</option>
                              ))}
                            </select>
                            <Button
                              disabled={
                                !agent ||
                                !saved ||
                                dirty ||
                                editor.state !== 'connected' ||
                                !editor.enabled
                              }
                              onClick={() => {
                                record(
                                  {
                                    ...editor,
                                    agents: [...editor.agents, agent],
                                  },
                                  `Access granted to ${agent}`
                                );
                                setNotice('Agent connected.');
                                setAgent('');
                              }}
                            >
                              Connect agent
                            </Button>
                          </div>
                          {editor.agents.length === 0 ? (
                            <div className="rounded-lg border border-dashed px-4 py-7 text-center">
                              <Bot className="mx-auto mb-2 size-6 text-muted-foreground" />
                              <p className="text-sm font-medium">
                                No agents connected yet
                              </p>
                              <p className="mt-1 text-xs text-muted-foreground">
                                Saving a credential does not automatically grant
                                access.
                              </p>
                            </div>
                          ) : (
                            editor.agents.map((name) => (
                              <div
                                key={name}
                                className="flex flex-wrap items-center gap-3 rounded-lg border p-4"
                              >
                                <Bot className="size-5 text-muted-foreground" />
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-medium">{name}</p>
                                  <p className="mt-1 text-xs text-muted-foreground">
                                    Demo action: generate a text response
                                  </p>
                                </div>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  disabled={busy || dirty}
                                  onClick={() => {
                                    const allowed =
                                      editor.enabled &&
                                      editor.state === 'connected';
                                    record(
                                      editor,
                                      allowed
                                        ? `${name}: demo action completed`
                                        : `${name}: demo action blocked`
                                    );
                                    setNotice(
                                      allowed
                                        ? 'Demo action completed successfully.'
                                        : 'Action blocked: credential is disabled or not verified.'
                                    );
                                  }}
                                >
                                  Run demo
                                </Button>
                                <Button
                                  aria-label={`Remove ${name}`}
                                  variant="ghost"
                                  size="sm"
                                  disabled={busy || dirty}
                                  onClick={() => {
                                    record(
                                      {
                                        ...editor,
                                        agents: editor.agents.filter(
                                          (item) => item !== name
                                        ),
                                      },
                                      `Access revoked for ${name}; future demo runs denied`
                                    );
                                    setNotice(
                                      `${name} can no longer use this credential.`
                                    );
                                  }}
                                >
                                  Remove
                                </Button>
                              </div>
                            ))
                          )}
                        </div>
                      </details>
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
      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogTitle>Delete this credential?</DialogTitle>
          <DialogDescription>
            {editor?.agents.length
              ? `${editor.agents.join(', ')} will lose access. Their next credential-backed action will be blocked in this demo.`
              : 'This credential has no assigned agents.'}{' '}
            This removes the demo record. Restart the flow to restore demo data.
          </DialogDescription>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setCredentials((items) =>
                  items.filter((item) => item.id !== editor?.id)
                );
                setConfirmDelete(false);
                closeEditor();
              }}
            >
              Delete credential
            </Button>
          </div>
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
