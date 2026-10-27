// Shared design tokens for the "Calibcare Dashboard Redesign" visual
// language -- kept in one place so Layout.jsx (sidebar/topbar, used on every
// page) and DashboardPage.jsx agree on the same palette instead of each
// hand-rolling its own hex constants.
export const theme = {
  brand: '#2952cc',
  brandDark: '#24408f',
  brandGradient: 'linear-gradient(135deg,#24408f,#3357b8)',
  ink: '#151f38',
  inkAlt: '#1b2a4b',
  textMuted: '#5b6478',
  textFaint: '#9aa2b4',
  textFainter: '#b0b6c4',
  border: '#eef0f5',
  borderStrong: '#e4e7ee',
  divider: '#f2f3f7',
  pageBg: '#f6f7fb',
  sidebarBg: '#eef1f8',
  chipBg: '#f3f5fa',
  cardShadow: '0 1px 2px rgba(16,24,40,.06), 0 1px 3px rgba(16,24,40,.05)',
  good: '#0f9d58',
  goodBg: '#e7f7ef',
  critical: '#d92d20',
  criticalStrong: '#b42318',
  criticalBg: '#fdeceb',
  criticalBgStrong: '#fee4e2',
  alertBg: '#fef3f2',
  alertBorder: '#fecdca',
  warning: '#b45309',
  warningBg: '#fef3e2',
  warningBorderSoft: '#f0d3a8',
  neutralMuted: '#94a3b8',
  // Page leadspace (title band) and the selected sidebar item.
  leadBg: 'linear-gradient(120deg,#1b2a4b 0%,#24408f 100%)',
  leadText: '#1b2a4b',
  leadMuted: '#c8d2ea',
  navActiveBg: '#2952cc',
  navHoverBg: '#e2e7f3',
};
