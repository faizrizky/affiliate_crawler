"use client";

import type { ThreadPost } from "@aff/types";
import { motion } from "framer-motion";
import {
  BadgeDollarSign,
  Heart,
  MessageCircle,
  Repeat2,
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
}: {
  post: ThreadPost;
  onApplyTemplate?: (post: ThreadPost) => void;
}) {
  const [avatarFailed, setAvatarFailed] = useState(false);
  const [failedMedia, setFailedMedia] = useState<Record<number, boolean>>({});
  const media = (post.mediaUrls ?? []).slice(0, 3);
  const initials = (post.authorDisplayName ?? post.authorUsername)
    .slice(0, 2)
    .toUpperCase();

  return (
    <motion.li variants={listItem} className="h-full">
      <Card className="flex h-full flex-col p-5">
        <div className="flex items-center gap-3">
          {post.authorAvatarUrl && !avatarFailed ? (
            <img
              src={post.authorAvatarUrl}
              alt={post.authorDisplayName ?? post.authorUsername}
              loading="lazy"
              onError={() => setAvatarFailed(true)}
              className="h-10 w-10 shrink-0 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-foreground">
              {initials}
            </div>
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">
              {post.authorDisplayName ?? post.authorUsername}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              @{post.authorUsername} · {formatTimeAgo(post.crawledAt)}
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
          {media.length > 0 && (
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
                    onError={() =>
                      setFailedMedia((m) => ({ ...m, [i]: true }))
                    }
                    className="aspect-square rounded-lg object-cover"
                  />
                ),
              )}
            </div>
          )}
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Heart className="h-3.5 w-3.5" />
              {formatCount(post.likeCount)}
            </span>
            <span className="flex items-center gap-1">
              <MessageCircle className="h-3.5 w-3.5" />
              {formatCount(post.replyCount)}
            </span>
            <span className="flex items-center gap-1">
              <Repeat2 className="h-3.5 w-3.5" />
              {formatCount(post.repostCount)}
            </span>
          </div>
          <div className="flex items-center gap-3">
            {onApplyTemplate && (
              <button
                type="button"
                onClick={() => onApplyTemplate(post)}
                className="flex items-center gap-1.5 text-xs font-medium text-foreground/70 transition-colors hover:text-foreground"
              >
                <WandSparkles className="h-3.5 w-3.5" />
                Apply template
              </button>
            )}
            <a
              href={post.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-medium text-primary hover:underline"
            >
              View on Threads
            </a>
          </div>
        </div>
      </Card>
    </motion.li>
  );
}
