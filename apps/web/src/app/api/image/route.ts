import { NextRequest } from "next/server";

// CDN Instagram mengirim Cross-Origin-Resource-Policy: same-origin untuk foto
// profil, jadi browser menolak menampilkannya langsung dari halaman kita
// (ERR_BLOCKED_BY_RESPONSE.NotSameOrigin). Route ini meneruskan byte-nya apa
// adanya — tidak ada file yang ditulis ke disk, hanya di-stream lalu dibuang;
// cache sepenuhnya urusan browser lewat header di bawah.

const ALLOWED_HOST_SUFFIXES = [".cdninstagram.com", ".fbcdn.net"];
const CACHE_SECONDS = 3600;

function isAllowed(target: URL): boolean {
  if (target.protocol !== "https:") return false;
  return ALLOWED_HOST_SUFFIXES.some(
    (suffix) =>
      target.hostname === suffix.slice(1) || target.hostname.endsWith(suffix),
  );
}

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("url");
  if (!raw) {
    return new Response("missing url", { status: 400 });
  }

  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    return new Response("invalid url", { status: 400 });
  }
  // Allowlist host: tanpa ini route-nya jadi open proxy (SSRF ke jaringan lokal).
  if (!isAllowed(target)) {
    return new Response("host not allowed", { status: 403 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      headers: { Accept: "image/*" },
      cache: "no-store",
    });
  } catch {
    return new Response("upstream fetch failed", { status: 502 });
  }

  const contentType = upstream.headers.get("content-type") ?? "";
  if (!upstream.ok || !contentType.startsWith("image/")) {
    return new Response("not an image", { status: 502 });
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": `public, max-age=${CACHE_SECONDS}, immutable`,
      "Cross-Origin-Resource-Policy": "same-origin",
    },
  });
}
