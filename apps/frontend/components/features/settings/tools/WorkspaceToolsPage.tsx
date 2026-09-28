'use client';
// v4 — Settings-13 card grid pattern
import { useEffect, useState, type ReactNode } from 'react';
import { Search } from 'lucide-react';
import {
  TOOLS,
  DIRECTORY,
  ToolLogo,
  type Tool,
} from '@/components/features/chat/tools/ToolsManagerDialog';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/Dialog';
import { openToolAuthorization } from './openToolAuthorization';
import { SelectMenu } from './SelectMenu';
import {
  ConnectButton,
  FloatingNotice,
  type Notice,
  ToolCard,
  ToolCardSection,
  TrayButton,
} from './ToolCard';
import {
  VaultCredentialPreview,
  INITIAL_PREVIEW_CREDENTIALS,
  type PreviewCredential,
} from '../admin-access-settings/VaultCredentialPreview';
import {
  audienceOf,
  includesCurrentUser,
  runsAsOf,
} from '../admin-access-settings/credentialSharing';

const CATALOG = Array.from(
  new Map([...TOOLS, ...DIRECTORY].map((tool) => [tool.id, tool])).values()
);

type DemoConnection = {
  id: string;
  name: string;
  service: string;
  tool?: Tool;
  managedByMe: boolean;
  adminOnly?: boolean;
  enabled: boolean;
  status: string;
  method: string;
};

const INITIAL_CONNECTIONS: DemoConnection[] = TOOLS.filter(
  (tool) => tool.state !== 'disconnected' && tool.type !== 'Desktop'
).map((tool) => ({
  id: tool.id,
  name: tool.name,
  service: tool.name,
  tool,
  // Microsoft 365 is enabled by the MSP. Shared connections (Vault) add more org cards below.
  managedByMe: tool.id !== 'microsoft',
  adminOnly: tool.id === 'microsoft',
  enabled: true,
  status: tool.state === 'error' ? 'Needs attention' : 'Connected',
  method: 'Account connection',
}));

const ADMIN_ONLY_CONNECTION_IDS = new Set(['salesforce', 'hubspot']);

/** Vault shared-connection service → the catalog tool it powers. */
const SERVICE_TOOL_IDS: Record<string, string> = {
  Asana: 'asana',
  Canny: 'canny',
  Figma: 'figma',
  GitHub: 'github',
  HubSpot: 'hubspot',
  Linear: 'linear',
  Notion: 'notion',
};

/** What a member needs to know about a connection their org shared with them. */
const sharedLock = (service: string, handle: string, personal: boolean) =>
  `Your organization shared this ${service} connection, so your actions run as ${handle}${
    personal ? ' (a personal account)' : ''
  }. It replaces your own ${service} connection. Ask a workspace admin to change it.`;

/** A card in "Your connections": an existing connection or a catalog tool. */
type YourCard =
  | { id: string; connection: DemoConnection; tool?: undefined }
  | { id: string; connection?: undefined; tool: Tool };

// What each tool is used for; drives the "Filter by type" dropdown. A tool
// can belong to several types when it genuinely does more than one job.
const TOOL_TYPES = [
  'Communication',
  'Calendar & meetings',
  'Docs & knowledge',
  'Project management',
  'Design',
  'Engineering',
  'Customer & sales',
  'IT & service desk',
] as const;
type ToolType = (typeof TOOL_TYPES)[number];

const TOOL_TYPES_BY_ID: Record<string, ToolType[]> = {
  slack: ['Communication'],
  gmail: ['Communication'],
  microsoft: ['Communication', 'Calendar & meetings', 'Docs & knowledge'],
  gcalendar: ['Calendar & meetings'],
  fireflies: ['Calendar & meetings', 'Docs & knowledge'],
  notion: ['Docs & knowledge', 'Project management'],
  gdrive: ['Docs & knowledge'],
  atlassian: ['Docs & knowledge', 'Project management'],
  linear: ['Project management', 'Engineering'],
  asana: ['Project management'],
  monday: ['Project management'],
  canva: ['Design'],
  figma: ['Design', 'Engineering'],
  mobbin: ['Design'],
  github: ['Engineering'],
  sentry: ['Engineering'],
  vercel: ['Engineering'],
  supabase: ['Engineering'],
  retool: ['Engineering'],
  hubspot: ['Customer & sales'],
  intercom: ['Customer & sales'],
  canny: ['Customer & sales'],
  connectwise: ['IT & service desk', 'Customer & sales'],
};

