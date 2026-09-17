import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Callout, PageTitle, Section } from "@/components/ui";

export const metadata = {
  title: "Transcript nguồn — SLP Blueprint",
  // Bản chép lại tác phẩm của người khác: không để search engine index bản sao này.
  robots: { index: false, follow: false },
};

function readTranscript(): string {
  return readFileSync(join(process.cwd(), "SOURCE_TRANSCRIPT.md"), "utf8");
}

export default function Page() {
  const transcript = readTranscript();

  return (
    <>
      <PageTitle
        kicker="15 slide, nguyên văn"
        title="Transcript nguồn"
        lead="Bản chép trung thực toàn bộ tài liệu gốc. Mọi diễn giải trên trang này đều truy về đây."
      />

      <Callout tone="note" title="Ghi nguồn">
        <p>
          Tài liệu gốc — <em>SLP Multi-Agent Blueprint</em>, 15 slide — là{" "}
          <strong>tác phẩm của người khác</strong>, không phải của trang này. Slide mang watermark
          &ldquo;Gemini Notebook&rdquo;. Bản chúng tôi nhận được không kèm tên tác giả, ngày phát
          hành, hay điều khoản sử dụng; nếu bạn là tác giả hoặc biết tác giả, xin liên hệ để chúng
          tôi ghi nhận đúng hoặc gỡ xuống.
        </p>
        <p>
          Phần dưới là <strong>bản chép chữ</strong> do trang này thực hiện để phục vụ việc phân
          tích và phê bình — không đăng lại file gốc, không đăng lại hình ảnh slide. Trang này đặt{" "}
          <code className="rounded bg-ink/60 px-1 py-0.5">noindex</code> để bản chép không bị công cụ
          tìm kiếm lập chỉ mục thay cho bản gốc.
        </p>
      </Callout>

      <Callout tone="warn" title="Trọng lượng của nguồn này">
        <p>
          Tài liệu gốc là PDF 15 trang, <strong>toàn ảnh raster 1376×768, không có text layer</strong>,
          watermark &ldquo;Gemini Notebook&rdquo;. Transcript dưới đây được chép lại từ ảnh render.
        </p>
        <p>
          Mọi con số trong đây là <strong>claim của tác giả slide</strong>, không có evidence tái lập,
          không có triển khai tham chiếu, không có số đo. Ba con số hay bị nghi chép nhầm —{" "}
          <code className="rounded bg-ink/60 px-1 py-0.5">vài chục k params</code>,{" "}
          <code className="rounded bg-ink/60 px-1 py-0.5">~40 dòng</code>,{" "}
          <code className="rounded bg-ink/60 px-1 py-0.5">25%</code> — đã được đối chiếu lại trực
          tiếp với ảnh gốc ở mức pixel và khớp nguyên văn.
        </p>
      </Callout>

      <Section title="Nguyên văn">
        <pre className="overflow-x-auto whitespace-pre-wrap rounded-lg border border-line bg-panel p-5 font-mono text-xs leading-relaxed text-body">
          {transcript}
        </pre>
      </Section>
    </>
  );
}
