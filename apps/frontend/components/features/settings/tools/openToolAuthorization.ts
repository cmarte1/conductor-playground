// Simulated provider consent window for the local prototype. No request leaves
// the browser: the pop-up is a static page that reports back via postMessage.
// Generalised from chat/tools/openConnectWiseOAuth.ts.

const POPUP_WIDTH = 520;
const POPUP_HEIGHT = 640;
const APPROVED = 'hatz-tool-authorization-approved';
const DENIED = 'hatz-tool-authorization-denied';

export type AuthorizationOutcome = 'approved' | 'cancelled' | 'blocked';

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);

export function openToolAuthorization(
  tool: { id: string; name: string; domain: string },
  onDone: (outcome: AuthorizationOutcome) => void
): void {
  const left = Math.round(window.screenX + (window.outerWidth - POPUP_WIDTH) / 2);
  const top = Math.round(window.screenY + (window.outerHeight - POPUP_HEIGHT) / 2);
  const popup = window.open(
    '',
    `authorize-${tool.id}`,
    `width=${POPUP_WIDTH},height=${POPUP_HEIGHT},left=${left},top=${top},popup=1,toolbar=0,menubar=0,location=0`
  );
  if (!popup) {
    onDone('blocked');
    return;
  }

  const name = escapeHtml(tool.name);
  const logo = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(tool.domain)}&sz=128`;

  popup.document.write(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Sign in to ${name}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
      background: #f5f5f5; min-height: 100vh;
      display: flex; align-items: center; justify-content: center;
    }
    .card {
      background: #fff; border: 1px solid #e5e5e5; border-radius: 16px;
      padding: 36px 36px 28px; width: 400px;
      display: flex; flex-direction: column; align-items: center; gap: 12px;
      box-shadow: 0 4px 24px rgba(0,0,0,0.08);
    }
    .logos { display: flex; align-items: center; gap: 12px; margin-bottom: 4px; }
    .tile {
      width: 52px; height: 52px; border-radius: 14px; border: 1px solid #e5e5e5;
      display: flex; align-items: center; justify-content: center; background: #fff; overflow: hidden;
    }
    .tile img { width: 32px; height: 32px; object-fit: contain; }
    .tile.hatz { background: #171717; color: #fff; font-weight: 700; font-size: 18px; border-color: #171717; }
    .dots { color: #bbb; letter-spacing: 2px; }
    h1 { font-size: 18px; font-weight: 600; color: #111; text-align: center; line-height: 1.3; }
    p { font-size: 14px; color: #666; text-align: center; line-height: 1.5; }
    .permissions {
      width: 100%; background: #fafafa; border: 1px solid #ebebeb; border-radius: 10px;
      padding: 12px 14px; display: flex; flex-direction: column; gap: 8px; margin: 4px 0;
    }
    .perm { display: flex; align-items: center; gap: 10px; font-size: 13px; color: #333; }
    .perm::before { content: '✓'; color: #16a34a; font-weight: 600; }
    .actions { width: 100%; display: flex; gap: 8px; margin-top: 4px; }
    button {
      flex: 1; padding: 10px; border-radius: 10px; font-size: 14px; font-weight: 500; cursor: pointer;
      display: flex; align-items: center; justify-content: center; gap: 8px;
    }
    .deny { background: #fff; color: #111; border: 1px solid #e5e5e5; }
    .allow { background: #171717; color: #fff; border: 1px solid #171717; }
    button:disabled { opacity: 0.7; cursor: not-allowed; }
    .spinner {
      width: 14px; height: 14px; border: 2px solid rgba(255,255,255,0.4); border-top-color: #fff;
      border-radius: 50%; animation: spin 0.7s linear infinite; display: none;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .status { font-size: 13px; color: #888; min-height: 16px; text-align: center; }
    .fine { font-size: 12px; color: #999; }
  </style>
</head>
<body>
  <div class="card">
    <div class="logos">
      <div class="tile hatz">H</div>
      <span class="dots">•••</span>
      <div class="tile"><img src="${logo}" alt="" /></div>
    </div>
    <h1>Hatz wants to access your ${name} account</h1>
    <p>Your agents will be able to:</p>
    <div class="permissions">
      <div class="perm">Read content you have access to in ${name}</div>
      <div class="perm">Create and update items on your behalf</div>
      <div class="perm">See your basic profile and email</div>
    </div>
    <div class="actions">
      <button class="deny" id="deny" onclick="deny()">Cancel</button>
      <button class="allow" id="allow" onclick="allow()">
        <span id="allow-label">Allow access</span><span class="spinner" id="spinner"></span>
      </button>
    </div>
    <div class="status" id="status"></div>
    <div class="fine">Prototype sign-in. No data leaves this browser.</div>
  </div>
  <script>
    function send(type) { window.opener && window.opener.postMessage({ type: type }, '*'); }
    function deny() { send('${DENIED}'); window.close(); }
    function allow() {
      document.getElementById('allow').disabled = true;
      document.getElementById('deny').disabled = true;
      document.getElementById('allow-label').textContent = 'Authorizing…';
      document.getElementById('spinner').style.display = 'block';
      setTimeout(function () {
        document.getElementById('status').textContent = 'Connected. You can close this window.';
        send('${APPROVED}');
        setTimeout(function () { window.close(); }, 700);
      }, 1200);
    }
  </script>
</body>
</html>`);
  popup.document.close();

  let settled = false;
  const finish = (outcome: AuthorizationOutcome) => {
    if (settled) return;
    settled = true;
    window.removeEventListener('message', onMessage);
    window.clearInterval(closedPoll);
    onDone(outcome);
  };
  const onMessage = (event: MessageEvent<{ type?: string }>) => {
    if (event.source !== popup) return;
    if (event.data?.type === APPROVED) finish('approved');
    if (event.data?.type === DENIED) finish('cancelled');
  };
  window.addEventListener('message', onMessage);
  // Closing the window without choosing counts as cancelling.
  const closedPoll = window.setInterval(() => {
    if (popup.closed) finish('cancelled');
  }, 400);
}
