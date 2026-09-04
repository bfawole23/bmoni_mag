import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App.tsx";

const rootEl = document.getElementById("root")!;

/* ------------------------------------------------------------------ */
/* Safety net: React 18 unmounts the whole tree on uncaught effect or  */
/* timer errors, which would leave a blank page. Catch everything at   */
/* the window level and show a recovery console instead.               */
/* ------------------------------------------------------------------ */
let crashed = false;
function showCrash(message: string) {
  if (crashed) return;
  crashed = true;
  console.error("[bmoni] fatal — recovery console shown:", message);
  rootEl.innerHTML = `
    <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:#122921;padding:24px;font-family:ui-sans-serif,system-ui,sans-serif">
      <div style="max-width:460px;width:100%;background:#0d1f18;border:1px solid #24443566;border-radius:14px;padding:32px;color:#f0f5ef;box-shadow:0 24px 64px -16px rgba(0,0,0,.4)">
        <div style="display:flex;align-items:center;gap:12px">
          <svg width="38" height="38" viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="#0d1f18" stroke="#2c4a3b"/><path d="M10 8h8.5a4 4 0 0 1 0 8H10zm0 8h10a4 4 0 0 1 0 8H10z" fill="none" stroke="#E8B25C" stroke-width="2.4"/></svg>
          <div>
            <p style="margin:0;font-size:17px;font-weight:700;letter-spacing:-.01em">Console hit a snag</p>
            <p style="margin:2px 0 0;font-family:ui-monospace,monospace;font-size:9.5px;text-transform:uppercase;letter-spacing:.22em;color:#7e9487">fatal · recovery</p>
          </div>
        </div>
        <p style="margin:20px 0 0;padding:12px 14px;border-radius:10px;background:rgba(178,59,49,.12);border:1px solid rgba(178,59,49,.3);font-family:ui-monospace,monospace;font-size:12px;line-height:1.6;color:#e8a79c;word-break:break-word">${message || "Unexpected runtime error"}</p>
        <p style="margin:12px 0 0;font-size:13px;line-height:1.6;color:#9db3a5">Usually this is stale sandbox data from an earlier build. Resetting clears only the local BMONI ledger and session in this browser.</p>
        <div style="margin-top:24px;display:flex;gap:10px;flex-wrap:wrap">
          <button id="bmoni-reset" style="background:#c9862f;color:#241703;border:0;border-radius:9px;padding:11px 18px;font-size:14px;font-weight:700;cursor:pointer">Reset sandbox data</button>
          <button id="bmoni-reload" style="background:transparent;color:#c4d3c8;border:1px solid #2c4a3b;border-radius:9px;padding:11px 18px;font-size:14px;font-weight:600;cursor:pointer">Just reload</button>
        </div>
      </div>
    </div>`;
  document.getElementById("bmoni-reset")?.addEventListener("click", () => {
    try { Object.keys(localStorage).filter((k) => k.startsWith("bmoni.")).forEach((k) => localStorage.removeItem(k)); } catch { /* noop */ }
    window.location.reload();
  });
  document.getElementById("bmoni-reload")?.addEventListener("click", () => window.location.reload());
}
window.addEventListener("error", (e) => { showCrash(e.message || "Uncaught error"); });
window.addEventListener("unhandledrejection", (e) => { showCrash(String((e as PromiseRejectionEvent).reason ?? "Unhandled promise rejection")); });

try {
  ReactDOM.createRoot(rootEl).render(<App />);
  console.info("[bmoni] console mounted — data lives in localStorage under bmoni.* keys");
} catch (e) {
  showCrash(e instanceof Error ? e.message : String(e));
}
