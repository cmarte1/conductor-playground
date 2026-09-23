'use client';
import { Fragment, type ReactNode } from 'react';
import {
  CheckCircle2,
  ExternalLink,
  Info,
  Loader2,
  MoreVertical,
  Unplug,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Switch } from '@/components/ui/Switch';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/Tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu';
import { cn } from '@/lib/utils';

// Shared card shell for the Integrations and Vault tabs: gray tray + white
// fixed-height card (logo + subcopy), action button and toggle underneath.

export function ToolCardGrid({ children }: { children: ReactNode }) {
  return (
    <TooltipProvider delayDuration={150}>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 min-[1770px]:grid-cols-4">{children}</div>
    </TooltipProvider>
  );
}

export function ToolCardSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-4 text-sm font-medium text-foreground">{title}</h2>
      <ToolCardGrid>{children}</ToolCardGrid>
    </section>
  );
}

/** Explains why a control is locked. Disabled elements swallow pointer events, so the trigger is a wrapper. */
function LockedHint({
  reason,
  children,
}: {
  reason?: string;
  children: ReactNode;
}) {
  if (!reason) return <>{children}</>;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span tabIndex={0} className="inline-flex cursor-not-allowed rounded-md">
          {children}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-60">
        {reason}
      </TooltipContent>
    </Tooltip>
  );
}

const trayButton = 'h-[29px] gap-[7px]';

export type Notice = { tone: 'success' | 'info'; text: string };

/** Bottom-centre confirmation; stands in for a toast, which this preview app doesn't mount. */
export function FloatingNotice({ notice }: { notice: Notice | null }) {
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
      {notice && (
        <div className="pointer-events-auto flex items-center gap-2 rounded-lg bg-[#171717] px-4 py-2.5 text-sm text-white shadow-lg">
          {notice.tone === 'success' ? (
            <CheckCircle2 className="size-4 text-emerald-400" aria-hidden="true" />
          ) : (
            <Info className="size-4 text-neutral-300" aria-hidden="true" />
          )}
          {notice.text}
        </div>
      )}
    </div>
  );
}

/** Elevated off-white square that holds a tool or provider logo. */
export function LogoTile({ children }: { children: ReactNode }) {
  return (
    <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-black/[0.06]">
      {children}
    </div>
  );
}

export type ActionMenuItem = {
  label: string;
  icon: LucideIcon;
  onSelect: () => void;
  destructive?: boolean;
  disabled?: boolean;
  /** Draws a divider above this item. */
  separated?: boolean;
};

/** Kebab menu sized to sit beside a StatusPill. */
export function ActionMenu({
  label,
  items,
  size = 'sm',
}: {
  label: string;
  items: ActionMenuItem[];
  /** `sm` sits beside a StatusPill; `lg` matches a LogoTile row. */
  size?: 'sm' | 'lg';
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`More actions for ${label}`}
          className={cn(
            'flex shrink-0 items-center justify-center border bg-white text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground',
            size === 'lg' ? 'size-10 rounded-lg shadow-sm' : 'size-5 rounded-[5px]'
          )}
        >
          <MoreVertical className={size === 'lg' ? 'size-4' : 'size-3.5'} aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        {items.map(({ label: itemLabel, icon: Icon, onSelect, destructive, disabled, separated }) => (
          <Fragment key={itemLabel}>
            {separated && <DropdownMenuSeparator />}
            <DropdownMenuItem
              disabled={disabled}
              className={cn(destructive && 'text-destructive focus:text-destructive')}
              onSelect={onSelect}
            >
              <Icon className="size-4" aria-hidden="true" />
              {itemLabel}
            </DropdownMenuItem>
          </Fragment>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

type StatusTone = 'success' | 'warning' | 'neutral';

const statusDots: Record<StatusTone, string> = {
  success: 'bg-emerald-500',
  warning: 'bg-amber-400',
  neutral: 'bg-neutral-300',
};

export function StatusPill({
  tone,
  children,
}: {
  tone: StatusTone;
  children: ReactNode;
}) {
  return (
    <span className="inline-flex h-5 items-center gap-1.5 rounded-[5px] border bg-white px-1.5 text-xs font-medium text-foreground">
      <span className={cn('size-1.5 rounded-full', statusDots[tone])} aria-hidden="true" />
      {children}
    </span>
  );
}

export function ConnectButton({
  onClick,
  disabled,
  loading,
}: {
  onClick?: () => void;
  disabled?: boolean;
  /** Waiting on the provider's sign-in window. */
  loading?: boolean;
}) {
  return (
    <Button
      size="sm"
      disabled={disabled || loading}
      className={cn(
        trayButton,
        'border-transparent bg-[#171717] text-white hover:bg-[#171717]/85'
      )}
      onClick={onClick}
    >
      {loading ? (
        <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
      ) : (
        <Unplug className="size-3.5" aria-hidden="true" />
      )}
      {loading ? 'Connecting…' : 'Connect'}
    </Button>
  );
}

export function TrayButton({
  children,
  onClick,
  disabled,
  destructive,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  destructive?: boolean;
}) {
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={disabled}
      className={cn(
        trayButton,
        destructive && 'text-destructive hover:text-destructive'
      )}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

export function ToolCard({
  logo,
  label,
  description,
  onOpen,
  status,
  action,
  actionLockedReason,
  toggle,
}: {
  logo: ReactNode;
  label: string;
  description: ReactNode;
  onOpen?: () => void;
  /** Replaces the external-link icon; the whole white card then opens on click. */
  status?: ReactNode;
  action: ReactNode;
  actionLockedReason?: string;
  toggle?: {
    checked: boolean;
    onCheckedChange?: (checked: boolean) => void;
    lockedReason?: string;
  };
}) {
  return (
    <div className="rounded-xl border bg-muted/40 pt-0.5 px-0.5 pb-[9px]">
      <div
        className={cn(
          'h-[120px] rounded-lg border bg-background p-4 shadow-sm',
          status &&
            onOpen &&
            'cursor-pointer transition-colors hover:border-foreground/20 hover:bg-muted/20'
        )}
        onClick={status ? onOpen : undefined}
      >
        <div className="flex items-start justify-between gap-2">
          <LogoTile>{logo}</LogoTile>
          {status ?? (
            <button
              type="button"
              onClick={onOpen}
              className="mt-0.5 text-muted-foreground/60 transition-colors hover:text-muted-foreground"
              aria-label={`Open ${label}`}
            >
              <ExternalLink className="size-4" aria-hidden="true" />
            </button>
          )}
        </div>
        <p className="mt-3 line-clamp-2 text-sm leading-snug text-muted-foreground">
          {description}
        </p>
      </div>
      <div className="flex items-center justify-between px-1.5 pt-2">
        <LockedHint reason={actionLockedReason}>{action}</LockedHint>
        {toggle && (
          <LockedHint reason={toggle.lockedReason}>
            <Switch
              checked={toggle.checked}
              disabled={Boolean(toggle.lockedReason)}
              className="data-[state=checked]:bg-black data-[state=unchecked]:bg-[#E5E5E5]"
              aria-label={`Turn ${label} ${toggle.checked ? 'off' : 'on'}`}
              onCheckedChange={toggle.onCheckedChange}
            />
          </LockedHint>
        )}
      </div>
    </div>
  );
}
