"use client";

import { useRef, useState } from "react";

export function ThreadMediaCarousel({
  urls,
  alt = "",
}: {
  urls: string[];
  alt?: string;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const [active, setActive] = useState(0);
  const [failed, setFailed] = useState<Record<number, boolean>>({});

  if (urls.length === 0) return null;

  const onScroll = () => {
    const el = trackRef.current;
    if (!el || rafRef.current != null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      if (!el.clientWidth) return;
      const index = Math.round(el.scrollLeft / el.clientWidth);
      setActive(Math.min(Math.max(index, 0), urls.length - 1));
    });
  };

  const goTo = (index: number) => {
    const el = trackRef.current;
    if (!el) return;
    el.scrollTo({ left: index * el.clientWidth, behavior: "smooth" });
  };

  const slide = (url: string, i: number) =>
    failed[i] ? (
      <div
        key={url}
        className="flex aspect-[4/3] w-full flex-none snap-center items-center justify-center rounded-xl bg-accent/50 text-xs text-muted-foreground"
      >
        No image
      </div>
    ) : (
      <img
        key={url}
        src={url}
        alt={alt}
        loading="lazy"
        onError={() => setFailed((m) => ({ ...m, [i]: true }))}
        className="aspect-[4/3] w-full flex-none snap-center rounded-xl object-cover"
      />
    );

  if (urls.length === 1) {
    return <div className="mt-3">{slide(urls[0], 0)}</div>;
  }

  return (
    <div className="relative mt-3">
      <div
        ref={trackRef}
        onScroll={onScroll}
        className="flex snap-x snap-mandatory overflow-x-auto rounded-xl [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {urls.map(slide)}
      </div>
      <div className="pointer-events-none absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1">
        {urls.map((url, i) => (
          <button
            key={url}
            type="button"
            aria-label={`Foto ${i + 1} dari ${urls.length}`}
            aria-current={i === active}
            onClick={(e) => {
              e.stopPropagation();
              goTo(i);
            }}
            className={`pointer-events-auto h-1.5 rounded-full transition-all ${
              i === active ? "w-4 bg-white" : "w-1.5 bg-white/50"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
