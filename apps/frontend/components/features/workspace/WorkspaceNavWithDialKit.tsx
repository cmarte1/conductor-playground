'use client';

import { useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { DialRoot, useDialKitController } from 'dialkit';
import 'dialkit/styles.css';
import { SideNav } from '@/components/navigation/side/SideNav';
import {
  buildCustomerSettingsSideNav,
} from '@/common/settings-view.server.side';

type Props = {
  companyName: string;
  canEditUserAndUsersAndRolesAccess: boolean;
  canManageGroups: boolean;
  hasComplianceAccess: boolean;
  hasUsageDashboardAccess: boolean;
  slackAgentEnabled: boolean;
};

// Admin-only nav pages — present in admin view, hidden in user view.
const ADMIN_PATHS = ['/workspace/integrations-and-tools'];
// User-only landing page when switching back from admin.
const USER_TOOLS_PATH = '/workspace/tools';

export function WorkspaceNavWithDialKit({
  companyName,
  canEditUserAndUsersAndRolesAccess,
  canManageGroups,
  hasComplianceAccess,
  hasUsageDashboardAccess,
  slackAgentEnabled,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const isOnAdminPage = ADMIN_PATHS.some((p) => pathname?.startsWith(p));

  const { values } = useDialKitController('Workspace persona', {
    viewAs: {
      type: 'select',
      options: ['user', 'admin'],
      default: isOnAdminPage ? 'admin' : 'user',
      label: 'View as',
    },
  });

  const isAdmin = values.viewAs === 'admin';

  // Only navigate when the user actively changes the DialKit toggle.
  // Skipping the initial render prevents DialKit's persisted state from
  // hijacking navigation when the user lands on a page directly.
  const prevIsAdmin = useRef<boolean | null>(null);
  useEffect(() => {
    if (prevIsAdmin.current === null) {
      prevIsAdmin.current = isAdmin;
      return;
    }
    if (prevIsAdmin.current === isAdmin) return;
    prevIsAdmin.current = isAdmin;

    if (isAdmin && !isOnAdminPage) {
      router.push('/workspace/integrations-and-tools');
    } else if (!isAdmin && isOnAdminPage) {
      router.push(USER_TOOLS_PATH);
    }
  }, [isAdmin, isOnAdminPage, router]);

  const nav = buildCustomerSettingsSideNav({
    canEditUserAndUsersAndRolesAccess: isAdmin
      ? true
      : canEditUserAndUsersAndRolesAccess,
    canManageGroups: isAdmin ? true : canManageGroups,
    // Admin view shows governance page; user view does not.
    canManageIntegrations: isAdmin,
    hasComplianceAccess: isAdmin ? true : hasComplianceAccess,
    hasUsageDashboardAccess: isAdmin ? true : hasUsageDashboardAccess,
    slackAgentEnabled,
  });

  return (
    <>
      <DialRoot position="bottom-right" />
      <SideNav companyName={companyName} sidenavRoutes={nav} />
    </>
  );
}
