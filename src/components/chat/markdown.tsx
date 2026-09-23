import type { ReactNode } from "react";

export function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
  const nodes: ReactNode[] = [];
  parts.forEach((part, i) => {
    if (!part) return;
    if (part.startsWith("**") && part.endsWith("**")) {
      nodes.push(<strong key={`${keyPrefix}-b${i}`}>{part.slice(2, -2)}</strong>);
    } else if (part.startsWith("*") && part.endsWith("*")) {
      nodes.push(<strong key={`${keyPrefix}-b${i}`}>{part.slice(1, -1)}</strong>);
    } else {
      nodes.push(<span key={`${keyPrefix}-s${i}`}>{part}</span>);
    }
  });
  return nodes;
}

type Block =
  | { type: "p"; key: string; content: ReactNode }
  | {
      type: "ul";
      key: string;
      items: { key: string; content: ReactNode }[];
    }
  | { type: "h"; key: string; level: number; content: ReactNode };

export function renderMarkdown(text: string, cursor?: ReactNode): ReactNode {
  const lines = text.split(/\r?\n/);
  const blocks: Block[] = [];
  let listBuffer: { text: string; index: number }[] = [];
  let paraBuffer: string[] = [];
  let blockId = 0;

  function flushList() {
    if (listBuffer.length) {
      blocks.push({
        type: "ul",
        key: `ul-${blockId++}`,
        items: listBuffer.map((item) => ({
          key: `li-${item.index}`,
          content: renderInline(item.text, `li-${item.index}`),
        })),
      });
      listBuffer = [];
    }
  }

  function flushPara() {
    if (paraBuffer.length) {
      const inline = paraBuffer.flatMap((line, j) =>
        j
          ? [<span key={`br-${j}`} />, ...renderInline(line, `p-in-${j}`)]
          : renderInline(line, `p-in-${j}`),
      );
      blocks.push({ type: "p", key: `p-${blockId++}`, content: inline });
      paraBuffer = [];
    }
  }

  lines.forEach((line, index) => {
    if (line.trim() === "") {
      flushList();
      flushPara();
      return;
    }
    const bullet = line.match(/^\s*([*-])\s+(.*)$/);
    if (bullet) {
      flushPara();
      listBuffer.push({ text: bullet[2] ?? "", index });
      return;
    }
    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      flushList();
      flushPara();
      blocks.push({
        type: "h",
        key: `h-${blockId++}`,
        level: heading[1]!.length,
        content: renderInline(heading[2] ?? "", `h-in-${blockId}`),
      });
      return;
    }
    flushList();
    paraBuffer.push(line);
  });
  flushList();
  flushPara();

  const last = blocks.length - 1;
  return (
    <>
      {blocks.map((block, i) => {
        const appendCursor = !!cursor && i === last;
        if (block.type === "ul") {
          return (
            <ul
              key={block.key}
              className="my-1.5 list-disc space-y-1 pl-5 marker:text-muted-foreground"
            >
              {block.items.map((item, j) => (
                <li key={item.key}>
                  {item.content}
                  {appendCursor && j === block.items.length - 1 ? cursor : null}
                </li>
              ))}
            </ul>
          );
        }
        if (block.type === "h") {
          const Tag = (block.level <= 3 ? "h3" : "h4") as "h3" | "h4";
          return (
            <Tag key={block.key} className="my-2 text-sm font-semibold text-foreground">
              {block.content}
              {appendCursor ? cursor : null}
            </Tag>
          );
        }
        return (
          <p key={block.key} className="my-1.5">
            {block.content}
            {appendCursor ? cursor : null}
          </p>
        );
      })}
    </>
  );
}
