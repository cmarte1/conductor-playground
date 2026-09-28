import {
  Mail,
  MessageSquare,
  User,
  KeyIcon,
  Building,
  Brain,
  Palette,
  Share2,
  Shield,
  SlidersHorizontal,
  Sparkles,
  ScrollText,
  BarChart2,
  Network,
  Settings,
  type LucideIcon,
} from 'lucide-react';
import React, { ReactNode } from 'react';
import { SkillIcon } from '@/components/features/chat/skills/SkillIcon';
import { ToolsIcon } from '@/components/features/chat/tools/ToolsIcon';
import type { SideNavSection } from '@/components/navigation/side/SideNav';

interface ISubsection {
  render: ReactNode;
  link: string;
  key: string;
}

const createSubSectionItem = (
  IconComponent: LucideIcon,
  text: string,
  link = ''
) => ({
  key: link || text.toLowerCase().replace(/\s+/g, '-'),
  render: (
    <React.Fragment>
      <IconComponent className="text-inherit" width={14} height={14} />
      <span className="text-sm">{text}</span>
    </React.Fragment>
  ),
  link,
});
const createSection = (title: string, subSections: ISubsection[]) => ({
  section: {
    title,
    key: title.toLowerCase().replace(/\s+/g, '-'),
    subSection: subSections,
  },
});

type BuildCustomerSettingsSideNavOptions = {
  canEditUserAndUsersAndRolesAccess?: boolean;
  canManageGroups?: boolean;
  canManageIntegrations?: boolean;
  hasComplianceAccess?: boolean;
  hasUsageDashboardAccess?: boolean;
  slackAgentEnabled?: boolean;
};

const buildCustomerSettingsSideNav = ({
  canEditUserAndUsersAndRolesAccess = true,
  canManageGroups = false,
  canManageIntegrations = false,
  hasComplianceAccess = false,
  hasUsageDashboardAccess = false,
  slackAgentEnabled = false,
}: BuildCustomerSettingsSideNavOptions = {}): SideNavSection[] => {
  const personalSubSections = [
    createSubSectionItem(User, 'Account', '/workspace/personal-settings'),
    createSubSectionItem(KeyIcon, 'Hatz API keys', '/workspace/api-keys'),
    createSubSectionItem(
      Sparkles,
      'AI preferences',
      '/workspace/ai-preferences'
    ),
    createSubSectionItem(Brain, 'Memory', '/workspace/memory'),
  ];

  const orgSubSections: ISubsection[] = [];

  if (canEditUserAndUsersAndRolesAccess) {
    orgSubSections.push(
      createSubSectionItem(
        User,
        'People & permissions',
        '/workspace/users-and-roles'
      )
    );
  }

  if (canEditUserAndUsersAndRolesAccess) {
    orgSubSections.push(
      createSubSectionItem(
        Mail,
        'Email Templates',
        '/workspace/email-templates'
      ),
      createSubSectionItem(Settings, 'Settings', '/workspace/org-settings')
    );
  }

  // Groups is gated on the group-manage permission, NOT on managing users: a
  // role scoped to group management should see this without being granted the
  // broader Users and Roles / Org Settings surface. Keep this check aligned
  // with the Groups page guard (workspace/groups/page.tsx) so the nav entry and
  // the page can't drift — a mismatch yields either a hidden-but-accessible
  // page or a visible-but-404 dead link.
  if (canManageGroups) {
    orgSubSections.push(
      createSubSectionItem(Share2, 'Groups', '/workspace/groups')
    );
  }

  if (canManageIntegrations) {
    orgSubSections.push(
      createSubSectionItem(
        SlidersHorizontal,
        'Integration policies',
        '/workspace/integrations-and-tools'
      )
    );
  }

  if (slackAgentEnabled && canManageIntegrations) {
    orgSubSections.push(
      createSubSectionItem(MessageSquare, 'Channels', '/workspace/channels')
    );
  }

  if (hasComplianceAccess) {
    orgSubSections.push(
      createSubSectionItem(
        ScrollText,
        'Compliance & Logs',
        '/workspace/compliance'
      )
    );
  }

  if (hasUsageDashboardAccess) {
    orgSubSections.push(
      createSubSectionItem(BarChart2, 'Usage', '/workspace/usage')
    );
  }

  const aiSubSections: ISubsection[] = [
    {
      key: '/workspace/skills',
      render: (
        <React.Fragment>
          <SkillIcon className="size-3.5 shrink-0 text-inherit" />
          <span className="text-sm">Skills</span>
        </React.Fragment>
      ),
      link: '/workspace/skills',
    },
    {
      key: '/workspace/tools',
      render: (
        <React.Fragment>
          <ToolsIcon className="size-3.5 shrink-0 text-inherit" />
          <span className="text-sm">Integrations</span>
        </React.Fragment>
      ),
      link: '/workspace/tools',
    },
  ];

  const sections = [createSection('Personal', personalSubSections).section];

  sections.push(createSection('Workspace', aiSubSections).section);

  if (orgSubSections.length > 0) {
    sections.push(createSection('Administration', orgSubSections).section);
  }

  return sections;
};

