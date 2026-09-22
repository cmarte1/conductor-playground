'use client';
// v4 — Settings-13 card grid pattern
import { useState, type ReactNode } from 'react';
import {
  Building2,
  ExternalLink,
  KeyRound,
  Plug,
  Search,
  Server,
  Trash2,
  Users,
} from 'lucide-react';
import {
  TOOLS,
  DIRECTORY,
  ToolLogo,
  type Tool,
} from '@/components/features/chat/tools/ToolsManagerDialog';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Switch } from '@/components/ui/Switch';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/Dialog';
import {
  VaultCredentialPreview,
  INITIAL_PREVIEW_CREDENTIALS,
  type PreviewCredential,
} from '../admin-access-settings/VaultCredentialPreview';

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
  managedByMe: !['microsoft', 'linear'].includes(tool.id),
  adminOnly: ['microsoft', 'linear'].includes(tool.id),
  status: tool.state === 'error' ? 'Needs attention' : 'Connected',
  method: 'Account connection',
}));

const ADMIN_ONLY_CONNECTION_IDS = new Set(['salesforce', 'hubspot']);

// ── Integration card ──────────────────────────────────────────────────────────

type CardProps = {
  logo: ReactNode;
  name: string;
  description: string;
  isConnected: boolean;
  isOrgManaged?: boolean;
  isAdminOnly?: boolean;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onToggle?: (checked: boolean) => void;
};

function IntegrationCard({
  logo,
  name,
  description,
  isConnected,
  isOrgManaged = false,
  isAdminOnly = false,
  onConnect,
  onDisconnect,
  onToggle,
}: CardProps) {
  const actionButton = isConnected ? (
    <Button variant="outline" size="sm" onClick={onDisconnect}>
      Disconnect
    </Button>
  ) : (
    <Button
      size="sm"
      className="border-transparent bg-black text-white hover:bg-black/80"
      onClick={onConnect}
    >
      <Plug className="mr-1.5 size-3.5" aria-hidden="true" />
      Connect
    </Button>
  );

  return (
    // (1) 2px padding on top/left/right; action row occupies bottom
    <div className="rounded-xl border bg-muted/40 pt-0.5 px-0.5 pb-[9px]">
      {/* (2) White content card — fixed height, subtle bottom shadow */}
      <div className="h-[120px] rounded-lg border bg-background p-4 shadow-sm">
        <div className="flex items-start justify-between gap-2">
          {/* (5) Logo in tactile elevated off-white square */}
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-black/[0.06]">
            {logo}
          </div>
          {/* (9) External link icon instead of ArrowUpRight */}
          <button
            type="button"
            className="mt-0.5 text-muted-foreground/60 transition-colors hover:text-muted-foreground"
            aria-label={`Open ${name} page`}
          >
            <ExternalLink className="size-4" aria-hidden="true" />
          </button>
        </div>
        {/* (3) Tool name removed */}
        {/* (4) 12px gap between logo and subcopy */}
        <p className="mt-3 text-sm leading-snug text-muted-foreground line-clamp-2">
          {description}
        </p>
      </div>
      {/* (8) Action row — 4px horizontal padding, reduced vertical via container */}
      <div className="flex items-center justify-between px-1 pt-2">
        {/* (6) Two states only: Disconnect (white) or Connect (black + plug) */}
        {actionButton}
        {/* (7) Black toggle */}
        <Switch
          checked={isConnected}
          disabled={isOrgManaged || isAdminOnly}
          className="data-[state=checked]:bg-black"
          aria-label={`${isConnected ? 'Disconnect' : 'Connect'} ${name}`}
          onCheckedChange={onToggle}
        />
      </div>
    </div>
  );
}

// ── Shared credential card ────────────────────────────────────────────────────

type SharedCred = {
  id: string;
  name: string;
  service: string;
  type: 'oauth' | 'mcp';
};

