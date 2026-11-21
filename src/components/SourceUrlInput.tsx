import { useState } from "react";
import { loadSource } from "../sourceUrl";
import type { Source } from "../videoCatalog";

export default function SourceUrlInput({ onLoad, disabled }: { onLoad: (source: Source) => void; disabled?: boolean }) {
  const [address, setAddress] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function importAddress() {
    setBusy(true);
    setError("");
    try {
      onLoad(await loadSource(address));
      setAddress("");
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return <div className="space-y-2 rounded-xl border border-s3 bg-s1 p-3">
    <label className="block text-sm font-medium">站源配置地址
      <input type="url" inputMode="url" placeholder="https://example.com/source.json" value={address} maxLength={4096}
        disabled={disabled || busy} onChange={event => setAddress(event.target.value)}
        onKeyDown={event => {
          if (event.key === "Enter") {
            event.preventDefault();
            if (!disabled && !busy && address.trim()) void importAddress();
          }
        }}
        className="mt-1 block w-full min-w-0 rounded-lg border border-s4 bg-canvas px-3 py-2 text-sm" />
    </label>
    <button type="button" disabled={disabled || busy || !address.trim()}
      onClick={() => void importAddress()}
      className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-on-primary disabled:opacity-50">
      {busy ? "正在读取…" : "从地址导入"}
    </button>
    {error && <p role="alert" className="text-sm text-danger">{error}</p>}
  </div>;
}
