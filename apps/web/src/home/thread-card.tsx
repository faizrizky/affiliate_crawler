"use client";

import type { ThreadPost } from "@aff/types";
import { motion } from "framer-motion";
import {
  BadgeDollarSign,
  CheckCircle2,
  Circle,
  ExternalLink,
  TrendingUp,
  WandSparkles,
} from "lucide-react";
import { useState } from "react";
import { listItem } from "@/animations/list-motion";
import { formatCount, formatTimeAgo } from "@/lib/utils";
import { Badge } from "@/ui/badge";
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
        className={`relative flex h-full flex-col p-6 ${
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
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-foreground"
              aria-hidden
            >
              {initials}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{name}</p>
            <p className="truncate text-xs text-muted-foreground">
              @{post.authorUsername} ·{" "}
              {formatTimeAgo(post.publishedAt ?? post.crawledAt)}
            </p>
          </div>
          {(post.relevanceScore != null || post.affiliateScore != null) && (
            <div className="flex shrink-0 items-center gap-1.5">
              {post.relevanceScore != null && (
                <Badge
                  variant="primary"
                  className="px-2.5 py-1.5"
                  title="Relevance score"
                >
                  <TrendingUp className="h-3.5 w-3.5" />
                  {post.relevanceScore}
                </Badge>
              )}
              {post.affiliateScore != null && (
                <Badge
                  variant="success"
                  className="px-2.5 py-1.5"
                  title="Affiliate score"
                >
                  <BadgeDollarSign className="h-3.5 w-3.5" />
                  {post.affiliateScore}
                </Badge>
              )}
            </div>
          )}
        </div>

        <p className="mt-2 text-xs text-muted-foreground">
          {formatCount(post.likeCount)} likes · {formatCount(post.replyCount)}{" "}
          replies · {formatCount(post.repostCount)} reposts
        </p>

        <div className="flex-1">
          <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed">
            {post.content}
          </p>
          <ThreadMediaCarousel urls={media} />
        </div>

        <div className="mt-5 flex items-center justify-between gap-3 border-t border-border pt-4">
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
