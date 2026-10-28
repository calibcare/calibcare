// Inline icon set. Sidebar/topbar/dashboard icons match the exact paths from
// the "Calibcare Dashboard Redesign" design canvas (24x24 viewBox, 1.8-2px
// stroke); a few smaller utility icons (search, chevrons, filter) predate
// that redesign and stay at their own viewBox.

const nav = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none' };

export function HomeIcon({ color = 'currentColor' }) {
  return (
    <svg {...nav}>
      <path d="M3 11.5 12 4l9 7.5" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path
        d="M5.5 10v9a1 1 0 0 0 1 1h4.5v-6h2v6H17a1 1 0 0 0 1-1v-9"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

export function PackageIcon({ color = 'currentColor' }) {
  return (
    <svg {...nav}>
      <path
        d="M12 3 21 7.5v9L12 21 3 16.5v-9Z M3 7.5 12 12l9-4.5 M12 12v9"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

export function BellIcon({ color = 'currentColor' }) {
  return (
    <svg {...nav}>
      <path
        d="M6 9a6 6 0 0 1 12 0c0 4 1.5 5.5 1.5 5.5h-15S6 13 6 9Z"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <path d="M9.5 17a2.5 2.5 0 0 0 5 0" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

export function SettingsIcon({ color = 'currentColor' }) {
  return (
    <svg {...nav}>
      <circle cx="12" cy="12" r="3.1" stroke={color} strokeWidth="1.8" fill="none" />
      <path
        d="M12 3v2.4M12 18.6V21M21 12h-2.4M5.4 12H3M18.4 5.6l-1.7 1.7M7.3 16.7l-1.7 1.7M18.4 18.4l-1.7-1.7M7.3 7.3 5.6 5.6"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

export function LogOutIcon({ color = 'currentColor' }) {
  return (
    <svg {...nav}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="M16 17l5-5-5-5 M21 12H9" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

export function SearchIcon({ color = 'currentColor', size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="11" cy="11" r="7" stroke={color} strokeWidth="2" fill="none" />
      <path d="m21 21-4.3-4.3" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function ChevronLeftIcon({ color = 'currentColor' }) {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
      <path d="m15 18-6-6 6-6" stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

export function ChevronRightIcon({ color = 'currentColor' }) {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
      <path d="m9 18 6-6-6-6" stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

export function ChevronDownIcon({ color = 'currentColor', size = 12 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="m6 9 6 6 6-6" stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

export function ArrowUpRightIcon({ color = 'currentColor', size = 15 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="m9 18 6-6-6-6" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

export function FilterIcon({ color = 'currentColor' }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M1.5 3.5h11 M4 7h6 M6 10.5h2" stroke={color} strokeWidth="2" strokeLinecap="round" fill="none" />
    </svg>
  );
}

export function AlertTriangleIcon({ color = 'currentColor', size = 15 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path
        d="M12 3.6 21 20H3L12 3.6Z M12 9.6v4.4"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <circle cx="12" cy="16.8" r="0.9" fill={color} stroke="none" />
    </svg>
  );
}

export function LayersIcon({ color = 'currentColor', size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path
        d="m12 3 8.5 4.6L12 12.2 3.5 7.6 12 3Z M3.5 12l8.5 4.6 8.5-4.6 M3.5 16.4l8.5 4.6 8.5-4.6"
        stroke={color}
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

export function CheckCircleIcon({ color = 'currentColor', size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke={color} strokeWidth="1.9" fill="none" />
      <path d="m8.3 12.3 2.5 2.5 4.7-5.2" stroke={color} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

export function SendIcon({ color = 'currentColor', size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="m3 12 18-8-6 18-3.3-7.1L3 12Z" stroke={color} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

export function ClockIcon({ color = 'currentColor', size = 17 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke={color} strokeWidth="2" fill="none" />
      <path d="M12 7v5.5l3.5 2" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

export function UsersIcon({ color = 'currentColor', size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="9" cy="8" r="3.2" stroke={color} strokeWidth="1.8" fill="none" />
      <path d="M3.5 19.2c0-3 2.5-5 5.5-5s5.5 2 5.5 5" stroke={color} strokeWidth="1.8" strokeLinecap="round" fill="none" />
      <path d="M16.2 5.3a3.2 3.2 0 0 1 0 5.6M17.6 14.6c2 .6 3.4 2.3 3.4 4.6" stroke={color} strokeWidth="1.8" strokeLinecap="round" fill="none" />
    </svg>
  );
}

export function ShieldIcon({ color = 'currentColor', size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M12 3.5 19 6v5.5c0 4.4-3 7.8-7 9-4-1.2-7-4.6-7-9V6Z" stroke={color} strokeWidth="1.8" strokeLinejoin="round" fill="none" />
      <path d="m9 12 2.2 2.2L15.5 10" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

export function KeyIcon({ color = 'currentColor', size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="8" cy="15" r="4" stroke={color} strokeWidth="1.8" fill="none" />
      <path d="m11 12 8-8M16 7l3 3M14 9l2 2" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

export function PlusIcon({ color = 'currentColor', size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M12 5v14M5 12h14" stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

export function EyeIcon({ color = 'currentColor', size = 15 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <circle cx="12" cy="12" r="2.6" stroke={color} strokeWidth="1.8" fill="none" />
    </svg>
  );
}

export function PencilIcon({ color = 'currentColor', size = 15 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="m14.5 4.5 3 3L7 18H4v-3l10.5-10.5Z" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

export function TrashIcon({ color = 'currentColor', size = 15 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path
        d="M4 7h16M9.5 7V5a1.5 1.5 0 0 1 1.5-1.5h2A1.5 1.5 0 0 1 14.5 5v2M6.5 7l.8 12a2 2 0 0 0 2 1.9h5.4a2 2 0 0 0 2-1.9l.8-12"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

export function MenuIcon({ color = 'currentColor' }) {
  return (
    <svg {...nav}>
      <path d="M4 7h16M4 12h16M4 17h16" stroke={color} strokeWidth="1.9" strokeLinecap="round" fill="none" />
    </svg>
  );
}

export function WrenchIcon({ color = 'currentColor' }) {
  return (
    <svg {...nav}>
      <path
        d="M14.7 6.3a4 4 0 0 0 5 5L21 12.6a6 6 0 0 1-7.6 1.7L6.5 21.2a2 2 0 0 1-2.8-2.8l6.9-6.9A6 6 0 0 1 12.3 3.9l1.3 1.3a4 4 0 0 0 1.1 1.1z"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

export function ArchiveIcon({ color = 'currentColor' }) {
  return (
    <svg {...nav}>
      <path d="M3.5 5h17v4h-17zM5 9v10h14V9M10 13h4" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}
