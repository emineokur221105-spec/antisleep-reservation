export type Shape = "circle" | "rect";

export type Seat = {
  id: string;
  label: string;
  shape: Shape;
  x: number;
  y: number;
  w: number;
  h: number;
  seats: number;
};

// SVG canvas units. 1m = 80 units, so default 9m × 7m = 720 × 560.
export const METER_PX = 80;
export const DEFAULT_SPACE_M = { w: 9, h: 7 };
export const CANVAS_W = DEFAULT_SPACE_M.w * METER_PX;
export const CANVAS_H = DEFAULT_SPACE_M.h * METER_PX;
export const GRID = 10;

// 14 seats: 8 bar stools (round, 1-seat) + 4 tables (square, 4-seat) + 2 rooms (rectangle, 6-seat)
// 朋友可以在編輯器自由 rename, 改人數, 拖位置
export const INITIAL_SEATS: Seat[] = [
  ...Array.from({ length: 8 }, (_, i) => ({
    id: `T${i + 1}`,
    label: `T${i + 1}`,
    shape: "circle" as Shape,
    x: 110 + i * 60,
    y: 160,
    w: 36,
    h: 36,
    seats: 1,
  })),
  { id: "T9", label: "T9", shape: "rect", x: 130, y: 290, w: 60, h: 60, seats: 4 },
  { id: "T10", label: "T10", shape: "rect", x: 260, y: 290, w: 60, h: 60, seats: 4 },
  { id: "T11", label: "T11", shape: "rect", x: 390, y: 290, w: 60, h: 60, seats: 4 },
  { id: "T12", label: "T12", shape: "rect", x: 520, y: 290, w: 60, h: 60, seats: 4 },
  { id: "T13", label: "T13", shape: "rect", x: 110, y: 430, w: 180, h: 80, seats: 6 },
  { id: "T14", label: "T14", shape: "rect", x: 420, y: 430, w: 180, h: 80, seats: 6 },
];

export const STAFF = ["Kabe", "Lily", "Sam"];

// 營業時段（朋友可在後台設定）
export type Hours = {
  openHour: number;   // 0-23
  closeHour: number;  // 0-23 (可 < openHour 表示跨午夜)
  intervalHr: number; // 每個時段長度（小時）
};

export const DEFAULT_HOURS: Hours = {
  openHour: 20,
  closeHour: 2,
  intervalHr: 2,
};

export function generateTimeSlots(hours: Hours): string[] {
  const { openHour, closeHour, intervalHr } = hours;
  const slots: string[] = [];
  let h = openHour;
  for (let i = 0; i < 12; i++) {
    slots.push(`${String(h).padStart(2, "0")}:00`);
    h = (h + intervalHr) % 24;
    if (h === closeHour) break;
  }
  return slots;
}

export function generateSlotLabels(
  slots: string[],
  intervalHr: number
): Record<string, string> {
  const map: Record<string, string> = {};
  for (const s of slots) {
    const startH = parseInt(s.slice(0, 2));
    const endH = (startH + intervalHr) % 24;
    const endLabel = endH === 0 ? "24" : String(endH).padStart(2, "0");
    map[s] = `${String(startH).padStart(2, "0")}–${endLabel}`;
  }
  return map;
}

// Default exports kept for backward compat (used by older imports)
export const TIME_SLOTS = generateTimeSlots(DEFAULT_HOURS);
export const SLOT_LABELS = generateSlotLabels(TIME_SLOTS, DEFAULT_HOURS.intervalHr);

const HOURS_KEY = "antisleep:hours";

export function loadHours(): Hours {
  if (typeof window === "undefined") return DEFAULT_HOURS;
  try {
    const raw = localStorage.getItem(HOURS_KEY);
    if (!raw) return DEFAULT_HOURS;
    const parsed = JSON.parse(raw);
    return {
      openHour: parsed.openHour ?? DEFAULT_HOURS.openHour,
      closeHour: parsed.closeHour ?? DEFAULT_HOURS.closeHour,
      intervalHr: parsed.intervalHr ?? DEFAULT_HOURS.intervalHr,
    };
  } catch {
    return DEFAULT_HOURS;
  }
}

export function saveHours(h: Hours) {
  if (typeof window === "undefined") return;
  localStorage.setItem(HOURS_KEY, JSON.stringify(h));
}

// Cycling palette so different reservations on the same table get different colors
export const RESERVATION_COLORS = [
  "var(--accent)",      // warm beige
  "var(--accent-blue)", // muted slate
  "#a87c8a",            // muted plum
  "#7a9b87",            // muted sage
];

export function colorForReservation(id: number): string {
  return RESERVATION_COLORS[Math.abs(id) % RESERVATION_COLORS.length];
}

// Suggest an ID for a new seat (T1, T2, ... or next available)
export function nextSeatId(existing: Seat[]): string {
  const used = new Set(existing.map((s) => s.id));
  for (let i = 1; i < 1000; i++) {
    const id = `T${i}`;
    if (!used.has(id)) return id;
  }
  return `T${Date.now()}`;
}

/* ---------------- Persistence (mockup: localStorage) ---------------- */

const STORAGE_KEY = "antisleep:floorplan";

export type FloorData = {
  seats: Seat[];
  space: { w: number; h: number };
};

export function loadFloor(): FloorData {
  if (typeof window === "undefined") {
    return { seats: INITIAL_SEATS, space: DEFAULT_SPACE_M };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { seats: INITIAL_SEATS, space: DEFAULT_SPACE_M };
    const parsed = JSON.parse(raw);
    return {
      seats: Array.isArray(parsed.seats) ? parsed.seats : INITIAL_SEATS,
      space: parsed.space ?? DEFAULT_SPACE_M,
    };
  } catch {
    return { seats: INITIAL_SEATS, space: DEFAULT_SPACE_M };
  }
}

export function saveFloor(data: FloorData) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}
