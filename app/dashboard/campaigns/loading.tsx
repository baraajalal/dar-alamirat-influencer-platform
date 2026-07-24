export default function CampaignsLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading campaigns">
      <div className="h-24 animate-pulse rounded-[26px] bg-white/80" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="h-32 animate-pulse rounded-[24px] bg-white/80" />
        ))}
      </div>
      <div className="h-20 animate-pulse rounded-[26px] bg-white/80" />
      <div className="h-96 animate-pulse rounded-[26px] bg-white/80" />
    </div>
  );
}
