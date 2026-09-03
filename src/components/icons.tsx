import type { ReactNode, SVGProps } from "react";

const I = ({ children, ...props }: SVGProps<SVGSVGElement> & { children: ReactNode }) => (
  <svg
    viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
    width="1em" height="1em" {...props}
  >
    {children}
  </svg>
);

export const LogoMark = ({ size = 28 }: { size?: number }) => (
  <svg viewBox="0 0 32 32" width={size} height={size} aria-hidden="true">
    <rect width="32" height="32" rx="7" fill="#122921" />
    <path d="M10 8h8.5a4 4 0 0 1 0 8H10zm0 8h10a4 4 0 0 1 0 8H10z" fill="none" stroke="#E8B25C" strokeWidth="2.4" />
  </svg>
);

export const IconGrid = (p: SVGProps<SVGSVGElement>) => <I {...p}><rect x="3" y="3" width="7.5" height="7.5" rx="1.5" /><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5" /><rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5" /><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5" /></I>;
export const IconWallet = (p: SVGProps<SVGSVGElement>) => <I {...p}><path d="M3 7.5A2.5 2.5 0 0 1 5.5 5h11A2.5 2.5 0 0 1 19 7.5V9" /><path d="M3 7.5V17a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2H5a2 2 0 0 1-2-1.5z" /><circle cx="16.5" cy="14" r="1.1" fill="currentColor" stroke="none" /></I>;
export const IconFund = (p: SVGProps<SVGSVGElement>) => <I {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7.5v9M8.5 13l3.5 3.5L15.5 13" /></I>;
export const IconSend = (p: SVGProps<SVGSVGElement>) => <I {...p}><path d="M4.5 12 3 4.5l17.5 7.5L3 19.5 4.5 12zm0 0h7" /></I>;
export const IconId = (p: SVGProps<SVGSVGElement>) => <I {...p}><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="8.5" cy="11" r="2" /><path d="M5.5 16c.6-1.6 1.7-2.4 3-2.4s2.4.8 3 2.4M14 9.5h5M14 13h5" /></I>;
export const IconBank = (p: SVGProps<SVGSVGElement>) => <I {...p}><path d="M3 9.5 12 4l9 5.5M4.5 10v8M9.5 10v8M14.5 10v8M19.5 10v8M3 20h18M3 18h18" /></I>;
export const IconBell = (p: SVGProps<SVGSVGElement>) => <I {...p}><path d="M18 9a6 6 0 1 0-12 0c0 5-2 6-2 6h16s-2-1-2-6" /><path d="M10 18.5a2.2 2.2 0 0 0 4 0" /></I>;
export const IconGear = (p: SVGProps<SVGSVGElement>) => <I {...p}><circle cx="12" cy="12" r="3.2" /><path d="M19 12a7 7 0 0 0-.15-1.4l2-1.55-2-3.46-2.35.95a7 7 0 0 0-2.42-1.4L13.7 2.6h-3.4l-.38 2.54a7 7 0 0 0-2.42 1.4l-2.35-.95-2 3.46 2 1.55a7 7 0 0 0 0 2.8l-2 1.55 2 3.46 2.35-.95a7 7 0 0 0 2.42 1.4l.38 2.54h3.4l.38-2.54a7 7 0 0 0 2.42-1.4l2.35.95 2-3.46-2-1.55c.1-.45.15-.92.15-1.4z" /></I>;
export const IconUser = (p: SVGProps<SVGSVGElement>) => <I {...p}><circle cx="12" cy="8" r="3.6" /><path d="M4.5 20c1.2-3.4 4-5.2 7.5-5.2s6.3 1.8 7.5 5.2" /></I>;
export const IconHelp = (p: SVGProps<SVGSVGElement>) => <I {...p}><circle cx="12" cy="12" r="9" /><path d="M9.3 9.2a2.8 2.8 0 1 1 3.9 2.9c-.8.4-1.2 1-1.2 1.9" /><circle cx="12" cy="17" r="0.4" fill="currentColor" /></I>;
export const IconOut = (p: SVGProps<SVGSVGElement>) => <I {...p}><path d="M14 4H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h7M16 8l4 4-4 4M20 12H9.5" /></I>;
export const IconCheck = (p: SVGProps<SVGSVGElement>) => <I {...p}><path d="m4.5 12.5 5 5L19.5 7" /></I>;
export const IconX = (p: SVGProps<SVGSVGElement>) => <I {...p}><path d="M6 6l12 12M18 6 6 18" /></I>;
export const IconAlert = (p: SVGProps<SVGSVGElement>) => <I {...p}><path d="M12 3.5 2.5 20h19L12 3.5zM12 10v4.5" /><circle cx="12" cy="17.3" r="0.4" fill="currentColor" /></I>;
export const IconClock = (p: SVGProps<SVGSVGElement>) => <I {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5.2l3.4 2" /></I>;
export const IconCopy = (p: SVGProps<SVGSVGElement>) => <I {...p}><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" transform="translate(2 2)" /></I>;
export const IconChevronD = (p: SVGProps<SVGSVGElement>) => <I {...p}><path d="m6 9 6 6 6-6" /></I>;
export const IconChevronR = (p: SVGProps<SVGSVGElement>) => <I {...p}><path d="m9 6 6 6-6 6" /></I>;
export const IconSearch = (p: SVGProps<SVGSVGElement>) => <I {...p}><circle cx="11" cy="11" r="6.5" /><path d="m20 20-3.8-3.8" /></I>;
export const IconPlus = (p: SVGProps<SVGSVGElement>) => <I {...p}><path d="M12 5v14M5 12h14" /></I>;
export const IconTrash = (p: SVGProps<SVGSVGElement>) => <I {...p}><path d="M4 7h16M9.5 7V5a1.5 1.5 0 0 1 1.5-1.5h2A1.5 1.5 0 0 1 14.5 5v2M6.5 7l.8 12a2 2 0 0 0 2 1.9h5.4a2 2 0 0 0 2-1.9l.8-12M10 11v6M14 11v6" /></I>;
export const IconRefresh = (p: SVGProps<SVGSVGElement>) => <I {...p}><path d="M20 12a8 8 0 1 1-2.3-5.6M20 3.5V8h-4.5" /></I>;
export const IconShield = (p: SVGProps<SVGSVGElement>) => <I {...p}><path d="M12 3 5 5.8v5.4c0 4.4 2.9 7.6 7 9.3 4.1-1.7 7-4.9 7-9.3V5.8L12 3z" /><path d="m9 11.8 2.2 2.2L15.5 9.5" /></I>;
export const IconBolt = (p: SVGProps<SVGSVGElement>) => <I {...p}><path d="M13 2 4.5 13.5H11L9.5 22 19 10h-6.5L13 2z" /></I>;
export const IconMenu = (p: SVGProps<SVGSVGElement>) => <I {...p}><path d="M4 7h16M4 12h16M4 17h16" /></I>;
export const IconEye = (p: SVGProps<SVGSVGElement>) => <I {...p}><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" /><circle cx="12" cy="12" r="2.8" /></I>;
export const IconEyeOff = (p: SVGProps<SVGSVGElement>) => <I {...p}><path d="M4 4l16 16M9.9 5.9A9.4 9.4 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17.6 17.6 0 0 1-3.2 3.9M6 8A16.5 16.5 0 0 0 2.5 12S6 18.5 12 18.5a9.6 9.6 0 0 0 3-.5" /><path d="M9.5 9.8a2.8 2.8 0 0 0 4 3.9" /></I>;
export const IconArrowR = (p: SVGProps<SVGSVGElement>) => <I {...p}><path d="M4 12h16m-6-6 6 6-6 6" /></I>;
export const IconArrowUpR = (p: SVGProps<SVGSVGElement>) => <I {...p}><path d="M7 17 17 7m-9 0h9v9" /></I>;
export const IconLink = (p: SVGProps<SVGSVGElement>) => <I {...p}><path d="M9.5 14.5 14.5 9.5M8 12l-2.5 2.5a3.5 3.5 0 0 0 5 5L13 17M16 12l2.5-2.5a3.5 3.5 0 0 0-5-5L11 7" /></I>;
export const IconLock = (p: SVGProps<SVGSVGElement>) => <I {...p}><rect x="5" y="10.5" width="14" height="10" rx="2" /><path d="M8 10.5V8a4 4 0 1 1 8 0v2.5" /></I>;
export const IconFile = (p: SVGProps<SVGSVGElement>) => <I {...p}><path d="M6 2.5h8L19 7.5v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-15a2 2 0 0 1 2-2z" /><path d="M13.5 2.5v5.5H19M8 13h8M8 16.5h5" /></I>;
export const IconInfo = (p: SVGProps<SVGSVGElement>) => <I {...p}><circle cx="12" cy="12" r="9" /><path d="M12 11v5.5" /><circle cx="12" cy="7.8" r="0.4" fill="currentColor" /></I>;
export const IconSwap = (p: SVGProps<SVGSVGElement>) => <I {...p}><path d="M7 4 3.5 7.5 7 11M3.5 7.5H17M17 13l3.5 3.5L17 20m3.5-3.5H7" /></I>;
export const IconScan = (p: SVGProps<SVGSVGElement>) => <I {...p}><path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2M3 12h18" /></I>;
export const IconReceipt = (p: SVGProps<SVGSVGElement>) => <I {...p}><path d="M5 3h14v18l-2.3-1.5L14.4 21l-2.4-1.5L9.6 21l-2.3-1.5L5 21V3z" /><path d="M8.5 8h7M8.5 11.5h7M8.5 15h4" /></I>;
export const IconGlobe = (p: SVGProps<SVGSVGElement>) => <I {...p}><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.8 2.6 4 5.6 4 9s-1.2 6.4-4 9c-2.8-2.6-4-5.6-4-9s1.2-6.4 4-9z" /></I>;
export const IconFilter = (p: SVGProps<SVGSVGElement>) => <I {...p}><path d="M4 5h16l-6.2 7.4V19l-3.6-1.8v-4.8L4 5z" /></I>;
export const IconDevice = (p: SVGProps<SVGSVGElement>) => <I {...p}><rect x="3" y="4.5" width="18" height="12" rx="2" /><path d="M9 20.5h6M12 16.5v4" /></I>;
export const IconDownload = (p: SVGProps<SVGSVGElement>) => <I {...p}><path d="M12 3.5v11M7.5 10l4.5 4.5L16.5 10M4.5 19.5h15" /></I>;
