"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { FloorPlanSVG } from "@/components/FloorPlanSVG";
import {
  DEFAULT_HOURS,
  DEFAULT_SPACE_M,
  generateSlotLabels,
  generateTimeSlots,
  type Hours,
  INITIAL_SEATS,
  loadFloor,
  loadHours,
  METER_PX,
  saveHours,
  type Seat,
  STAFF,
} from "@/lib/seats";

type ReservationStatus = "arrived" | "no-show";

type Reservation = {
  id: number;
  date: string;
  time: string;          // start slot
  durationSlots: number; // 1 = 2 hr, 2 = 4 hr, 3 = 6 hr
  table: string;
  takenBy: string;
  name: string;
  phone: string;
  partySize: number;
  notes?: string;
  status?: ReservationStatus; // undefined = pending arrival
};

const TODAY = new Date().toISOString().slice(0, 10);

const MOCK_RESERVATIONS: Reservation[] = [];

type ParsedFields = {
  date?: string;
  time?: string;
  durationSlots?: number;
  table?: string;
  name?: string;
  phone?: string;
  partySize?: number;
  notes?: string;
};

// Best-effort parser for free-form text (IG/LINE chat)
function parseReservationText(text: string): ParsedFields {
  const result: ParsedFields = {};
  const t = text.replace(/\s+/g, " ");

  // Date: YYYY-MM-DD or YYYY/MM/DD or M/D / MM/DD (assumes current year)
  const ymd = text.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (ymd) {
    result.date = `${ymd[1]}-${ymd[2].padStart(2, "0")}-${ymd[3].padStart(2, "0")}`;
  } else {
    const md = text.match(/(?<![-/\d])(\d{1,2})[-/](\d{1,2})(?![-/\d])/);
    if (md) {
      const yr = new Date().getFullYear();
      result.date = `${yr}-${md[1].padStart(2, "0")}-${md[2].padStart(2, "0")}`;
    }
  }

  // Time: HH:MM, or 晚上 X 點, X 點
  const hm = text.match(/(\d{1,2}):(\d{2})/);
  if (hm) {
    result.time = `${hm[1].padStart(2, "0")}:${hm[2]}`;
  } else {
    const eve = text.match(/晚上\s*(\d{1,2})\s*點/) ?? text.match(/(?:^|[^\d])(\d{1,2})\s*點/);
    if (eve) {
      let h = parseInt(eve[1]);
      if (h < 12) h += 12; // assume evening
      if (h === 24) h = 0;
      result.time = `${String(h).padStart(2, "0")}:00`;
    }
  }

  // Duration: X 小時 / X hr / 待 X 小時
  const dur = text.match(/(\d{1,2})\s*(?:小時|hr)/i);
  if (dur) {
    const hrs = parseInt(dur[1]);
    if (hrs > 0) result.durationSlots = Math.max(1, Math.round(hrs / 2));
  }

  // Phone: 09xx-xxx-xxx, with optional spaces/dashes
  const phone = text.match(/09\d{2}[-\s]?\d{3}[-\s]?\d{3}/);
  if (phone) result.phone = phone[0].replace(/\s+/g, "");

  // Party size: X 人 / X 個 / X 位
  const ps = text.match(/(\d+)\s*[人位個]/);
  if (ps) result.partySize = parseInt(ps[1]);

  // Table: 桌位：T9 / T9 / B2
  const tbl =
    text.match(/(?:桌位|桌號|位置)[：:]\s*([A-Z]\d{1,2})/) ??
    text.match(/\b([T][1-9]\d?)\b/);
  if (tbl) result.table = tbl[1];

  // Name: 姓名：Anna / 名字：Anna / 稱呼：Anna
  const name = text.match(/(?:姓名|名字|稱呼)[：:]\s*([^\s\n,，。:：]+)/);
  if (name) result.name = name[1];

  // Notes: 備註：... / 備注：...
  const notes = text.match(/(?:備註|備注|注意事項)[：:]\s*([^\n]+)/);
  if (notes) result.notes = notes[1].trim();

  void t;
  return result;
}

// Conflict: same date+table where slot ranges overlap
function hasConflict(
  candidate: { date: string; time: string; durationSlots: number; table: string },
  all: Reservation[],
  timeSlots: string[],
  excludeId?: number
): Reservation | null {
  const startIdx = timeSlots.indexOf(candidate.time);
  if (startIdx < 0) return null;
  for (const other of all) {
    if (other.id === excludeId) continue;
    if (other.date !== candidate.date) continue;
    if (other.table !== candidate.table) continue;
    const otherStart = timeSlots.indexOf(other.time);
    if (otherStart < 0) continue;
    const overlap =
      startIdx < otherStart + other.durationSlots &&
      otherStart < startIdx + candidate.durationSlots;
    if (overlap) return other;
  }
  return null;
}

