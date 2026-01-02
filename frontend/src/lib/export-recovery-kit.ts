import JSZip from "jszip"
import { saveAs } from "file-saver"

export interface SecretMetadata {
  id: string
  title: string
  threshold: number
  totalShares: number
  checkInDays: number
  recipients: Array<{ name: string; email: string }>
  createdAt: string
  exportedAt: string
}

export interface RecoveryKitData {
  metadata: SecretMetadata
  serverShare: string | null
  userManagedShares: string[]
}

function generateRecoveryInstructions(metadata: SecretMetadata): string {
  return `# KeyFate Recovery Instructions

## Secret: ${metadata.title}

### Recovery Requirements
- **Minimum shares needed**: ${metadata.threshold} of ${metadata.totalShares}
- **Check-in interval**: ${metadata.checkInDays} days

### Recipients
${metadata.recipients.map((r, i) => `${i + 1}. ${r.name} (${r.email})`).join("\n")}

### How to Recover Your Secret

1. Open the \`recovery.html\` file in any web browser
2. Enter at least ${metadata.threshold} shares (one per line)
3. Click "Recover Secret"
4. Your original secret will be displayed

### Share Distribution

The shares in this kit are:
- **server-share.txt**: The share that was stored on KeyFate's server
- **user-shares.txt**: The shares you were responsible for managing

### Important Notes

- This recovery kit works completely offline
- No internet connection is required to recover your secret
- Keep this kit in a secure location
- Consider storing copies in multiple locations (cloud storage, USB drive, etc.)
- You can share individual shares with trusted contacts

### Technical Details

- Algorithm: Shamir's Secret Sharing
- Share format: Hexadecimal strings
- Exported: ${metadata.exportedAt}
- Secret ID: ${metadata.id}

---

If KeyFate is still operational, you can also recover your secret at:
https://keyfate.com/secrets/${metadata.id}/recover

For support: support@keyfate.com
`
}

