"use client";

import type { ThreadPost } from "@aff/types";
import { motion } from "framer-motion";
import {
  BadgeDollarSign,
  CheckCircle2,
  Circle,
  ExternalLink,
  Flame,
  Heart,
  MessageCircle,
  Repeat2,
  WandSparkles,
} from "lucide-react";
import { useState } from "react";
import { listItem } from "@/animations/list-motion";
import { formatCount, formatTimeAgo } from "@/lib/utils";
import { Card } from "@/ui/card";
import { ThreadMediaCarousel } from "./thread-media-carousel";

export function ThreadCard({
  post,
  onApplyTemplate,
  selectMode = false,
  selected = false,
  onToggleSelect,
}: {
  post: ThreadPost;
  onApplyTemplate?: (post: ThreadPost) => void;
  selectMode?: boolean;
  selected?: boolean;
  onToggleSelect?: (postId: string) => void;
}) {
  const [avatarFailed, setAvatarFailed] = useState(false);
  const media = post.mediaUrls ?? [];
  const name = post.authorDisplayName ?? post.authorUsername;
  const initials = name.slice(0, 2).toUpperCase();

  const toggle = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    onToggleSelect?.(post.id);
  };

  return (
    <motion.li variants={listItem} className="h-full">
      <Card
        onClick={selectMode && onToggleSelect ? toggle : undefined}
        className={`relative flex h-full flex-col border-transparent p-6 shadow-[0_10px_30px_-18px_rgba(140,30,60,0.45)] ${
          selectMode ? "cursor-pointer" : ""
        } ${selected ? "ring-2 ring-primary" : ""}`}
      >
        {selectMode && (
          <button
            type="button"
            aria-label={selected ? "Batalkan pilih post" : "Pilih post"}
            aria-pressed={selected}
            onClick={toggle}
            className="absolute left-3 top-3 z-10 rounded-full bg-card p-0.5 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {selected ? (
              <CheckCircle2 className="h-5 w-5 text-primary" />
            ) : (
              <Circle className="h-5 w-5 text-muted-foreground" />
            )}
          </button>
        )}

        <div className={`flex items-center gap-3 ${selectMode ? "pl-7" : ""}`}>
          {post.authorAvatarUrl && !avatarFailed ? (
            <img
              src={post.authorAvatarUrl}
              alt={name}
              loading="lazy"
              onError={() => setAvatarFailed(true)}
              className="h-12 w-12 shrink-0 rounded-full object-cover"
            />
          ) : (
            <div
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-semibold text-secondary-foreground"
              aria-hidden
            >
              {initials}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-semibold leading-tight">
              {name}
            </p>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              @{post.authorUsername} ·{" "}
              {formatTimeAgo(post.publishedAt ?? post.crawledAt)}
            </p>
          </div>
          {post.relevanceScore != null && (
            <span
              title="Relevance score"
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-xs font-semibold text-secondary-foreground"
            >
              <Flame className="h-3.5 w-3.5 text-primary" />
              {post.relevanceScore}
            </span>
          )}
        </div>

        <div className="flex-1">
          <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed">
            {post.content}
          </p>
          <ThreadMediaCarousel urls={media} />
        </div>

        <div className="mt-4 flex items-center justify-between gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1">
              <Heart className="h-3.5 w-3.5" />
              {formatCount(post.likeCount)}
            </span>
            <span className="inline-flex items-center gap-1">
              <MessageCircle className="h-3.5 w-3.5" />
              {formatCount(post.replyCount)}
            </span>
            <span className="inline-flex items-center gap-1">
              <Repeat2 className="h-3.5 w-3.5" />
              {formatCount(post.repostCount)}
            </span>
          </span>
          {post.affiliateScore != null && (
            <span
              title="Affiliate score"
              className="inline-flex shrink-0 items-center gap-1 font-semibold text-primary"
            >
              <BadgeDollarSign className="h-3.5 w-3.5" />
              {post.affiliateScore}
            </span>
          )}
        </div>

        <div className="mt-3 flex items-center justify-between gap-3 border-t border-border pt-4">
          <a
            href={post.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            View on Threads
          </a>
          {onApplyTemplate && !selectMode && (
            <button
              type="button"
              onClick={() => onApplyTemplate(post)}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <WandSparkles className="h-3.5 w-3.5" />
              Apply Template
            </button>
          )}
        </div>
      </Card>
    </motion.li>
  );
}
