export default function DashboardLoading() {
  return (
    <div className="animate-pulse space-y-5">
      <div className="h-32 rounded-[28px] bg-white/70" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-32 rounded-[24px] bg-white/70" />)}
      </div>
      <div className="grid gap-5 xl:grid-cols-3"><div className="h-80 rounded-[26px] bg-white/70 xl:col-span-2"/><div className="h-80 rounded-[26px] bg-white/70"/></div>
    </div>
  );
}
