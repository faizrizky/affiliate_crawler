"use client";

import { motion } from "framer-motion";
import { usePathname } from "next/navigation";
import { fadeUp } from "./variants";

export function PageTransition({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  return (
    <motion.div
      key={pathname}
      variants={fadeUp}
      initial="hidden"
      animate="visible"
    >
      {children}
    </motion.div>
  );
}
