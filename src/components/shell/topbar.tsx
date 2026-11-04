import Link from "next/link";
import { TopActions } from "./top-actions";

export type Crumb = { label: string; href?: string };

export function Topbar({ trail }: { trail: Crumb[] }) {
  const title = trail[trail.length - 1]?.label;
  return (
    <header data-shell className="sticky top-0 z-20 flex h-14 items-center justify-between gap-4 border-b border-line bg-page/95 px-8 backdrop-blur-[2px]">
      <div className="min-w-0">
        {trail.length > 1 && (
          <nav aria-label="breadcrumb" className="flex items-center gap-1.5 text-[12px] leading-tight text-ink-3">
            {trail.slice(0, -1).map((c, i) => (
              <span key={i} className="flex items-center gap-1.5">
                {i > 0 && <span>/</span>}
                {c.href ? (
                  <Link href={c.href} className="transition-colors duration-150 hover:text-ink">
                    {c.label}
                  </Link>
                ) : (
                  <span>{c.label}</span>
                )}
              </span>
            ))}
          </nav>
        )}
        <p className="truncate text-[15px] font-medium leading-tight">{title}</p>
      </div>
      <TopActions />
    </header>
  );
}

/** Standard page frame. `wide` removes the max width and padding for full-bleed viewers. */
export function Page({ trail, children, wide }: { trail: Crumb[]; children: React.ReactNode; wide?: boolean }) {
  return (
    <>
      <Topbar trail={trail} />
      <main className={wide ? "px-4 py-4" : "mx-auto max-w-[1560px] px-8 py-8"}>{children}</main>
    </>
  );
}
