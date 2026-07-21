import { useRef, useCallback } from "react";
import { markdownToHtml } from "../../lib/markdown";
import { toast } from "../../lib/ui";

export function MarkdownContent({ text }: { text: string }) {
  const ref = useRef<HTMLDivElement>(null);

  const handleClick = useCallback((e: React.MouseEvent) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>(".md-copy");
    if (!btn) return;
    const code = btn.dataset.code ?? "";
    navigator.clipboard.writeText(code).then(
      () => toast("Copied", "success", 1500),
      () => toast("Couldn't copy", "error"),
    );
  }, []);

  return (
    <div
      ref={ref}
      className="md-content"
      onClick={handleClick}
      dangerouslySetInnerHTML={{ __html: markdownToHtml(text) }}
    />
  );
}
