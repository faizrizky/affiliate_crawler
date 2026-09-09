import { NextRequest } from "next/server";

const TARGET = process.env.API_PROXY_TARGET ?? "http://localhost:3001";

async function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname.replace(/^\/api/, "") || "/";
  const headers: Record<string, string> = {};
  const contentType = req.headers.get("content-type");
  const authorization = req.headers.get("authorization");
  if (contentType) headers["Content-Type"] = contentType;
  if (authorization) headers.Authorization = authorization;

  const upstream = await fetch(`${TARGET}${path}${req.nextUrl.search}`, {
    method: req.method,
    headers,
    body:
      req.method === "GET" || req.method === "HEAD"
        ? undefined
        : await req.arrayBuffer(),
    cache: "no-store",
  });

  const body =
    upstream.status === 204 ? null : await upstream.arrayBuffer();
  return new Response(body, {
    status: upstream.status,
    headers: {
      "Content-Type":
        upstream.headers.get("content-type") ?? "application/json",
    },
  });
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const DELETE = proxy;
