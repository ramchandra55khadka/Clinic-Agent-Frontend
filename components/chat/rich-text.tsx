import type { ReactNode } from "react";

/**
 * Lightweight formatter for assistant answers (Markdown-ish).
 * Supports **bold**, `code`, headings, bullet and numbered lists — without
 * `dangerouslySetInnerHTML`, so model output can never inject markup.
 */

const INLINE_PATTERN = /(\*\*[^*\n]+\*\*|`[^`\n]+`)/g;

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let index = 0;
  let match: RegExpExecArray | null;

  INLINE_PATTERN.lastIndex = 0;
  while ((match = INLINE_PATTERN.exec(text)) !== null) {
    if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index));
    const token = match[0];
    if (token.startsWith("**")) {
      nodes.push(<strong key={`${keyPrefix}-b${index}`}>{token.slice(2, -2)}</strong>);
    } else {
      nodes.push(
        <code key={`${keyPrefix}-c${index}`} className="rich-code">
          {token.slice(1, -1)}
        </code>,
      );
    }
    lastIndex = match.index + token.length;
    index += 1;
  }

  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
}

type Block =
  | { kind: "p"; lines: string[] }
  | { kind: "ul"; items: string[] }
  | { kind: "ol"; items: string[] }
  | { kind: "h"; text: string };

function parseBlocks(text: string): Block[] {
  const blocks: Block[] = [];
  let paragraph: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length > 0) {
      blocks.push({ kind: "p", lines: paragraph });
      paragraph = [];
    }
  };

  for (const rawLine of text.replace(/\r\n/g, "\n").split("\n")) {
    const line = rawLine.trim();
    if (!line) {
      flushParagraph();
      continue;
    }

    const previous = blocks[blocks.length - 1];

    if (/^[-*•]\s+/.test(line) && previous?.kind === "ul") {
      previous.items.push(line.replace(/^[-*•]\s+/, ""));
      continue;
    }
    if (/^\d+[.)]\s+/.test(line) && previous?.kind === "ol") {
      previous.items.push(line.replace(/^\d+[.)]\s+/, ""));
      continue;
    }
    if (/^[-*•]\s+/.test(line)) {
      flushParagraph();
      blocks.push({ kind: "ul", items: [line.replace(/^[-*•]\s+/, "")] });
      continue;
    }
    if (/^\d+[.)]\s+/.test(line)) {
      flushParagraph();
      blocks.push({ kind: "ol", items: [line.replace(/^\d+[.)]\s+/, "")] });
      continue;
    }
    if (/^#{1,6}\s+/.test(line)) {
      flushParagraph();
      blocks.push({ kind: "h", text: line.replace(/^#{1,6}\s+/, "") });
      continue;
    }

    paragraph.push(line);
  }

  flushParagraph();
  return blocks;
}

export function RichText({ text }: { text: string }) {
  const blocks = parseBlocks(text);

  return (
    <div className="space-y-2 text-sm leading-relaxed">
      {blocks.map((block, blockIndex) => {
        const key = `blk-${blockIndex}`;

        if (block.kind === "h") {
          return (
            <p key={key} className="font-semibold">
              {renderInline(block.text, key)}
            </p>
          );
        }

        if (block.kind === "ul") {
          return (
            <ul key={key} className="space-y-1 pl-4">
              {block.items.map((item, itemIndex) => (
                <li key={`${key}-${itemIndex}`} className="list-disc marker:text-muted">
                  {renderInline(item, `${key}-${itemIndex}`)}
                </li>
              ))}
            </ul>
          );
        }

        if (block.kind === "ol") {
          return (
            <ol key={key} className="space-y-1 pl-4">
              {block.items.map((item, itemIndex) => (
                <li key={`${key}-${itemIndex}`} className="list-decimal marker:text-muted">
                  {renderInline(item, `${key}-${itemIndex}`)}
                </li>
              ))}
            </ol>
          );
        }

        return (
          <p key={key}>
            {block.lines.map((line, lineIndex) => (
              <span key={`${key}-${lineIndex}`}>
                {lineIndex > 0 && <br />}
                {renderInline(line, `${key}-${lineIndex}`)}
              </span>
            ))}
          </p>
        );
      })}
    </div>
  );
}
