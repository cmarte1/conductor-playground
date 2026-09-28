'use client';
import { useState, type ReactNode } from 'react';
import { AlertTriangle, Bot, Check, User, Users } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/Tooltip';
import { cn } from '@/lib/utils';
import { CredentialProviderLogo } from './CredentialProviderLogo';

// What sharing a Vault credential means, said the same way everywhere it's
// decided or reviewed: the share step, the confirmation, the table hover and
// the credential's Access tab. Two facts drive every line:
//   1. Whose account the actions run as (the connection check reports it).
//   2. What sharing does: a provider key *adds* access; a shared connection
//      *replaces* each person's own connection, with no opt-out (production's
//      override behavior, see SharedCredentialOverrideWarning).
// Share targets match production: the whole workspace or roles, plus agents
// (planned in the Vault contract). Individual users, groups and artifacts are
// not supported targets yet.

export type CredentialKind = 'apiKey' | 'connection';
export type AccountKind = 'personal' | 'service' | 'organization';
export type RunsAs = { handle: string; kind: AccountKind };
export type ShareAudience = { workspace: boolean; roles: string[]; agents: string[] };

export const EMPTY_AUDIENCE: ShareAudience = { workspace: false, roles: [], agents: [] };

// Demo workspace: 14 people across four roles. The signed-in demo user is an admin.
export const WORKSPACE_PEOPLE = 14;
export const ROLES = [
  { name: 'Workspace admins', people: 3 },
  { name: 'Engineering', people: 5 },
  { name: 'Customer success', people: 4 },
  { name: 'Sales', people: 2 },
] as const;
const CURRENT_USER_ROLES = ['Workspace admins'];
export const DEMO_AGENTS = ['Research assistant', 'Customer success agent', 'Analytics reporter'];

/** Services agents call directly with a key (no Hatz integration of their own). */
export const PROVIDER_KEY_SERVICES = ['Airtable', 'Anthropic', 'OpenAI', 'Stripe'];
/** Hatz integrations an admin can connect once for the team with a token. */
export const CONNECTION_SERVICES = ['Asana', 'Canny', 'Figma', 'GitHub', 'HubSpot', 'Linear', 'Notion'];

/** Anything stored in Vault that can be shared. */
type Shareable = {
  service?: string;
  agents: string[];
  sharing?: { workspace: boolean; roles: string[] };
  runsAs?: RunsAs;
};
export const audienceOf = (item: Shareable): ShareAudience => ({
  workspace: item.sharing?.workspace ?? false,
  roles: item.sharing?.roles ?? [],
  agents: item.agents,
});
export const runsAsOf = (item: Shareable): RunsAs =>
  item.runsAs ?? { handle: `Hatz's ${item.service ?? 'OpenAI'} account`, kind: 'organization' };

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
export const peopleLabel = (n: number) => (n === 1 ? '1 person' : `${n} people`);

export function peopleCount(audience: ShareAudience): number {
  if (audience.workspace) return WORKSPACE_PEOPLE;
  const inRoles = ROLES.filter((r) => audience.roles.includes(r.name)).reduce(
    (sum, r) => sum + r.people,
    0
  );
  return Math.max(inRoles, 1); // the owner always has access
}

/** Does this audience include the signed-in demo user (so their own connection is replaced)? */
export const includesCurrentUser = (audience: ShareAudience) =>
  audience.workspace || audience.roles.some((r) => CURRENT_USER_ROLES.includes(r));

/** A personal account shared with anyone else: the pattern behind the GitHub incident. */
export const isRiskyShare = (audience: ShareAudience, runsAs: RunsAs) =>
  runsAs.kind === 'personal' && peopleCount(audience) > 1;

/** Broad or personal-account shares get a second, explicit confirmation. */
export const needsShareConfirmation = (audience: ShareAudience, runsAs: RunsAs) =>
  audience.workspace || isRiskyShare(audience, runsAs);

export function audienceShort(audience: ShareAudience): string {
  const people = audience.workspace
    ? 'Everyone'
    : audience.roles.length === 1
      ? audience.roles[0]
      : audience.roles.length
        ? `${audience.roles.length} roles`
        : 'Only you';
  return audience.agents.length ? `${people} · ${plural(audience.agents.length, 'agent')}` : people;
}

