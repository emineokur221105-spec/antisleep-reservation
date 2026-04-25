"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { FloorPlanSVG } from "@/components/FloorPlanSVG";
import {
  DEFAULT_SPACE_M,
  INITIAL_SEATS,
  loadFloor,
  METER_PX,
  nextSeatId,
  saveFloor,
  type Seat,
  type Shape,
} from "@/lib/seats";

const MIN_M = 4;
const MAX_M = 20;

export default function FloorEditorPage() {
  const [seats, setSeats] = useState<Seat[]>(INITIAL_SEATS);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [spaceM, setSpaceM] = useState(DEFAULT_SPACE_M);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  // Load from localStorage on mount
  useEffect(() => {
    const data = loadFloor();
    setSeats(data.seats);
    setSpaceM(data.space);
  }, []);

  const canvasW = spaceM.w * METER_PX;
  const canvasH = spaceM.h * METER_PX;
  const selected = seats.find((s) => s.id === selectedId) ?? null;

  const handleSave = () => {
    saveFloor({ seats, space: spaceM });
    const now = new Date();
    setSavedAt(now.toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
  };

  const updateSeat = (id: string, patch: Partial<Seat>) => {
    setSeats((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  };

  const updateSpace = (patch: Partial<typeof spaceM>) => {
    const next = { ...spaceM, ...patch };
    next.w = Math.max(MIN_M, Math.min(MAX_M, next.w));
    next.h = Math.max(MIN_M, Math.min(MAX_M, next.h));
    setSpaceM(next);
    // Clamp seats inside new bounds
    const newW = next.w * METER_PX;
    const newH = next.h * METER_PX;
    setSeats((prev) =>
      prev.map((s) => ({
        ...s,
        x: Math.max(20, Math.min(newW - s.w - 20, s.x)),
        y: Math.max(20, Math.min(newH - s.h - 20, s.y)),
      }))
    );
  };

  const addSeat = (shape: Shape) => {
    const id = nextSeatId(seats);
    const isCircle = shape === "circle";
    const next: Seat = {
      id,
      label: id,
      shape,
      x: 60,
      y: 60,
      w: isCircle ? 40 : 60,
      h: isCircle ? 40 : 60,
      seats: isCircle ? 1 : 4,
    };
    setSeats((prev) => [...prev, next]);
    setSelectedId(id);
  };

  const deleteSelected = () => {
    if (!selected) return;
    if (!confirm(`刪除 ${selected.label}？`)) return;
    setSeats((prev) => prev.filter((s) => s.id !== selected.id));
    setSelectedId(null);
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
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
            <Link href="/admin" className="text-foreground-muted hover:text-foreground">
              訂位
            </Link>
            <span className="text-foreground">座位編輯</span>
            <span className="cursor-not-allowed text-foreground-muted opacity-40">設定</span>
          </div>
        </div>
      </header>

      {/* Toolbar */}
      <div className="border-b border-border px-4 py-3 sm:px-6 sm:py-4">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2 sm:gap-3">
          <ToolButton onClick={() => addSeat("circle")}>+ 圓桌</ToolButton>
          <ToolButton onClick={() => addSeat("rect")}>+ 方桌</ToolButton>

          {/* Space size */}
          <div className="ml-2 flex items-center gap-2 rounded-full border border-border bg-background-elevated px-3 py-1 text-sm">
            <span className="font-mono text-[10px] uppercase tracking-widest text-foreground-muted">
              空間
            </span>
            <input
              type="number"
              min={MIN_M}
              max={MAX_M}
              value={spaceM.w}
              onChange={(e) =>
                updateSpace({ w: parseInt(e.target.value) || MIN_M })
              }
              className="w-12 bg-transparent text-center font-mono outline-none focus:text-accent"
            />
            <span className="text-foreground-muted">m ×</span>
            <input
              type="number"
              min={MIN_M}
              max={MAX_M}
              value={spaceM.h}
              onChange={(e) =>
                updateSpace({ h: parseInt(e.target.value) || MIN_M })
              }
              className="w-12 bg-transparent text-center font-mono outline-none focus:text-accent"
            />
            <span className="text-foreground-muted">m</span>
          </div>

          <div className="ml-auto flex items-center gap-3">
            {savedAt && (
              <span className="font-mono text-[10px] uppercase tracking-widest text-accent">
                ✓ 已儲存 {savedAt}
              </span>
            )}
            <span className="hidden font-mono text-[10px] uppercase tracking-widest text-foreground-muted sm:inline">
              拖拉移動・拖右下角縮放
            </span>
            <button
              className="rounded-full bg-accent px-5 py-2 text-sm font-medium uppercase tracking-widest text-background hover:opacity-90"
              onClick={handleSave}
            >
              儲存
            </button>
          </div>
        </div>
      </div>

      {/* Editor: canvas + side panel */}
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 px-4 py-6 sm:flex-row sm:px-6 sm:py-8">
        <div className="flex-1">
          <div className="overflow-hidden rounded-lg border border-border bg-background-elevated">
            <FloorPlanSVG
              seats={seats}
              mode="edit"
              canvasW={canvasW}
              canvasH={canvasH}
              selectedId={selectedId}
              onSeatClick={setSelectedId}
              onSeatChange={updateSeat}
              onCanvasClick={() => setSelectedId(null)}
            />
          </div>
        </div>

        <aside className="w-full sm:w-72">
          {selected ? (
            <div className="rounded-lg border border-border bg-background-elevated p-5">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-mono text-sm uppercase tracking-widest text-accent">
                  {selected.label}
                </h3>
                <button
                  onClick={deleteSelected}
                  className="text-xs uppercase tracking-widest text-red-400/70 hover:text-red-400"
                >
                  刪除
                </button>
              </div>
              <div className="space-y-4">
                <Field label="名稱">
                  <input
                    type="text"
                    value={selected.label}
                    onChange={(e) => updateSeat(selected.id, { label: e.target.value })}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 outline-none focus:border-accent"
                  />
                </Field>
                <Field label="可坐人數">
                  <input
                    type="number"
                    min={1}
                    value={selected.seats}
                    onChange={(e) =>
                      updateSeat(selected.id, { seats: parseInt(e.target.value) || 1 })
                    }
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 outline-none focus:border-accent"
                  />
                </Field>
                <div className="rounded border border-border p-3 font-mono text-[10px] text-foreground-muted">
                  {selected.shape === "circle" ? "圓桌" : "方桌"} ·{" "}
                  位置 x{Math.round(selected.x)} y{Math.round(selected.y)} · 大小{" "}
                  {Math.round(selected.w)}×{Math.round(selected.h)}
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-border border-dashed p-6 text-center text-sm text-foreground-muted">
              <p className="mb-2">點選任一桌位編輯</p>
              <p className="text-xs">或拖拉移動位置・拖右下角縮放</p>
            </div>
          )}

          <div className="mt-4 rounded-lg border border-border bg-background-elevated p-4 text-xs leading-relaxed text-foreground-muted">
            <p className="mb-2 font-mono text-[10px] uppercase tracking-widest">操作</p>
            <ul className="space-y-1.5">
              <li>· 工具列「+ 圓桌」「+ 方桌」加新座位</li>
              <li>· 拖拉桌身移動位置（吸附格線）</li>
              <li>· 點選後拖<span className="text-accent">右下角金色 handle</span> 縮放</li>
              <li>· 改完按「儲存」</li>
            </ul>
          </div>
        </aside>
      </main>
    </div>
  );
}

function ToolButton({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="rounded-full border border-border bg-background px-4 py-2 text-sm transition hover:border-accent hover:text-accent"
    >
      {children}
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-widest text-foreground-muted">
        {label}
      </span>
      {children}
    </label>
  );
}
