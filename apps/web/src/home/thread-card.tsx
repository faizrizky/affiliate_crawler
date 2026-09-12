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
  const [failedMedia, setFailedMedia] = useState<Record<number, boolean>>({});
  const media = (post.mediaUrls ?? []).slice(0, 6);
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
        className={`flex h-full flex-col p-5 ${
          selectMode ? "cursor-pointer" : ""
        } ${selected ? "ring-2 ring-primary" : ""}`}
      >
        <div className="flex items-center gap-3">
          {selectMode && (
            <button
              type="button"
              aria-label={selected ? "Batalkan pilih post" : "Pilih post"}
              onClick={(e) => {
                e.stopPropagation();
                onToggleSelect?.(post.id);
              }}
              className="-m-1 shrink-0 rounded-full p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {selected ? (
                <CheckCircle2 className="h-5 w-5 text-primary" />
              ) : (
                <Circle className="h-5 w-5 text-muted-foreground" />
              )}
            </button>
          )}
          {post.authorAvatarUrl && !avatarFailed ? (
            <img
              src={post.authorAvatarUrl}
              alt={name}
              loading="lazy"
              onError={() => setAvatarFailed(true)}
              className="h-10 w-10 shrink-0 rounded-full object-cover"
            />
          ) : (
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-foreground"
              aria-hidden
            >
              {initials}
            </div>
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{name}</p>
            <p className="truncate text-xs text-muted-foreground">
              @{post.authorUsername} ·{" "}
              {formatTimeAgo(post.publishedAt ?? post.crawledAt)}
            </p>
          </div>
        </div>

        {(post.relevanceScore != null || post.affiliateScore != null) && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {post.relevanceScore != null && (
              <Badge variant="primary">
                <TrendingUp className="h-3 w-3" />
                Relevance {post.relevanceScore}
              </Badge>
            )}
            {post.affiliateScore != null && (
              <Badge variant="success">
                <BadgeDollarSign className="h-3 w-3" />
                Affiliate {post.affiliateScore}
              </Badge>
            )}
          </div>
        )}

        <div className="flex-1">
          <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">
            {post.content}
          </p>
          {media.length === 1 && !failedMedia[0] ? (
            <img
              src={media[0]}
              alt=""
              loading="lazy"
              onError={() => setFailedMedia((m) => ({ ...m, 0: true }))}
              className="mt-3 aspect-video w-full rounded-xl object-cover"
            />
          ) : media.length > 1 ? (
            <div className="mt-3 grid grid-cols-3 gap-1.5">
              {media.map((url, i) =>
                failedMedia[i] ? (
                  <div
                    key={url}
                    className="flex aspect-square items-center justify-center rounded-lg bg-accent/50 text-[10px] text-muted-foreground"
                  >
                    No image
                  </div>
                ) : (
                  <img
                    key={url}
                    src={url}
                    alt=""
                    loading="lazy"
                    onError={() => setFailedMedia((m) => ({ ...m, [i]: true }))}
                    className="aspect-square rounded-lg object-cover"
                  />
                ),
              )}
            </div>
          ) : null}
        </div>

        <div className="mt-4 flex items-center justify-between gap-3 border-t border-border pt-3">
          <span className="truncate text-xs text-muted-foreground">
            {formatCount(post.likeCount)} likes ·{" "}
            {formatCount(post.replyCount)} replies
          </span>
          <div className="flex shrink-0 items-center gap-3">
            {onApplyTemplate && !selectMode && (
              <button
                type="button"
                onClick={() => onApplyTemplate(post)}
                className="inline-flex items-center gap-1.5 rounded-full border border-input bg-transparent px-3 py-1.5 text-xs font-medium transition-colors hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <WandSparkles className="h-3.5 w-3.5" />
                Apply Template
              </button>
            )}
            <a
              href={post.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              View on Threads
            </a>
          </div>
        </div>
      </Card>
    </motion.li>
  );
}
