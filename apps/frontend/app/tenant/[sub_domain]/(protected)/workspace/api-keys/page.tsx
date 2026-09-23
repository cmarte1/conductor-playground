import { HatzApiKeysPreview } from '@/components/features/settings/api-keys/HatzApiKeysPreview';

// Prototype: the redesigned Hatz API keys page runs on demo data so demos never
// mint real keys or show a live secret on screen. The production page (APIKeyForm
// + APIKeyList, the create_api_token permission check, and LLM Gateway setup)
// is unchanged in those components and should be restored before shipping.
export default function APIKeysPage() {
  return (
    // Same frame as StyledSettingsLayout; the page draws its own header so the
    // primary action can align with the subcopy.
    <div className="flex w-full items-center justify-center px-24 py-10">
      <div className="w-full max-w-7xl">
        <HatzApiKeysPreview />
      </div>
    </div>
  );
}
