export const APP_NAMES = {
  web: "web",
  api: "api",
  crawler: "crawler",
} as const;

export const PORTS = {
  web: 3000,
  api: 3001,
  crawler: 8001,
} as const;

export const QUEUES = {
  crawl: "crawl",
  process: "process",
  affiliate: "affiliate",
} as const;