// Returns the set of table IDs occupied at given slot index, considering durations
function tablesOccupiedAtSlot(
  reservations: Reservation[],
  timeSlots: string[],
  slotIdx: number,
  excludeId?: number
): Set<string> {
  const set = new Set<string>();
  for (const r of reservations) {
    if (r.id === excludeId) continue;
    const startIdx = timeSlots.indexOf(r.time);
    if (startIdx < 0) continue;
    if (slotIdx >= startIdx && slotIdx < startIdx + r.durationSlots) {
      set.add(r.table);
    }
  }
  return set;
}

type EditTarget = {
  reservation?: Reservation;
  defaultTable: string;
  defaultTime: string;
};

type ViewMode = "grid" | "floor";

export default function AdminPage() {
  const [reservations, setReservations] = useState(MOCK_RESERVATIONS);
  const [selectedDate, setSelectedDate] = useState(TODAY);
  const [editing, setEditing] = useState<EditTarget | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [seats, setSeats] = useState<Seat[]>(INITIAL_SEATS);
  const [spaceM, setSpaceM] = useState(DEFAULT_SPACE_M);
  const [hours, setHoursState] = useState<Hours>(DEFAULT_HOURS);

  const timeSlots = useMemo(() => generateTimeSlots(hours), [hours]);
  const slotLabels = useMemo(
    () => generateSlotLabels(timeSlots, hours.intervalHr),
    [timeSlots, hours.intervalHr]
  );

  const [floorTimeSlot, setFloorTimeSlot] = useState<string>(timeSlots[0]);

  // Keep floorTimeSlot valid when hours change
  useEffect(() => {
    if (!timeSlots.includes(floorTimeSlot)) {
      setFloorTimeSlot(timeSlots[0]);
    }
  }, [timeSlots, floorTimeSlot]);

  // Persist hours change
  const setHours = (h: Hours) => {
    setHoursState(h);
    saveHours(h);
  };

  // Load floor + hours from localStorage on mount
  useEffect(() => {
    const reload = () => {
      const data = loadFloor();
      setSeats(data.seats);
      setSpaceM(data.space);
      setHoursState(loadHours());
    };
    reload();
    window.addEventListener("focus", reload);
    return () => window.removeEventListener("focus", reload);
  }, []);

  // Tick every minute so the "due now" banner updates
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const canvasW = spaceM.w * METER_PX;
  const canvasH = spaceM.h * METER_PX;

  const dayReservations = reservations.filter((r) => r.date === selectedDate);

  const grid = useMemo(() => {
    const map = new Map<string, Reservation>();
    for (const r of dayReservations) map.set(`${r.table}|${r.time}`, r);
    return map;
  }, [dayReservations]);

  // Per-table timeline across all slots (so we can show every reservation on a table,
  // including different people across the night). Recomputes when hours change.
  const seatTimelines = useMemo(() => {
    const map = new Map<string, (Reservation | null)[]>();
    for (const r of dayReservations) {
      const start = timeSlots.indexOf(r.time);
      if (start < 0) continue;
      if (!map.has(r.table)) {
        map.set(
          r.table,
          Array<Reservation | null>(timeSlots.length).fill(null)
        );
      }
      const tl = map.get(r.table)!;
      for (let i = start; i < Math.min(start + r.durationSlots, timeSlots.length); i++) {
        tl[i] = r;
      }
    }
    return map;
  }, [dayReservations, timeSlots]);

  const currentSlotIdx = timeSlots.indexOf(floorTimeSlot);

  const openCell = (table: string, time: string) => {
    const existing = grid.get(`${table}|${time}`);
    setEditing({ reservation: existing, defaultTable: table, defaultTime: time });
  };

  const openSeatInFloor = (tableId: string) => {
    openCell(tableId, floorTimeSlot);
  };

  const [toast, setToast] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 3000);
  };

  const saveReservation = (r: Omit<Reservation, "id"> & { id?: number }): boolean => {
    const conflict = hasConflict(
      { date: r.date, time: r.time, durationSlots: r.durationSlots, table: r.table },
      reservations,
      timeSlots,
      r.id
    );
    if (conflict) {
      showToast(
        `⚠️ 衝突：${conflict.table} 在 ${conflict.time} 已被 ${conflict.name} 預訂`
      );
      return false;
    }
    if (r.id) {
      setReservations((prev) =>
        prev.map((x) => (x.id === r.id ? ({ ...x, ...r } as Reservation) : x))
      );
      showToast("✓ 訂位已更新・LINE 群組已推送異動");
    } else {
      setReservations((prev) => [...prev, { ...r, id: Date.now() } as Reservation]);
      showToast(`✓ 已新增訂位 ${r.name}・LINE 群組已推送`);
    }
    setEditing(null);
    setPasteOpen(false);
    return true;
  };

  const [pasteOpen, setPasteOpen] = useState(false);

  const deleteReservation = (id: number) => {
    setReservations((prev) => prev.filter((x) => x.id !== id));
    setEditing(null);
  };

  const markStatus = (id: number, status: ReservationStatus) => {
    setReservations((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status } : r))
    );
  };

  // Reservations whose start time has already passed today and are still pending arrival
  const dueReservations = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    return dayReservations.filter((r) => {
      if (r.status) return false;
      if (r.date !== todayStr) return false;
      const [h, m] = r.time.split(":").map(Number);
      // reservation start time today, treating "00:00" / "02:00" etc. as same calendar day
      // (酒吧 demo: 顯示營業時段內所有開始時間 ≤ 現在的 pending)
      const start = new Date();
      start.setHours(h, m ?? 0, 0, 0);
      return start.getTime() <= now.getTime();
    });
  }, [dayReservations, now]);

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-border bg-background-elevated">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6 sm:py-4">
          <div className="flex items-center gap-3 sm:gap-8">
            <Link href="/" className="font-mono text-sm tracking-widest hover:text-accent">
              anti sleep <span className="text-foreground-muted">™</span>
            </Link>
            <span className="hidden font-mono text-xs uppercase tracking-widest text-foreground-muted sm:inline">
              · Admin
            </span>
          </div>
          <div className="flex items-center gap-3 text-xs uppercase tracking-widest sm:gap-6">
            <span className="text-foreground">訂位</span>
            <Link href="/admin/floor" className="text-foreground-muted hover:text-foreground">
              座位編輯
            </Link>
            <span className="cursor-not-allowed text-foreground-muted opacity-40">設定</span>
          </div>
        </div>
      </header>

      {/* Date switcher + hours control */}
      <div className="border-b border-border px-4 py-4 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <DateSwitcher value={selectedDate} onChange={setSelectedDate} />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm">
            <div className="flex items-center gap-3">
              <span className="text-foreground-muted">
                共 <span className="text-foreground">{dayReservations.length}</span> 筆訂位
              </span>
              <button
                onClick={() =>
                  setEditing({ defaultTable: "", defaultTime: timeSlots[0] })
                }
                className="rounded-full bg-accent px-4 py-1.5 text-xs font-medium uppercase tracking-widest text-background hover:opacity-90"
              >
                + 新增訂位
              </button>
              <button
                onClick={() => setPasteOpen(true)}
                className="rounded-full border border-accent px-4 py-1.5 text-xs font-medium uppercase tracking-widest text-accent hover:bg-accent hover:text-background"
              >
                📋 貼上訂位
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <HoursControl value={hours} onChange={setHours} />
              <ViewToggle value={viewMode} onChange={setViewMode} />
            </div>
          </div>
        </div>
      </div>

      {/* Notification banner: reservations whose start time has passed but not yet confirmed */}
      {dueReservations.length > 0 && (
        <div className="border-b border-accent/40 bg-accent/5 px-4 py-3 sm:px-6">
          <div className="mx-auto max-w-6xl">
            <div className="mb-2 flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-accent">
              <span>⏰</span>
              <span>
                {dueReservations.length} 筆訂位開始時間已到，請確認客人是否抵達
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {dueReservations.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1.5 text-sm"
                >
                  <span className="font-mono text-foreground-muted">{r.time}</span>
                  <span className="rounded bg-accent/15 px-1.5 py-0.5 font-mono text-xs text-accent">
                    {r.table}
                  </span>
                  <span>
                    {r.name}・{r.partySize} 人
                  </span>
                  <button
                    onClick={() => markStatus(r.id, "arrived")}
                    className="ml-2 rounded-full bg-accent px-3 py-0.5 text-xs uppercase tracking-widest text-background hover:opacity-90"
                  >
                    ✓ 到了
                  </button>
                  <button
                    onClick={() => markStatus(r.id, "no-show")}
                    className="text-xs uppercase tracking-widest text-foreground-muted hover:text-red-400"
                  >
                    × 沒來
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Main */}
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
        {viewMode === "grid" ? (
          <ReservationGrid
            seats={seats}
            grid={grid}
            timeSlots={timeSlots}
            slotLabels={slotLabels}
            onCellClick={openCell}
          />
        ) : (
          <FloorView
            seats={seats}
            canvasW={canvasW}
            canvasH={canvasH}
            currentSlot={floorTimeSlot}
            onSlotChange={setFloorTimeSlot}
            seatTimelines={seatTimelines}
            currentSlotIdx={currentSlotIdx}
            timeSlots={timeSlots}
            slotLabels={slotLabels}
            onSeatClick={openSeatInFloor}
          />
        )}
      </main>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-40 max-w-sm rounded-lg border border-accent/40 bg-background-elevated px-4 py-3 text-sm shadow-2xl">
          {toast}
        </div>
      )}

      {pasteOpen && (
        <PasteReservationDrawer
          seats={seats}
          timeSlots={timeSlots}
          slotLabels={slotLabels}
          defaultDate={selectedDate}
          onClose={() => setPasteOpen(false)}
          onSave={(r) => saveReservation({ ...r })}
        />
      )}

      {editing && (
        <ReservationDrawer
          target={editing}
          seats={seats}
          timeSlots={timeSlots}
          slotLabels={slotLabels}
          existingTablesAtTime={(time) =>
            tablesOccupiedAtSlot(
              dayReservations,
              timeSlots,
              timeSlots.indexOf(time),
              editing.reservation?.id
            )
          }
          onClose={() => setEditing(null)}
          onSave={(r) =>
            saveReservation({
              ...r,
              id: editing.reservation?.id,
              date: selectedDate,
            })
          }
          onDelete={
            editing.reservation
              ? () => deleteReservation(editing.reservation!.id)
              : undefined
          }
        />
      )}
    </div>
  );
}

