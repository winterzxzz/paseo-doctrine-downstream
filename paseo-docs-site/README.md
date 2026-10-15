# SLP Docs — site

Trang tĩnh trình bày [`docs/slp-guide.md`](../docs/slp-guide.md): cơ chế SLP (Supervisor · Lead ·
Peer) gồm vai trò, cơ chế, workflow, use case và anti-pattern, có sơ đồ Mermaid. Giao diện theo phong cách winterzxzz.tech (SN Pro, Patrick Hand,
nền trắng ấm, accent `#1f6fe5`).

## Nội dung nằm ở đâu

Site không có nội dung riêng. `lib/guide.ts` đọc `docs/slp-guide.md` lúc build và chia theo heading
`## `. Muốn sửa chữ hay sơ đồ, sửa file markdown đó rồi build lại. Đổi tên một heading `## ` thì sửa
luôn `PAGES` trong `lib/guide.ts`; build fail nếu không tìm thấy heading.

Link tương đối trong markdown được đổi thành link GitHub tới file trong `docs/`.

## Chạy

```bash
npm install
npm run dev        # http://localhost:3000
npm run typecheck
npm run build      # xuất HTML tĩnh ra ./out
```

Site là app độc lập, không thuộc npm workspace của repo, và được loại khỏi `oxfmt`/`oxlint` giống
`slp-blueprint-site`. Kiểm tra bằng `npm run typecheck` và `npm run build`.

Sơ đồ render ở trình duyệt. Sơ đồ lỗi cú pháp hiện khung báo lỗi thay vì biến mất. Trong
`sequenceDiagram`, không dùng `;` trong text vì Mermaid coi nó là dấu kết thúc lệnh.

## Deploy

Site chạy trên Vercel, project `paseo-docs`: https://paseo-docs.vercel.app. Vercel không tự build được vì
site đọc `../docs/slp-guide.md`, nằm ngoài thư mục này. Build ở máy rồi deploy thư mục `out` đã build:

```bash
npm run build
rm -rf /tmp/vercel-paseo-docs && mkdir -p /tmp/vercel-paseo-docs
cp -R out /tmp/vercel-paseo-docs/paseo-docs
cd /tmp/vercel-paseo-docs/paseo-docs && vercel deploy --prod --yes
```

Tên thư mục `paseo-docs` quyết định project Vercel được deploy vào.
