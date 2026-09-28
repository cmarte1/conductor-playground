'use client';
import { useState } from 'react';
import { toast } from 'sonner';
import { notifyLoading, notifySuccess } from '../tools/prototypeToast';
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Loader2,
  Search,
} from 'lucide-react';
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
import { cn } from '@/lib/utils';
import { CredentialProviderLogo } from './CredentialProviderLogo';
import {
  CONNECTION_SERVICES,
  EMPTY_AUDIENCE,
  PROVIDER_KEY_SERVICES,
  ShareAccessPanel,
  ShareConfirmActions,
  ShareConfirmBody,
  needsShareConfirmation,
  shareConfirmTitle,
  simulateRunsAs,
  type CredentialKind,
  type RunsAs,
  type ShareAudience,
} from './credentialSharing';

// Add a Vault credential, service-first. Two kinds share this flow:
//   - Provider API key: a key agents call a service with (OpenAI, Stripe…).
//   - Shared connection: one token that powers a Hatz integration for the team,
//     replacing each person's own connection.
// Steps: 1. choose the service  2. get + paste the key (guided), save and check
//   3. share (People | Agents), with the account it runs as  4. confirm broad
//   or personal-account shares.
// Local prototype only: the check is simulated and the full key never leaves
// this dialog; only a masked preview is handed back.

/** Recognisable key prefixes. Used as a safety check against the chosen service. */
export function detectProvider(key: string): string | null {
  const value = key.trim();
  if (value.startsWith('sk-ant-')) return 'Anthropic';
  if (value.startsWith('sk-')) return 'OpenAI';
  if (value.startsWith('sk_live_') || value.startsWith('sk_test_') || value.startsWith('rk_')) return 'Stripe';
  if (value.startsWith('ghp_') || value.startsWith('github_pat_')) return 'GitHub';
  if (value.startsWith('lin_api_')) return 'Linear';
  if (value.startsWith('secret_') || value.startsWith('ntn_')) return 'Notion';
  if (value.startsWith('pat-')) return 'HubSpot';
  if (value.startsWith('pat')) return 'Airtable';
  return null;
}

const maskKey = (key: string) => {
  const value = key.trim();
  const prefix = value.match(/^[a-z]+[-_](?:[a-z]+[-_])?/i)?.[0] ?? '';
  return `${prefix}${value.slice(prefix.length, prefix.length + 4)}...${value.slice(-4)}`;
};

// Short, spaced, or "invalid" keys fail the simulated check so the error path can be demoed.
const simulateProviderCheck = (key: string) =>
  key.length >= 20 && !/\s/.test(key) && !/invalid/i.test(key);

type Guide = { steps: string[]; url?: string; linkLabel?: string };

