# Threads Crawler

Service crawling hasil pencarian Threads (FastAPI + Playwright).

## Menjalankan

```bash
cd apps/crawler
.venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8001
```

Test:

```bash
curl -s http://127.0.0.1:8001/health
curl -s -X POST http://127.0.0.1:8001/crawl \
  -H 'Content-Type: application/json' \
  -d '{"keyword":"gatal","limit":10}'
```

## Konfigurasi env

Konfigurasi dibaca dari environment `CRAWLER_*` dan file `.env` di folder ini
(sudah gitignored, jangan commit). Wajib diisi:

```env
CRAWLER_THREADS_USE_BROWSER=true
CRAWLER_THREADS_BROWSER_PROFILE=/home/infra/aff/runtime/threads-profile
CRAWLER_THREADS_BROWSER_LOCALE=id-ID
CRAWLER_THREADS_BROWSER_TIMEZONE=Asia/Jakarta
CRAWLER_THREADS_ACCEPT_LANGUAGE=id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7
```

`CRAWLER_THREADS_BROWSER_PROFILE` memakai **persistent Chromium profile** yang
sama di setiap fetch, sehingga sesi (termasuk login) tetap terpelihara.
Profile TIDAK pernah dihapus oleh crawler. Hanya satu proses crawler yang
boleh memakai profile ini secara bersamaan.

## Provisioning profile (manual, sekali saja)

1. Pastikan Chromium terpasang:

   ```bash
   .venv/bin/python -m playwright install chromium
   ```

2. Login manual ke Threads lewat profile tersebut. Jalankan sekali:

   ```bash
   .venv/bin/python -m playwright open \
     --persistent /home/infra/aff/runtime/threads-profile \
     --browser chromium \
     https://www.threads.com
   ```

   Login dengan akun sendiri di jendela yang terbuka, lalu tutup jendela.
   State sesi tersimpan di folder profile.

3. Pastikan permission:

   ```bash
   chmod 700 /home/infra/aff/runtime /home/infra/aff/runtime/threads-profile
   ```

> Jangan pernah menyalin cookie/token/storage-state ke repo atau `.env`.
> Satu-satunya tempat state sesi hidup adalah folder profile.

## Error code

`POST /crawl` mengembalikan `{"posts":[...]}`. Koneksi/struktur error Threads
diteruskan sebagai JSON error dengan `code`:

- `THREADS_LOGIN_REQUIRED` — harus login (provision profile).
- `THREADS_CHALLENGE` — halaman verifikasi/anti-bot; retry langsung tidak
  membantu, provision ulang profile login.
- `THREADS_REQUEST_FAILED` / `THREADS_RENDER_FAILED` — transient, spider
  otomatis retry dengan backoff.

## Tests

```bash
.venv/bin/python -m pytest tests/ -q
```