type BuildAdminSettingsSideNavOptions = {
  canManageIntegrations?: boolean;
  /**
   * The resolved surface verdict for the *selected* MSP — rollout barrier and
   * `can_manage_llm_gateway` together, from `llmGateway.surfaceAccess`. Not a permission flag.
   *
   * The false default is load-bearing: `ADMIN_SETTINGS_SIDE_NAV` builds this nav with no options,
   * so an unresolved verdict must close the entry rather than fall back to permissions.
   */
  llmGatewayVisible?: boolean;
};

const buildAdminSettingsSideNav = ({
  canManageIntegrations = false,
  llmGatewayVisible = false,
}: BuildAdminSettingsSideNavOptions = {}): SideNavSection[] => {
  const adminSubSections: ISubsection[] = [
    createSubSectionItem(User, 'Users and Roles', '/settings/users-and-roles'),
    createSubSectionItem(Palette, 'My Interface', '/settings/my-interface'),
    createSubSectionItem(KeyIcon, 'API Keys', '/settings/api-keys'),
    createSubSectionItem(Mail, 'Email Templates', '/settings/email-templates'),
    createSubSectionItem(Shield, 'SAML', '/settings/saml'),
    createSubSectionItem(
      Building,
      'Global Settings',
      '/settings/global-settings'
    ),
  ];

  // Gated on manage_entity_integrations: a view-only MSP seat can't manage
  // integration policy (the page 403s), so don't show the nav entry.
  if (canManageIntegrations) {
    adminSubSections.push(
      createSubSectionItem(
        SlidersHorizontal,
        'Integrations',
        '/settings/integrations-and-tools'
      )
    );
  }

  // The resolved verdict, not manage_llm_gateway alone: the page answers not-found unless the
  // barrier is open, so a permission-only entry advertises an unlaunched USD product.
  if (llmGatewayVisible) {
    adminSubSections.push(
      createSubSectionItem(Network, 'LLM Gateway', '/settings/llm-gateway')
    );
  }

  return [
    createSection('Personal', [
      createSubSectionItem(User, 'Account', '/settings/account'),
    ]),
    createSection('Admin', adminSubSections),
  ].map(({ section }) => section);
};

// Permission-free fallback for callers without a selected entity. Request-scoped admin surfaces
// use the builder and pass their selected entity's authorization decisions explicitly.
const ADMIN_SETTINGS_SIDE_NAV = buildAdminSettingsSideNav();

export {
  ADMIN_SETTINGS_SIDE_NAV,
  buildAdminSettingsSideNav,
  buildCustomerSettingsSideNav,
  createSubSectionItem,
  createSection,
};
