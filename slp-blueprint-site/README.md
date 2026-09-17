# SLP Blueprint — site

Trang tĩnh giải thích tài liệu *SLP Multi-Agent Blueprint* (Supervisor · Lead · Peer), kèm 12 ví dụ
thực chiến và kết quả một phiên thẩm định ba lane mù.

Nguồn nội dung: [`SOURCE_TRANSCRIPT.md`](./SOURCE_TRANSCRIPT.md) — bản chép trung thực 15 slide của
tài liệu gốc. File đó là nguồn bất biến; mọi diễn giải trên site đều truy về nó.

## Chạy

```bash
npm install
npm run dev        # http://localhost:3000
npm run typecheck
npm run build      # xuất HTML tĩnh ra ./out
```

## Stack

| | |
|---|---|
| Next.js | 15.5.25 (App Router, `output: "export"`) |
| React | 19 |
| Tailwind CSS | 4 (qua `@tailwindcss/postcss`) |
| TypeScript | 5.9 |

Build ra `out/` — HTML tĩnh thuần, không cần Node runtime khi serve.

## Deploy lên GitHub Pages

GitHub Pages phục vụ *project site* dưới đường dẫn `https://<user>.github.io/<repo>/`, nên Next.js
phải biết tiền tố đó. Tiền tố được đọc từ biến môi trường `NEXT_PUBLIC_BASE_PATH`:

```bash
# build cho project site tại https://<user>.github.io/<repo>/
NEXT_PUBLIC_BASE_PATH=/<repo> npm run build
```

Bỏ trống biến này khi chạy local hoặc khi deploy lên *user site* / domain riêng (phục vụ ở gốc `/`).

Workflow CI có sẵn ở `.github/workflows/slp-site-pages.yml` (thư mục gốc của repo) tự đặt biến này
theo tên repo. `public/.nojekyll` có sẵn để GitHub Pages không bỏ qua thư mục `_next`.

## Cấu trúc

```
app/               # route tĩnh, mỗi thư mục một trang
components/        # UI dùng chung (nav, callout, bảng, badge)
content/           # dữ liệu nội dung (12 ví dụ, bảng ánh xạ)
SOURCE_TRANSCRIPT.md
```
