# Paseo Docs — site

Trang tĩnh trình bày [`docs/overview.md`](../docs/overview.md): bản đồ thành phần, use case và các
workflow chính, có sơ đồ Mermaid. Giao diện theo phong cách winterzxzz.tech (SN Pro, Patrick Hand,
nền trắng ấm, accent `#1f6fe5`).

## Nội dung nằm ở đâu

Site không có nội dung riêng. `lib/overview.ts` đọc `docs/overview.md` lúc build và chia theo heading
`## `. Muốn sửa chữ hay sơ đồ, sửa file markdown đó rồi build lại. Đổi tên một heading `## ` thì sửa
luôn `PAGES` trong `lib/overview.ts`; build fail nếu không tìm thấy heading.

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

`next.config.mjs` đọc `NEXT_PUBLIC_BASE_PATH` giống `slp-blueprint-site`. Repo này chỉ có một GitHub
Pages site và workflow `slp-site-pages.yml` đang dùng nó, nên chưa có workflow deploy cho site này.
