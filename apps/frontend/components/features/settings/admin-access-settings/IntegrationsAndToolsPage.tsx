'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { TRPCClientErrorLike } from '@trpc/client';
import { toast } from 'sonner';
import { api } from '@/trpc/react';
import type { AppRouter } from '@/app/server/api/root';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/AlertDialog';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';
import {
  applyPolicyChanges,
  selectSettledChanges,
} from '@/lib/features/admin-access-settings/applyPolicyChanges';
import { LangdockPoliciesSection } from './sections/LangdockPoliciesSection';
import { CustomMcpPolicySection } from './sections/CustomMcpPolicySection';
import { McpInventorySection } from './sections/McpInventorySection';
import { SharedCredentialsSection } from './sections/SharedCredentialsSection';
import { TenantOAuthAppsSection } from './sections/TenantOAuthAppsSection';
import { SharedMcpCredentialsSection } from './sections/SharedMcpCredentialsSection';
import { SettingsSaveBar } from '@/components/features/settings/SettingsSaveBar';
import { useAdminAccessPolicy } from './state/useAdminAccessPolicy';
import type { EffectiveAdminAccessPolicy } from './types';
import { SlackAgentOverviewCard } from '../slack-agent/SlackAgentOverviewCard';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs';
import { VaultTab } from './VaultTab';

type Props = {
  effective: EffectiveAdminAccessPolicy;
  /** Tenant prototype: management lives in Apps & tools; retain the MSP surface. */
  policiesOnly?: boolean;
  /** Fail-closed `slack_agent` rollout gate. Omitted is treated as disabled. */
  slackAgentEnabled?: boolean;
  /**
   * Fail-closed `credential_sharing` rollout gate. Omitted is treated as
   * disabled, which keeps this page byte-identical to its pre-DRE-72 render.
   */
  credentialSharingEnabled?: boolean;
  /**
   * Fail-closed `tenant_oauth_apps` gate — the OAuth-app delta's own kill
   * switch, separate from `credential_sharing` because that one is already
   * live and this has to be revocable without it. Omitted is disabled.
   */
  tenantOAuthAppsEnabled?: boolean;
};

const isTrpcClientError = (
  reason: unknown
): reason is TRPCClientErrorLike<AppRouter> =>
  typeof reason === 'object' && reason !== null && 'data' in reason;

const isLockedByParent = (reason: unknown): boolean =>
  isTrpcClientError(reason) && reason.data?.code === 'CONFLICT';

