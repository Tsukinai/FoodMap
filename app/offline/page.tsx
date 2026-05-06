export default function OfflinePage() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 bg-[var(--fm-paper)] text-[var(--fm-ink)]">
      <svg
        width="48"
        height="48"
        viewBox="0 0 24 24"
        fill="none"
        stroke="var(--fm-ink-3)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <line x1="1" y1="1" x2="23" y2="23" />
        <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
        <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
        <path d="M10.71 5.05A16 16 0 0 1 22.56 9" />
        <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
        <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
        <circle cx="12" cy="20" r="1" fill="var(--fm-ink-3)" stroke="none" />
      </svg>
      <p className="text-[var(--fm-ink-2)]">当前处于离线状态，请检查网络连接</p>
    </div>
  )
}
