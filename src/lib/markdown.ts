const escapeHtml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

const inlineMarkdown = (value: string) => {
  let html = escapeHtml(value);
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>');
  html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');
  return html;
};

const renderLinesWithBreaks = (lines: string[]) => lines.map((line) => inlineMarkdown(line)).join('<br />');

const renderList = (lines: string[], ordered: boolean) => {
  const tag = ordered ? 'ol' : 'ul';
  const pattern = ordered ? /^\d+\.\s+/ : /^[-*]\s+/;
  const items = lines.map((line) => `<li>${inlineMarkdown(line.replace(pattern, ''))}</li>`).join('');
  return `<${tag}>${items}</${tag}>`;
};

export const renderMarkdown = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) {
    return '<p class="markdown-empty">No notes yet.</p>';
  }

  const blocks = trimmed.split(/\n{2,}/).map((block) => block.trim()).filter(Boolean);

  return blocks.map((block) => {
    const lines = block.split('\n');

    if (lines.every((line) => /^[-*]\s+/.test(line))) {
      return renderList(lines, false);
    }

    if (lines.every((line) => /^\d+\.\s+/.test(line))) {
      return renderList(lines, true);
    }

    if (lines.every((line) => /^>\s?/.test(line))) {
      const quote = lines.map((line) => line.replace(/^>\s?/, '')).join('\n');
      return `<blockquote>${renderLinesWithBreaks(quote.split('\n'))}</blockquote>`;
    }

    if (/^#{1,6}\s+/.test(lines[0])) {
      const match = lines[0].match(/^(#{1,6})\s+(.*)$/);
      if (match) {
        const level = match[1].length;
        const rest = lines.slice(1);
        const heading = `<h${level}>${inlineMarkdown(match[2])}</h${level}>`;
        if (rest.length === 0) return heading;
        return `${heading}<p>${renderLinesWithBreaks(rest)}</p>`;
      }
    }

    return `<p>${renderLinesWithBreaks(lines)}</p>`;
  }).join('');
};