/** Where to get a key, per provider. Unknown providers get generic steps. */
const KEY_GUIDES: Record<string, Guide> = {
  OpenAI: {
    url: 'https://platform.openai.com/api-keys',
    linkLabel: 'Open OpenAI API keys',
    steps: ['Sign in to OpenAI and open API keys', 'Click Create new secret key, then copy it', 'Paste it below'],
  },
  Anthropic: {
    url: 'https://console.anthropic.com/settings/keys',
    linkLabel: 'Open Anthropic API keys',
    steps: ['Sign in to the Anthropic Console and open API keys', 'Click Create key, then copy it', 'Paste it below'],
  },
  GitHub: {
    url: 'https://github.com/settings/tokens',
    linkLabel: 'Open GitHub tokens',
    steps: ['Open Settings → Developer settings → Personal access tokens', 'Generate a fine-grained token with only the access you need', 'Copy it and paste it below'],
  },
  Stripe: {
    url: 'https://dashboard.stripe.com/apikeys',
    linkLabel: 'Open Stripe API keys',
    steps: ['Open Developers → API keys in Stripe', 'Create a restricted key with only the access you need', 'Copy it and paste it below'],
  },
  Linear: {
    url: 'https://linear.app/settings/account/security',
    linkLabel: 'Open Linear API settings',
    steps: ['Sign in to Linear with the account agents should act as', 'Open Settings → Security & access → Personal API keys', 'Create a key, copy it, and paste it below'],
  },
  HubSpot: {
    url: 'https://app.hubspot.com/private-apps',
    linkLabel: 'Open HubSpot private apps',
    steps: ['Create a private app in HubSpot with only the scopes you need', 'Copy its access token', 'Paste it below'],
  },
  Notion: {
    url: 'https://www.notion.so/my-integrations',
    linkLabel: 'Open Notion integrations',
    steps: ['Create a new internal integration in Notion', 'Copy its Internal Integration Secret', 'Paste it below'],
  },
  Airtable: {
    url: 'https://airtable.com/create/tokens',
    linkLabel: 'Open Airtable tokens',
    steps: ['Create a personal access token in Airtable', 'Pick the scopes and bases it can use, then copy it', 'Paste it below'],
  },
};
const guideFor = (service: string): Guide =>
  KEY_GUIDES[service] ?? {
    steps: [
      `Open API keys in your ${service} account settings`,
      'Create a new key and copy it',
      'Paste it below',
    ],
  };

export type NewApiKey = {
  kind: CredentialKind;
  name: string;
  service: string;
  organization: string;
  keyPreview: string;
  /** The account the connection check reported. */
  runsAs: RunsAs;
  /** Who can use it: workspace or roles, plus agents. */
  audience: ShareAudience;
};

type Step = 'service' | 'connect' | 'share' | 'confirm';
type Checked = Omit<NewApiKey, 'audience' | 'kind'>;

export type Teammate = { name: string; email: string };

