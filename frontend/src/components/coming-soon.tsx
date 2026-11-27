export function ComingSoon({ title, step }: { title: string; step: number }) {
  return (
    <div className="flex flex-col gap-2">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="text-muted-foreground">
        This page is built in step {step} of the frontend plan (docs/FRONTEND-PLAN.md). Until then, the
        classic version is at <a className="underline" href="/classic/">/classic/</a>.
      </p>
    </div>
  );
}
