"use client";

import Link from "next/link";
import { Fragment, useMemo, type ReactNode } from "react";
import { cx } from "@/components/ui";
import { parseMarkdown, type Block, type Inline } from "@/lib/ai/tools/markdown";

const linkCls = "text-accent-text underline decoration-[color:var(--line-strong)] underline-offset-2 transition-colors duration-150 hover:decoration-current";

function Inl({ nodes, onNavigate }: { nodes: Inline[]; onNavigate?: () => void }) {
  return (
    <>
      {nodes.map((n, i) => {
        switch (n.t) {
          case "text":
            return <Fragment key={i}>{n.v}</Fragment>;
          case "br":
            return <br key={i} />;
          case "code":
            return (
              <code key={i} className="rounded-[4px] bg-raised px-1 font-mono text-[12px]">
                {n.v}
              </code>
            );
          case "b":
            return (
              <strong key={i} className="font-medium">
                <Inl nodes={n.c} onNavigate={onNavigate} />
              </strong>
            );
          case "i":
            return (
              <em key={i}>
                <Inl nodes={n.c} onNavigate={onNavigate} />
              </em>
            );
          case "link":
            return n.internal ? (
              <Link key={i} href={n.href} onClick={onNavigate} className={linkCls}>
                <Inl nodes={n.c} />
              </Link>
            ) : (
              <a key={i} href={n.href} target="_blank" rel="noreferrer noopener" className={linkCls}>
                <Inl nodes={n.c} />
              </a>
            );
        }
      })}
    </>
  );
}

function BlockView({ b, onNavigate }: { b: Block; onNavigate?: () => void }): ReactNode {
  switch (b.t) {
    case "h":
      return (
        <p className={cx("font-medium", b.level <= 2 ? "text-[15px]" : "text-[14px]")}>
          <Inl nodes={b.c} onNavigate={onNavigate} />
        </p>
      );
    case "p":
      return (
        <p>
          <Inl nodes={b.c} onNavigate={onNavigate} />
        </p>
      );
    case "ul":
    case "ol":
      return (
        <ul className="flex flex-col gap-1">
          {b.items.map((it, i) => (
            <li key={i} className="flex gap-2" style={{ paddingLeft: it.depth * 16 }}>
              <span className={cx("shrink-0 text-ink-3", it.num !== undefined && "num min-w-4 text-right")}>{it.num !== undefined ? `${it.num}.` : "–"}</span>
              <span className="min-w-0">
                <Inl nodes={it.c} onNavigate={onNavigate} />
              </span>
            </li>
          ))}
        </ul>
      );
    case "table":
      return (
        <div className="-mx-1 overflow-x-auto">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr>
                {b.head.map((h, i) => (
                  <th key={i} className={cx("border-b border-line-strong px-2 py-1.5 font-medium text-ink-2", b.align[i] === "right" ? "text-right" : b.align[i] === "center" ? "text-center" : "text-left")}>
                    <Inl nodes={h} onNavigate={onNavigate} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {b.rows.map((r, i) => (
                <tr key={i}>
                  {r.map((c, k) => (
                    <td key={k} className={cx("border-b border-line px-2 py-1.5 align-top", b.align[k] === "right" ? "num text-right" : b.align[k] === "center" ? "text-center" : "")}>
                      <Inl nodes={c} onNavigate={onNavigate} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case "code":
      return <pre className="overflow-x-auto rounded-[8px] bg-raised px-3 py-2 font-mono text-[12px]">{b.v}</pre>;
    case "hr":
      return <hr className="border-line" />;
  }
}

/** Assistant answer rendered from markdown. Internal links use Next <Link>. */
export function Markdown({ text, onNavigate }: { text: string; onNavigate?: () => void }) {
  const blocks = useMemo(() => parseMarkdown(text), [text]);
  return (
    <div className="flex flex-col gap-2.5 break-words text-[14px] leading-relaxed text-ink">
      {blocks.map((b, i) => (
        <BlockView key={i} b={b} onNavigate={onNavigate} />
      ))}
    </div>
  );
}