function SharedCredentialCard({
  name,
  service,
  type,
  onDelete,
}: {
  name: string;
  service: string;
  type: 'oauth' | 'mcp';
  onDelete: () => void;
}) {
  const Icon = type === 'mcp' ? Server : Users;
  const typeLabel =
    type === 'mcp' ? 'Shared MCP server' : 'Shared OAuth credential';

  return (
    <div className="rounded-xl border bg-muted/40 pt-0.5 px-0.5 pb-[9px]">
      <div className="h-[120px] rounded-lg border bg-background p-4 shadow-sm">
        <Icon className="size-8 shrink-0 text-muted-foreground" aria-hidden="true" />
        <p className="mt-3 text-sm font-medium leading-snug">{name}</p>
        <p className="mt-1 text-sm leading-snug text-muted-foreground line-clamp-2">
          {typeLabel} · {service}
        </p>
      </div>
      <div className="flex items-center justify-between px-1 pt-2">
        <Button
          variant="outline"
          size="sm"
          className="text-destructive hover:text-destructive"
          onClick={onDelete}
        >
          <Trash2 className="mr-1.5 size-3.5" aria-hidden="true" /> Delete
        </Button>
        <Switch checked className="data-[state=checked]:bg-black" aria-label={`${name} shared credential`} />
      </div>
    </div>
  );
}

// ── Vault credential card ─────────────────────────────────────────────────────