/* ---------------- Hours Control ---------------- */

function HoursControl({
  value,
  onChange,
}: {
  value: Hours;
  onChange: (h: Hours) => void;
}) {
  const fmt = (h: number) => `${String(h).padStart(2, "0")}:00`;
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background-elevated px-3 py-1.5 text-sm">
      <span className="font-mono text-[10px] uppercase tracking-widest text-foreground-muted">
        營業
      </span>
      <select
        value={value.openHour}
        onChange={(e) =>
          onChange({ ...value, openHour: parseInt(e.target.value) })
        }
        className="bg-transparent font-mono outline-none focus:text-accent"
      >
        {Array.from({ length: 24 }, (_, i) => (
          <option key={i} value={i}>{fmt(i)}</option>
        ))}
      </select>
      <span className="text-foreground-muted">~</span>
      <select
        value={value.closeHour}
        onChange={(e) =>
          onChange({ ...value, closeHour: parseInt(e.target.value) })
        }
        className="bg-transparent font-mono outline-none focus:text-accent"
      >
        {Array.from({ length: 24 }, (_, i) => (
          <option key={i} value={i}>{fmt(i)}</option>
        ))}
      </select>
    </div>
  );
}

/* ---------------- View Toggle ---------------- */

function ViewToggle({
  value,
  onChange,
}: {
  value: ViewMode;
  onChange: (v: ViewMode) => void;
}) {
  return (
    <div className="inline-flex items-center rounded-full border border-border bg-background-elevated p-1">
      <button
        onClick={() => onChange("grid")}
        className={`rounded-full px-4 py-1 text-xs uppercase tracking-widest transition ${
          value === "grid"
            ? "bg-foreground text-background"
            : "text-foreground-muted hover:text-foreground"
        }`}
      >
        甘特圖
      </button>
      <button
        onClick={() => onChange("floor")}
        className={`rounded-full px-4 py-1 text-xs uppercase tracking-widest transition ${
          value === "floor"
            ? "bg-foreground text-background"
            : "text-foreground-muted hover:text-foreground"
        }`}
      >
        座位圖
      </button>
    </div>
  );
}