const ALL_TYPES = 'all';
const TYPE_OPTIONS = [
  { value: ALL_TYPES, label: 'All types' },
  ...TOOL_TYPES.map((type) => ({ value: type, label: type })),
];

const ORG_LOCK =
  'Managed by your organization. Ask a workspace admin to turn off or disconnect it.';
const ADMIN_ONLY_LOCK = 'Only workspace admins can connect this tool.';

// ── Page ──────────────────────────────────────────────────────────────────────

export function WorkspaceToolsPage({
  canManageCredentials = false,
  initialTab = 'integrations',
}: {
  /** Still passed by the route; the company badge was removed from the header. */
  companyName?: string;
  canManageCredentials?: boolean;
  /** Deep link from elsewhere (e.g. Hatz API keys → Vault). */
  initialTab?: 'integrations' | 'vault';
  /** Production custom-MCP inventory. Shown in Vault, where custom servers now live. */
  customConnections?: ReactNode;
  existingCredentials?: ReactNode;
}) {
  const [tab, setTab] = useState<string>(
    initialTab === 'vault' && canManageCredentials ? 'vault' : 'integrations'
  );
  const [query, setQuery] = useState('');
  const [connections, setConnections] = useState(INITIAL_CONNECTIONS);
  const [credentials, setCredentials] = useState<PreviewCredential[]>(
    INITIAL_PREVIEW_CREDENTIALS
  );
  const [openCredential, setOpenCredential] = useState<{
    id: string;
    request: number;
  }>();
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [apiKeyTool, setApiKeyTool] = useState<Tool | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [notice, setNotice] = useState<Notice | null>(null);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(timer);
  }, [notice]);

  const normalized = query.trim().toLowerCase();
  const [typeFilter, setTypeFilter] = useState<string>(ALL_TYPES);
  const matchesType = (id: string) =>
    typeFilter === ALL_TYPES ||
    (TOOL_TYPES_BY_ID[id] ?? []).some((type) => type === typeFilter);

  // Shared connections from Vault that include me replace my own connection:
  // they show as organization cards, and the tool leaves "Your connections".
  // One connection per tool per person: the newest shared connection wins (open question for eng).
  const sharedWithMe = credentials
    .flatMap((cred) => {
      const tool = CATALOG.find((t) => t.id === SERVICE_TOOL_IDS[cred.service ?? '']);
      return cred.kind === 'connection' && cred.enabled && tool && includesCurrentUser(audienceOf(cred))
        ? [{ cred, tool }]
        : [];
    })
    .filter(({ tool }, index, all) => all.findIndex((x) => x.tool.id === tool.id) === index);
  const sharedToolIds = new Set(sharedWithMe.map(({ tool }) => tool.id));
  const orgShared = sharedWithMe.filter(
    ({ tool }) => matchesType(tool.id) && tool.name.toLowerCase().includes(normalized)
  );

  const orgConnections = connections.filter(
    (item) =>
      !item.managedByMe &&
      matchesType(item.id) &&
      `${item.name} ${item.service}`.toLowerCase().includes(normalized)
  );
  const myConnections = connections.filter(
    (item) =>
      item.managedByMe &&
      !sharedToolIds.has(item.id) &&
      matchesType(item.id) &&
      `${item.name} ${item.service}`.toLowerCase().includes(normalized)
  );
  // Catalog items not yet connected
  const availableCatalog = CATALOG.filter(
    (tool) =>
      !connections.some((c) => c.id === tool.id) &&
      matchesType(tool.id) &&
      tool.id !== 'microsoft' &&
      !sharedToolIds.has(tool.id) &&
      tool.type !== 'Desktop' &&
      `${tool.name} ${tool.description ?? ''}`.toLowerCase().includes(normalized)
  );

  // Card order is fixed when the page loads (connected first, then the catalog)
  // so a card never jumps away while someone is connecting or toggling it.
  // The connected-first sort reapplies on the next load.
  const [cardOrder] = useState(
    () =>
      new Map(
        [
          ...INITIAL_CONNECTIONS.filter((c) => c.managedByMe).map((c) => c.id),
          ...CATALOG.map((tool) => tool.id),
        ].map((id, index) => [id, index])
      )
  );
  const rankOf = (id: string) => cardOrder.get(id) ?? Number.MAX_SAFE_INTEGER;
  const yourCards: YourCard[] = [
    ...myConnections.map((connection) => ({ id: connection.id, connection })),
    ...availableCatalog.map((tool) => ({ id: tool.id, tool })),
  ].sort((a, b) => rankOf(a.id) - rankOf(b.id));

  const changeTab = (value: string) => {
    setTab(value);
    setQuery('');
    if (value !== 'vault') setOpenCredential(undefined);
  };

  const setEnabled = (id: string, enabled: boolean) =>
    setConnections((prev) =>
      prev.map((c) => (c.id === id ? { ...c, enabled } : c))
    );

  const addConnection = (tool: Tool, method: string) => {
    setConnections((items) => [
      ...items.filter((item) => item.id !== tool.id),
      {
        id: tool.id,
        name: tool.name,
        service: tool.name,
        tool,
        managedByMe: true,
        enabled: true,
        status: 'Connected',
        method,
      },
    ]);
    setNotice({ tone: 'success', text: `${tool.name} connected` });
  };

  const closeApiKey = () => {
    setApiKeyTool(null);
    setApiKey('');
  };

  // Connect follows the tool's authorization type: provider sign-in, API key, or none.
  const connect = (tool: Tool) => {
    if (tool.authorization === 'API Key') {
      setApiKeyTool(tool);
      return;
    }
    if (tool.authorization === '—') {
      addConnection(tool, 'Built in');
      return;
    }
    setConnectingId(tool.id);
    openToolAuthorization(tool, (outcome) => {
      setConnectingId(null);
      if (outcome === 'approved') addConnection(tool, 'Account connection');
      else if (outcome === 'cancelled')
        setNotice({ tone: 'info', text: `${tool.name} wasn't connected. The sign-in window was closed.` });
      else
        setNotice({ tone: 'info', text: `Your browser blocked the ${tool.name} sign-in window. Allow pop-ups and try again.` });
    });
  };

  const [addMcpRequest, setAddMcpRequest] = useState(0);
  const openCustomServer = () => {
    changeTab('vault');
    setAddMcpRequest((n) => n + 1);
  };

  return (
    <div className="mx-auto w-full px-4 pb-10 sm:px-24">
      <header className="mb-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Integrations</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Connect apps to your workspace and manage credentials.
            </p>
          </div>
        </div>
      </header>

      <Tabs value={tab} onValueChange={changeTab}>
        <div className="flex items-center gap-2">
          <TabsList aria-label="Integrations">
            <TabsTrigger value="integrations" className="rounded-sm">Integrations</TabsTrigger>
            {canManageCredentials && (
              <TabsTrigger value="vault" className="rounded-sm">Vault</TabsTrigger>
            )}
          </TabsList>
          {tab !== 'vault' && (
            <>
              <div className="relative ml-2 w-72">
                <Search
                  className="absolute left-3 top-2.5 size-4 text-muted-foreground"
                  aria-hidden="true"
                />
                <Input
                  aria-label="Search integrations"
                  placeholder="Search integrations"
                  className="pl-9"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
              <SelectMenu
                ariaLabel="Filter by type"
                className="w-52"
                value={typeFilter === ALL_TYPES ? '' : typeFilter}
                onChange={setTypeFilter}
                options={TYPE_OPTIONS}
                placeholder="Filter by type"
                menuLabel="Type"
              />
            </>
          )}
        </div>

        {/* ── Integrations tab ── */}
        <TabsContent value="integrations" className="mt-7 space-y-10">

          {orgConnections.length + orgShared.length > 0 && (
            <ToolCardSection title="Organization">
              {orgShared.map(({ cred, tool }) => {
                const runsAs = runsAsOf(cred);
                const lock = sharedLock(cred.service ?? tool.name, runsAs.handle, runsAs.kind === 'personal');
                return (
                  <ToolCard
                    key={cred.id}
                    logo={<ToolLogo tool={tool} />}
                    label={tool.name}
                    description={`Runs as ${runsAs.handle} · shared by ${
                      !cred.createdBy || cred.createdBy === 'Chris Marte' ? 'you' : cred.createdBy
                    }`}
                    action={<TrayButton disabled>Disconnect</TrayButton>}
                    actionLockedReason={lock}
                    toggle={{ checked: true, lockedReason: lock }}
                  />
                );
              })}
              {orgConnections.map((item) => (
                <ToolCard
                  key={item.id}
                  logo={item.tool ? <ToolLogo tool={item.tool} /> : <div className="size-8 rounded bg-muted" />}
                  label={item.name}
                  description={item.tool?.description ?? 'Connected by your organization'}
                  action={<TrayButton disabled>Disconnect</TrayButton>}
                  actionLockedReason={ORG_LOCK}
                  toggle={{ checked: item.enabled, lockedReason: ORG_LOCK }}
                />
              ))}
            </ToolCardSection>
          )}

          <ToolCardSection title="Your connections">
            {yourCards.map(({ connection: item, tool: catalogTool }) => {
              if (item) {
                return (
                  <ToolCard
                    key={item.id}
                    logo={item.tool ? <ToolLogo tool={item.tool} /> : <div className="size-8 rounded bg-muted" />}
                    label={item.name}
                    description={item.tool?.description ?? item.method}
                    action={
                      item.enabled ? (
                        <TrayButton onClick={() => setEnabled(item.id, false)}>
                          Disconnect
                        </TrayButton>
                      ) : (
                        <ConnectButton onClick={() => setEnabled(item.id, true)} />
                      )
                    }
                    toggle={{
                      checked: item.enabled,
                      onCheckedChange: (checked) => setEnabled(item.id, checked),
                    }}
                  />
                );
              }
              if (!catalogTool) return null;
              const tool = catalogTool;
              const lockedReason = ADMIN_ONLY_CONNECTION_IDS.has(tool.id)
                ? ADMIN_ONLY_LOCK
                : undefined;
              return (
                <ToolCard
                  key={tool.id}
                  logo={<ToolLogo tool={tool} />}
                  label={tool.name}
                  description={tool.description ?? 'Connect your account'}
                  action={
                    <ConnectButton
                      disabled={Boolean(lockedReason)}
                      loading={connectingId === tool.id}
                      onClick={() => connect(tool)}
                    />
                  }
                  actionLockedReason={lockedReason}
                  toggle={{
                    checked: false,
                    lockedReason,
                    onCheckedChange: (checked) => {
                      if (checked) connect(tool);
                    },
                  }}
                />
              );
            })}

            {!myConnections.length && !availableCatalog.length && (
              <p className="col-span-full py-10 text-center text-sm text-muted-foreground">
                {normalized || typeFilter !== ALL_TYPES
                  ? 'No integrations match your search or filter.'
                  : 'No integrations available.'}
              </p>
            )}
          </ToolCardSection>

          {/* Escape hatch for tools missing from the catalog; custom servers live in Vault. */}
          <p className="text-center text-sm text-muted-foreground">
            Don&apos;t see your tool?{' '}
            {canManageCredentials ? (
              <button
                type="button"
                onClick={openCustomServer}
                className="font-medium text-foreground underline-offset-4 hover:underline"
              >
                Add a custom MCP server in Vault →
              </button>
            ) : (
              'Ask a workspace admin to add it as a custom MCP server.'
            )}
          </p>

        </TabsContent>

        {/* ── Vault tab ── */}
        {canManageCredentials && (
          <TabsContent value="vault" className="mt-7 space-y-6">
            <VaultCredentialPreview
              credentials={credentials}
              onCredentialsChange={setCredentials}
              openCredential={openCredential}
              onViewConnections={() => changeTab('integrations')}
              addMcpRequest={addMcpRequest}
            />
            {/* Production MCP inventory / shared-credential sections are folded into the
                cards above for the demo; see customConnections/existingCredentials props. */}
          </TabsContent>
        )}
      </Tabs>

      <FloatingNotice notice={notice} />

      {/* ── API key connect dialog (tools that authorize with a key, not sign-in) ── */}
      <Dialog
        open={apiKeyTool !== null}
        onOpenChange={(open) => {
          if (!open) closeApiKey();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Connect {apiKeyTool?.name}</DialogTitle>
            <DialogDescription>
              {apiKeyTool?.name} connects with an API key instead of a sign-in.
              Create one in your {apiKeyTool?.name} account settings and paste it here.
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!apiKeyTool || !apiKey.trim()) return;
              addConnection(apiKeyTool, 'API key');
              closeApiKey();
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="tool-api-key">API key</Label>
              <Input
                id="tool-api-key"
                type="password"
                autoComplete="off"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                You won&apos;t be able to view the key again after connecting.
                This prototype doesn&apos;t store it.
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={closeApiKey}>
                Cancel
              </Button>
              <Button type="submit" disabled={!apiKey.trim()}>
                Connect
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