function generateRecoveryHTML(metadata: SecretMetadata): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>KeyFate Recovery Tool - ${metadata.title}</title>
  <style>
    :root {
      --bg: #0a0a0a;
      --card: #141414;
      --border: #262626;
      --text: #fafafa;
      --muted: #a1a1aa;
      --primary: #22c55e;
      --error: #ef4444;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: var(--bg);
      color: var(--text);
      min-height: 100vh;
      padding: 2rem;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
    }
    h1 {
      font-size: 1.5rem;
      margin-bottom: 0.5rem;
    }
    .subtitle {
      color: var(--muted);
      margin-bottom: 2rem;
    }
    .card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 0.5rem;
      padding: 1.5rem;
      margin-bottom: 1.5rem;
    }
    .card h2 {
      font-size: 1rem;
      margin-bottom: 1rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .info-grid {
      display: grid;
      gap: 0.75rem;
    }
    .info-item {
      display: flex;
      justify-content: space-between;
    }
    .info-label { color: var(--muted); }
    .info-value { font-weight: 500; }
    textarea {
      width: 100%;
      min-height: 150px;
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: 0.375rem;
      color: var(--text);
      padding: 0.75rem;
      font-family: 'Monaco', 'Menlo', monospace;
      font-size: 0.875rem;
      resize: vertical;
    }
    textarea:focus {
      outline: none;
      border-color: var(--primary);
    }
    .help-text {
      color: var(--muted);
      font-size: 0.875rem;
      margin-top: 0.5rem;
    }
    button {
      background: var(--primary);
      color: var(--bg);
      border: none;
      border-radius: 0.375rem;
      padding: 0.75rem 1.5rem;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
      width: 100%;
      margin-top: 1rem;
    }
    button:hover { opacity: 0.9; }
    button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .result {
      margin-top: 1.5rem;
      padding: 1rem;
      border-radius: 0.375rem;
    }
    .result.success {
      background: rgba(34, 197, 94, 0.1);
      border: 1px solid var(--primary);
    }
    .result.error {
      background: rgba(239, 68, 68, 0.1);
      border: 1px solid var(--error);
      color: var(--error);
    }
    .result h3 {
      margin-bottom: 0.75rem;
      font-size: 0.875rem;
    }
    .secret-content {
      background: var(--bg);
      padding: 1rem;
      border-radius: 0.25rem;
      font-family: 'Monaco', 'Menlo', monospace;
      white-space: pre-wrap;
      word-break: break-word;
    }
    .copy-btn {
      margin-top: 0.75rem;
      background: var(--border);
      color: var(--text);
    }
    .offline-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      background: rgba(34, 197, 94, 0.2);
      color: var(--primary);
      padding: 0.25rem 0.5rem;
      border-radius: 0.25rem;
      font-size: 0.75rem;
      margin-bottom: 1rem;
    }
    .warning {
      background: rgba(234, 179, 8, 0.1);
      border: 1px solid #eab308;
      color: #eab308;
      padding: 0.75rem;
      border-radius: 0.375rem;
      font-size: 0.875rem;
      margin-bottom: 1rem;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="offline-badge">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      </svg>
      Works Offline
    </div>

    <h1>KeyFate Recovery Tool</h1>
    <p class="subtitle">${metadata.title}</p>

    <div class="card">
      <h2>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <path d="M12 16v-4M12 8h.01"/>
        </svg>
        Secret Details
      </h2>
      <div class="info-grid">
        <div class="info-item">
          <span class="info-label">Threshold</span>
          <span class="info-value">${metadata.threshold} of ${metadata.totalShares} shares</span>
        </div>
        <div class="info-item">
          <span class="info-label">Check-in Interval</span>
          <span class="info-value">${metadata.checkInDays} days</span>
        </div>
        <div class="info-item">
          <span class="info-label">Recipients</span>
          <span class="info-value">${metadata.recipients.length}</span>
        </div>
      </div>
    </div>

    <div class="card">
      <h2>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
          <path d="M7 11V7a5 5 0 0110 0v4"/>
        </svg>
        Recover Secret
      </h2>

      <div class="warning">
        Enter at least <strong>${metadata.threshold}</strong> shares to recover your secret.
        Each share should be on its own line.
      </div>

      <textarea id="shares-input" placeholder="Enter shares here, one per line...&#10;&#10;Example:&#10;8001abc123...&#10;8002def456..."></textarea>
      <p class="help-text">Shares are hexadecimal strings. Check server-share.txt and user-shares.txt in this kit.</p>

      <button id="recover-btn" onclick="recoverSecret()">Recover Secret</button>

      <div id="result"></div>
    </div>

    <div class="card" style="background: transparent; border: 1px dashed var(--border);">
      <p style="color: var(--muted); font-size: 0.875rem; text-align: center;">
        This tool works entirely in your browser. No data is sent anywhere.
        <br>
        <a href="https://keyfate.com" style="color: var(--primary);">keyfate.com</a>
      </p>
    </div>
  </div>

  <script>
    // Shamir's Secret Sharing - Minimal Implementation
    // Based on GF(256) arithmetic for share combining

    const GF256 = {
      exp: new Uint8Array(512),
      log: new Uint8Array(256),
      init() {
        let x = 1;
        for (let i = 0; i < 255; i++) {
          this.exp[i] = x;
          this.log[x] = i;
          x = x << 1;
          if (x >= 256) x ^= 0x11b;
        }
        for (let i = 255; i < 512; i++) {
          this.exp[i] = this.exp[i - 255];
        }
      },
      mul(a, b) {
        if (a === 0 || b === 0) return 0;
        return this.exp[this.log[a] + this.log[b]];
      },
      div(a, b) {
        if (b === 0) throw new Error('Division by zero');
        if (a === 0) return 0;
        return this.exp[this.log[a] + 255 - this.log[b]];
      }
    };
    GF256.init();

    function lagrangeInterpolate(points, x) {
      let result = 0;
      for (let i = 0; i < points.length; i++) {
        let term = points[i].y;
        for (let j = 0; j < points.length; j++) {
          if (i !== j) {
            const num = x ^ points[j].x;
            const den = points[i].x ^ points[j].x;
            term = GF256.mul(term, GF256.div(num, den));
          }
        }
        result ^= term;
      }
      return result;
    }

    function hexToBytes(hex) {
      const bytes = new Uint8Array(hex.length / 2);
      for (let i = 0; i < hex.length; i += 2) {
        bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
      }
      return bytes;
    }

    function combineShares(shareHexes) {
      const shares = shareHexes.map(hex => hexToBytes(hex.trim()));

      // Validate shares have same length
      const shareLength = shares[0].length;
      if (!shares.every(s => s.length === shareLength)) {
        throw new Error('All shares must have the same length');
      }

      // Extract x-coordinates (first byte) and values
      const points = [];
      const secretLength = shareLength - 1;

      for (const share of shares) {
        const x = share[0];
        const values = share.slice(1);
        points.push({ x, values });
      }

      // Reconstruct each byte of the secret
      const secret = new Uint8Array(secretLength);
      for (let i = 0; i < secretLength; i++) {
        const bytePoints = points.map(p => ({ x: p.x, y: p.values[i] }));
        secret[i] = lagrangeInterpolate(bytePoints, 0);
      }

      return new TextDecoder().decode(secret);
    }

    function recoverSecret() {
      const input = document.getElementById('shares-input').value;
      const resultDiv = document.getElementById('result');

      const shares = input.trim().split('\\n').filter(s => s.trim().length > 0);

      if (shares.length < ${metadata.threshold}) {
        resultDiv.innerHTML = \`
          <div class="result error">
            <h3>Not Enough Shares</h3>
            <p>You entered \${shares.length} share(s), but ${metadata.threshold} are required.</p>
          </div>
        \`;
        return;
      }

      try {
        const secret = combineShares(shares);
        resultDiv.innerHTML = \`
          <div class="result success">
            <h3>Secret Recovered Successfully!</h3>
            <div class="secret-content" id="secret-output">\${escapeHtml(secret)}</div>
            <button class="copy-btn" onclick="copySecret()">Copy to Clipboard</button>
          </div>
        \`;
      } catch (err) {
        resultDiv.innerHTML = \`
          <div class="result error">
            <h3>Recovery Failed</h3>
            <p>\${escapeHtml(err.message)}</p>
            <p style="margin-top: 0.5rem; font-size: 0.875rem;">
              Make sure you're using valid shares from your recovery kit.
            </p>
          </div>
        \`;
      }
    }

    function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    function copySecret() {
      const secret = document.getElementById('secret-output').textContent;
      navigator.clipboard.writeText(secret).then(() => {
        const btn = document.querySelector('.copy-btn');
        btn.textContent = 'Copied!';
        setTimeout(() => btn.textContent = 'Copy to Clipboard', 2000);
      });
    }
  </script>
</body>
</html>`
}

function generateMetadataJSON(metadata: SecretMetadata): string {
  return JSON.stringify(
    {
      version: 1,
      secretId: metadata.id,
      title: metadata.title,
      shamir: {
        threshold: metadata.threshold,
        totalShares: metadata.totalShares,
      },
      checkInDays: metadata.checkInDays,
      recipients: metadata.recipients,
      timestamps: {
        created: metadata.createdAt,
        exported: metadata.exportedAt,
      },
    },
    null,
    2
  )
}

export async function generateRecoveryKit(data: RecoveryKitData): Promise<Blob> {
  const zip = new JSZip()

  zip.file("recovery.html", generateRecoveryHTML(data.metadata))
  zip.file("instructions.md", generateRecoveryInstructions(data.metadata))
  zip.file("metadata.json", generateMetadataJSON(data.metadata))

  const sharesFolder = zip.folder("shares")
  if (sharesFolder) {
    if (data.serverShare) {
      sharesFolder.file("server-share.txt", data.serverShare)
    }

    if (data.userManagedShares.length > 0) {
      const userSharesContent = data.userManagedShares
        .map((share, i) => `# Share ${i + 2} (User-managed)\n${share}`)
        .join("\n\n")
      sharesFolder.file("user-shares.txt", userSharesContent)
    }

    const allShares = []
    if (data.serverShare) {
      allShares.push(`# Server Share (Share 1)\n${data.serverShare}`)
    }
    data.userManagedShares.forEach((share, i) => {
      allShares.push(`# Share ${i + 2} (User-managed)\n${share}`)
    })
    sharesFolder.file(
      "all-shares.txt",
      `# All Shares for "${data.metadata.title}"\n# Threshold: ${data.metadata.threshold} of ${data.metadata.totalShares}\n# Exported: ${data.metadata.exportedAt}\n\n${allShares.join("\n\n")}`
    )
  }

  return zip.generateAsync({ type: "blob" })
}

export async function downloadRecoveryKit(data: RecoveryKitData): Promise<void> {
  const blob = await generateRecoveryKit(data)
  const filename = `keyfate-recovery-${data.metadata.id.slice(0, 8)}-${Date.now()}.zip`
  saveAs(blob, filename)
}

export function getUserManagedSharesFromStorage(secretId: string): string[] {
  if (typeof window === "undefined") return []

  const key = `keyfate:userManagedShares:${secretId}`
  const stored = localStorage.getItem(key)

  if (!stored) return []

  try {
    const parsed = JSON.parse(stored)
    if (Date.now() > parsed.expiresAt) {
      localStorage.removeItem(key)
      return []
    }
    return parsed.shares || []
  } catch {
    return []
  }
}
