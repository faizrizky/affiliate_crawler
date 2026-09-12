"use client";

import Link from "next/link";
import { useLinks } from "@/hooks/use-links";
import { cn } from "@/lib/utils";
import { Label } from "@/ui/label";

/**
 * Dropdown katalog link produk. Dipakai di form template dan di dialog
 * generate, supaya keduanya selalu memilih dari sumber yang sama.
 */
export function LinkSelector({
  value,
  onChange,
  id = "link-selector",
  label = "Link Produk",
  error,
  disabled,
}: {
  value: string;
  onChange: (linkId: string) => void;
  id?: string;
  label?: string;
  error?: string;
  disabled?: boolean;
}) {
  const { links } = useLinks();
  const options = links.data?.links ?? [];
  const selected = options.find((link) => link.id === value);

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {links.isLoading ? (
        <div className="h-10 animate-pulse rounded-full bg-muted" />
      ) : options.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Belum ada link produk.{" "}
          <Link href="/links" className="font-medium text-primary hover:underline">
            Tambahkan dulu di halaman Link
          </Link>
          .
        </p>
      ) : (
        <select
          id={id}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={Boolean(error)}
          className={cn(
            "h-10 w-full rounded-full border border-input bg-card px-4 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50",
            error && "border-destructive focus-visible:ring-destructive",
          )}
        >
          <option value="">Pilih link produk…</option>
          {options.map((link) => (
            <option key={link.id} value={link.id}>
              {link.name}
            </option>
          ))}
        </select>
      )}
      {selected && (
        <p className="truncate text-xs text-muted-foreground" title={selected.url}>
          {selected.url}
        </p>
      )}
      {error && (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
