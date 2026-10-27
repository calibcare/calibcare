import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { theme } from '../theme';

// Shared page building blocks, following the dashboard UX patterns the
// layout is based on (Pencil & Paper, "Dashboard Design UX Patterns"):
// a leadspace with a clear title and description on every page, sections
// that group like with like, filter feedback next to the title, skeleton
// loading instead of a bare "Loading…", and a drawer for drilling into
// detail without leaving the page.

// Leadspace: full-width band at the top of a page. `stats` are the page's
// headline numbers (clickable when they lead somewhere), `children` is the
// filter-feedback row.
export function PageHeader({ eyebrow, title, description, stats, actions, children }) {
  return (
    <header className="-mx-8 -mt-7 px-8 pt-7 pb-7" style={{ background: theme.leadBg }}>
      {eyebrow && <div className="mb-3 text-[13px] font-semibold">{eyebrow}</div>}
      <div className="flex items-end justify-between gap-6 flex-wrap">
        <div className="min-w-0 flex-1">
          <h1 className="text-[26px] font-bold leading-tight" style={{ color: '#fff' }}>
            {title}
          </h1>
          {description && (
            <p className="text-[14px] mt-1.5 max-w-[600px]" style={{ color: theme.leadMuted }}>
              {description}
            </p>
          )}
        </div>
        {(stats?.length > 0 || actions) && (
          <div className="flex items-end gap-7 flex-wrap">
            {stats?.map((s) => (
              <HeaderStat key={s.label} {...s} />
            ))}
            {actions}
          </div>
        )}
      </div>
      {children && <div className="mt-4">{children}</div>}
    </header>
  );
}

function HeaderStat({ label, value, onClick, active }) {
  const body = (
    <>
      <span className="block text-[26px] font-bold leading-none" style={{ color: '#fff' }}>
        {value}
      </span>
      <span className="block text-[12px] mt-1.5" style={{ color: theme.leadMuted, textDecoration: active ? 'underline' : 'none', textUnderlineOffset: 4 }}>
        {label}
      </span>
    </>
  );
  if (!onClick) return <div className="text-center">{body}</div>;
  return (
    <button type="button" onClick={onClick} className="text-center rounded-lg px-1 hover:opacity-80" style={{ border: 'none', background: 'none' }}>
      {body}
    </button>
  );
}

// A button that reads well on the dark leadspace.
export function HeaderButton({ children, ...props }) {
  return (
    <button
      type="button"
      {...props}
      className="rounded-[10px] px-[18px] py-2.5 text-[13.5px] font-semibold whitespace-nowrap"
      style={{ backgroundColor: '#fff', color: theme.leadText, border: 'none' }}
    >
      {children}
    </button>
  );
}

// Filter feedback: what is applied right now, each removable, plus Clear.
export function FilterFeedback({ pills, onRemove, onClear, summary }) {
  return (
    <div className="flex items-center gap-2 flex-wrap text-[12.5px]">
      <span style={{ color: theme.leadMuted }}>{pills.length ? 'Filters applied:' : summary}</span>
      {pills.map((p) => (
        <span
          key={`${p.key}|${p.value}`}
          className="inline-flex items-center gap-1 rounded-full pl-[11px] pr-1 py-[3px] font-semibold"
          style={{ backgroundColor: '#fff', color: theme.leadText }}
        >
          {p.label}
          <button
            type="button"
            onClick={() => onRemove(p)}
            aria-label={`Remove filter ${p.label}`}
            className="px-1 text-[13px]"
            style={{ color: 'inherit', border: 'none', background: 'none' }}
          >
            ✕
          </button>
        </span>
      ))}
      {pills.length > 0 && (
        <>
          <button type="button" onClick={onClear} className="font-semibold underline underline-offset-4" style={{ color: '#fff', border: 'none', background: 'none' }}>
            Clear all
          </button>
          {summary && <span style={{ color: theme.leadMuted }}>· {summary}</span>}
        </>
      )}
    </div>
  );
}

// A group of related content: a heading, an optional "View all" link or
// control on the right, then the content.
export function Section({ title, hint, to, actionLabel = 'View all', action, children, className = '' }) {
  return (
    <section className={`flex flex-col gap-3 ${className}`}>
      <div className="flex items-center justify-between gap-3 min-h-[32px]">
        <div className="flex items-baseline gap-2.5">
          <h2 className="text-[16px] font-bold" style={{ color: theme.ink }}>
            {title}
          </h2>
          {hint && (
            <span className="text-[12.5px]" style={{ color: theme.textFaint }}>
              {hint}
            </span>
          )}
        </div>
        {action}
        {to && (
          <Link to={to} className="rounded-lg px-3 py-1.5 text-[12.5px] font-semibold" style={{ border: `1px solid ${theme.borderStrong}`, color: theme.brand, backgroundColor: '#fff' }}>
            {actionLabel} →
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

// Loading placeholder shaped like the content that is coming.
export function Skeleton({ className = '', style }) {
  return <div className={`skeleton ${className}`} style={style} aria-hidden="true" />;
}

// Right-hand drawer for a quick look without leaving the page.
export function SideDrawer({ title, description, onClose, footer, children, label }) {
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <>
      <div className="fixed inset-0 z-40" style={{ backgroundColor: 'rgba(15,20,40,.25)' }} onClick={onClose} />
      <aside
        aria-label={label || title}
        className="fixed top-0 right-0 bottom-0 z-50 bg-white flex flex-col"
        style={{ width: 'min(420px, 100%)', boxShadow: '-8px 0 30px rgba(16,24,40,.18)' }}
      >
        <div className="px-6 pt-6 pb-5" style={{ borderBottom: `1px solid ${theme.divider}` }}>
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-[20px] font-bold leading-snug" style={{ color: theme.ink }}>
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="w-8 h-8 rounded-lg text-[18px] leading-none shrink-0 hover:bg-[#f3f5fa]"
              style={{ color: theme.textMuted, border: 'none', background: 'none' }}
            >
              ✕
            </button>
          </div>
          {description && <div className="text-[13px] mt-1.5" style={{ color: theme.textMuted }}>{description}</div>}
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {footer && (
          <div className="px-6 py-4 flex gap-2 flex-wrap" style={{ borderTop: `1px solid ${theme.divider}` }}>
            {footer}
          </div>
        )}
      </aside>
    </>
  );
}