/* ---------------- Grid (Gantt) ---------------- */

function ReservationGrid({
  seats,
  grid,
  timeSlots,
  slotLabels,
  onCellClick,
}: {
  seats: Seat[];
  grid: Map<string, Reservation>;
  timeSlots: string[];
  slotLabels: Record<string, string>;
  onCellClick: (table: string, time: string) => void;
}) {
  const cols = `64px repeat(${timeSlots.length}, minmax(0, 1fr))`;
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <div
        className="grid border-b border-border bg-background-elevated"
        style={{ gridTemplateColumns: cols }}
      >
        <div className="px-2 py-2 sm:px-4 sm:py-3" />
        {timeSlots.map((t) => (
          <div
            key={t}
            className="border-l border-border px-2 py-2 text-center font-mono text-[11px] uppercase tracking-widest text-foreground-muted sm:px-4 sm:py-3 sm:text-xs"
          >
            {slotLabels[t]}
          </div>
        ))}
      </div>

      {seats.map((seat) => {
        // Walk slots, build cells with colSpan for multi-slot reservations
        const cells: React.ReactNode[] = [];
        let i = 0;
        while (i < timeSlots.length) {
          const t = timeSlots[i];
          const r = grid.get(`${seat.id}|${t}`);
          if (r) {
            const span = Math.min(r.durationSlots, timeSlots.length - i);
            cells.push(
              <button
                key={`${seat.id}-${i}`}
                onClick={() => onCellClick(seat.id, t)}
                style={{ gridColumn: `span ${span}` }}
                className="group relative min-h-[64px] border-l border-border bg-accent/15 p-2 text-left transition hover:bg-accent/25 sm:min-h-[72px] sm:p-3"
              >
                <div className="flex h-full flex-col justify-between">
                  <div>
                    <div className="truncate text-sm font-medium leading-tight">{r.name}</div>
                    <div className="mt-0.5 flex items-baseline gap-1.5 font-mono text-xs text-foreground-muted">
                      <span>{r.partySize} 人</span>
                      {span > 1 && (
                        <span className="text-accent">· {span * 2} hr</span>
                      )}
                    </div>
                  </div>
                  <div className="font-mono text-[10px] text-foreground-muted/70">
                    {r.takenBy}
                    {r.notes && <span className="ml-1 text-accent">●</span>}
                  </div>
                </div>
              </button>
            );
            i += span;
          } else {
            cells.push(
              <button
                key={`${seat.id}-${i}`}
                onClick={() => onCellClick(seat.id, t)}
                className="group relative min-h-[64px] border-l border-border p-2 text-left transition hover:bg-background-elevated sm:min-h-[72px] sm:p-3"
              >
                <div className="flex h-full items-center justify-center text-2xl font-light text-foreground-muted/30 transition group-hover:text-accent">
                  +
                </div>
              </button>
            );
            i += 1;
          }
        }
        return (
          <div
            key={seat.id}
            className="grid border-b border-border last:border-0"
            style={{ gridTemplateColumns: cols }}
          >
            <div className="flex items-center justify-center border-r border-border bg-background-elevated/30 font-mono text-sm">
              {seat.label}
            </div>
            {cells}
          </div>
        );
      })}
    </div>
  );
}

