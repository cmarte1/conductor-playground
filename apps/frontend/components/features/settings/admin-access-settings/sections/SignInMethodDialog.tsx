'use client';
import { useState } from 'react';
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
import { notifySuccess } from '../../tools/prototypeToast';

// Tenant OAuth app ("bring your own sign-in app"), moved out of Vault: it's a
// rule about how everyone signs in to a tool, not a credential anyone shares.
// Each person still signs in with their own account. Prototype only: nothing
// is saved and the secret never leaves this dialog.

export type SignInMethod = 'hatz' | 'company';

/** Tools whose sign-in app a workspace can replace with its own. Salesforce only today. */
export const SIGN_IN_APP_TOOLS = new Set(['salesforce']);

const CALLBACK_URL = 'https://app.hatz.ai/oauth/salesforce/callback';

export function SignInMethodButton({ toolName }: { toolName: string }) {
  const [open, setOpen] = useState(false);
  // Demo seed: the company app is already set up, matching Vault's "Managed elsewhere" row.
  const [method, setMethod] = useState<SignInMethod>('company');
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="shrink-0 rounded-md border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        Sign-in: {method === 'company' ? 'Company app' : 'Hatz app'}
      </button>
      <SignInMethodDialog
        key={String(open)}
        open={open}
        onOpenChange={setOpen}
        toolName={toolName}
        method={method}
        onSave={(next) => {
          setMethod(next);
          setOpen(false);
          notifySuccess(`${toolName} sign-in method saved`);
        }}
      />
    </>
  );
}

function MethodOption({
  selected,
  onSelect,
  title,
  body,
}: {
  selected: boolean;
  onSelect: () => void;
  title: string;
  body: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        'flex w-full items-start gap-3 rounded-lg border px-3 py-3 text-left transition-colors',
        selected ? 'border-[#171717]' : 'hover:bg-muted/40'
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border',
          selected ? 'border-[#171717] bg-[#171717]' : 'border-neutral-300'
        )}
      >
        {selected && <span className="size-1.5 rounded-full bg-white" />}
      </span>
      <span>
        <span className="block text-sm font-medium text-foreground">{title}</span>
        <span className="mt-0.5 block text-xs text-muted-foreground">{body}</span>
      </span>
    </button>
  );
}

function SignInMethodDialog({
  open,
  onOpenChange,
  toolName,
  method,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  toolName: string;
  method: SignInMethod;
  onSave: (method: SignInMethod) => void;
}) {
  const [draft, setDraft] = useState<SignInMethod>(method);
  const [clientId, setClientId] = useState(method === 'company' ? '3MVG9lKcPoNINVB…a1Qz' : '');
  const [secretSaved, setSecretSaved] = useState(method === 'company');
  const [secret, setSecret] = useState('');
  const companyReady = Boolean(clientId.trim()) && (secretSaved || Boolean(secret.trim()));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[560px]">
        <DialogHeader className="space-y-[9px]">
          <DialogTitle>{toolName} sign-in method</DialogTitle>
          <DialogDescription className="pr-6">
            Choose which {toolName} app your team signs in through. Everyone still signs in with
            their own {toolName} account; nothing is shared.
          </DialogDescription>
        </DialogHeader>

        <div role="radiogroup" aria-label="Sign-in method" className="mt-2 space-y-2">
          <MethodOption
            selected={draft === 'hatz'}
            onSelect={() => setDraft('hatz')}
            title={`Hatz's ${toolName} app`}
            body="Works for most organizations. No setup."
          />
          <MethodOption
            selected={draft === 'company'}
            onSelect={() => setDraft('company')}
            title={`Your company's ${toolName} app`}
            body={`Use this if your ${toolName} org only allows apps it has approved.`}
          />
        </div>

        {draft === 'company' && (
          <div className="space-y-4 rounded-lg border bg-muted/30 p-4">
            <div className="space-y-2">
              <Label htmlFor="sign-in-client-id">Consumer key (client ID)</Label>
              <Input
                id="sign-in-client-id"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                placeholder="From your connected app in Salesforce Setup"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="sign-in-secret">Consumer secret</Label>
                {secretSaved && (
                  <button
                    type="button"
                    onClick={() => setSecretSaved(false)}
                    className="text-xs text-info-500 underline-offset-4 hover:underline"
                  >
                    Replace secret
                  </button>
                )}
              </div>
              <Input
                id="sign-in-secret"
                type="password"
                autoComplete="off"
                disabled={secretSaved}
                value={secretSaved ? 'saved-secret-mask' : secret}
                onChange={(e) => setSecret(e.target.value)}
                placeholder="Paste the consumer secret"
              />
              <p className="text-xs text-muted-foreground">
                {secretSaved
                  ? "Saved and encrypted. It's listed in Vault under Managed elsewhere."
                  : "Stored encrypted. No one can view it after saving."}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="sign-in-callback">Callback URL</Label>
              <Input id="sign-in-callback" readOnly value={CALLBACK_URL} className="font-mono text-xs" />
              <p className="text-xs text-muted-foreground">Add this to your connected app in {toolName}.</p>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={draft === 'company' && !companyReady}
            className="bg-[#171717] text-white hover:bg-[#171717]/85"
            onClick={() => onSave(draft)}
          >
            Save
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
