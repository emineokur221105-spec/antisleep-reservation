"use client";

import { useRef } from "react";
import {
  CANVAS_H as DEFAULT_CANVAS_H,
  CANVAS_W as DEFAULT_CANVAS_W,
  colorForReservation,
  GRID,
  type Seat,
} from "@/lib/seats";

type Mode = "view" | "edit";

export type ReservationInfo = {
  id: number;
  name: string;
  partySize: number;
  durationSlots: number;
  notes?: string;
};

type DragState =
  | { kind: "move"; id: string; dx: number; dy: number }
  | {
      kind: "resize";
      id: string;
      startX: number;
      startY: number;
      startW: number;
      startH: number;
      startMouseX: number;
      startMouseY: number;
    };

type Props = {
  seats: Seat[];
  mode: Mode;
  canvasW?: number;
  canvasH?: number;
  selectedId?: string | null;
  // Per-seat timeline: array length = number of slots; null if free, ReservationInfo if booked
  seatTimelines?: Map<string, (ReservationInfo | null)[]>;
  // Index of the currently focused slot (for highlighting)
  currentSlotIdx?: number;
  onSeatClick?: (id: string) => void;
  onSeatChange?: (id: string, patch: Partial<Seat>) => void;
  onCanvasClick?: () => void;
};

const MIN_SIZE = 30;
const HANDLE_R = 8;

