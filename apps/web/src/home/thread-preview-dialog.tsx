"use client";

import type { ThreadPost } from "@aff/types";
import {
  BadgeDollarSign,
  ExternalLink,
  Heart,
  MessageCircle,
  Repeat2,
  TrendingUp,
  WandSparkles,
} from "lucide-react";
import { useState } from "react";
import { proxiedImage } from "@/lib/image";
import { formatCount, formatTimeAgo } from "@/lib/utils";
import { Button } from "@/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/ui/dialog";
import { ThreadMediaCarousel } from "./thread-media-carousel";

/** Layar pertama Flow A: lihat thread utuh dulu, baru pilih template. */
export function ThreadPreviewDialog({
  post,
  onOpenChange,
  onSelectTemplate,
}: {
  post: ThreadPost | null;
  onOpenChange: (open: boolean) => void;
  onSelectTemplate: (post: ThreadPost) => void;
}) {
  const [avatarFailed, setAvatarFailed] = useState(false);
  const name = post?.authorDisplayName ?? post?.authorUsername ?? "";
  const avatar = proxiedImage(post?.authorAvatarUrl);

  return (
    <Dialog open={post != null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        {post && (
          <>
            <DialogHeader>
              <DialogTitle>Thread</DialogTitle>
              <DialogDescription>
                Tinjau dulu, lalu pilih template untuk membuat draft balasan.
              </DialogDescription>
            </DialogHeader>

            <div className="flex max-h-[60vh] flex-col gap-3 overflow-y-auto pr-1">
              <div className="flex items-center gap-3">
                {avatar && !avatarFailed ? (
                  <img
                    src={avatar}
                    alt={name}
                    loading="lazy"
                    onError={() => setAvatarFailed(true)}
                    className="h-12 w-12 shrink-0 rounded-full object-cover"
                  />
                ) : (
                  <div
                    aria-hidden
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-semibold text-secondary-foreground"
                  >
                    {name.slice(0, 2).toUpperCase()}
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
              </div>

              <p className="whitespace-pre-wrap text-sm leading-relaxed">
                {post.content}
              </p>

              <ThreadMediaCarousel urls={post.mediaUrls ?? []} />

              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
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
                {post.relevanceScore != null && (
                  <span className="inline-flex items-center gap-1">
                    <TrendingUp className="h-3.5 w-3.5" />
                    Relevance {post.relevanceScore}
                  </span>
                )}
                {post.affiliateScore != null && (
                  <span className="inline-flex items-center gap-1 font-semibold text-primary">
                    <BadgeDollarSign className="h-3.5 w-3.5" />
                    {post.affiliateScore}
                  </span>
                )}
              </div>
            </div>

            <DialogFooter className="flex-wrap items-center justify-between gap-3">
              <Button variant="outline" asChild>
                <a href={post.sourceUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink />
                  View on Threads
                </a>
              </Button>
              <div className="flex items-center gap-2">
                <Button variant="ghost" onClick={() => onOpenChange(false)}>
                  Tutup
                </Button>
                <Button onClick={() => onSelectTemplate(post)}>
                  <WandSparkles />
                  Select Template
                </Button>
              </div>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