export function audiencePeopleDetail(audience: ShareAudience): string {
  if (audience.workspace) return `Everyone in the workspace · ${peopleLabel(WORKSPACE_PEOPLE)}`;
  if (audience.roles.length) return `${audience.roles.join(', ')} · ${peopleLabel(peopleCount(audience))}`;
  return 'Only you';
}

export function runsAsLine(runsAs: RunsAs, service: string): string {
  if (runsAs.kind === 'personal') return `Personal ${service} account`;
  if (runsAs.kind === 'service') return 'Service account';
  return `Your workspace's ${service} account · usage bills here`;
}

/** The sentence people read right before they confirm. */
export function shareSummary(
  kind: CredentialKind,
  audience: ShareAudience,
  runsAs: RunsAs,
  service: string
): string {
  const people = peopleCount(audience);
  const agents = audience.agents.length;
  if (people <= 1 && !agents)
    return kind === 'apiKey'
      ? 'Only you can use this key so far. It does nothing until an agent or teammate can use it.'
      : `Only you use this connection so far. No one else's ${service} connection changes.`;
  const who = [people > 1 ? peopleLabel(people) : '', agents ? plural(agents, 'agent') : '']
    .filter(Boolean)
    .join(' and ');
  if (kind === 'apiKey') return `${who} can use this key. Calls run on ${runsAs.handle}. No one can view the key.`;
  return people > 1
    ? `${who} will act as ${runsAs.handle} on ${service}. It replaces their own ${service} connection.`
    : `${who} will act as ${runsAs.handle} on ${service}.`;
}

// Prototype stand-in for what the connection check reports about the account.
// Tokens containing "bot", "svc" or "service" come back as a service account.
export function simulateRunsAs(kind: CredentialKind, service: string, key: string): RunsAs {
  if (kind === 'apiKey') return { handle: `Hatz's ${service} account`, kind: 'organization' };
  const isService = /bot|svc|service/i.test(key);
  if (service === 'GitHub') return { handle: isService ? '@hatz-bot' : '@cmarte', kind: isService ? 'service' : 'personal' };
  return { handle: isService ? 'hatz-bot@hatz.ai' : 'cmarte@hatz.ai', kind: isService ? 'service' : 'personal' };
}

// ── Runs as ───────────────────────────────────────────────────────────────────

export function RunsAsNotice({
  kind,
  service,
  runsAs,
  onUseServiceAccount,
}: {
  kind: CredentialKind;
  service: string;
  runsAs: RunsAs;
  /** Offered when a personal account is about to be shared. */
  onUseServiceAccount?: () => void;
}) {
  const personal = kind === 'connection' && runsAs.kind === 'personal';
  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-lg border px-3 py-2.5',
        personal && 'border-amber-200 bg-amber-50'
      )}
    >
      <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-white shadow-sm ring-1 ring-black/[0.06]">
        <CredentialProviderLogo service={service} size={16} />
      </span>
      <div className="min-w-0 flex-1 text-sm">
        <p className="text-foreground">
          Runs as <span className="font-medium">{runsAs.handle}</span>
        </p>
        <p className={cn('text-xs', personal ? 'text-amber-800' : 'text-muted-foreground')}>
          {personal
            ? `A personal ${service} account. Anyone it's shared with acts as ${runsAs.handle}.`
            : runsAsLine(runsAs, service)}
        </p>
        {personal && onUseServiceAccount && (
          <button
            type="button"
            onClick={onUseServiceAccount}
            className="mt-1 text-xs text-info-500 underline-offset-4 hover:underline"
          >
            Use a service account instead
          </button>
        )}
      </div>
    </div>
  );
}

// ── Share panel: People | Agents ─────────────────────────────────────────────

type PeopleMode = 'me' | 'workspace' | 'roles';