export function FloorPlanSVG({
  seats,
  mode,
  canvasW = DEFAULT_CANVAS_W,
  canvasH = DEFAULT_CANVAS_H,
  selectedId,
  seatTimelines,
  currentSlotIdx = 0,
  onSeatClick,
  onSeatChange,
  onCanvasClick,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<DragState | null>(null);

  const clientToSvg = (clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    const scaleX = canvasW / rect.width;
    const scaleY = canvasH / rect.height;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  };

  const onSeatPointerDown = (e: React.PointerEvent, seat: Seat) => {
    onSeatClick?.(seat.id);
    if (mode !== "edit") return;
    e.preventDefault();
    e.stopPropagation();
    const { x, y } = clientToSvg(e.clientX, e.clientY);
    dragRef.current = { kind: "move", id: seat.id, dx: x - seat.x, dy: y - seat.y };
    (e.target as Element).setPointerCapture?.(e.pointerId);
  };

  const onResizeHandlePointerDown = (e: React.PointerEvent, seat: Seat) => {
    if (mode !== "edit") return;
    e.preventDefault();
    e.stopPropagation();
    const { x, y } = clientToSvg(e.clientX, e.clientY);
    dragRef.current = {
      kind: "resize",
      id: seat.id,
      startX: seat.x,
      startY: seat.y,
      startW: seat.w,
      startH: seat.h,
      startMouseX: x,
      startMouseY: y,
    };
    (e.target as Element).setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag || !onSeatChange) return;
    const { x, y } = clientToSvg(e.clientX, e.clientY);
    const seat = seats.find((s) => s.id === drag.id);
    if (!seat) return;

    if (drag.kind === "move") {
      let nx = Math.round((x - drag.dx) / GRID) * GRID;
      let ny = Math.round((y - drag.dy) / GRID) * GRID;
      nx = Math.max(20, Math.min(canvasW - seat.w - 20, nx));
      ny = Math.max(20, Math.min(canvasH - seat.h - 20, ny));
      onSeatChange(drag.id, { x: nx, y: ny });
    } else {
      // Resize from bottom-right corner
      let nw = Math.round((drag.startW + (x - drag.startMouseX)) / GRID) * GRID;
      let nh = Math.round((drag.startH + (y - drag.startMouseY)) / GRID) * GRID;
      nw = Math.max(MIN_SIZE, Math.min(canvasW - drag.startX - 20, nw));
      nh = Math.max(MIN_SIZE, Math.min(canvasH - drag.startY - 20, nh));
      // Circle: keep w == h
      if (seat.shape === "circle") {
        const size = Math.max(nw, nh);
        nw = size;
        nh = size;
      }
      onSeatChange(drag.id, { w: nw, h: nh });
    }
  };

  const onPointerUp = () => {
    dragRef.current = null;
  };

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${canvasW} ${canvasH}`}
      className="block w-full touch-none select-none"
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
      onClick={(e) => {
        if (e.target === e.currentTarget) onCanvasClick?.();
      }}
    >
      {/* Grid background (only in edit mode) */}
      {mode === "edit" && (
        <>
          <defs>
            <pattern id="grid" width={GRID} height={GRID} patternUnits="userSpaceOnUse">
              <path
                d={`M ${GRID} 0 L 0 0 0 ${GRID}`}
                fill="none"
                stroke="var(--border)"
                strokeWidth="0.5"
                opacity="0.5"
              />
            </pattern>
          </defs>
          <rect width={canvasW} height={canvasH} fill="url(#grid)" />
        </>
      )}

      {/* Outer wall */}
      <rect
        x="20"
        y="20"
        width={canvasW - 40}
        height={canvasH - 40}
        fill="none"
        stroke="var(--border)"
        strokeWidth="3"
      />

      {/* Seats */}
      {seats.map((s) => {
        const isSelected = s.id === selectedId;
        const timeline = seatTimelines?.get(s.id) ?? null;
        const currentReservation = timeline?.[currentSlotIdx] ?? null;
        const isReserved = !!currentReservation;

        // Distinct reservations on this seat throughout the night (for label list)
        const distinctReservations: ReservationInfo[] = [];
        if (timeline) {
          const seen = new Set<number>();
          for (const r of timeline) {
            if (r && !seen.has(r.id)) {
              seen.add(r.id);
              distinctReservations.push(r);
            }
          }
        }
        const hasMultiple = distinctReservations.length > 1;

        const cx = s.x + s.w / 2;
        const cy = s.y + s.h / 2;

        const seatColor = currentReservation
          ? colorForReservation(currentReservation.id)
          : null;

        const fill = seatColor
          ? seatColor
          : isSelected
            ? "var(--accent)"
            : "var(--background)";
        const stroke = seatColor
          ? seatColor
          : isSelected
            ? "var(--accent)"
            : "var(--foreground-muted)";
        const textFill =
          isReserved || isSelected ? "var(--background)" : "var(--foreground)";

        const cursor = mode === "edit" ? "move" : onSeatClick ? "pointer" : "default";

        // Timeline mini-bar geometry (below the seat)
        const tlSlots = timeline?.length ?? 0;
        const tlW = Math.max(s.w, 60);
        const tlSegW = tlSlots > 0 ? tlW / tlSlots : 0;
        const tlX = cx - tlW / 2;
        const tlY = s.y + s.h + 6;
        const tlH = 5;

        return (
          <g key={s.id}>
            <g
              onPointerDown={(e) => onSeatPointerDown(e, s)}
              style={{ cursor }}
            >
              {s.shape === "circle" ? (
                <circle
                  cx={cx}
                  cy={cy}
                  r={s.w / 2}
                  fill={fill}
                  stroke={stroke}
                  strokeWidth={isSelected ? 3 : 2}
                />
              ) : (
                <rect
                  x={s.x}
                  y={s.y}
                  width={s.w}
                  height={s.h}
                  rx="4"
                  fill={fill}
                  stroke={stroke}
                  strokeWidth={isSelected ? 3 : 2}
                />
              )}
              <text
                x={cx}
                y={cy + 3}
                textAnchor="middle"
                className="pointer-events-none font-mono text-[11px]"
                fill={textFill}
              >
                {s.label}
              </text>
              {/* Show seat capacity inside large seats when not reserved */}
              {mode === "view" && !isReserved && s.w >= 50 && (
                <text
                  x={cx}
                  y={cy + 16}
                  textAnchor="middle"
                  className="pointer-events-none font-mono text-[9px]"
                  fill={textFill}
                  opacity="0.7"
                >
                  {s.seats} 人
                </text>
              )}
            </g>

            {/* Mini timeline + names below the seat (view mode only) */}
            {mode === "view" && timeline && tlSlots > 0 && (
              <g className="pointer-events-none">
                {/* Timeline segments: filled if reserved, empty (border only) if free */}
                {timeline.map((r, idx) => {
                  const segX = tlX + idx * tlSegW;
                  const isCurrent = idx === currentSlotIdx;
                  return (
                    <rect
                      key={`bg-${idx}`}
                      x={segX + 1}
                      y={tlY}
                      width={tlSegW - 2}
                      height={tlH}
                      rx="1"
                      fill={r ? colorForReservation(r.id) : "transparent"}
                      stroke={
                        isCurrent
                          ? "var(--foreground)"
                          : r
                            ? "none"
                            : "var(--foreground-muted)"
                      }
                      strokeWidth={isCurrent ? 1.5 : r ? 0 : 1}
                      opacity={r ? 0.95 : 0.5}
                    />
                  );
                })}

                {/* Current slot reservation name */}
                {currentReservation && (
                  <text
                    x={cx}
                    y={tlY + tlH + 12}
                    textAnchor="middle"
                    className="font-mono text-[10px]"
                    fill="var(--foreground)"
                  >
                    {currentReservation.name}・{currentReservation.partySize} 人
                  </text>
                )}

                {/* If multiple distinct reservations, list other names below in muted color */}
                {hasMultiple &&
                  distinctReservations
                    .filter((r) => !currentReservation || r.id !== currentReservation.id)
                    .map((r, i) => (
                      <text
                        key={`other-${r.id}`}
                        x={cx}
                        y={tlY + tlH + 24 + i * 11}
                        textAnchor="middle"
                        className="font-mono text-[9px]"
                        fill={colorForReservation(r.id)}
                        opacity="0.75"
                      >
                        {r.name}・{r.partySize} 人
                      </text>
                    ))}
              </g>
            )}

            {/* Resize handle (bottom-right, only when selected in edit mode) */}
            {mode === "edit" && isSelected && (
              <g
                onPointerDown={(e) => onResizeHandlePointerDown(e, s)}
                style={{ cursor: "nwse-resize" }}
              >
                {/* Larger invisible hit area for easier touch */}
                <rect
                  x={s.x + s.w - HANDLE_R - 4}
                  y={s.y + s.h - HANDLE_R - 4}
                  width={HANDLE_R * 2 + 8}
                  height={HANDLE_R * 2 + 8}
                  fill="transparent"
                />
                <circle
                  cx={s.x + s.w}
                  cy={s.y + s.h}
                  r={HANDLE_R}
                  fill="var(--background)"
                  stroke="var(--accent)"
                  strokeWidth="2"
                />
                <path
                  d={`M ${s.x + s.w - 3} ${s.y + s.h + 1} L ${s.x + s.w + 1} ${s.y + s.h - 3}`}
                  stroke="var(--accent)"
                  strokeWidth="1.5"
                  fill="none"
                />
              </g>
            )}
          </g>
        );
      })}
    </svg>
  );
}
