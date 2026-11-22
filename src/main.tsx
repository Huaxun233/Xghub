import ProjectHome from './pages/ProjectHome';
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { AppProvider } from "./store";
import { invoke, isTauri } from "@tauri-apps/api/core";
import Videos from "./pages/Videos";
import Platform from "./pages/Platform";
import { Logo } from "./icons";
import "./index.css";
import { initPlaybackLog, installPlaybackPageEvents } from "./playbackDiagnostics";

const worker = import.meta.env.MODE === "worker";
if (worker && location.pathname === "/" && location.hash === "#admin") {
  location.replace("/admin");
}
if (worker && location.pathname === '/' && /^#(home|comics|library|search|account)$/.test(location.hash)) history.replaceState(null, '', '/app' + location.hash);
if (worker) window.addEventListener('hashchange', () => {
 if(location.pathname === '/' && /^#(home|comics|library|search|account|admin)$/.test(location.hash)) location.replace(location.hash === '#admin' ? '/admin' : '/app' + location.hash);
});
const native = !worker && isTauri();
if (native) {
  installPlaybackPageEvents();
  void initPlaybackLog();
}

/* 运行期错误统一落到 debug.log，便于自查 */
function report(kind: string, msg: string) {
  if (native) invoke("debug_log", { msg: `[${kind}] ${msg}` }).catch(() => {});
}
window.addEventListener("error", (e) => {
  report("error", `${e.message} @ ${e.filename}:${e.lineno}:${e.colno}`);
});
window.addEventListener("unhandledrejection", (e) => {
  report("reject", String((e.reason && (e.reason.stack || e.reason.message)) || e.reason));
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {worker ? (location.pathname === '/' ? <ProjectHome /> : <Platform />) : native ? <AppProvider><App /></AppProvider> : (
      <div className="absolute inset-0 flex flex-col">
        <header className="flex items-center gap-2.5 border-b border-s3 px-5 py-3 font-semibold">
          <Logo size={25} /> Xghub
        </header>
        <main className="relative min-h-0 flex-1"><Videos active /></main>
      </div>
    )}
  </React.StrictMode>,
);
