import type { ReactElement, ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import rehypeSlug from "rehype-slug";
import remarkGfm from "remark-gfm";
import { resolveDocHref } from "@/lib/guide";
import { Mermaid } from "./mermaid";

interface CodeProps {
  className?: string;
  children?: ReactNode;
}

function isMermaid(node: ReactNode): node is ReactElement<CodeProps> {
  const element = node as ReactElement<CodeProps> | null;
  return Boolean(element?.props?.className?.includes("language-mermaid"));
}

export function Markdown({ source }: { source: string }) {
  return (
    <div className="prose-docs">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSlug]}
        components={{
          pre({ children }) {
            if (isMermaid(children)) return <Mermaid chart={String(children.props.children).trim()} />;
            return <pre>{children}</pre>;
          },
          a({ href = "", children }) {
            const resolved = resolveDocHref(href);
            const external = resolved.startsWith("http");
            return (
              <a href={resolved} {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
                {children}
              </a>
            );
          },
          table({ children }) {
            return (
              <div className="table-wrap">
                <table>{children}</table>
              </div>
            );
          },
        }}
      >
        {source}
      </ReactMarkdown>
    </div>
  );
}
