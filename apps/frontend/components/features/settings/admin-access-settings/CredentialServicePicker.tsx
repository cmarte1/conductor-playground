'use client';

import { useId, useRef, useState } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/Dialog';
import { cn } from '@/lib/utils';
import { CredentialProviderLogo } from './CredentialProviderLogo';

// Design-preview catalog only; these entries do not register live integrations.
export const CREDENTIAL_SERVICES = [
  'Airtable',
  'Anthropic',
  'Asana',
  'Canny',
  'Figma',
  'GitHub',
  'HubSpot',
  'Linear',
  'Notion',
  'OpenAI',
  'Salesforce',
  'Slack',
  'Stripe',
];

export function CredentialServicePicker({
  open,
  onOpenChange,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (service: string) => void;
}) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [active, setActive] = useState(0);
  const results = CREDENTIAL_SERVICES.filter((service) =>
    service.toLowerCase().includes(query.trim().toLowerCase())
  );
  function select(service: string) {
    setSelected(service);
    setQuery(service);
    setExpanded(false);
    input.current?.focus();
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        ref={dialog}
        tabIndex={-1}
        className="w-[calc(100%-2rem)] max-w-[480px] gap-0 overflow-visible p-6"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          dialog.current?.focus();
        }}
        onEscapeKeyDown={(event) => {
          if (expanded) {
            event.preventDefault();
            setExpanded(false);
          }
        }}
      >
        <DialogTitle className="text-xl font-medium leading-7 tracking-normal">
          Add new credential
        </DialogTitle>
        <DialogDescription className="mb-5 mt-4 text-base leading-6">
          Select an app or service to connect to
        </DialogDescription>
        <div
          className="relative"
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget))
              setExpanded(false);
          }}
        >
          <div
            className={cn(
              'flex h-12 items-center gap-2 rounded-md border bg-background px-3 transition-colors focus-within:border-ring focus-within:ring-1 focus-within:ring-ring',
              expanded && 'border-ring ring-1 ring-ring'
            )}
          >
            <Search
              className="size-4 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
            <input
              ref={input}
              role="combobox"
              aria-label="Search for app"
              aria-expanded={expanded}
              aria-controls={`${id}-list`}
              aria-autocomplete="list"
              aria-activedescendant={
                expanded && results[active] ? `${id}-${active}` : undefined
              }
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              placeholder="Search for app…"
              value={query}
              onClick={() => setExpanded(true)}
              onChange={(event) => {
                setQuery(event.target.value);
                setSelected('');
                setActive(0);
                setExpanded(true);
              }}
              onKeyDown={(event) => {
                if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                  event.preventDefault();
                  setExpanded(true);
                  const next = !expanded
                    ? 0
                    : Math.max(
                        0,
                        Math.min(
                          results.length - 1,
                          active + (event.key === 'ArrowDown' ? 1 : -1)
                        )
                      );
                  setActive(next);
                  document
                    .getElementById(`${id}-${next}`)
                    ?.scrollIntoView?.({ block: 'nearest' });
                } else if (
                  event.key === 'Enter' &&
                  expanded &&
                  results[active]
                ) {
                  event.preventDefault();
                  select(results[active]);
                }
              }}
            />
            <button
              type="button"
              tabIndex={-1}
              aria-label="Show services"
              onClick={() => {
                setExpanded(!expanded);
                input.current?.focus();
              }}
            >
              <ChevronDown
                className={cn(
                  'size-4 text-muted-foreground transition-transform',
                  expanded && 'rotate-180'
                )}
              />
            </button>
          </div>
          {expanded && (
            <div
              id={`${id}-list`}
              role="listbox"
              aria-label="Apps and services"
              className="absolute left-0 right-0 top-full z-50 mt-2 max-h-[min(280px,35dvh)] overflow-y-auto overscroll-contain rounded-md border bg-popover py-1 text-popover-foreground shadow-lg"
            >
              {results.map((service, index) => (
                <div
                  key={service}
                  id={`${id}-${index}`}
                  role="option"
                  aria-selected={selected === service}
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseMove={() => setActive(index)}
                  onClick={() => select(service)}
                  className={cn(
                    'flex cursor-pointer items-center gap-3 px-5 py-2.5 text-sm',
                    active === index && 'bg-accent'
                  )}
                >
                  <CredentialProviderLogo service={service} />
                  <span>{service}</span>
                </div>
              ))}
              {!results.length && (
                <p
                  role="status"
                  className="px-5 py-4 text-sm text-muted-foreground"
                >
                  No apps or services found.
                </p>
              )}
            </div>
          )}
        </div>
        <div className="mt-8 flex justify-end">
          <Button disabled={!selected} onClick={() => onSelect(selected)}>
            Continue
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
