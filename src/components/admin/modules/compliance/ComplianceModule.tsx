/**
 * Compliance module — cleared for a rebuild from scratch.
 *
 * The previous module (overview, CDD, practice registers and reports) was
 * removed in full. This shell keeps the admin route, sidebar entry and lazy
 * chunk wired so the new module can be built in place.
 */
export function ComplianceModule() {
  return (
    <div className="flex h-full w-full flex-col bg-slate-50/50">
      <div className="shrink-0 border-b bg-white px-6 py-4 shadow-sm">
        <h1 className="text-2xl font-semibold text-foreground">Compliance</h1>
      </div>
    </div>
  );
}
