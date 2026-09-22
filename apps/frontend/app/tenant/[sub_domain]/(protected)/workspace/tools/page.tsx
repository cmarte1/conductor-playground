import { WorkspaceToolsPage } from '@/components/features/settings/tools/WorkspaceToolsPage';
import { notFound } from 'next/navigation';
import { api } from '@/trpc/server';
import { userPermissions } from '@/common/constants';
import { getEntityNameBySupabase } from '@/services/custom-interface.server';
import {
  loadEffectiveAdminAccessPolicy,
  isForbiddenScopeError,
} from '@/lib/features/admin-access-settings/route.server';
import { resolveCredentialSharingEnabled } from '@/lib/features/credential-sharing/resolve-enabled.server';
import { resolveTenantOAuthAppsEnabled } from '@/lib/features/tenant-oauth-apps/resolve-enabled.server';
import { McpInventorySection } from '@/components/features/settings/admin-access-settings/sections/McpInventorySection';
import { SharedCredentialsSection } from '@/components/features/settings/admin-access-settings/sections/SharedCredentialsSection';
import { SharedMcpCredentialsSection } from '@/components/features/settings/admin-access-settings/sections/SharedMcpCredentialsSection';
import { TenantOAuthAppsSection } from '@/components/features/settings/admin-access-settings/sections/TenantOAuthAppsSection';

export default async function WorkspaceToolsRoute() {
  const [userData, permissions] = await Promise.all([
    api.users.getUserData(),
    api.users.getPermissions(),
  ]);
  const entityId =
    userData?.tenantEntityId ?? userData?.profile?.companyEntityId;
  if (!entityId) notFound();
  const [company] = await getEntityNameBySupabase(entityId);
  let effective = null;
  // Reuse the existing server-side management check, not a new client-only gate.
  if (permissions.includes(userPermissions.MANAGE_OWN_ENTITY_INTEGRATIONS)) {
    try {
      effective = await loadEffectiveAdminAccessPolicy({
        scope: 'tenant',
        entityId,
      });
    } catch (error) {
      if (!isForbiddenScopeError(error)) throw error;
    }
  }
  const credentialSharingEnabled = effective
    ? await resolveCredentialSharingEnabled()
    : false;
  const tenantOAuthAppsEnabled = credentialSharingEnabled
    ? await resolveTenantOAuthAppsEnabled()
    : false;
  return (
    <WorkspaceToolsPage
      key={entityId}
      companyName={company?.name ?? 'Current company'}
      canManageCredentials={true}
      customConnections={
        effective ? (
          <McpInventorySection
            scope="tenant"
            scopeEntityId={entityId}
            policySaving={false}
            usePolicyDenied={
              effective.customMcp.use.effectiveDecision === 'deny'
            }
            useDeniedByMsp={effective.customMcp.use.lock?.source === 'msp'}
          />
        ) : undefined
      }
      existingCredentials={
        credentialSharingEnabled ? (
          <>
            <SharedCredentialsSection scopeEntityId={entityId} />
            {tenantOAuthAppsEnabled && (
              <TenantOAuthAppsSection scopeEntityId={entityId} />
            )}
            <SharedMcpCredentialsSection
              scopeEntityId={entityId}
              tenantOAuthAppsEnabled={tenantOAuthAppsEnabled}
            />
          </>
        ) : undefined
      }
    />
  );
}