function ChoiceRow({
  selected,
  onSelect,
  icon,
  label,
  detail,
  multi = false,
}: {
  selected: boolean;
  onSelect: () => void;
  icon: ReactNode;
  label: ReactNode;
  detail?: ReactNode;
  multi?: boolean;
}) {
  return (
    <li>
      <button
        type="button"
        role={multi ? 'checkbox' : 'radio'}
        aria-checked={selected}
        onClick={onSelect}
        className="flex h-12 w-full items-center gap-3 rounded-md px-1 text-left transition-colors hover:bg-muted/50"
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">{icon}</span>
        <span className="min-w-0 flex-1 truncate text-sm text-foreground">{label}</span>
        {detail && <span className="shrink-0 text-xs text-muted-foreground">{detail}</span>}
        <span
          aria-hidden="true"
          className={cn(
            'flex size-4 shrink-0 items-center justify-center border transition-colors',
            multi ? 'rounded-[4px]' : 'rounded-full',
            selected ? 'border-[#171717] bg-[#171717] text-white' : 'border-neutral-300 bg-white'
          )}
        >
          {selected && (multi ? <Check className="size-3" /> : <span className="size-1.5 rounded-full bg-white" />)}
        </span>
      </button>
    </li>
  );
}

export function ShareAccessPanel({
  kind,
  service,
  runsAs,
  value,
  onChange,
  currentUserEmail,
  onUseServiceAccount,
}: {
  kind: CredentialKind;
  service: string;
  runsAs: RunsAs;
  value: ShareAudience;
  onChange: (next: ShareAudience) => void;
  currentUserEmail: string;
  onUseServiceAccount?: () => void;
}) {
  const [tab, setTab] = useState<'people' | 'agents'>('people');
  const [mode, setMode] = useState<PeopleMode>(
    value.workspace ? 'workspace' : value.roles.length ? 'roles' : 'me'
  );
  const setPeople = (next: PeopleMode) => {
    setMode(next);
    onChange({ ...value, workspace: next === 'workspace', roles: next === 'roles' ? value.roles : [] });
  };
  const toggle = (list: string[], item: string) =>
    list.includes(item) ? list.filter((x) => x !== item) : [...list, item];
  const risky = isRiskyShare(value, runsAs);

  return (
    <div className="space-y-4">
      <RunsAsNotice
        kind={kind}
        service={service}
        runsAs={runsAs}
        onUseServiceAccount={onUseServiceAccount}
      />

      <div role="tablist" aria-label="Share with" className="grid grid-cols-2 rounded-lg bg-muted p-1">
        {(['people', 'agents'] as const).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={cn(
              'rounded-[4px] py-1.5 text-sm font-medium transition-colors',
              tab === t ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {t === 'people' ? 'People' : 'Agents'}
            {t === 'agents' && value.agents.length > 0 && (
              <span className="ml-1.5 text-xs text-muted-foreground">{value.agents.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* Both tabs start at the same height (three rows); People grows when roles open. */}
      <div className="min-h-[152px]">
        {tab === 'people' ? (
          <ul role="radiogroup" aria-label="Who can use it" className="space-y-1">
            <ChoiceRow
              selected={mode === 'me'}
              onSelect={() => setPeople('me')}
              icon={<User className="size-4 text-muted-foreground" aria-hidden="true" />}
              label={
                <>
                  Only you <span className="text-muted-foreground">({currentUserEmail})</span>
                </>
              }
              detail="Owner"
            />
            <ChoiceRow
              selected={mode === 'workspace'}
              onSelect={() => setPeople('workspace')}
              icon={<Users className="size-4 text-muted-foreground" aria-hidden="true" />}
              label="Everyone in the workspace"
              detail={peopleLabel(WORKSPACE_PEOPLE)}
            />
            <ChoiceRow
              selected={mode === 'roles'}
              onSelect={() => setPeople('roles')}
              icon={<Users className="size-4 text-muted-foreground" aria-hidden="true" />}
              label="Specific roles"
              detail={value.roles.length ? peopleLabel(peopleCount(value)) : undefined}
            />
            {mode === 'roles' && (
              <li>
                <ul aria-label="Roles" className="ml-12 space-y-0.5 border-l pl-3">
                  {ROLES.map((role) => (
                    <ChoiceRow
                      key={role.name}
                      multi
                      selected={value.roles.includes(role.name)}
                      onSelect={() => onChange({ ...value, roles: toggle(value.roles, role.name) })}
                      icon={<Users className="size-3.5 text-muted-foreground" aria-hidden="true" />}
                      label={role.name}
                      detail={peopleLabel(role.people)}
                    />
                  ))}
                </ul>
              </li>
            )}
          </ul>
        ) : (
          <ul aria-label="Agents" className="space-y-1">
            {DEMO_AGENTS.map((agent) => (
              <ChoiceRow
                key={agent}
                multi
                selected={value.agents.includes(agent)}
                onSelect={() => onChange({ ...value, agents: toggle(value.agents, agent) })}
                icon={<Bot className="size-4 text-muted-foreground" aria-hidden="true" />}
                label={agent}
              />
            ))}
          </ul>
        )}
      </div>

      <p
        role="status"
        className={cn(
          'rounded-md px-3 py-2 text-xs leading-relaxed',
          risky ? 'bg-amber-50 text-amber-900' : 'bg-muted/60 text-muted-foreground'
        )}
      >
        {shareSummary(kind, value, runsAs, service)}
      </p>
    </div>
  );
}

// ── Confirmation for broad or personal-account shares ────────────────────────

export function ShareConfirmBody({
  kind,
  service,
  runsAs,
  audience,
}: {
  kind: CredentialKind;
  service: string;
  runsAs: RunsAs;
  audience: ShareAudience;
}) {
  const people = peopleLabel(peopleCount(audience));
  const facts = [
    kind === 'apiKey'
      ? `${people} can use this key. Calls run on ${runsAs.handle}.`
      : `${people} will act as ${runsAs.handle} on ${service}.`,
    kind === 'connection' &&
      `It replaces their own ${service} connection, and they can't opt out.`,
    `They can use it, but they can't view the ${kind === 'apiKey' ? 'key' : 'token'}.`,
    runsAs.kind === 'personal' &&
      `This is a personal account. If its owner leaves or revokes the token, it stops working for everyone.`,
    'You can change who has access anytime in Vault.',
  ].filter((fact): fact is string => Boolean(fact));
  return (
    <ul className="space-y-2.5">
      {facts.map((fact) => (
        <li key={fact} className="flex gap-2.5 text-sm text-foreground">
          <span className="mt-2 size-1.5 shrink-0 rounded-full bg-muted-foreground/60" aria-hidden="true" />
          {fact}
        </li>
      ))}
    </ul>
  );
}

export const shareConfirmTitle = (audience: ShareAudience, runsAs: RunsAs) =>
  audience.workspace ? 'Share with everyone in the workspace?' : runsAs.kind === 'personal' ? 'Share a personal account?' : 'Share this credential?';

export function ShareConfirmActions({
  audience,
  onBack,
  onConfirm,
}: {
  audience: ShareAudience;
  onBack: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="flex justify-end gap-2 border-t pt-4">
      <Button variant="outline" onClick={onBack}>
        Back
      </Button>
      <Button className="bg-[#171717] text-white hover:bg-[#171717]/85" onClick={onConfirm}>
        Share with {peopleLabel(peopleCount(audience))}
      </Button>
    </div>
  );
}

// ── Table cell: compact label, full detail on hover ──────────────────────────

export function SharedWithCell({
  audience,
  runsAs,
  service,
}: {
  audience: ShareAudience;
  runsAs: RunsAs;
  service: string;
}) {
  const risky = isRiskyShare(audience, runsAs);
  const unused = !audience.workspace && !audience.roles.length && !audience.agents.length;
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            tabIndex={0}
            className={cn(
              'inline-flex max-w-full items-center gap-1.5 truncate rounded-sm text-sm underline decoration-dotted decoration-muted-foreground/40 underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              unused ? 'text-muted-foreground/70' : 'text-muted-foreground'
            )}
          >
            {risky && (
              <AlertTriangle className="size-3.5 shrink-0 text-amber-600" aria-label="Personal account shared" />
            )}
            {audienceShort(audience)}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" align="start" className="max-w-72 space-y-1 py-2 text-left">
          <p>{audiencePeopleDetail(audience)}</p>
          {audience.agents.length > 0 && <p>Agents: {audience.agents.join(', ')}</p>}
          <p className="opacity-80">
            Runs as {runsAs.handle}
            {runsAs.kind === 'personal' ? ` (personal ${service} account)` : runsAs.kind === 'service' ? ' (service account)' : ''}
          </p>
          {risky && <p className="opacity-80">Everyone listed acts as this person. Consider a service account.</p>}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
