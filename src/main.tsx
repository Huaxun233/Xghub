import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { AppProvider } from "./store";
import { invoke, isTauri } from "@tauri-apps/api/core";
import Videos from "./pages/Videos";
import WebTheme from "./components/WebTheme";
import { Logo } from "./icons";
import "./index.css";
import { initPlaybackLog, installPlaybackPageEvents } from "./playbackDiagnostics";

const native = isTauri();
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

function StaticWeb() {
  const [section, setSection] = React.useState<"home" | "library" | "search" | "personal">("home");
  return <div className="absolute inset-0 flex">
    <aside className="flex w-20 shrink-0 flex-col gap-3 overflow-y-auto border-r border-s3 bg-bg p-2 sm:w-44 sm:p-4">
      <div className="flex items-center justify-center gap-2 font-bold sm:justify-start"><Logo size={25} /><span className="hidden sm:inline">Xghub</span></div>
      <nav aria-label="主导航" className="grid gap-1">
        {([{ id: "home", label: "首页" }, { id: "library", label: "分类" }, { id: "search", label: "搜索" },
          { id: "personal", label: "我的" }] as const).map(item => (
          <button key={item.id} aria-current={section === item.id ? "page" : undefined} onClick={() => setSection(item.id)}
            className={"rounded-lg px-2 py-3 text-sm sm:text-left " + (section === item.id ? "bg-pc text-on-pc font-semibold" : "text-mut hover:bg-s3")}>
            {item.label}
          </button>
        ))}
      </nav>
      <div className="mt-auto"><WebTheme /></div>
    </aside>
    <main className="relative min-w-0 flex-1"><Videos key={section} active section={section} /></main>
  </div>;
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {native ? <AppProvider><App /></AppProvider> : <StaticWeb />}
  </React.StrictMode>,
);
