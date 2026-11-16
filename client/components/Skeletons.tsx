export function StudyHubSkeleton() {
  return (
    <div aria-busy="true" aria-label="Generating study guide" className="space-y-6 animate-pulse">
      <div className="rounded-2xl border border-border-subtle bg-surface p-6">
        <div className="h-5 w-48 rounded-lg bg-surface-muted" />
        <div className="mt-4 space-y-2.5">
          <div className="h-4 w-full rounded bg-surface-muted" />
          <div className="h-4 w-5/6 rounded bg-surface-muted" />
          <div className="h-4 w-4/6 rounded bg-surface-muted" />
        </div>
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        {[1, 2, 3, 4].map((idx) => (
          <div key={idx} className="rounded-2xl border border-border-subtle bg-surface p-6">
            <div className="h-4 w-36 rounded bg-surface-muted" />
            <div className="mt-4 space-y-2">
              <div className="h-3.5 w-full rounded bg-surface-muted" />
              <div className="h-3.5 w-11/12 rounded bg-surface-muted" />
              <div className="h-3.5 w-3/4 rounded bg-surface-muted" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function QuizQuestionSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-label="Generating quiz questions"
      className="rounded-2xl border border-border-subtle bg-surface p-6 sm:p-8 animate-pulse"
    >
      <div className="flex items-center justify-between gap-4">
        <div className="h-4 w-32 rounded bg-surface-muted" />
        <div className="h-4 w-20 rounded bg-surface-muted" />
      </div>
      <div className="mt-4 h-2 w-full rounded-full bg-surface-muted" />
      <div className="mt-6 space-y-2.5">
        <div className="h-5 w-11/12 rounded bg-surface-muted" />
        <div className="h-5 w-3/5 rounded bg-surface-muted" />
      </div>
      <div className="mt-6 space-y-3">
        {[1, 2, 3, 4].map((idx) => (
          <div key={idx} className="h-14 w-full rounded-xl bg-surface-muted" />
        ))}
      </div>
    </div>
  );
}