function VaultCard({
  name,
  description,
  onDelete,
}: {
  name: string;
  description: string;
  onDelete: () => void;
}) {
  return (
    <div className="rounded-xl border bg-muted/40 pt-0.5 px-0.5 pb-[9px]">
      <div className="h-[120px] rounded-lg border bg-background p-4 shadow-sm">
        <div className="flex items-start justify-between gap-2">
          <KeyRound className="size-8 shrink-0 text-muted-foreground" aria-hidden="true" />
        </div>
        <p className="mt-3 text-sm font-medium leading-snug">{name}</p>
        <p className="mt-1 text-sm leading-snug text-muted-foreground line-clamp-2">
          {description}
        </p>
      </div>
      <div className="flex items-center justify-between px-1 pt-2">
        <Button
          variant="outline"
          size="sm"
          className="text-destructive hover:text-destructive"
          onClick={onDelete}
        >
          <Trash2 className="mr-1.5 size-3.5" aria-hidden="true" /> Delete
        </Button>
        <Switch checked className="data-[state=checked]:bg-black" aria-label={`${name} credential`} />
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function WorkspaceToolsPage({
  companyName = 'Current company',
  canManageCredentials = false,
  customConnections,
  existingCredentials,
}: {
  companyName?: string;
  canManageCredentials?: boolean;
  customConnections?: ReactNode;
  existingCredentials?: ReactNode;
}) {
  const [tab, setTab] = useState('integrations');
  const [query, setQuery] = useState('');
  const [connections, setConnections] = useState(INITIAL_CONNECTIONS);
  const [credentials, setCredentials] = useState<PreviewCredential[]>(
    INITIAL_PREVIEW_CREDENTIALS
  );
  const [openCredential, setOpenCredential] = useState<{
    id: string;
    request: number;
  }>();
  const [customOpen, setCustomOpen] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customUrl, setCustomUrl] = useState('');
  const [customError, setCustomError] = useState('');
  const [selectedTool, setSelectedTool] = useState<Tool | null>(null);
  const [accountName, setAccountName] = useState('');

  // Add credential modal flows (vault API key handled inside VaultCredentialPreview)
  type CredentialFlow = 'shared-oauth' | 'shared-mcp' | null;
  const [credentialFlow, setCredentialFlow] = useState<CredentialFlow>(null);
  const [sharedCreds, setSharedCreds] = useState<SharedCred[]>([]);

  // Shared OAuth form
  const [oauthName, setOauthName] = useState('');
  const [oauthService, setOauthService] = useState('');

  // Shared MCP form
  const [mcpName, setMcpName] = useState('');
  const [mcpUrl, setMcpUrl] = useState('');
  const [mcpToken, setMcpToken] = useState('');
  const [mcpError, setMcpError] = useState('');

  const openFlow = (flow: CredentialFlow) => {
    setOauthName(''); setOauthService('');
    setMcpName(''); setMcpUrl(''); setMcpToken(''); setMcpError('');
    setCredentialFlow(flow);
  };

  const normalized = query.trim().toLowerCase();

  const orgConnections = connections.filter(
    (item) =>
      !item.managedByMe &&
      `${item.name} ${item.service}`.toLowerCase().includes(normalized)
  );
  const myConnections = connections.filter(
    (item) =>
      item.managedByMe &&
      `${item.name} ${item.service}`.toLowerCase().includes(normalized)
  );
  const visibleCredentials = canManageCredentials
    ? credentials.filter((item) =>
        `${item.name} ${item.service ?? 'OpenAI'}`.toLowerCase().includes(normalized)
      )
    : [];

  // Catalog items not yet connected
  const availableCatalog = CATALOG.filter(
    (tool) =>
      !connections.some((c) => c.id === tool.id) &&
      !['microsoft', 'linear'].includes(tool.id) &&
      tool.type !== 'Desktop' &&
      `${tool.name} ${tool.description ?? ''}`.toLowerCase().includes(normalized)
  );

  const changeTab = (value: string) => {
    setTab(value);
    setQuery('');
    if (value !== 'vault') setOpenCredential(undefined);
  };

  const disconnect = (id: string) =>
    setConnections((prev) => prev.filter((c) => c.id !== id));

  const connect = (tool: Tool) => {
    setSelectedTool(tool);
    setAccountName(tool.name);
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
          <div className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm text-muted-foreground">
            <Building2 className="size-4" aria-hidden="true" />
            <span>{companyName}</span>
          </div>
        </div>
      </header>

      <Tabs value={tab} onValueChange={changeTab}>
        <div className="flex items-center gap-2">
          <TabsList aria-label="Integrations">
            <TabsTrigger value="integrations">Integrations</TabsTrigger>
            {canManageCredentials && (
              <TabsTrigger value="vault">Vault</TabsTrigger>
            )}
          </TabsList>
          {tab !== 'vault' && (
            <div className="relative ml-auto w-56">
              <Search
                className="absolute left-3 top-2.5 size-4 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                aria-label="Search integrations"
                placeholder="Search…"
                className="pl-9"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          )}
        </div>

        {/* ── Integrations tab ── */}
        <TabsContent value="integrations" className="mt-7 space-y-10">

          {/* Organization — org-managed connections */}
          {orgConnections.length > 0 && (
            <section>
              <h2 className="mb-4 text-sm font-medium text-foreground">Organization</h2>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {orgConnections.map((item) => (
                  <IntegrationCard
                    key={item.id}
                    logo={item.tool ? <ToolLogo tool={item.tool} /> : <div className="size-8 rounded bg-muted" />}
                    name={item.name}
                    description={item.tool?.description ?? 'Connected by your organization'}
                    isConnected
                    isOrgManaged
                  />
                ))}
              </div>
            </section>
          )}

          {/* Workspace credentials — admin-added shared creds */}
          {canManageCredentials && sharedCreds.length > 0 && (
            <section>
              <h2 className="mb-4 text-sm font-medium text-foreground">Workspace credentials</h2>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {sharedCreds.map((item) => (
                  <SharedCredentialCard
                    key={item.id}
                    name={item.name}
                    service={item.service}
                    type={item.type}
                    onDelete={() =>
                      setSharedCreds((prev) => prev.filter((c) => c.id !== item.id))
                    }
                  />
                ))}
              </div>
            </section>
          )}

          {/* Your connections + available catalog */}
          <section>
            <h2 className="mb-4 text-sm font-medium text-foreground">Your connections</h2>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {/* Vault credentials */}
              {visibleCredentials.map((item) => (
                <VaultCard
                  key={item.id}
                  name={item.name}
                  description={`API credential · ${item.service ?? 'OpenAI'}`}
                  onDelete={() =>
                    setCredentials((prev) => prev.filter((c) => c.id !== item.id))
                  }
                />
              ))}

              {/* Personal connected tools */}
              {myConnections.map((item) => (
                <IntegrationCard
                  key={item.id}
                  logo={item.tool ? <ToolLogo tool={item.tool} /> : <div className="size-8 rounded bg-muted" />}
                  name={item.name}
                  description={item.tool?.description ?? item.method}
                  isConnected
                  onDisconnect={() => disconnect(item.id)}
                  onToggle={(checked) => {
                    if (!checked) disconnect(item.id);
                  }}
                />
              ))}

              {/* Available catalog — states 3 & 4 */}
              {availableCatalog.map((tool) => {
                const isAdminOnly = ADMIN_ONLY_CONNECTION_IDS.has(tool.id);
                return (
                  <IntegrationCard
                    key={tool.id}
                    logo={<ToolLogo tool={tool} />}
                    name={tool.name}
                    description={tool.description ?? 'Connect your account'}
                    isConnected={false}
                    isAdminOnly={isAdminOnly}
                    onConnect={() => connect(tool)}
                    onToggle={(checked) => {
                      if (checked && !isAdminOnly) connect(tool);
                    }}
                  />
                );
              })}

              {!myConnections.length &&
                !visibleCredentials.length &&
                !availableCatalog.length && (
                  <p className="col-span-3 py-10 text-center text-sm text-muted-foreground">
                    No integrations available.
                  </p>
                )}
            </div>
          </section>

          {/* Advanced connections */}
          <details className="rounded-xl border p-5">
            <summary className="cursor-pointer text-sm font-medium">
              Advanced connections
            </summary>
            <div className="mt-4 space-y-4">
              <p className="text-sm text-muted-foreground">
                Connect a service using its custom MCP server address. These
                connections stay within the selected company.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setCustomName('');
                  setCustomUrl('');
                  setCustomError('');
                  setCustomOpen(true);
                }}
              >
                Add custom connection
              </Button>
              {customConnections}
            </div>
          </details>
        </TabsContent>

        {/* ── Vault tab ── */}
        {canManageCredentials && (
          <TabsContent value="vault" className="mt-7 space-y-6">
            <VaultCredentialPreview
              credentials={credentials}
              onCredentialsChange={setCredentials}
              openCredential={openCredential}
              onViewConnections={() => changeTab('integrations')}
              onAddSharedCredential={() => openFlow('shared-oauth')}
              onAddSharedMcp={() => openFlow('shared-mcp')}
            />
            {existingCredentials && (
              <details className="rounded-xl border p-4">
                <summary className="cursor-pointer text-sm font-medium">
                  Existing integration authentication
                </summary>
                <div className="mt-4 space-y-6">{existingCredentials}</div>
              </details>
            )}
          </TabsContent>
        )}
      </Tabs>

      {/* ── Shared OAuth credential dialog ── */}
      <Dialog
        open={credentialFlow === 'shared-oauth'}
        onOpenChange={(open) => { if (!open) setCredentialFlow(null); }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add shared credential</DialogTitle>
            <DialogDescription>
              Connect a service for the whole workspace. All members with access
              can use this connection in their agents.
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              setSharedCreds((prev) => [
                ...prev,
                {
                  id: `shared-oauth-${Date.now()}`,
                  name: oauthName.trim(),
                  service: oauthService.trim(),
                  type: 'oauth',
                },
              ]);
              setCredentialFlow(null);
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="oauth-name">Connection name</Label>
              <Input
                id="oauth-name"
                required
                placeholder="e.g. Marketing Salesforce"
                value={oauthName}
                onChange={(e) => setOauthName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="oauth-service">Service</Label>
              <Input
                id="oauth-service"
                required
                placeholder="e.g. Salesforce, Google Workspace"
                value={oauthService}
                onChange={(e) => setOauthService(e.target.value)}
              />
            </div>
            <p className="text-sm text-muted-foreground">
              In production this will open a browser window to complete the OAuth
              authorization flow with {oauthService || 'the service'}.
            </p>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setCredentialFlow(null)}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!oauthName.trim() || !oauthService.trim()}
              >
                {oauthService.trim()
                  ? `Connect ${oauthService.trim()}`
                  : 'Connect'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Shared MCP credential dialog ── */}
      <Dialog
        open={credentialFlow === 'shared-mcp'}
        onOpenChange={(open) => { if (!open) setCredentialFlow(null); }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add shared MCP credential</DialogTitle>
            <DialogDescription>
              Share an MCP server credential across the workspace. Workspace
              members can use this server in their agent connections.
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              let parsed: URL;
              try {
                parsed = new URL(mcpUrl);
              } catch {
                setMcpError('Enter a valid HTTPS server URL.');
                return;
              }
              if (parsed.protocol !== 'https:') {
                setMcpError('Server URL must use HTTPS.');
                return;
              }
              setSharedCreds((prev) => [
                ...prev,
                {
                  id: `shared-mcp-${Date.now()}`,
                  name: mcpName.trim(),
                  service: parsed.hostname,
                  type: 'mcp',
                },
              ]);
              setCredentialFlow(null);
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="mcp-name">Name</Label>
              <Input
                id="mcp-name"
                required
                placeholder="e.g. Internal reporting server"
                value={mcpName}
                onChange={(e) => setMcpName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mcp-url">Server URL</Label>
              <Input
                id="mcp-url"
                type="url"
                required
                placeholder="https://your-service.example/mcp"
                value={mcpUrl}
                onChange={(e) => { setMcpUrl(e.target.value); setMcpError(''); }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mcp-token">
                Auth token{' '}
                <span className="text-xs font-normal text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="mcp-token"
                type="password"
                placeholder="Bearer token or API key"
                value={mcpToken}
                onChange={(e) => setMcpToken(e.target.value)}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Do not include secrets in the URL. The auth token is write-only.
            </p>
            {mcpError && (
              <p role="alert" className="text-sm text-destructive">{mcpError}</p>
            )}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setCredentialFlow(null)}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!mcpName.trim() || !mcpUrl.trim()}
              >
                Save credential
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Add custom connection dialog ── */}
      <Dialog open={customOpen} onOpenChange={setCustomOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add custom connection</DialogTitle>
            <DialogDescription>
              Add a custom service to {companyName}. Technical connection type: MCP.
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              let parsed: URL;
              try {
                parsed = new URL(customUrl);
              } catch {
                setCustomError('Enter a valid HTTPS server URL.');
                return;
              }
              if (
                !parsed ||
                parsed.protocol !== 'https:' ||
                parsed.username ||
                parsed.password ||
                parsed.search ||
                parsed.hash
              ) {
                setCustomError(
                  'Use an HTTPS server URL without passwords, tokens, query parameters, or fragments.'
                );
                return;
              }
              setConnections((items) => [
                ...items,
                {
                  id: `custom-${Date.now()}`,
                  name: customName.trim(),
                  service: parsed.hostname,
                  managedByMe: true,
                  status: 'Not tested',
                  method: `Custom connection · MCP · ${parsed.hostname}`,
                },
              ]);
              setCustomOpen(false);
              setQuery('');
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="custom-name">Connection name</Label>
              <Input
                id="custom-name"
                required
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="e.g. Internal reporting"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="custom-url">Server URL</Label>
              <Input
                id="custom-url"
                type="url"
                required
                value={customUrl}
                onChange={(e) => setCustomUrl(e.target.value)}
                placeholder="https://your-service.example/mcp"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Do not include a secret in the URL. Saving this setup does not test or authorize the service.
            </p>
            {customError && (
              <p role="alert" className="text-sm text-destructive">{customError}</p>
            )}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setCustomOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={!customName.trim() || !customUrl.trim()}>
                Save connection
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Connect tool dialog ── */}
      <Dialog
        open={selectedTool !== null}
        onOpenChange={(open) => { if (!open) setSelectedTool(null); }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedTool?.name} connection</DialogTitle>
            <DialogDescription>
              Set up an account for use in {companyName}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="account-name">Connection name</Label>
            <Input
              id="account-name"
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
            />
          </div>
          <p className="text-sm text-muted-foreground">
            This preview saves the connection name only. Provider sign-in is not connected here.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setSelectedTool(null)}>Cancel</Button>
            <Button
              disabled={!accountName.trim()}
              onClick={() => {
                if (!selectedTool) return;
                const tool = selectedTool;
                setConnections((items) => {
                  const existing = items.find((item) => item.id === tool.id);
                  if (existing)
                    return items.map((item) =>
                      item.id === tool.id ? { ...item, name: accountName.trim() } : item
                    );
                  return [
                    ...items,
                    {
                      id: tool.id,
                      name: accountName.trim(),
                      service: tool.name,
                      tool,
                      managedByMe: true,
                      status: 'Setup needed',
                      method: 'Account connection',
                    },
                  ];
                });
                setSelectedTool(null);
                changeTab('integrations');
              }}
            >
              Save setup
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
