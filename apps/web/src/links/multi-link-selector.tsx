"use client";

import { ArrowDown, ArrowUp, Check, ChevronDown, Search, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useLinks } from "@/hooks/use-links";
import { cn } from "@/lib/utils";
import { Label } from "@/ui/label";

/**
 * Pilih banyak link berurutan. Urutan pilihan = nomor placeholder:
 * link #1 mengisi {{affiliate_link_1}}, #2 mengisi {{affiliate_link_2}}, dst.
 *
 * Daftar pilihan dibuka di dalam alur form (bukan melayang) supaya tidak
 * terpotong oleh panel dialog yang bisa di-scroll di layar kecil.
 */
export function MultiLinkSelector({
  value,
  onChange,
  id = "link-multi",
  label = "Link Produk",
  error,
  categoryId,
}: {
  value: string[];
  onChange: (linkIds: string[]) => void;
  id?: string;
  label?: string;
  error?: string;
  /** Kalau diisi, hanya link di kategori ini yang ditawarkan di daftar. */
  categoryId?: string | null;
}) {
  const { links } = useLinks();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const allLinks = links.data?.links ?? [];
  const byId = new Map(allLinks.map((l) => [l.id, l]));

  const q = query.trim().toLowerCase();
  const options = allLinks
    .filter((l) => !categoryId || l.categoryId === categoryId)
    .filter((l) => !q || l.name.toLowerCase().includes(q) || l.url.toLowerCase().includes(q));

  const toggle = (linkId: string) =>
    onChange(value.includes(linkId) ? value.filter((x) => x !== linkId) : [...value, linkId]);

  const move = (index: number, delta: number) => {
    const next = [...value];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={`${id}-toggle`}>{label}</Label>

      {links.isLoading ? (
        <div className="h-10 animate-pulse rounded-full bg-muted" />
      ) : allLinks.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Belum ada link produk.{" "}
          <Link href="/links" className="font-medium text-primary hover:underline">
            Tambahkan dulu di halaman Link
          </Link>
          .
        </p>
      ) : (
        <>
          {value.length > 0 && (
            <ol className="flex flex-col gap-1 sm:gap-1.5" aria-label="Link terpilih (urutan = nomor placeholder)">
              {value.map((linkId, index) => {
                const link = byId.get(linkId);
                return (
                  <li
                    key={linkId}
                    // Satu baris di mobile supaya modal template tetap muat satu layar;
                    // nomor placeholder cukup dibaca dari badge.
                    className="flex items-center gap-2 rounded-2xl border border-border bg-secondary/40 py-1 pl-1.5 pr-1 sm:py-1.5 sm:pl-2 sm:pr-1.5"
                  >
                    <span
                      title={`{{affiliate_link_${index + 1}}}`}
                      className="flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-semibold text-primary-foreground"
                    >
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{link?.name ?? "Link tidak ditemukan"}</p>
                      <p className="hidden truncate font-mono text-[11px] text-muted-foreground sm:block">
                        {`{{affiliate_link_${index + 1}}}`}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center">
                      <button
                        type="button"
                        onClick={() => move(index, -1)}
                        disabled={index === 0}
                        aria-label={`Naikkan ${link?.name ?? "link"}`}
                        className="rounded-lg p-1 text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-30 sm:p-1.5"
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => move(index, 1)}
                        disabled={index === value.length - 1}
                        aria-label={`Turunkan ${link?.name ?? "link"}`}
                        className="rounded-lg p-1 text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-30 sm:p-1.5"
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => toggle(linkId)}
                        aria-label={`Hapus ${link?.name ?? "link"}`}
                        className="rounded-lg p-1 text-muted-foreground hover:bg-accent hover:text-destructive sm:p-1.5"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}

          <button
            id={`${id}-toggle`}
            type="button"
            aria-expanded={open}
            aria-controls={`${id}-panel`}
            onClick={() => setOpen((o) => !o)}
            className={cn(
              "flex h-10 w-full items-center justify-between rounded-full border border-input bg-card px-4 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
              error && "border-destructive focus-visible:ring-destructive",
            )}
          >
            <span className={value.length ? "" : "text-muted-foreground"}>
              {value.length ? `${value.length} link dipilih` : "Pilih link produk…"}
            </span>
            <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")} />
          </button>

          {open && (
            <div id={`${id}-panel`} className="rounded-2xl border border-border bg-card p-2 shadow-sm">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  id={`${id}-search`}
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Cari nama atau URL link…"
                  aria-label="Cari link"
                  autoFocus
                  className="h-9 w-full rounded-full border border-input bg-card pl-9 pr-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
              <ul role="listbox" aria-multiselectable="true" className="mt-2 max-h-52 overflow-y-auto overscroll-contain">
                {options.length === 0 ? (
                  <li className="px-3 py-3 text-xs text-muted-foreground">
                    {q
                      ? `Tidak ada link yang cocok dengan "${query.trim()}".`
                      : categoryId
                        ? "Belum ada link di kategori ini."
                        : "Tidak ada link."}
                  </li>
                ) : (
                  options.map((link) => {
                    const position = value.indexOf(link.id);
                    const checked = position >= 0;
                    return (
                      <li key={link.id} role="option" aria-selected={checked}>
                        <label className="flex cursor-pointer items-center gap-3 rounded-xl px-2.5 py-2 hover:bg-secondary/60">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggle(link.id)}
                            className="peer sr-only"
                          />
                          <span
                            aria-hidden
                            className={cn(
                              "flex h-5 w-5 shrink-0 items-center justify-center rounded-[7px] border transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-ring",
                              checked ? "border-primary bg-primary text-primary-foreground" : "border-input bg-card",
                            )}
                          >
                            {checked && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm">{link.name}</span>
                            <span className="block truncate text-[11px] text-muted-foreground">{link.url}</span>
                          </span>
                          {checked && (
                            <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-[11px] font-semibold text-secondary-foreground">
                              #{position + 1}
                            </span>
                          )}
                        </label>
                      </li>
                    );
                  })
                )}
              </ul>
              <div className="mt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    setQuery("");
                  }}
                  className="rounded-full px-3 py-1.5 text-xs font-semibold text-primary hover:bg-secondary"
                >
                  Selesai
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {error && (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
