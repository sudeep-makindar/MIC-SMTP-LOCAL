import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function base(children: React.ReactNode, { size = 16, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {children}
    </svg>
  );
}

export const IconDashboard = (p: IconProps) =>
  base(
    <>
      <rect x="3.5" y="3.5" width="7.5" height="7.5" rx="1.2" />
      <rect x="13" y="3.5" width="7.5" height="4.5" rx="1.2" />
      <rect x="13" y="10.2" width="7.5" height="10.3" rx="1.2" />
      <rect x="3.5" y="13.2" width="7.5" height="7.3" rx="1.2" />
    </>,
    p
  );

export const IconTemplates = (p: IconProps) =>
  base(
    <>
      <rect x="4" y="3.5" width="16" height="17" rx="1.5" />
      <path d="M8 8.5h8M8 12.5h8M8 16.5h5" />
    </>,
    p
  );

export const IconLogs = (p: IconProps) =>
  base(
    <>
      <path d="M6 3.5h9l4 4v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-16a1 1 0 0 1 1-1Z" />
      <path d="M15 3.5v4h4" />
      <path d="M8.5 12.5h7M8.5 15.8h7M8.5 9.2h3" />
    </>,
    p
  );

export const IconSettings = (p: IconProps) =>
  base(
    <>
      <circle cx="12" cy="12" r="3.1" />
      <path d="M12 3.5v2.1M12 18.4v2.1M20.5 12h-2.1M5.6 12H3.5M17.7 6.3l-1.5 1.5M7.8 16.2l-1.5 1.5M17.7 17.7l-1.5-1.5M7.8 7.8 6.3 6.3" />
    </>,
    p
  );

export const IconTrash = (p: IconProps) =>
  base(
    <>
      <path d="M4.5 6.5h15" />
      <path d="M9 6.5V4.8a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1.7" />
      <path d="M6.5 6.5 7.3 19a1.5 1.5 0 0 0 1.5 1.4h6.4A1.5 1.5 0 0 0 16.7 19l.8-12.5" />
      <path d="M10 10.5v6M14 10.5v6" />
    </>,
    p
  );

export const IconShuffle = (p: IconProps) =>
  base(
    <>
      <path d="M3.5 6.5h3.2l8.3 11h4.5" />
      <path d="M17.3 4.7 20 6.5l-2.7 1.8" />
      <path d="M3.5 17.5h3.2l2.8-3.7" />
      <path d="M13.4 9.7 15 7.5" />
      <path d="M17.3 20.3 20 18.5l-2.7-1.8" />
    </>,
    p
  );

export const IconClip = (p: IconProps) =>
  base(<path d="M8 12.5V7a4 4 0 0 1 8 0v9a2.6 2.6 0 0 1-5.2 0V8.3a1.2 1.2 0 0 1 2.4 0V15" />, p);

export const IconPlus = (p: IconProps) => base(<path d="M12 4.5v15M4.5 12h15" />, p);

export const IconClose = (p: IconProps) => base(<path d="M6 6l12 12M18 6 6 18" />, p);

export const IconCheck = (p: IconProps) => base(<path d="M4.5 12.5l5 5 10-11" />, p);

export const IconArrowRight = (p: IconProps) => base(<path d="M4.5 12h14.5M13 6l6 6-6 6" />, p);

export const IconArrowLeft = (p: IconProps) => base(<path d="M19.5 12H5M11 6l-6 6 6 6" />, p);

export const IconSearch = (p: IconProps) =>
  base(
    <>
      <circle cx="10.6" cy="10.6" r="6.6" />
      <path d="M19.5 19.5 15.4 15.4" />
    </>,
    p
  );

export const IconFolder = (p: IconProps) =>
  base(<path d="M4 6.5a1 1 0 0 1 1-1h4.4l1.8 2h7.8a1 1 0 0 1 1 1V18a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6.5Z" />, p);

export const IconEmpty = (p: IconProps) =>
  base(
    <>
      <path d="M4 9.5 12 4l8 5.5V19a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V9.5Z" />
      <path d="M4 10l6.5 4a3 3 0 0 0 3 0L20 10" />
    </>,
    p
  );

export const IconMark = (p: IconProps) =>
  base(
    <>
      <path d="M4 12 19 5l-4.4 15-4-6.4L4 12Z" />
      <path d="M14.6 13.6 19 5" />
    </>,
    p
  );
