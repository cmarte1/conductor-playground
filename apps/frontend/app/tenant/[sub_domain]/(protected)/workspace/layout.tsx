import { userPermissions } from '@/common/constants';
import { WorkspaceNavWithDialKit } from '@/components/features/workspace/WorkspaceNavWithDialKit';
import { RestrictedAccess } from '@/components/features/shared/RestrictedAccess';
import { getEntityNameBySupabase } from '@/services/custom-interface.server';
import { resolveCurrentSlackAgentFeatureEnabled } from '@/lib/features/slack-agent/feature-flags.server';
import { api } from '@/trpc/server';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

const {
  MANAGE_OWN_ENTITY_USERS,
  VIEW_OWN_ENTITY_USAGE,
  MANAGE_GROUPS,
  PLATFORM_MANAGE_GROUPS,
} = userPermissions;

const LayoutWorspaceSettings = async ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [userData, permissionNames, slackAgentEnabled] = await Promise.all([
    api.users.getUserData(),
    api.users.getPermissions(),
    resolveCurrentSlackAgentFeatureEnabled(),
  ]);
  const entityId = userData?.tenantEntityId;

  if (!entityId) {
    redirect('/login');
  }

  if (!permissionNames.includes('platform_user_settings')) {
    return <RestrictedAccess renderAsMain />;
  }

  const [data] = await getEntityNameBySupabase(entityId, true);
  const canEditUserAndUsersAndRolesAccess = permissionNames.includes(
    MANAGE_OWN_ENTITY_USERS
  );
  const canManageGroups =
    permissionNames.includes(MANAGE_GROUPS) ||
    permissionNames.includes(PLATFORM_MANAGE_GROUPS);
  const complianceAccess = await api.compliance.canAccess({
    tenantId: entityId,
  });
  const hasComplianceAccess = complianceAccess.hasAccess;
  const hasUsageDashboardAccess = permissionNames.includes(
    VIEW_OWN_ENTITY_USAGE
  );
  return (
    <main className="flex size-full overflow-hidden">
      <div className="hidden h-full w-max lg:block">
        <WorkspaceNavWithDialKit
          companyName={data?.name!}
          canEditUserAndUsersAndRolesAccess={canEditUserAndUsersAndRolesAccess}
          canManageGroups={canManageGroups}
          hasComplianceAccess={hasComplianceAccess}
          hasUsageDashboardAccess={hasUsageDashboardAccess}
          slackAgentEnabled={slackAgentEnabled}
        />
      </div>
      {/* pb-0 / lg:pb-0: workspace pages render `position: sticky bottom-0` footers
          (e.g. OrgSettingsContainer's save/reset row). Chromium offsets sticky
          against the content edge when the scroll container has padding-bottom,
          leaving a visible gap. overscroll-contain prevents the macOS rubber-band
          from briefly un-pinning the sticky footer at end-of-scroll. See
          .claude/rules/sticky-footer-padding.md. */}
      <div className="flex-grow overflow-auto overscroll-contain p-0.5 pb-0 pt-6 lg:p-10 lg:pb-0">
        {children}
      </div>
    </main>
  );
};

export default LayoutWorspaceSettings;

export const generateMetadata = async (): Promise<Metadata> => {
  return { title: 'Workspace' };
};