/* ---------------- Floor View ---------------- */

function FloorView({
  seats,
  canvasW,
  canvasH,
  currentSlot,
  onSlotChange,
  seatTimelines,
  currentSlotIdx,
  timeSlots,
  slotLabels,
  onSeatClick,
}: {
  seats: Seat[];
  canvasW: number;
  canvasH: number;
  currentSlot: string;
  onSlotChange: (t: string) => void;
  seatTimelines: Map<string, (Reservation | null)[]>;
  currentSlotIdx: number;
  timeSlots: string[];
  slotLabels: Record<string, string>;
  onSeatClick: (id: string) => void;
}) {
  return (
    <div className="space-y-4">
      {/* Time slot tabs */}
      <div className="flex items-center justify-center gap-2">
        {timeSlots.map((t) => {
          const active = t === currentSlot;
          return (
            <button
              key={t}
              onClick={() => onSlotChange(t)}
              className={`rounded-full border px-5 py-2 text-sm font-mono tracking-widest transition ${
                active
                  ? "border-accent bg-accent text-background"
                  : "border-border text-foreground-muted hover:border-foreground hover:text-foreground"
              }`}
            >
              {slotLabels[t]}
            </button>
          );
        })}
      </div>

      {/* Floor plan */}
      <div className="overflow-hidden rounded-lg border border-border bg-background-elevated">
        <FloorPlanSVG
          seats={seats}
          mode="view"
          canvasW={canvasW}
          canvasH={canvasH}
          seatTimelines={seatTimelines}
          currentSlotIdx={currentSlotIdx}
          onSeatClick={onSeatClick}
        />
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-6 text-xs text-foreground-muted">
        <span className="flex items-center gap-2">
          <span className="inline-block h-3 w-3 rounded border-2 border-foreground-muted bg-background" />
          空位
        </span>
        <span className="flex items-center gap-2">
          <span className="inline-block h-3 w-3 rounded bg-accent" />
          已訂
        </span>
        <span>· 點任一桌新增/編輯訂位</span>
      </div>
    </div>
  );
}

/* ---------------- Date Switcher ---------------- */

