"use client";

import { motion } from "framer-motion";
import type { ThreadPost } from "@aff/types";
import { listStagger } from "@/animations/list-motion";
import { ThreadCard } from "./thread-card";

export function ThreadList({
  posts,
  onApplyTemplate,
}: {
  posts: ThreadPost[];
  onApplyTemplate?: (post: ThreadPost) => void;
}) {
  return (
    <motion.ul
      variants={listStagger}
      initial="hidden"
      animate="visible"
      className="grid list-none grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
    >
      {posts.map((post) => (
        <ThreadCard
          key={post.id}
          post={post}
          onApplyTemplate={onApplyTemplate}
        />
      ))}
    </motion.ul>
  );
}
