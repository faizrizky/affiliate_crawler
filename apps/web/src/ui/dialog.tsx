"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { createContext, useContext } from "react";
import { dialogMotion, overlayMotion } from "@/animations/modal-motion";
import { cn } from "@/lib/utils";

const DialogOpenContext = createContext(false);

export function Dialog({
  open,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return (
    <DialogOpenContext.Provider value={open ?? false}>
      <DialogPrimitive.Root open={open} {...props} />
    </DialogOpenContext.Provider>
  );
}
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export function DialogContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content>) {
  const open = useContext(DialogOpenContext);
  return (
    <AnimatePresence>
      {open && (
        <DialogPrimitive.Portal forceMount>
          <DialogPrimitive.Overlay asChild forceMount>
            <motion.div
              variants={overlayMotion}
              initial="hidden"
              animate="visible"
              exit="hidden"
              className="fixed inset-0 z-50 bg-foreground/40"
            />
          </DialogPrimitive.Overlay>
          <DialogPrimitive.Content
            forceMount
            className={cn(
              "fixed left-1/2 top-1/2 z-50 w-[calc(100vw-1.5rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 sm:w-[calc(100vw-2rem)]",
              className,
            )}
            {...props}
          >
            <motion.div
              variants={dialogMotion}
              initial="hidden"
              animate="visible"
              exit="hidden"
              // Tinggi dibatasi layar (dvh = area terlihat di Safari mobile, di luar
              // toolbar browser). Kalau isi tetap lebih tinggi, panel yang di-scroll —
              // bukan halaman — dan DialogFooter menempel di bawah.
              className="relative max-h-[calc(100dvh-1.5rem)] overflow-y-auto overscroll-contain rounded-3xl border border-border bg-card p-4 text-card-foreground shadow-lg sm:max-h-[calc(100dvh-2rem)] sm:p-5"
            >
              {children}
              <DialogPrimitive.Close className="absolute right-3.5 top-3.5 text-muted-foreground opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring sm:right-4 sm:top-4">
                <X className="h-4 w-4" />
                <span className="sr-only">Close</span>
              </DialogPrimitive.Close>
            </motion.div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      )}
    </AnimatePresence>
  );
}

export function DialogHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("mb-3 flex flex-col space-y-1 pr-8 sm:mb-4 sm:space-y-1.5", className)} {...props} />
  );
}

export function DialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      className={cn("text-lg font-semibold leading-none", className)}
      {...props}
    />
  );
}

export function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}

export function DialogFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        // Sticky: tombol aksi tetap terlihat walau isi dialog harus di-scroll.
        "sticky -bottom-4 -mx-4 mt-4 flex justify-end gap-2 bg-card px-4 pb-4 pt-3 sm:-bottom-5 sm:-mx-5 sm:mt-5 sm:px-5 sm:pb-5",
        className,
      )}
      {...props}
    />
  );
}
