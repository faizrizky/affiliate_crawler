"use client";

import { motion } from "framer-motion";
import type { ThreadPost } from "@aff/types";
import { listStagger } from "@/animations/list-motion";
import { ThreadCard } from "./thread-card";

export function ThreadList({
  posts,
  onApplyTemplate,
  selectMode = false,
  selectedIds = [],
  onToggleSelect,
}: {
  posts: ThreadPost[];
  onApplyTemplate?: (post: ThreadPost) => void;
  selectMode?: boolean;
  selectedIds?: string[];
  onToggleSelect?: (postId: string) => void;
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
          selectMode={selectMode}
          selected={selectedIds.includes(post.id)}
          onToggleSelect={onToggleSelect}
        />
      ))}
    </motion.ul>
  );
}