export function IntegrationsAndToolsPage({
  effective,
  policiesOnly = false,
  slackAgentEnabled = false,
  credentialSharingEnabled = false,
  tenantOAuthAppsEnabled = false,
}: Props) {
  const {
    draft,
    isDirty,
    pendingChanges,
    setIntegrationDenied,
    setToolDenied,
    setCustomMcpDenied,
    reset,
    clearTouched,
  } = useAdminAccessPolicy(effective);
  const [isSaving, setIsSaving] = useState(false);
  const router = useRouter();

  const {
    setHasChanges,
    showNavigationWarning,
    setShowNavigationWarning,
    cancelNavigation,
    discardAndNavigate,
  } = useUnsavedChanges({ legacyHistoryGuard: false });

  useEffect(() => {
    setHasChanges(isDirty);
  }, [isDirty, setHasChanges]);

  const setRule = api.policy.setRule.useMutation();
  const deleteRule = api.policy.deleteRule.useMutation();
  const utils = api.useUtils();

  const handleSave = async (): Promise<void> => {
    if (!isDirty || isSaving) return;
    setIsSaving(true);
    try {
      const changes = pendingChanges;
      const { total, failures, lockedByParent } = await applyPolicyChanges({
        entityId: effective.entityId,
        changes,
        mutators: {
          setRule: (input) => setRule.mutateAsync(input),
          deleteRule: (input) => deleteRule.mutateAsync(input),
        },
        isConflict: isLockedByParent,
      });

      clearTouched(
        selectSettledChanges({
          changes,
          failures,
          isConflict: isLockedByParent,
        })
      );

      if (failures.length === 0) {
        toast.success('Policy settings saved.');
      } else {
        for (const failure of failures) {
          console.error('[admin-access-settings] Save change failed', failure);
        }
        toast.error(
          lockedByParent
            ? 'Some changes are locked by your MSP and cannot be overridden here.'
            : `Could not save ${failures.length} of ${total} changes. Please try again.`
        );
      }
    } finally {
      void utils.invalidate();
      router.refresh();
      setIsSaving(false);
    }
  };

  return (
    <>
      <p className="text-base leading-[36px] tracking-[0.1px] text-muted-foreground">
        Manage what integrations your users can use.
      </p>

      {policiesOnly ? (
        <div className="mt-6 min-w-0 space-y-8">
          {slackAgentEnabled ? <SlackAgentOverviewCard /> : null}
          <LangdockPoliciesSection
            scope={effective.scope}
            integrations={effective.integrations}
            tools={effective.builtInTools}
            draftIntegrations={draft.integrations}
            draftTools={draft.tools}
            onIntegrationChange={setIntegrationDenied}
            onToolChange={setToolDenied}
            savingLocked={isSaving}
          />
          <CustomMcpPolicySection
            sectionLayout
            scope={effective.scope}
            scopeEntityId={effective.entityId}
            customMcp={effective.customMcp}
            draftCustomMcp={draft.customMcp}
            onChange={setCustomMcpDenied}
            savingLocked={isSaving}
            credentialSharingEnabled={credentialSharingEnabled}
          />
          <SettingsSaveBar
            isDirty={isDirty}
            isSaving={isSaving}
            onReset={reset}
            onSave={() => {
              void handleSave();
            }}
          />
        </div>
      ) : (
        <Tabs defaultValue="availability" className="mt-6">
          <TabsList>
            <TabsTrigger value="availability">Availability</TabsTrigger>
            <TabsTrigger value="custom-connections">
              {policiesOnly
                ? 'Custom connection policies'
                : 'Custom connections'}
            </TabsTrigger>
            {!policiesOnly && <TabsTrigger value="vault">Vault</TabsTrigger>}
          </TabsList>

          {/* ── Availability ── */}
          <TabsContent value="availability">
            <div className="w-full min-w-0 space-y-8 pb-0 pt-6">
              <div className="grid min-w-0 gap-6">
                {slackAgentEnabled ? <SlackAgentOverviewCard /> : null}
                {!policiesOnly &&
                credentialSharingEnabled &&
                effective.scope !== 'msp' ? (
                  <SharedCredentialsSection
                    scopeEntityId={effective.entityId}
                  />
                ) : null}
                {!policiesOnly &&
                credentialSharingEnabled &&
                tenantOAuthAppsEnabled &&
                effective.scope !== 'msp' ? (
                  <TenantOAuthAppsSection scopeEntityId={effective.entityId} />
                ) : null}
                <LangdockPoliciesSection
                  scope={effective.scope}
                  integrations={effective.integrations}
                  tools={effective.builtInTools}
                  draftIntegrations={draft.integrations}
                  draftTools={draft.tools}
                  onIntegrationChange={setIntegrationDenied}
                  onToolChange={setToolDenied}
                  savingLocked={isSaving}
                />
              </div>
            </div>
          </TabsContent>

          {/* ── Custom connections ── */}
          <TabsContent value="custom-connections">
            <div className="mx-auto max-w-4xl space-y-8 px-6 pb-0 pt-6">
              <div className="grid gap-6">
                {/* Inventory first — what's registered matters more than policy toggles */}
                {!policiesOnly && (
                  <McpInventorySection
                    scope={effective.scope}
                    scopeEntityId={effective.entityId}
                    policySaving={isSaving}
                    usePolicyDenied={
                      effective.customMcp.use.effectiveDecision === 'deny'
                    }
                    useDeniedByMsp={
                      effective.customMcp.use.lock?.source === 'msp'
                    }
                  />
                )}
                {!policiesOnly &&
                credentialSharingEnabled &&
                effective.scope !== 'msp' ? (
                  <SharedMcpCredentialsSection
                    scopeEntityId={effective.entityId}
                    tenantOAuthAppsEnabled={tenantOAuthAppsEnabled}
                  />
                ) : null}
                {/* Policy controls secondary */}
                <CustomMcpPolicySection
                  scope={effective.scope}
                  scopeEntityId={effective.entityId}
                  customMcp={effective.customMcp}
                  draftCustomMcp={draft.customMcp}
                  onChange={setCustomMcpDenied}
                  savingLocked={isSaving}
                  credentialSharingEnabled={credentialSharingEnabled}
                />
              </div>
              <SettingsSaveBar
                isDirty={isDirty}
                isSaving={isSaving}
                onReset={reset}
                onSave={() => {
                  void handleSave();
                }}
              />
            </div>
          </TabsContent>

          {/* ── Vault ── */}
          {!policiesOnly && (
            <TabsContent value="vault">
              <div className="mx-auto max-w-4xl px-6 pb-8 pt-6">
                <VaultTab />
              </div>
            </TabsContent>
          )}
        </Tabs>
      )}

      <AlertDialog
        open={showNavigationWarning}
        onOpenChange={(open) => {
          if (open) {
            setShowNavigationWarning(open);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unsaved changes</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved settings. Are you sure you want to navigate away?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={cancelNavigation}>
              Stay on this page
            </AlertDialogCancel>
            <AlertDialogAction onClick={discardAndNavigate}>
              Leave without saving
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
