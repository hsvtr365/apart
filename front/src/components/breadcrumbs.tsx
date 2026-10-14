import Link from "next/link";
import { pageBreadcrumbs } from "@/lib/seo";
import type { Post } from "@/lib/types";

export function Breadcrumbs({ path, post }: { path: string; post?: Post }) {
  const items = pageBreadcrumbs(path, post);
  return (
    <nav aria-label="현재 위치" className="py-3 text-sm text-muted">
      <ol className="flex flex-wrap items-center gap-2">
        {items.map((item, i) => (
          <li key={item.path} className="min-w-0">
            {i > 0 && (
              <span aria-hidden="true" className="mr-2">
                ›
              </span>
            )}
            {i === items.length - 1 ? (
              <span aria-current="page">{item.name}</span>
            ) : (
              <Link className="underline" href={item.path}>
                {item.name}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