function DateSwitcher({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const dates = useMemo(() => {
    const today = new Date();
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      const weekdays = ["日", "一", "二", "三", "四", "五", "六"];
      return {
        iso: d.toISOString().slice(0, 10),
        label:
          i === 0
            ? "今天"
            : i === 1
              ? "明天"
              : `${d.getMonth() + 1}/${d.getDate()} (${weekdays[d.getDay()]})`,
      };
    });
  }, []);

  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1">
      {dates.map((d) => {
        const active = d.iso === value;
        return (
          <button
            key={d.iso}
            onClick={() => onChange(d.iso)}
            className={`whitespace-nowrap rounded-full border px-4 py-1.5 text-sm transition ${
              active
                ? "border-accent bg-accent text-background"
                : "border-border text-foreground-muted hover:border-foreground hover:text-foreground"
            }`}
          >
            {d.label}
          </button>
        );
      })}
    </div>
  );
}

/* ---------------- Drawer ---------------- */

/* ---------------- Paste Reservation Drawer ---------------- */

function PasteReservationDrawer({
  seats,
  timeSlots,
  slotLabels,
  defaultDate,
  onClose,
  onSave,
}: {
  seats: Seat[];
  timeSlots: string[];
  slotLabels: Record<string, string>;
  defaultDate: string;
  onClose: () => void;
  onSave: (r: Omit<Reservation, "id">) => boolean;
}) {
  const [text, setText] = useState("");
  const [parsed, setParsed] = useState(false);
  const [date, setDate] = useState(defaultDate);
  const [time, setTime] = useState(timeSlots[0]);
  const [durationSlots, setDurationSlots] = useState(1);
  const [table, setTable] = useState("");
  const [takenBy, setTakenBy] = useState(STAFF[0]);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [partySize, setPartySize] = useState(2);
  const [notes, setNotes] = useState("");

  const startIdx = timeSlots.indexOf(time);
  const maxDuration = startIdx >= 0 ? timeSlots.length - startIdx : 1;
  const effectiveDuration = Math.min(durationSlots, maxDuration);

  const handleParse = () => {
    const p = parseReservationText(text);
    if (p.date) setDate(p.date);
    if (p.time && timeSlots.includes(p.time)) setTime(p.time);
    if (p.durationSlots) setDurationSlots(p.durationSlots);
    if (p.table) setTable(p.table);
    if (p.name) setName(p.name);
    if (p.phone) setPhone(p.phone);
    if (p.partySize) setPartySize(p.partySize);
    if (p.notes) setNotes(p.notes);
    setParsed(true);
  };

  const canSubmit = !!table && !!name && !!phone && partySize > 0;

  const handleSubmit = () => {
    onSave({
      date,
      time,
      durationSlots: effectiveDuration,
      table,
      takenBy,
      name,
      phone,
      partySize,
      notes,
    });
  };

  const endHour = ((startIdx + effectiveDuration) * 2 + 18) % 24;
  const endLabel = startIdx >= 0 ? `${String(endHour).padStart(2, "0")}:00` : "—";

  const placeholder = `貼上 IG / LINE 對話訊息，例如：

11/30 22:00
Mike・3 人
桌位：T10
電話：0966-888-999
備註：對堅果過敏`;

  return (
    <>
      <div className="fixed inset-0 z-20 bg-background/80 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-30 flex w-full max-w-md flex-col border-l border-border bg-background shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <h2 className="text-xl font-light">📋 貼上訂位</h2>
            <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-foreground-muted">
              貼上對話 → 解析欄位 → 確認送出
            </p>
          </div>
          <button onClick={onClose} className="text-foreground-muted hover:text-foreground">
            ✕
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-6">
          {/* Paste area */}
          <div>
            <label className="mb-2 block font-mono text-xs uppercase tracking-widest text-foreground-muted">
              貼上訂位資訊
            </label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={placeholder}
              rows={6}
              className="w-full rounded-lg border border-border bg-background-elevated px-3 py-2 font-mono text-sm leading-relaxed outline-none focus:border-accent"
            />
            <button
              onClick={handleParse}
              disabled={!text.trim()}
              className="mt-2 w-full rounded-lg border border-accent bg-accent/10 px-4 py-2 text-sm font-medium uppercase tracking-widest text-accent transition hover:bg-accent hover:text-background disabled:cursor-not-allowed disabled:opacity-30"
            >
              {parsed ? "↻ 重新解析" : "🔍 解析貼上的內容"}
            </button>
          </div>

          {/* Parsed form */}
          {parsed && (
            <>
              <div className="border-t border-border pt-5">
                <p className="mb-4 font-mono text-[10px] uppercase tracking-widest text-foreground-muted">
                  解析結果（可直接修改）
                </p>
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-3">
                    <Field label="日期">
                      <input
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        className="w-full rounded-lg border border-border bg-background px-3 py-2 outline-none focus:border-accent"
                      />
                    </Field>
                    <Field label="開始時段">
                      <select
                        value={time}
                        onChange={(e) => setTime(e.target.value)}
                        className="w-full rounded-lg border border-border bg-background px-3 py-2 outline-none focus:border-accent"
                      >
                        {timeSlots.map((t) => (
                          <option key={t} value={t}>{slotLabels[t]}</option>
                        ))}
                      </select>
                    </Field>
                    <Field label="預計">
                      <select
                        value={effectiveDuration}
                        onChange={(e) => setDurationSlots(parseInt(e.target.value))}
                        className="w-full rounded-lg border border-border bg-background px-3 py-2 outline-none focus:border-accent"
                      >
                        {Array.from({ length: maxDuration }, (_, i) => i + 1).map((d) => (
                          <option key={d} value={d}>{d * 2} hr</option>
                        ))}
                      </select>
                    </Field>
                  </div>
                  <Field label="桌號">
                    <select
                      value={table}
                      onChange={(e) => setTable(e.target.value)}
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 outline-none focus:border-accent"
                    >
                      <option value="" disabled>選擇桌號</option>
                      {seats.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.label}・{s.seats} 人
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="客人姓名">
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 outline-none focus:border-accent"
                    />
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="電話">
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="w-full rounded-lg border border-border bg-background px-3 py-2 outline-none focus:border-accent"
                      />
                    </Field>
                    <Field label="人數">
                      <input
                        type="number"
                        min={1}
                        value={partySize}
                        onChange={(e) => setPartySize(parseInt(e.target.value) || 0)}
                        className="w-full rounded-lg border border-border bg-background px-3 py-2 outline-none focus:border-accent"
                      />
                    </Field>
                  </div>
                  <Field label="定位人">
                    <select
                      value={takenBy}
                      onChange={(e) => setTakenBy(e.target.value)}
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 outline-none focus:border-accent"
                    >
                      {STAFF.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="備註">
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={2}
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 outline-none focus:border-accent"
                    />
                  </Field>
                </div>
              </div>

              {/* LINE preview */}
              <div className="rounded-lg border border-border bg-background-elevated p-3">
                <div className="mb-2 font-mono text-[10px] uppercase tracking-widest text-foreground-muted">
                  送出後 LINE 群組會收到
                </div>
                <div className="rounded bg-[#1a2332] p-3 font-mono text-xs leading-relaxed text-white">
                  <div className="text-[#06c755]">🍸 新訂位</div>
                  <div className="mt-1.5 space-y-0.5">
                    <div>{date} {time} – {endLabel} ({effectiveDuration * 2} 小時)</div>
                    <div>{name || "—"}・{partySize || "?"} 人</div>
                    <div>桌位：{table || "—"}</div>
                    <div>電話：{phone || "—"}</div>
                    {notes && <div className="text-white/60">備註：{notes}</div>}
                    <div className="text-white/60">接單：{takenBy}</div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="border-t border-border px-6 py-4">
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 rounded-full border border-border px-6 py-2.5 text-sm uppercase tracking-widest text-foreground-muted hover:text-foreground"
            >
              取消
            </button>
            <button
              onClick={handleSubmit}
              disabled={!parsed || !canSubmit}
              className="flex-1 rounded-full bg-accent px-6 py-2.5 text-sm font-medium uppercase tracking-widest text-background transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-30"
            >
              送出 + 通知
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function ReservationDrawer({
  target,
  seats,
  timeSlots,
  slotLabels,
  existingTablesAtTime,
  onClose,
  onSave,
  onDelete,
}: {
  target: EditTarget;
  seats: Seat[];
  timeSlots: string[];
  slotLabels: Record<string, string>;
  existingTablesAtTime: (time: string) => Set<string>;
  onClose: () => void;
  onSave: (r: Omit<Reservation, "id">) => void;
  onDelete?: () => void;
}) {
  const r = target.reservation;
  const [time, setTime] = useState(r?.time ?? target.defaultTime);
  const [durationSlots, setDurationSlots] = useState<number>(r?.durationSlots ?? 1);
  const [table, setTable] = useState(r?.table ?? target.defaultTable);
  const [takenBy, setTakenBy] = useState(r?.takenBy ?? STAFF[0]);
  const [name, setName] = useState(r?.name ?? "");
  const [phone, setPhone] = useState(r?.phone ?? "");
  const [partySize, setPartySize] = useState<number>(r?.partySize ?? 2);
  const [notes, setNotes] = useState(r?.notes ?? "");

  const startIdx = timeSlots.indexOf(time);
  const maxDuration = timeSlots.length - startIdx;
  // Clamp duration if user changes time and current dur exceeds bound
  const effectiveDuration = Math.min(durationSlots, maxDuration);

  const taken = existingTablesAtTime(time);
  const canSubmit = !!table && !!name && !!phone && partySize > 0;
  const isEdit = !!r;

  const endHour = ((startIdx + effectiveDuration) * 2 + 18) % 24;
  const endLabel = `${String(endHour).padStart(2, "0")}:00`;

  return (
    <>
      <div className="fixed inset-0 z-20 bg-background/80 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-30 flex w-full max-w-md flex-col border-l border-border bg-background shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <h2 className="text-xl font-light">{isEdit ? "編輯訂位" : "新增訂位"}</h2>
            <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-foreground-muted">
              {isEdit ? `#${r!.id}` : "新訂位"}
            </p>
          </div>
          <button onClick={onClose} className="text-foreground-muted hover:text-foreground" aria-label="關閉">
            ✕
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-6">
          <div className="grid grid-cols-3 gap-3">
            <Field label="開始時段">
              <select
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 outline-none focus:border-accent"
              >
                {timeSlots.map((t) => (
                  <option key={t} value={t}>{slotLabels[t]}</option>
                ))}
              </select>
            </Field>
            <Field label="預計時間">
              <select
                value={effectiveDuration}
                onChange={(e) => setDurationSlots(parseInt(e.target.value))}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 outline-none focus:border-accent"
              >
                {Array.from({ length: maxDuration }, (_, i) => i + 1).map((d) => (
                  <option key={d} value={d}>{d * 2} 小時</option>
                ))}
              </select>
            </Field>
            <Field label="桌號">
              <select
                value={table}
                onChange={(e) => setTable(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 outline-none focus:border-accent"
              >
                <option value="" disabled>
                  選擇桌號
                </option>
                {seats.map((s) => (
                  <option key={s.id} value={s.id} disabled={taken.has(s.id)}>
                    {s.label}・{s.seats} 人 {taken.has(s.id) ? "(已訂)" : ""}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="客人姓名">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="客人稱呼"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 outline-none focus:border-accent"
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="電話">
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="0912-345-678"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 outline-none focus:border-accent"
              />
            </Field>
            <Field label="人數">
              <input
                type="number"
                min={1}
                value={partySize}
                onChange={(e) => setPartySize(parseInt(e.target.value) || 0)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 outline-none focus:border-accent"
              />
            </Field>
          </div>
          <Field label="定位人 (誰接的)">
            <select
              value={takenBy}
              onChange={(e) => setTakenBy(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 outline-none focus:border-accent"
            >
              {STAFF.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </Field>
          <Field label="備註 (可不填)">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 outline-none focus:border-accent"
            />
          </Field>

          <div className="rounded-lg border border-border bg-background-elevated p-3">
            <div className="mb-2 font-mono text-[10px] uppercase tracking-widest text-foreground-muted">
              送出後 LINE 群組會收到
            </div>
            <div className="rounded bg-[#1a2332] p-3 font-mono text-xs leading-relaxed text-white">
              <div className="text-[#06c755]">{isEdit ? "✏️ 訂位異動" : "🍸 新訂位"}</div>
              <div className="mt-1.5 space-y-0.5">
                <div>{time} – {endLabel} ({effectiveDuration * 2} 小時)</div>
                <div>{name || "—"}・{partySize || "?"} 人</div>
                <div>桌位：{table || "—"}</div>
                <div>電話：{phone || "—"}</div>
                {notes && <div className="text-white/60">備註：{notes}</div>}
                <div className="text-white/60">接單：{takenBy}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-border px-6 py-4">
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 rounded-full border border-border px-6 py-2.5 text-sm uppercase tracking-widest text-foreground-muted hover:text-foreground"
            >
              取消
            </button>
            <button
              onClick={() =>
                onSave({
                  date: "",
                  time,
                  durationSlots: effectiveDuration,
                  table,
                  takenBy,
                  name,
                  phone,
                  partySize,
                  notes,
                })
              }
              disabled={!canSubmit}
              className="flex-1 rounded-full bg-accent px-6 py-2.5 text-sm font-medium uppercase tracking-widest text-background transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-30"
            >
              {isEdit ? "儲存" : "送出 + 通知"}
            </button>
          </div>
          {onDelete && (
            <button
              onClick={() => {
                if (confirm("確定取消這筆訂位？")) onDelete();
              }}
              className="mt-3 w-full rounded-full px-6 py-2 text-sm uppercase tracking-widest text-red-400/70 hover:text-red-400"
            >
              取消這筆訂位
            </button>
          )}
        </div>
      </div>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block font-mono text-xs uppercase tracking-widest text-foreground-muted">
        {label}
      </span>
      {children}
    </label>
  );
}
