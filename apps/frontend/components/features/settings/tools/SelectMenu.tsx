'use client';
import type { ReactNode } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu';
import { cn } from '@/lib/utils';

// Select-style dropdown after the ReUI c-dropdown-menu-18 pattern: outline
// trigger with an optional leading logo, caret pushed right with real inner
// padding, and a labelled menu the same width as the trigger.

export type SelectMenuOption = {
  value: string;
  label: string;
  icon?: ReactNode;
};

export function SelectMenu({
  id,
  value,
  onChange,
  options,
  placeholder,
  menuLabel,
  ariaLabel,
  disabled,
  className,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectMenuOption[];
  placeholder: string;
  /** Small heading at the top of the open menu. */
  menuLabel?: string;
  ariaLabel?: string;
  disabled?: boolean;
  className?: string;
}) {
  const selected = options.find((option) => option.value === value);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={disabled}>
        <Button
          id={id}
          type="button"
          variant="outline"
          aria-label={ariaLabel}
          className={cn(
            'h-10 w-full justify-start gap-2 px-3 font-normal shadow-none',
            className
          )}
        >
          {selected?.icon && <span className="flex shrink-0">{selected.icon}</span>}
          <span className={cn('truncate', !selected && 'text-muted-foreground')}>
            {selected?.label ?? placeholder}
          </span>
          <ChevronDown className="ml-auto size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="max-h-72 w-[var(--radix-dropdown-menu-trigger-width)] min-w-56 overflow-y-auto"
      >
        <DropdownMenuGroup>
          {menuLabel && (
            <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
              {menuLabel}
            </DropdownMenuLabel>
          )}
          {options.map((option) => (
            <DropdownMenuItem
              key={option.value}
              onSelect={() => onChange(option.value)}
              className="gap-2"
            >
              {option.icon && <span className="flex shrink-0">{option.icon}</span>}
              <span className="truncate">{option.label}</span>
              {option.value === value && (
                <Check className="ml-auto size-4 text-muted-foreground" aria-hidden="true" />
              )}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
