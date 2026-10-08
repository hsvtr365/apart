import type { SVGProps } from "react";
export function Icon({
  name,
  ...props
}: SVGProps<SVGSVGElement> & { name: string }) {
  const paths: Record<string, React.ReactNode> = {
    home: <path d="m3 10 9-7 9 7v11h-6v-7H9v7H3Z" />,
    map: <path d="m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2Z M9 3v16M15 5v16" />,
    plus: <path d="M12 4v16M4 12h16" />,
    feed: (
      <>
        <rect x="4" y="3" width="16" height="18" rx="2" />
        <path d="M8 8h8M8 12h8M8 16h5" />
      </>
    ),
    user: (
      <>
        <circle cx="12" cy="7" r="4" />
        <path d="M4 22v-3a8 8 0 0 1 16 0v3" />
      </>
    ),
    heart: <path d="M12 21 3 12C-2 5 7-1 12 6 17-1 26 5 21 12Z" />,
    comment: <path d="M4 4h16v12H9l-5 4Z" />,
    pin: (
      <>
        <path d="M12 22S4 14 4 9a8 8 0 0 1 16 0c0 5-8 13-8 13Z" />
        <circle cx="12" cy="9" r="3" />
      </>
    ),
    close: <path d="m6 6 12 12M6 18 18 6" />,
    check: <path d="m5 12 4 4L19 6" />,
    back: <path d="m14 5-7 7 7 7M7 12h14" />,
  };
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      aria-hidden="true"
      {...props}
    >
      {paths[name] ?? paths.feed}
    </svg>
  );
}
