import { useState } from "react";

export default function WebTheme() {
  const [light, setLight] = useState(() => document.documentElement.classList.contains("theme-light"));
  return <button type="button" aria-pressed={light}
    className="w-full rounded-lg px-2 py-3 text-sm text-on hover:bg-pc"
    onClick={() => {
      const next = !light;
      document.documentElement.classList.toggle("theme-light", next);
      try { localStorage.setItem("hghub_theme", next ? "light" : "dark"); } catch { /* temporary preference */ }
      setLight(next);
    }}>{light ? "深色模式" : "浅色模式"}</button>;
}
