"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, Copy } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { copyText } from "@/lib/clipboard";
import { cn } from "@/lib/utils";

const iconMotion = {
  hidden: { opacity: 0, scale: 0.5 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.18 } },
};

export function CopyButton({
  value,
  label,
  title = "Copy content",
  className,
}: {
  value: string;
  label?: string;
  title?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
    },
    [],
  );

  const onClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const ok = await copyText(value);
    if (!ok) {
      toast.error("Gagal menyalin ke clipboard");
      return;
    }
    setCopied(true);
    toast.success("Disalin ke clipboard");
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.button
      type="button"
      title={title}
      aria-label={label ?? title}
      onClick={onClick}
      whileTap={{ scale: 0.9 }}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
        copied && "text-emerald-600",
        className,
      )}
    >
      <span className="relative flex h-4 w-4 items-center justify-center">
        <AnimatePresence initial={false} mode="wait">
          {copied ? (
            <motion.span
              key="check"
              variants={iconMotion}
              initial="hidden"
              animate="visible"
              exit="hidden"
              className="absolute inset-0"
            >
              <Check className="h-4 w-4" />
            </motion.span>
          ) : (
            <motion.span
              key="copy"
              variants={iconMotion}
              initial="hidden"
              animate="visible"
              exit="hidden"
              className="absolute inset-0"
            >
              <Copy className="h-4 w-4" />
            </motion.span>
          )}
        </AnimatePresence>
      </span>
      {label && <span className="text-xs font-medium">{label}</span>}
    </motion.button>
  );
}
