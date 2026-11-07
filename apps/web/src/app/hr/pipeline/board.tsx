"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import {
  DndContext, DragOverlay, KeyboardSensor, PointerSensor, TouchSensor, useDraggable, useDroppable,
  useSensor, useSensors, type DragEndEvent, type DragStartEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { APPLICATION_STATUSES, STATUS_META, type ApplicationStatus } from "@hr/shared";
import { changeStatus } from "../actions";
import { Alert } from "@/components/ui/alert";
import { cn } from "@/lib/cn";

export interface Card {
  id: string; name: string; position: string; status: ApplicationStatus; status_changed_at: string;
}

const daysSince = (iso: string) => Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000));

const COLUMN_ACCENT: Record<string, string> = {
  slate: "bg-slate-400", blue: "bg-blue-500", indigo: "bg-indigo-500", violet: "bg-violet-500",
  amber: "bg-amber-500", teal: "bg-teal-500", green: "bg-ok", red: "bg-bad",
};

export function PipelineBoard({ initial, canMove }: { initial: Card[]; canMove: boolean }) {
  const [cards, setCards] = useState(initial);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [, start] = useTransition();
  useEffect(() => setCards(initial), [initial]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
    useSensor(KeyboardSensor),
  );

  function move(id: string, to: ApplicationStatus) {
    const card = cards.find((c) => c.id === id);
    if (!card || card.status === to) return;
    const from = card.status;
    setCards((cs) => cs.map((c) => (c.id === id ? { ...c, status: to, status_changed_at: new Date().toISOString() } : c)));
    setMessage(null);
    start(async () => {
      const res = await changeStatus(id, to);
      if (res.error) {
        setCards((cs) => cs.map((c) => (c.id === id ? { ...c, status: from } : c)));
        setMessage({ tone: "error", text: res.error });
      } else {
        setMessage({ tone: "success", text: `${card.name} moved to ${STATUS_META[to].label}. They've been emailed.` });
      }
    });
  }

  const onDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id));
  const onDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    if (e.over) move(String(e.active.id), e.over.id as ApplicationStatus);
  };
  const active = cards.find((c) => c.id === activeId);

  return (
    <div className="grid gap-4">
      {message && <Alert tone={message.tone}>{message.text}</Alert>}
      <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setActiveId(null)}
        accessibility={{
          announcements: {
            onDragStart: ({ active }) => `Picked up ${cards.find((c) => c.id === active.id)?.name}.`,
            onDragOver: ({ over }) => over ? `Over ${STATUS_META[over.id as ApplicationStatus].label}.` : "Not over a stage.",
            onDragEnd: ({ active, over }) => over ? `Moved ${cards.find((c) => c.id === active.id)?.name} to ${STATUS_META[over.id as ApplicationStatus].label}.` : "Move cancelled.",
            onDragCancel: () => "Move cancelled.",
          },
        }}>
        <div className="-mx-4 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6">
          <div className="flex min-w-max gap-3">
            {APPLICATION_STATUSES.map((s) => (
              <Column key={s} status={s} cards={cards.filter((c) => c.status === s)} canMove={canMove} onMove={move} />
            ))}
          </div>
        </div>
        <DragOverlay>{active ? <CardBody card={active} lifted /> : null}</DragOverlay>
      </DndContext>
    </div>
  );
}

function Column({ status, cards, canMove, onMove }: {
  status: ApplicationStatus; cards: Card[]; canMove: boolean; onMove: (id: string, to: ApplicationStatus) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status, disabled: !canMove });
  const meta = STATUS_META[status];
  return (
    <section ref={setNodeRef} aria-label={`${meta.label}, ${cards.length}`} data-column={status}
      className={cn("flex w-[248px] flex-col rounded-[var(--radius-panel)] border bg-mist/70 transition-colors",
        isOver ? "border-ink bg-info-bg" : "border-line")}>
      <header className="flex items-center gap-2 px-3 py-2.5">
        <span className={cn("size-2 rounded-full", COLUMN_ACCENT[meta.tone])} aria-hidden="true" />
        <h2 className="text-sm font-semibold text-ink">{meta.label}</h2>
        <span className="ml-auto text-xs font-medium tabular-nums text-muted">{cards.length}</span>
      </header>
      <ul className="grid min-h-24 content-start gap-2 px-2 pb-2">
        {cards.map((c) => <DraggableCard key={c.id} card={c} canMove={canMove} onMove={onMove} />)}
        {cards.length === 0 && <li className="rounded-[var(--radius-control)] border border-dashed border-line px-3 py-4 text-center text-xs text-muted">No candidates</li>}
      </ul>
    </section>
  );
}

function DraggableCard({ card, canMove, onMove }: { card: Card; canMove: boolean; onMove: (id: string, to: ApplicationStatus) => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: card.id, disabled: !canMove });
  return (
    <li ref={setNodeRef} style={{ transform: CSS.Translate.toString(transform) }} data-card={card.id}
      className={cn(isDragging && "opacity-40")}>
      <CardBody card={card} handleProps={canMove ? { ...attributes, ...listeners } : undefined}
        footer={canMove && (
          <label className="mt-2 flex items-center gap-1.5 border-t border-line pt-2 text-xs text-muted">
            <span className="sr-only">Move {card.name} to</span>
            <span aria-hidden="true">Move to</span>
            <select value={card.status} onChange={(e) => onMove(card.id, e.target.value as ApplicationStatus)}
              className="min-w-0 flex-1 rounded border-0 bg-transparent py-0.5 text-xs font-medium text-ink focus:ring-1 focus:ring-ink">
              {APPLICATION_STATUSES.map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
            </select>
          </label>
        )} />
    </li>
  );
}

function CardBody({ card, handleProps, footer, lifted }: {
  card: Card; handleProps?: Record<string, unknown>; footer?: React.ReactNode; lifted?: boolean;
}) {
  const days = daysSince(card.status_changed_at);
  return (
    <div className={cn("rounded-[var(--radius-control)] border border-line bg-white p-3", lifted && "rotate-1 shadow-lg ring-1 ring-ink/10")}>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <Link href={`/hr/applications/${card.id}`} className="block truncate text-sm font-medium text-ink hover:underline">{card.name}</Link>
          <p className="truncate text-xs text-muted">{card.position}</p>
          <p className={cn("mt-1 text-xs", days > 7 ? "text-amber-800" : "text-muted")}>
            {days === 0 ? "In this stage since today" : `${days} ${days === 1 ? "day" : "days"} in this stage`}
          </p>
        </div>
        {handleProps && (
          <button type="button" {...handleProps} aria-label={`Drag ${card.name}`}
            className="-mr-1 -mt-0.5 cursor-grab touch-none rounded p-1 text-steel-light hover:bg-mist hover:text-ink active:cursor-grabbing">
            <svg viewBox="0 0 16 16" className="size-4" fill="currentColor" aria-hidden="true">
              {[3, 8, 13].flatMap((y) => [5, 11].map((x) => <circle key={`${x}${y}`} cx={x} cy={y} r="1.3" />))}
            </svg>
          </button>
        )}
      </div>
      {footer}
    </div>
  );
}
