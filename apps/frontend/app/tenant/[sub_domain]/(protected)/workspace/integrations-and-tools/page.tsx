import { notFound } from 'next/navigation';
import { resolveTenantOAuthAppsEnabled } from '@/lib/features/tenant-oauth-apps/resolve-enabled.server';
import { IntegrationsAndToolsPage } from '@/components/features/settings/admin-access-settings/IntegrationsAndToolsPage';
import type {
  EffectiveAdminAccessPolicy,
  PolicyScope,
} from '@/components/features/settings/admin-access-settings/types';
import StyledSettingsLayout from '@/components/features/settings/StyledLayout';
import { resolveCredentialSharingEnabled } from '@/lib/features/credential-sharing/resolve-enabled.server';
import {
  isForbiddenScopeError,
  loadEffectiveAdminAccessPolicy,
  resolveDevScopeOverride,
} from '@/lib/features/admin-access-settings/route.server';
import { api } from '@/trpc/server';
import { resolveCurrentSlackAgentFeatureEnabled } from '@/lib/features/slack-agent/feature-flags.server';

// Prototype demo policy — used when the logged-in account lacks admin permissions.
// Provides realistic data so demos don't require a real admin seat.
const DEMO_POLICY: EffectiveAdminAccessPolicy = {
  scope: 'tenant',
  entityId: 'demo',
  integrations: [
    { id: 'slack', name: 'Slack', description: 'Messaging, channels, and notifications for your team.', effectiveDecision: 'allow', effectiveSource: 'default', localDecision: null, lock: null, iconUrl: null },
    { id: 'google_calendar', name: 'Google Calendar', description: 'Schedule events and check availability.', effectiveDecision: 'allow', effectiveSource: 'default', localDecision: null, lock: null, iconUrl: null },
    { id: 'gmail', name: 'Gmail', description: 'Read, draft, and send email.', effectiveDecision: 'allow', effectiveSource: 'default', localDecision: null, lock: null, iconUrl: null },
    { id: 'google_drive', name: 'Google Drive', description: 'Access and create files in Google Drive.', effectiveDecision: 'allow', effectiveSource: 'default', localDecision: null, lock: null, iconUrl: null },
    { id: 'linear', name: 'Linear', description: 'Manage issues and projects in Linear.', effectiveDecision: 'allow', effectiveSource: 'default', localDecision: null, lock: null, iconUrl: null },
    { id: 'notion', name: 'Notion', description: 'Read and write pages, databases, and docs.', effectiveDecision: 'allow', effectiveSource: 'default', localDecision: null, lock: null, iconUrl: null },
    { id: 'github', name: 'GitHub', description: 'Access repos, PRs, and issues.', effectiveDecision: 'allow', effectiveSource: 'default', localDecision: null, lock: null, iconUrl: null },
    { id: 'microsoft_365', name: 'Microsoft 365', description: 'Office suite, Teams, and OneDrive.', effectiveDecision: 'allow', effectiveSource: 'msp', localDecision: null, lock: { source: 'msp', message: 'Enabled by your MSP — cannot be changed here.' }, iconUrl: null },
    { id: 'asana', name: 'Asana', description: 'Task tracking and project management.', effectiveDecision: 'deny', effectiveSource: 'tenant', localDecision: 'deny', lock: null, iconUrl: null },
    { id: 'salesforce', name: 'Salesforce', description: 'CRM and sales pipeline data.', effectiveDecision: 'deny', effectiveSource: 'msp', localDecision: null, lock: { source: 'msp', message: 'Restricted by your MSP — cannot be enabled here.' }, iconUrl: null },
  ],
  builtInTools: [],
  aiModels: [],
  customMcp: {
    create: { effectiveDecision: 'allow', effectiveSource: 'default', localDecision: null, lock: null },
    use: { effectiveDecision: 'allow', effectiveSource: 'default', localDecision: null, lock: null },
  },
};

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function TenantIntegrationsAndToolsPage({
  searchParams,
}: PageProps) {
  const slackAgentEnabled = await resolveCurrentSlackAgentFeatureEnabled();

  const userData = await api.users.getUserData();
  // Tenant scope only — never fall back to the admin/MSP entity here, or the
  // page would target a scope that doesn't match the "tenant" label (and the
  // backend would gate it anyway).
  const entityId =
    userData?.tenantEntityId ?? userData?.profile?.companyEntityId;
  if (!entityId) {
    notFound();
  }

  const params = await searchParams;
  const scope: PolicyScope = resolveDevScopeOverride(params.scope) ?? 'tenant';

  let effective: EffectiveAdminAccessPolicy;
  try {
    effective = await loadEffectiveAdminAccessPolicy({ scope, entityId });
  } catch (error) {
    if (isForbiddenScopeError(error)) {
      // Prototype fallback: render with demo data so the admin view is demoable
      // without a real admin seat. Remove this branch before shipping to production.
      effective = DEMO_POLICY;
    } else {
      throw error;
    }
  }

  return (
    <StyledSettingsLayout title="Integration policies">
      <IntegrationsAndToolsPage
        policiesOnly
        effective={effective}
        slackAgentEnabled={slackAgentEnabled}
        credentialSharingEnabled={await resolveCredentialSharingEnabled()}
        tenantOAuthAppsEnabled={await resolveTenantOAuthAppsEnabled()}
      />
    </StyledSettingsLayout>
  );
}
