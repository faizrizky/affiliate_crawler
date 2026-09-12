"use client";

import { AnimatePresence, motion } from "framer-motion";
import { sheetMotion } from "@/animations/modal-motion";
import { Button } from "@/ui/button";

/**
 * Bar melayang untuk mode pilih-banyak. Dipakai bersama oleh daftar thread,
 * draft, template, dan link supaya posisi/animasinya konsisten.
 */
export function SelectionBar({
  count,
  open = count > 0,
  onCancel,
  children,
  cancelLabel = "Batal",
}: {
  count: number;
  open?: boolean;
  onCancel: () => void;
  children: React.ReactNode;
  cancelLabel?: string;
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          variants={sheetMotion}
          initial="hidden"
          animate="visible"
          exit="hidden"
          className="fixed inset-x-0 bottom-28 z-40 px-4 md:bottom-6"
        >
          <div className="mx-auto flex max-w-md items-center justify-between gap-3 rounded-full bg-card px-4 py-3 shadow-lg">
            <span className="text-sm font-medium">{count} dipilih</span>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={onCancel}>
                {cancelLabel}
              </Button>
              {children}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
