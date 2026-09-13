"use client";

import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Input } from "@/ui/input";

/** Input password dengan tombol mata untuk menampilkan/menyembunyikan isi. */
export function PasswordInput({
  className,
  ...props
}: Omit<React.InputHTMLAttributes<HTMLInputElement>, "type">) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <Input
        {...props}
        type={visible ? "text" : "password"}
        className={cn("pr-11", className)}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Sembunyikan password" : "Tampilkan password"}
        aria-pressed={visible}
        aria-controls={props.id}
        disabled={props.disabled}
        className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
      >
        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}
