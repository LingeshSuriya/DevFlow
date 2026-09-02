export default function Header({ title, subtitle }) {
  return (
    <div className="h-14 px-6 flex items-center border-b border-zinc-800 shrink-0">
      <div>
        <div className="font-mono text-sm text-zinc-100">{title}</div>
        <div className="text-xs text-zinc-500">{subtitle}</div>
      </div>
    </div>
  );
}
