import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = process.cwd();
const output = resolve(root, 'www');
const liveSite = 'https://vybora-social-live-8yyn.onrender.com/';

await mkdir(output, { recursive: true });

// The installed Android app starts with this small launcher instead of a frozen
// copy of the frontend, so normal website deployments can update the UI without
// requiring users to reinstall. The destination is fixed and HTTPS-only.
const launcher = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta name="theme-color" content="#080810">
  <meta name="robots" content="noindex,nofollow">
  <title>VYBORA</title>
  <style>
    :root{color-scheme:dark;background:#080810;color:#f8f7ff;font:16px system-ui,sans-serif}
    *{box-sizing:border-box}
    body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px}
    main{width:min(100%,360px);text-align:center}
    .logo{margin:0 auto 18px;width:58px;height:58px;display:grid;place-items:center;border-radius:18px;background:linear-gradient(135deg,#50f0d0,#8a5cff 58%,#ff6fcf);color:#100c20;font-size:32px;font-weight:900}
    h1{margin:0 0 8px;letter-spacing:.14em;font-size:24px}
    p{color:#aaa9c0;line-height:1.5}
    a,button{display:inline-block;margin-top:12px;border:0;border-radius:999px;padding:12px 18px;background:linear-gradient(110deg,#8a5cff,#ff6fcf);color:#10091e;font-weight:800;text-decoration:none}
    #retry{display:none}
  </style>
</head>
<body>
  <main>
    <div class="logo" aria-hidden="true">V</div>
    <h1>VYBORA</h1>
    <p id="status">Connecting to VYBORA…</p>
    <button id="retry" type="button">Try again</button>
    <p><a href="${liveSite}" rel="noopener">Open VYBORA</a></p>
  </main>
  <script>
    (function () {
      'use strict';
      var target = "https://vybora-social-live-8yyn.onrender.com/";
      var status = document.getElementById('status');
      var retry = document.getElementById('retry');
      var navigationStarted = false;
      function connect() {
        if (navigationStarted) return;
        navigationStarted = true;
        status.textContent = 'Opening VYBORA…';
        retry.style.display = 'none';
        // Navigate directly: a cross-origin no-cors fetch cannot prove that the
        // WebView can render the destination and only adds another network hop.
        window.location.replace(target);
        window.setTimeout(function () {
          if (document.visibilityState === 'visible' && document.location.href !== target) {
            status.textContent = 'VYBORA could not open. Check your connection and try again.';
            retry.style.display = 'inline-block';
            navigationStarted = false;
          }
        }, 12000);
      }
      retry.addEventListener('click', connect);
      connect();
    }());
  </script>
</body>
</html>
`;

await writeFile(resolve(output, 'index.html'), launcher, 'utf8');
console.log('Prepared VYBORA live-site launcher:', liveSite);
