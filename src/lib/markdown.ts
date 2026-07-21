// Lightweight markdown → HTML for chat assistant messages.
// Handles: code blocks, inline code, bold, italic, headers, lists, links.
// No external dependency — keeps the bundle lean.

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function markdownToHtml(md: string): string {
  const lines = md.split("\n");
  const out: string[] = [];
  let inCode = false;
  let codeLang = "";
  let codeLines: string[] = [];
  let inList: "ul" | "ol" | "" = "";

  function closeList() {
    if (inList) { out.push(inList === "ul" ? "</ul>" : "</ol>"); inList = ""; }
  }

  function inlineFormat(line: string): string {
    return line
      .replace(/`([^`]+)`/g, '<code class="md-inline-code">$1</code>')
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.+?)\*/g, "<em>$1</em>")
      .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer" class="md-link">$1</a>');
  }

  for (const rawLine of lines) {
    if (rawLine.startsWith("```")) {
      if (inCode) {
        out.push(
          `<div class="md-code-block"><div class="md-code-header">${escapeHtml(codeLang) || "code"}<button class="md-copy" data-code="${escapeHtml(codeLines.join("\n"))}">Copy</button></div><pre><code>${escapeHtml(codeLines.join("\n"))}</code></pre></div>`
        );
        codeLines = []; codeLang = ""; inCode = false;
      } else {
        closeList();
        codeLang = rawLine.slice(3).trim();
        inCode = true;
      }
      continue;
    }
    if (inCode) { codeLines.push(rawLine); continue; }

    const trimmed = rawLine.trim();
    if (!trimmed) { closeList(); out.push(""); continue; }

    // Headers
    const hMatch = trimmed.match(/^(#{1,3})\s+(.+)/);
    if (hMatch) {
      closeList();
      const level = hMatch[1].length;
      out.push(`<h${level + 2} class="md-h">${inlineFormat(escapeHtml(hMatch[2]))}</h${level + 2}>`);
      continue;
    }

    // Unordered list
    if (/^[-*]\s/.test(trimmed)) {
      if (inList !== "ul") { closeList(); out.push("<ul>"); inList = "ul"; }
      out.push(`<li>${inlineFormat(escapeHtml(trimmed.replace(/^[-*]\s+/, "")))}</li>`);
      continue;
    }

    // Ordered list
    if (/^\d+\.\s/.test(trimmed)) {
      if (inList !== "ol") { closeList(); out.push("<ol>"); inList = "ol"; }
      out.push(`<li>${inlineFormat(escapeHtml(trimmed.replace(/^\d+\.\s+/, "")))}</li>`);
      continue;
    }

    closeList();
    out.push(`<p>${inlineFormat(escapeHtml(trimmed))}</p>`);
  }

  if (inCode) {
    out.push(`<div class="md-code-block"><pre><code>${escapeHtml(codeLines.join("\n"))}</code></pre></div>`);
  }
  closeList();
  return out.join("\n");
}
