export type GuoPin = { id: string; name: string };

const KEY = "xghub.guoModule.pins";

export function readPins(): GuoPin[] {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) || "[]") as unknown;
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is GuoPin =>
      !!item && typeof item === "object" &&
      typeof (item as GuoPin).id === "string" && /^[a-z0-9][a-z0-9_-]{0,31}$/.test((item as GuoPin).id) &&
      typeof (item as GuoPin).name === "string").slice(0, 40);
  } catch { return []; }
}

export function writePins(pins: GuoPin[]) {
  try { localStorage.setItem(KEY, JSON.stringify(pins)); } catch { /* 存储不可用时忽略 */ }
}

export function addPin(pin: GuoPin): GuoPin[] {
  const pins = readPins().filter(item => item.id !== pin.id);
  const next = [pin, ...pins];
  writePins(next);
  return next;
}

export function removePin(id: string): GuoPin[] {
  const next = readPins().filter(item => item.id !== id);
  writePins(next);
  return next;
}
