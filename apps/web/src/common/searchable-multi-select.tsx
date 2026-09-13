"use client";

import { Check, ChevronDown, Search } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export type SearchableOption = {
  value: string;
  label: string;
  /** Angka kecil di kanan (mis. jumlah item). */
  count?: number;
};

/**
 * Dropdown filter dengan kotak pencarian dan pilihan banyak (checkbox).
 * values kosong = tidak memfilter (menampilkan allLabel). Keyboard: panah
 * atas/bawah memilih baris, Enter mencentang/melepas, Escape menutup.
 */
export function SearchableMultiSelect({
  id,
  values,
  options,
  onChange,
  label,
  allLabel,
  icon: Icon,
  searchPlaceholder = "Cari…",
  className,
}: {
  id: string;
  values: string[];
  options: SearchableOption[];
  onChange: (values: string[]) => void;
  /** Label untuk pembaca layar. */
  label: string;
  /** Teks tombol saat tidak ada yang dipilih, mis. "Semua kategori". */
  allLabel: string;
  icon?: React.ComponentType<{ className?: string }>;
  searchPlaceholder?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const q = query.trim().toLowerCase();
  const filtered = q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;
  const chosen = options.filter((o) => values.includes(o.value));
  const summary =
    chosen.length === 0
      ? allLabel
      : chosen.length === 1
        ? chosen[0].label
        : `${chosen[0].label} +${chosen.length - 1}`;

  // Tutup saat klik di luar komponen.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  const openPanel = () => {
    setQuery("");
    setHighlight(0);
    setOpen(true);
  };

  // Panel tetap terbuka supaya bisa mencentang beberapa opsi sekaligus.
  const toggle = (value: string) =>
    onChange(values.includes(value) ? values.filter((v) => v !== value) : [...values, value]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const option = filtered[highlight];
      if (option) toggle(option.value);
    }
  };

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        id={id}
        type="button"
        aria-label={`${label}: ${chosen.length ? chosen.map((o) => o.label).join(", ") : allLabel}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => (open ? setOpen(false) : openPanel())}
        className={cn(
          "flex h-10 w-full min-w-52 items-center gap-2 rounded-full border border-input bg-card pl-3.5 pr-3 text-left text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          chosen.length > 0 && "border-primary/50",
        )}
      >
        {Icon && <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />}
        <span className="min-w-0 flex-1 truncate">{summary}</span>
        {chosen.length > 0 && (
          <span className="shrink-0 rounded-full bg-primary px-1.5 text-[11px] font-semibold leading-5 text-primary-foreground">
            {chosen.length}
          </span>
        )}
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div
          className="absolute left-0 top-full z-30 mt-1.5 w-full min-w-64 rounded-2xl border border-border bg-card p-2 shadow-lg"
          onKeyDown={onKeyDown}
          // Klik opsi/tombol di panel tidak boleh mencuri fokus dari kotak cari:
          // tanpa ini fokus pindah ke body, lalu ketik, Enter, dan Escape tidak
          // lagi sampai ke panel. click tetap jalan walau mousedown dicegah.
          onMouseDown={(e) => {
            if (!(e.target instanceof HTMLInputElement)) e.preventDefault();
          }}
        >
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setHighlight(0);
              }}
              placeholder={searchPlaceholder}
              aria-label={`Cari ${label.toLowerCase()}`}
              aria-controls={listId}
              aria-activedescendant={filtered[highlight] ? `${listId}-${highlight}` : undefined}
              autoFocus
              className="h-9 w-full rounded-full border border-input bg-card pl-9 pr-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <div className="mt-2 flex min-h-6 items-center justify-between px-2.5 text-xs text-muted-foreground">
            <span>{values.length ? `${values.length} dipilih` : allLabel}</span>
            {values.length > 0 && (
              <button
                type="button"
                onClick={() => onChange([])}
                className="py-1 font-medium text-primary hover:underline"
              >
                Hapus pilihan
              </button>
            )}
          </div>
          <ul
            id={listId}
            role="listbox"
            aria-label={label}
            aria-multiselectable="true"
            className="mt-1 max-h-64 overflow-y-auto overscroll-contain"
          >
            {filtered.length === 0 ? (
              <li className="px-3 py-3 text-xs text-muted-foreground">
                Tidak ada yang cocok dengan &ldquo;{query.trim()}&rdquo;.
              </li>
            ) : (
              filtered.map((option, index) => {
                const isSelected = values.includes(option.value);
                return (
                  <li
                    key={option.value}
                    id={`${listId}-${index}`}
                    role="option"
                    aria-selected={isSelected}
                    onPointerEnter={() => setHighlight(index)}
                    onClick={() => toggle(option.value)}
                    className={cn(
                      "flex cursor-pointer items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm",
                      index === highlight && "bg-secondary/70",
                    )}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        "flex h-4 w-4 shrink-0 items-center justify-center rounded-[5px] border transition-colors",
                        isSelected
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-input bg-card",
                      )}
                    >
                      {isSelected && <Check className="h-3 w-3" strokeWidth={3} />}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{option.label}</span>
                    {option.count !== undefined && (
                      <span className="shrink-0 text-xs text-muted-foreground">{option.count}</span>
                    )}
                  </li>
                );
              })
            )}
          </ul>
          <div className="mt-2 flex justify-end border-t border-border pt-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-full bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground"
            >
              Selesai
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