export function AddApiKeyDialog({
  kind = 'apiKey',
  open,
  onOpenChange,
  onAdded,
  currentUser,
}: {
  kind?: CredentialKind;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdded: (key: NewApiKey) => void;
  currentUser: Teammate;
}) {
  const noun = kind === 'apiKey' ? 'key' : 'token';
  const [step, setStep] = useState<Step>('service');
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState('');
  const [listOpen, setListOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [service, setService] = useState('');
  const [key, setKey] = useState('');
  const [name, setName] = useState('');
  const [nameEdited, setNameEdited] = useState(false);
  const [organization, setOrganization] = useState('');
  const [moreOpen, setMoreOpen] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState('');
  const [checked, setChecked] = useState<Checked | null>(null);
  const [audience, setAudience] = useState<ShareAudience>(EMPTY_AUDIENCE);

  const detected = detectProvider(key);
  const mismatch = detected && service && detected !== service ? detected : null;
  const displayName = nameEdited ? name : service ? `${service} ${kind === 'apiKey' ? 'key' : 'team connection'}` : '';
  const results = (kind === 'apiKey' ? PROVIDER_KEY_SERVICES : CONNECTION_SERVICES).filter((s) =>
    s.toLowerCase().includes(query.trim().toLowerCase())
  );
  const guide = guideFor(service);
  const reset = () => {
    setStep('service');
    setQuery('');
    setPicked('');
    setListOpen(false);
    setActive(0);
    setService('');
    setKey('');
    setName('');
    setNameEdited(false);
    setOrganization('');
    setMoreOpen(false);
    setChecking(false);
    setError('');
    setChecked(null);
    setAudience(EMPTY_AUDIENCE);
  };

  const finish = (shared: ShareAudience = audience) => {
    if (checked) onAdded({ ...checked, kind, audience: shared });
    reset();
    onOpenChange(false);
  };

  // Closing after a successful check still keeps the key (nothing granted yet).
  const close = (next: boolean) => {
    if (next) return onOpenChange(true);
    if (checking) return;
    // The key is saved once the check passes; closing the share step keeps it.
    if (step === 'share') return finish();
    // Closing an unconfirmed broad share keeps the credential private (agents stay).
    if (step === 'confirm') return finish({ ...EMPTY_AUDIENCE, agents: audience.agents });
    reset();
    onOpenChange(false);
  };

  const pick = (value: string) => {
    setPicked(value);
    setQuery('');
    setListOpen(false);
  };

  const chooseService = (value: string) => {
    setService(value);
    setError('');
    setStep('connect');
  };

  const saveAndCheck = () => {
    const value = key.trim();
    if (!value || !displayName.trim() || checking) return;
    setError('');
    setChecking(true);
    const toastId = notifyLoading(`Checking your ${service} ${noun}…`);
    setTimeout(() => {
      setChecking(false);
      if (!simulateProviderCheck(value)) {
        // The error belongs on the field it's about; no error toast.
        toast.dismiss(toastId);
        setError(`${service} didn't accept this ${noun}. Check that you copied all of it, then paste it again.`);
        setKey('');
        return;
      }
      const runsAs = simulateRunsAs(kind, service, value);
      notifySuccess(
        kind === 'apiKey' ? `${service} key is active` : `Connected as ${runsAs.handle} on ${service}`,
        toastId
      );
      setChecked({
        name: displayName.trim(),
        service,
        organization: organization.trim(),
        keyPreview: maskKey(value),
        runsAs,
      });
      setStep('share');
    }, 1600);
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-w-[560px]">
        {step === 'service' && (
          <>
            <DialogHeader className="space-y-[9px]">
              <DialogTitle>{kind === 'apiKey' ? 'Add provider API key' : 'Add shared connection'}</DialogTitle>
              <DialogDescription className="pr-6">
                {kind === 'apiKey'
                  ? 'Choose the service this key is for. Keys belong to the workspace and keep working if the person who added them leaves.'
                  : "Choose the tool to connect once for your team. People you share it with use this account instead of their own."}
              </DialogDescription>
            </DialogHeader>
            {/* n8n-style combobox: the list floats over the modal instead of growing it. */}
            <div
              className="relative mt-2"
              onBlur={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget)) setListOpen(false);
              }}
            >
              <div
                className={cn(
                  'flex h-11 items-center gap-2 rounded-md border bg-background px-3 transition-colors focus-within:border-ring focus-within:ring-1 focus-within:ring-ring',
                  listOpen && 'border-ring ring-1 ring-ring'
                )}
              >
                {picked && !listOpen ? (
                  <CredentialProviderLogo service={picked} size={18} />
                ) : (
                  <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                )}
                <input
                  autoFocus
                  role="combobox"
                  aria-label="Search services"
                  aria-expanded={listOpen}
                  aria-controls="service-listbox"
                  aria-autocomplete="list"
                  aria-activedescendant={listOpen && results[active] ? `service-${active}` : undefined}
                  className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                  placeholder="Search services…"
                  value={listOpen ? query : picked || query}
                  onClick={() => setListOpen(true)}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setPicked('');
                    setActive(0);
                    setListOpen(true);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                      e.preventDefault();
                      if (!listOpen) return setListOpen(true);
                      const next = Math.max(
                        0,
                        Math.min(results.length - 1, active + (e.key === 'ArrowDown' ? 1 : -1))
                      );
                      setActive(next);
                      document.getElementById(`service-${next}`)?.scrollIntoView({ block: 'nearest' });
                    } else if (e.key === 'Enter') {
                      e.preventDefault();
                      if (listOpen && results[active]) pick(results[active]);
                      else if (picked) chooseService(picked);
                    } else if (e.key === 'Escape' && listOpen) {
                      e.preventDefault();
                      e.stopPropagation();
                      setListOpen(false);
                    }
                  }}
                />
                <button
                  type="button"
                  tabIndex={-1}
                  aria-label={listOpen ? 'Hide services' : 'Show services'}
                  onClick={() => setListOpen((v) => !v)}
                >
                  <ChevronDown
                    className={cn('size-4 text-muted-foreground transition-transform', listOpen && 'rotate-180')}
                    aria-hidden="true"
                  />
                </button>
              </div>
              {listOpen && (
                <div
                  id="service-listbox"
                  role="listbox"
                  aria-label="Services"
                  className="absolute left-0 right-0 top-full z-50 mt-2 max-h-72 overflow-y-auto overscroll-contain rounded-md border bg-popover py-1 text-popover-foreground shadow-lg"
                >
                  {results.map((item, index) => (
                    <div
                      key={item}
                      id={`service-${index}`}
                      role="option"
                      aria-selected={picked === item}
                      tabIndex={-1}
                      onMouseDown={(e) => e.preventDefault()}
                      onMouseMove={() => setActive(index)}
                      onClick={() => pick(item)}
                      className={cn(
                        'flex cursor-pointer items-center gap-3 px-4 py-2.5 text-sm',
                        active === index && 'bg-muted'
                      )}
                    >
                      <CredentialProviderLogo service={item} size={20} />
                      <span>{item}</span>
                    </div>
                  ))}
                  {!results.length && (
                    <p role="status" className="px-4 py-4 text-sm text-muted-foreground">
                      No services match “{query.trim()}”.
                    </p>
                  )}
                </div>
              )}
            </div>
            <div className="flex justify-end pt-2">
              <Button disabled={!picked} className="bg-[#171717] text-white hover:bg-[#171717]/85" onClick={() => chooseService(picked)}>
                Continue
              </Button>
            </div>
          </>
        )}

        {step === 'connect' && (
          <>
            <DialogHeader className="space-y-[9px]">
              <DialogTitle className="flex items-center gap-2">
                <CredentialProviderLogo service={service} size={20} />
                Connect {service}
              </DialogTitle>
              <DialogDescription className="pr-6">
                {kind === 'apiKey' ? (
                  <>
                    Paste {/^[AEIOU]/.test(service) ? 'an' : 'a'} {service} API key so your agents can
                    call it on the workspace&apos;s account.
                  </>
                ) : (
                  <>
                    Paste a {service} token. Everyone you share this with will act as the account
                    that owns it.
                  </>
                )}
              </DialogDescription>
            </DialogHeader>
            <form
              className="mt-2 space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                saveAndCheck();
              }}
            >
              {/* Guidance before the field: non-technical admins need to know where the key lives. */}
              <div className="rounded-lg border bg-muted/30 p-4">
                <p className="text-sm font-medium text-foreground">Get your {service} {noun}</p>
                <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
                  {guide.steps.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ol>
                {guide.url && (
                  <a
                    href={guide.url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-info-500 hover:text-info-500/80 underline-offset-4 hover:underline"
                  >
                    {guide.linkLabel}
                    <ExternalLink className="size-3.5" aria-hidden="true" />
                  </a>
                )}
                {kind === 'connection' && (
                  <p className="mt-3 border-t pt-3 text-xs text-muted-foreground">
                    Use a token from a service account, not your personal account. Everyone you
                    share with acts as whoever owns the token.
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="new-api-key">{kind === 'apiKey' ? 'API key' : 'Access token'}</Label>
                <Input
                  id="new-api-key"
                  type="password"
                  autoComplete="off"
                  autoFocus
                  placeholder={`Paste your ${service} ${noun}`}
                  value={key}
                  disabled={checking}
                  aria-invalid={Boolean(error)}
                  aria-describedby="new-api-key-hint"
                  onChange={(e) => {
                    setKey(e.target.value);
                    setError('');
                  }}
                />
                <p
                  id="new-api-key-hint"
                  role={error || mismatch ? 'alert' : undefined}
                  className={cn(
                    'flex min-h-4 items-center gap-1.5 text-xs',
                    error ? 'text-destructive' : mismatch ? 'text-amber-700' : 'text-muted-foreground'
                  )}
                >
                  {error ? (
                    error
                  ) : mismatch ? (
                    <>
                      <AlertTriangle className="size-3.5 shrink-0" aria-hidden="true" />
                      This looks like {/^[AEIOU]/.test(mismatch) ? 'an' : 'a'} {mismatch} {noun}.
                      <button
                        type="button"
                        onClick={() => setService(mismatch)}
                        className="font-medium underline underline-offset-2"
                      >
                        Switch to {mismatch}
                      </button>
                    </>
                  ) : (
                    // Reassurance, not a warning: the user is handing Hatz a secret they already hold.
                    'Stored encrypted. No one, including you, can view it after saving.'
                  )}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="new-api-key-name">{kind === 'apiKey' ? 'Key name' : 'Connection name'}</Label>
                <Input
                  id="new-api-key-name"
                  placeholder="e.g. Production key"
                  value={displayName}
                  disabled={checking}
                  onChange={(e) => {
                    setName(e.target.value);
                    setNameEdited(true);
                  }}
                />
              </div>

              {service === 'OpenAI' && (
                <div>
                  <button
                    type="button"
                    onClick={() => setMoreOpen((v) => !v)}
                    aria-expanded={moreOpen}
                    className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
                  >
                    <ChevronRight
                      className={cn('size-3.5 transition-transform', moreOpen && 'rotate-90')}
                      aria-hidden="true"
                    />
                    More options
                  </button>
                  {moreOpen && (
                    <div className="mt-3 space-y-2">
                      <Label htmlFor="new-api-key-org">Organization ID (optional)</Label>
                      <Input
                        id="new-api-key-org"
                        placeholder="org-…"
                        value={organization}
                        onChange={(e) => setOrganization(e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">
                        Needed only if you belong to more than one OpenAI organization.
                      </p>
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  disabled={checking}
                  onClick={() => {
                    setPicked(service);
                    setError('');
                    setStep('service');
                  }}
                >
                  Back
                </Button>
                <Button
                  type="submit"
                  disabled={!key.trim() || !displayName.trim() || checking}
                  className="gap-1.5 bg-[#171717] text-white hover:bg-[#171717]/85"
                >
                  {checking && <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />}
                  {checking ? 'Checking…' : 'Save and check'}
                </Button>
              </div>
            </form>
          </>
        )}

        {step === 'share' && checked && (
          <>
            <DialogHeader>
              <DialogTitle>Share {checked.name}</DialogTitle>
              <DialogDescription className="sr-only">
                Choose who can use this {noun}. No one can view the {noun} itself.
              </DialogDescription>
            </DialogHeader>
            <div className="mt-1">
              <ShareAccessPanel
                kind={kind}
                service={checked.service}
                runsAs={checked.runsAs}
                value={audience}
                onChange={setAudience}
                currentUserEmail={currentUser.email}
                onUseServiceAccount={
                  kind === 'connection'
                    ? () => {
                        // Start the token over; nothing has been shared yet.
                        setChecked(null);
                        setKey('');
                        setStep('connect');
                      }
                    : undefined
                }
              />
            </div>
            <div className="flex justify-end border-t pt-4">
              <Button
                className="bg-[#171717] text-white hover:bg-[#171717]/85"
                onClick={() =>
                  needsShareConfirmation(audience, checked.runsAs) ? setStep('confirm') : finish()
                }
              >
                Done
              </Button>
            </div>
          </>
        )}

        {step === 'confirm' && checked && (
          <>
            <DialogHeader className="space-y-[9px]">
              <DialogTitle>{shareConfirmTitle(audience, checked.runsAs)}</DialogTitle>
              <DialogDescription className="pr-6">
                {checked.name} · {checked.service}
              </DialogDescription>
            </DialogHeader>
            <div className="mt-2">
              <ShareConfirmBody kind={kind} service={checked.service} runsAs={checked.runsAs} audience={audience} />
            </div>
            <ShareConfirmActions audience={audience} onBack={() => setStep('share')} onConfirm={() => finish()} />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
