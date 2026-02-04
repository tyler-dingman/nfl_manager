export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-6 py-16">
      <section className="space-y-3">
        <h1 className="text-3xl font-semibold">NFL Manager</h1>
        <p className="text-muted-foreground">
          App Router + TypeScript starter with Tailwind, shadcn/ui, TanStack Table, and
          Zustand.
        </p>
      </section>
      <section className="rounded-lg border border-border bg-card p-6 text-card-foreground">
        <h2 className="text-xl font-medium">Next steps</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-muted-foreground">
          <li>Wire up Supabase credentials in <code>.env.local</code>.</li>
          <li>Build features inside <code>src/features</code>.</li>
          <li>Add UI components to <code>src/components</code>.</li>
        </ul>
      </section>
    </main>
  );
}
