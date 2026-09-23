// Shared shell for the auth screens (login/register/forgot-password/verify-
// code), matching the Figma design tokens exactly: dark page background
// with a centered rounded card, brand-blue logo mark, Inter type scale.
// The design's 390x844 frame + iOS status bar were just Figma's phone-
// mockup presentation chrome, not real content -- this renders the actual
// card only, responsively.

export const BRAND = '#1D459E';
export const INK = '#0F172A';
export const MUTED = '#64748B';
export const BORDER = '#E2E8F0';
export const CARD_BG = '#F8FAFC';
export const PAGE_BG = '#0F172A';

function LogoMark() {
  return (
    <div className="w-8 h-8 rounded-[10px] flex items-center justify-center shrink-0" style={{ backgroundColor: BRAND }}>
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <polyline points="1,9 5,9 7,3 11,15 13,9 17,9" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </svg>
    </div>
  );
}

export function AuthLogo() {
  return (
    <div className="flex items-center justify-center gap-2 w-full">
      <LogoMark />
      <span className="text-[22px] font-extrabold" style={{ color: INK }}>
        Calibcare
      </span>
    </div>
  );
}

export function AuthShell({ children }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ backgroundColor: PAGE_BG }}>
      <div className="w-full max-w-[400px] rounded-[24px] flex flex-col" style={{ backgroundColor: CARD_BG }}>
        {children}
      </div>
    </div>
  );
}

export function AuthHeader() {
  return (
    <div className="flex flex-col items-center gap-3 px-6 pt-8 pb-6">
      <AuthLogo />
    </div>
  );
}

export function EyeOffIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path
        d="M2 10s3-6 8-6 8 6 8 6-3 6-8 6-8-6-8-6Z M7.5 7.5a3 3 0 1 0 5 5 M2 2l16 16"
        stroke={MUTED}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

export function ArrowLeftIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path d="M12.5 4 6 10l6.5 6" stroke={BRAND} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

export function AuthField({ label, children }) {
  return (
    <div className="flex flex-col gap-2 w-full">
      <label className="text-sm font-semibold" style={{ color: INK }}>
        {label}
      </label>
      {children}
    </div>
  );
}

export function inputBoxClass() {
  return 'w-full h-[52px] px-4 rounded-xl text-[15px] outline-none bg-white';
}

export const inputBoxStyle = {
  border: `1.5px solid ${BORDER}`,
  color: INK,
};

export function PrimaryButton({ children, disabled, ...props }) {
  return (
    <button
      disabled={disabled}
      className="w-full h-[52px] rounded-xl text-white text-base font-semibold disabled:opacity-50"
      style={{ backgroundColor: BRAND }}
      {...props}
    >
      {children}
    </button>
  );
}

export function OutlineButton({ children, ...props }) {
  return (
    <button
      className="w-full h-[52px] rounded-xl text-base font-semibold flex items-center justify-center gap-2 bg-white"
      style={{ border: `1.5px solid ${BORDER}`, color: INK }}
      {...props}
    >
      {children}
    </button>
  );
}

export function Divider({ label }) {
  return (
    <div className="flex items-center gap-4 py-2 w-full">
      <div className="flex-1 h-0" style={{ borderTop: `1px solid ${BORDER}` }} />
      <span className="text-sm font-semibold" style={{ color: MUTED }}>
        {label}
      </span>
      <div className="flex-1 h-0" style={{ borderTop: `1px solid ${BORDER}` }} />
    </div>
  );
}
