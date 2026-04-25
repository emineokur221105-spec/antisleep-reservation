"use client";

import Link from "next/link";
import { useState } from "react";

type Step = 1 | 2 | 3 | 4 | 5;

type Booking = {
  date?: string;
  time?: string;
  tableId?: string;
  tableLabel?: string;
  name?: string;
  phone?: string;
  partySize?: number;
  notes?: string;
};

export default function BookPage() {
  const [step, setStep] = useState<Step>(1);
  const [booking, setBooking] = useState<Booking>({});

  const next = () => setStep((s) => Math.min(5, s + 1) as Step);
  const prev = () => setStep((s) => Math.max(1, s - 1) as Step);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top nav */}
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <Link
            href="/"
            className="font-mono text-sm tracking-widest hover:text-accent"
          >
            anti sleep <span className="text-foreground-muted">™</span>
          </Link>
          <Link
            href="/"
            className="text-xs uppercase tracking-widest text-foreground-muted hover:text-foreground"
          >
            ← 返回首頁
          </Link>
        </div>
      </header>

      {/* Step indicator */}
      {step <= 4 && (
        <div className="border-b border-border px-6 py-6">
          <div className="mx-auto flex max-w-4xl items-center gap-3 text-xs font-mono uppercase tracking-widest">
            {STEP_LABELS.map((label, i) => {
              const num = (i + 1) as Step;
              const active = num === step;
              const done = num < step;
              return (
                <div key={label} className="flex items-center gap-3">
                  <span
                    className={`flex h-6 w-6 items-center justify-center rounded-full border ${
                      done
                        ? "border-accent bg-accent text-background"
                        : active
                          ? "border-accent text-accent"
                          : "border-border text-foreground-muted"
                    }`}
                  >
                    {done ? "✓" : num}
                  </span>
                  <span
                    className={
                      active
                        ? "text-foreground"
                        : done
                          ? "text-foreground-muted"
                          : "text-foreground-muted"
                    }
                  >
                    {label}
                  </span>
                  {i < STEP_LABELS.length - 1 && (
                    <span className="mx-2 h-px w-6 bg-border" />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Step content */}
      <main className="flex-1 px-6 py-12">
        <div className="mx-auto max-w-4xl">
          {step === 1 && (
            <StepDate
              value={booking.date}
              onChange={(date) => setBooking({ ...booking, date })}
            />
          )}
          {step === 2 && (
            <StepTime
              value={booking.time}
              onChange={(time) => setBooking({ ...booking, time })}
            />
          )}
          {step === 3 && (
            <StepSeat
              value={booking.tableId}
              onChange={(tableId, tableLabel) =>
                setBooking({ ...booking, tableId, tableLabel })
              }
            />
          )}
          {step === 4 && (
            <StepForm
              booking={booking}
              onChange={(patch) => setBooking({ ...booking, ...patch })}
            />
          )}
          {step === 5 && <StepDone booking={booking} />}
        </div>
      </main>

      {/* Nav buttons */}
      {step <= 4 && (
        <div className="border-t border-border px-6 py-6">
          <div className="mx-auto flex max-w-4xl items-center justify-between">
            <button
              onClick={prev}
              disabled={step === 1}
              className="text-sm uppercase tracking-widest text-foreground-muted hover:text-foreground disabled:opacity-30 disabled:hover:text-foreground-muted"
            >
              ← 上一步
            </button>
            <button
              onClick={next}
              disabled={!canProceed(step, booking)}
              className="rounded-full bg-accent px-8 py-3 text-sm font-medium uppercase tracking-widest text-background transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-30"
            >
              {step === 4 ? "送出訂位" : "下一步 →"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const STEP_LABELS = ["日期", "時段", "座位", "資料"];

function canProceed(step: Step, b: Booking): boolean {
  if (step === 1) return !!b.date;
  if (step === 2) return !!b.time;
  if (step === 3) return !!b.tableId;
  if (step === 4)
    return !!b.name && !!b.phone && !!b.partySize && b.partySize > 0;
  return false;
}

/* ---------------- Step 1: Date ---------------- */
function StepDate({
  value,
  onChange,
}: {
  value?: string;
  onChange: (v: string) => void;
}) {
  const dates = nextDates(7);
  return (
    <div>
      <h2 className="mb-2 text-3xl font-light">選擇日期</h2>
      <p className="mb-10 text-foreground-muted">想哪一晚過來？</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-7">
        {dates.map((d) => {
          const selected = value === d.iso;
          return (
            <button
              key={d.iso}
              onClick={() => onChange(d.iso)}
              className={`flex flex-col items-center gap-1 rounded-lg border p-4 transition ${
                selected
                  ? "border-accent bg-accent/10 text-accent"
                  : "border-border hover:border-foreground"
              }`}
            >
              <span className="font-mono text-xs uppercase tracking-widest text-foreground-muted">
                {d.weekday}
              </span>
              <span className="text-2xl font-light">{d.day}</span>
              <span className="font-mono text-xs text-foreground-muted">
                {d.month}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------- Step 2: Time ---------------- */
function StepTime({
  value,
  onChange,
}: {
  value?: string;
  onChange: (v: string) => void;
}) {
  const slots = [
    "20:00",
    "20:30",
    "21:00",
    "21:30",
    "22:00",
    "22:30",
    "23:00",
    "23:30",
    "00:00",
    "00:30",
  ];
  // Mock: 21:00 and 22:30 already full
  const fullSlots = new Set(["21:00", "22:30"]);
  return (
    <div>
      <h2 className="mb-2 text-3xl font-light">選擇時段</h2>
      <p className="mb-10 text-foreground-muted">
        每段 30 分鐘・灰色為已客滿
      </p>
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
        {slots.map((s) => {
          const full = fullSlots.has(s);
          const selected = value === s;
          return (
            <button
              key={s}
              onClick={() => !full && onChange(s)}
              disabled={full}
              className={`rounded-lg border py-4 font-mono text-base transition ${
                full
                  ? "cursor-not-allowed border-border bg-background-elevated text-foreground-muted line-through"
                  : selected
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-border hover:border-foreground"
              }`}
            >
              {s}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------- Step 3: Seat (Floor plan) ---------------- */
type Seat = {
  id: string;
  area: "A" | "B" | "C";
  shape: "circle" | "rect";
  cx: number;  // center x (for circle) or rect center
  cy: number;
  w: number;
  h: number;
  seats: number;
  taken?: boolean;
};

// Naming: A = 吧檯位 (bar stools), B = 桌位 (tables), C = 包廂 (private rooms)
const SEATS: Seat[] = [
  // A1-A8: bar stools at counter
  ...Array.from({ length: 8 }, (_, i) => ({
    id: `A${i + 1}`,
    area: "A" as const,
    shape: "circle" as const,
    cx: 130 + i * 60,
    cy: 175,
    w: 28,
    h: 28,
    seats: 1,
    taken: i === 2 || i === 5,
  })),
  // B1-B4: 4-seat tables
  { id: "B1", area: "B", shape: "rect", cx: 160, cy: 320, w: 60, h: 60, seats: 4 },
  { id: "B2", area: "B", shape: "rect", cx: 290, cy: 320, w: 60, h: 60, seats: 4, taken: true },
  { id: "B3", area: "B", shape: "rect", cx: 420, cy: 320, w: 60, h: 60, seats: 4 },
  { id: "B4", area: "B", shape: "rect", cx: 550, cy: 320, w: 60, h: 60, seats: 4 },
  // C1-C2: private rooms
  { id: "C1", area: "C", shape: "rect", cx: 200, cy: 470, w: 180, h: 80, seats: 6 },
  { id: "C2", area: "C", shape: "rect", cx: 510, cy: 470, w: 180, h: 80, seats: 6, taken: true },
];

function StepSeat({
  value,
  onChange,
}: {
  value?: string;
  onChange: (id: string, label: string) => void;
}) {
  const selected = SEATS.find((s) => s.id === value);
  return (
    <div>
      <h2 className="mb-2 text-3xl font-light">選擇座位</h2>
      <p className="mb-8 text-foreground-muted">
        點選想要的座位・<span className="text-foreground-muted/60">深色為已被預訂</span>
      </p>

      {/* Floor plan */}
      <div className="overflow-x-auto rounded-lg border border-border bg-background-elevated p-4">
        <svg
          viewBox="0 0 720 580"
          className="mx-auto block w-full max-w-3xl"
          style={{ minWidth: 600 }}
        >
          {/* Outer wall */}
          <rect
            x="20"
            y="20"
            width="680"
            height="540"
            fill="none"
            stroke="var(--border)"
            strokeWidth="3"
          />

          {/* Entry (gap on right wall + label) */}
          <rect x="697" y="60" width="6" height="80" fill="var(--background-elevated)" />
          <text
            x="660"
            y="55"
            textAnchor="end"
            className="fill-[var(--accent)] font-mono text-[10px] uppercase tracking-widest"
          >
            ↓ Entry
          </text>

          {/* WC corner (bottom right) */}
          <rect
            x="620"
            y="20"
            width="80"
            height="50"
            fill="var(--background)"
            stroke="var(--border)"
            strokeWidth="1"
            strokeDasharray="3 3"
          />
          <text
            x="660"
            y="50"
            textAnchor="middle"
            className="fill-[var(--foreground-muted)] font-mono text-[10px] uppercase tracking-widest"
          >
            WC
          </text>

          {/* Bar counter (back wall, behind bar stools) */}
          <rect
            x="80"
            y="100"
            width="540"
            height="35"
            fill="var(--accent-blue)"
            opacity="0.3"
            stroke="var(--accent-blue)"
            strokeWidth="2"
          />
          <text
            x="350"
            y="123"
            textAnchor="middle"
            className="fill-[var(--accent)] font-mono text-[12px] uppercase tracking-[0.4em]"
          >
            BAR
          </text>

          {/* Area labels */}
          <text
            x="40"
            y="180"
            className="fill-[var(--foreground-muted)] font-mono text-[10px] uppercase tracking-widest"
          >
            A
          </text>
          <text
            x="40"
            y="325"
            className="fill-[var(--foreground-muted)] font-mono text-[10px] uppercase tracking-widest"
          >
            B
          </text>
          <text
            x="40"
            y="475"
            className="fill-[var(--foreground-muted)] font-mono text-[10px] uppercase tracking-widest"
          >
            C
          </text>

          {/* Private rooms walls (C area) */}
          <rect
            x="90"
            y="420"
            width="220"
            height="120"
            fill="none"
            stroke="var(--border)"
            strokeWidth="2"
          />
          <rect
            x="400"
            y="420"
            width="220"
            height="120"
            fill="none"
            stroke="var(--border)"
            strokeWidth="2"
          />

          {/* Render chairs around table seats (B & C) */}
          {SEATS.filter((s) => s.area === "B" || s.area === "C").map((s) => {
            const halfW = s.w / 2;
            const halfH = s.h / 2;
            const chairR = 6;
            const offset = 14;
            // 4 chairs around: top, bottom, left, right (for B); for C, more chairs
            const chairs =
              s.area === "B"
                ? [
                    { x: s.cx, y: s.cy - halfH - offset },
                    { x: s.cx, y: s.cy + halfH + offset },
                    { x: s.cx - halfW - offset, y: s.cy },
                    { x: s.cx + halfW + offset, y: s.cy },
                  ]
                : [
                    // 6 chairs around private room: 2 top, 2 bottom, 1 each side
                    { x: s.cx - 50, y: s.cy - halfH - offset },
                    { x: s.cx + 50, y: s.cy - halfH - offset },
                    { x: s.cx - 50, y: s.cy + halfH + offset },
                    { x: s.cx + 50, y: s.cy + halfH + offset },
                    { x: s.cx - halfW - offset, y: s.cy },
                    { x: s.cx + halfW + offset, y: s.cy },
                  ];
            return (
              <g key={`chairs-${s.id}`} opacity={s.taken ? 0.3 : 0.6}>
                {chairs.map((c, i) => (
                  <circle
                    key={i}
                    cx={c.x}
                    cy={c.y}
                    r={chairR}
                    fill="none"
                    stroke="var(--foreground-muted)"
                    strokeWidth="1"
                  />
                ))}
              </g>
            );
          })}

          {/* Render seats */}
          {SEATS.map((s) => {
            const isSelected = value === s.id;
            const isTaken = s.taken;
            const fill = isTaken
              ? "var(--background-elevated)"
              : isSelected
                ? "var(--accent)"
                : "var(--background)";
            const stroke = isTaken
              ? "var(--border)"
              : isSelected
                ? "var(--accent)"
                : "var(--foreground-muted)";
            const cursor = isTaken ? "not-allowed" : "pointer";
            const onClick = () =>
              !isTaken && onChange(s.id, `${s.id}・${s.seats} 人座`);

            return (
              <g
                key={s.id}
                onClick={onClick}
                style={{ cursor }}
                className="transition-opacity hover:opacity-80"
              >
                {s.shape === "circle" ? (
                  <circle
                    cx={s.cx}
                    cy={s.cy}
                    r={s.w / 2}
                    fill={fill}
                    stroke={stroke}
                    strokeWidth="2"
                  />
                ) : (
                  <rect
                    x={s.cx - s.w / 2}
                    y={s.cy - s.h / 2}
                    width={s.w}
                    height={s.h}
                    rx="4"
                    fill={fill}
                    stroke={stroke}
                    strokeWidth="2"
                  />
                )}
                <text
                  x={s.cx}
                  y={s.cy + 4}
                  textAnchor="middle"
                  className="pointer-events-none font-mono text-[11px]"
                  fill={
                    isTaken
                      ? "var(--foreground-muted)"
                      : isSelected
                        ? "var(--background)"
                        : "var(--foreground)"
                  }
                >
                  {s.id}
                </text>
              </g>
            );
          })}

          {/* Legend */}
          <g transform="translate(40, 555)">
            <circle cx="6" cy="-3" r="5" fill="var(--background)" stroke="var(--foreground-muted)" strokeWidth="1.5" />
            <text x="18" y="0" className="fill-[var(--foreground-muted)] font-mono text-[9px]">可選</text>
            <circle cx="60" cy="-3" r="5" fill="var(--accent)" stroke="var(--accent)" strokeWidth="1.5" />
            <text x="72" y="0" className="fill-[var(--foreground-muted)] font-mono text-[9px]">已選</text>
            <circle cx="115" cy="-3" r="5" fill="var(--background-elevated)" stroke="var(--border)" strokeWidth="1.5" />
            <text x="127" y="0" className="fill-[var(--foreground-muted)] font-mono text-[9px]">已訂</text>
            <text x="180" y="0" className="fill-[var(--foreground-muted)] font-mono text-[9px]">A = 吧檯　B = 桌位 (4人)　C = 包廂 (6人)</text>
          </g>
        </svg>
      </div>

      {/* Selection summary */}
      <div className="mt-6 flex items-center justify-between rounded-lg border border-border p-4">
        <span className="text-sm text-foreground-muted">目前選擇</span>
        <span className="font-mono text-sm">
          {selected ? `${selected.id}・${selected.seats} 人座` : "—"}
        </span>
      </div>
    </div>
  );
}

/* ---------------- Step 4: Form ---------------- */
function StepForm({
  booking,
  onChange,
}: {
  booking: Booking;
  onChange: (patch: Partial<Booking>) => void;
}) {
  return (
    <div>
      <h2 className="mb-2 text-3xl font-light">填寫資料</h2>
      <p className="mb-10 text-foreground-muted">最後一步，差不多就好了</p>

      {/* Summary */}
      <div className="mb-10 grid gap-3 rounded-lg border border-border bg-background-elevated p-6 font-mono text-sm">
        <Row label="日期" value={booking.date} />
        <Row label="時段" value={booking.time} />
        <Row label="座位" value={booking.tableLabel} />
      </div>

      {/* Form */}
      <div className="grid gap-6">
        <Field label="姓名">
          <input
            type="text"
            value={booking.name ?? ""}
            onChange={(e) => onChange({ name: e.target.value })}
            placeholder="您的稱呼"
            className="w-full rounded-lg border border-border bg-background px-4 py-3 text-base outline-none transition focus:border-accent"
          />
        </Field>
        <Field label="電話">
          <input
            type="tel"
            value={booking.phone ?? ""}
            onChange={(e) => onChange({ phone: e.target.value })}
            placeholder="0912-345-678"
            className="w-full rounded-lg border border-border bg-background px-4 py-3 text-base outline-none transition focus:border-accent"
          />
        </Field>
        <Field label="人數">
          <input
            type="number"
            min={1}
            value={booking.partySize ?? ""}
            onChange={(e) =>
              onChange({ partySize: parseInt(e.target.value) || 0 })
            }
            placeholder="2"
            className="w-full rounded-lg border border-border bg-background px-4 py-3 text-base outline-none transition focus:border-accent"
          />
        </Field>
        <Field label="備註（過敏 / 慶生 / 其他需求）">
          <textarea
            value={booking.notes ?? ""}
            onChange={(e) => onChange({ notes: e.target.value })}
            placeholder="可不填"
            rows={3}
            className="w-full rounded-lg border border-border bg-background px-4 py-3 text-base outline-none transition focus:border-accent"
          />
        </Field>
      </div>
    </div>
  );
}

/* ---------------- Step 5: Done ---------------- */
function StepDone({ booking }: { booking: Booking }) {
  const code = "AS-" + Math.floor(Math.random() * 9000 + 1000);
  return (
    <div className="text-center">
      <p className="mb-6 font-mono text-xs uppercase tracking-[0.3em] text-accent">
        Reservation Confirmed
      </p>
      <h2 className="mb-4 text-4xl font-light">訂位完成</h2>
      <p className="mb-10 text-foreground-muted">現場報這組編號就好</p>

      <div className="mx-auto mb-10 inline-block rounded-lg border border-accent bg-accent/5 px-12 py-8">
        <p className="font-mono text-xs uppercase tracking-widest text-foreground-muted">
          訂位編號
        </p>
        <p className="mt-2 font-mono text-4xl font-light text-accent">{code}</p>
      </div>

      <div className="mx-auto max-w-md grid gap-3 rounded-lg border border-border p-6 text-left font-mono text-sm">
        <Row label="日期" value={booking.date} />
        <Row label="時段" value={booking.time} />
        <Row label="座位" value={booking.tableLabel} />
        <Row label="姓名" value={booking.name} />
        <Row label="人數" value={booking.partySize ? `${booking.partySize} 人` : undefined} />
      </div>

      <Link
        href="/"
        className="mt-12 inline-flex items-center gap-3 rounded-full border border-foreground px-8 py-3 text-sm uppercase tracking-widest transition hover:bg-foreground hover:text-background"
      >
        ← 回首頁
      </Link>
    </div>
  );
}

/* ---------------- Helpers ---------------- */
function Row({ label, value }: { label: string; value?: string | number }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="text-foreground-muted">{label}</span>
      <span>{value ?? "—"}</span>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block font-mono text-xs uppercase tracking-widest text-foreground-muted">
        {label}
      </span>
      {children}
    </label>
  );
}

function nextDates(count: number) {
  const weekdays = ["週日", "週一", "週二", "週三", "週四", "週五", "週六"];
  const today = new Date();
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    return {
      iso: d.toISOString().slice(0, 10),
      weekday: i === 0 ? "今天" : i === 1 ? "明天" : weekdays[d.getDay()],
      day: d.getDate(),
      month: `${d.getMonth() + 1}月`,
    };
  });
}
