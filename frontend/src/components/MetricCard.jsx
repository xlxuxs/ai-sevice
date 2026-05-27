export function MetricCard({ label, value, helper, icon: Icon }) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="mt-2 text-3xl font-bold text-slate-950">{value}</p>
        </div>
        {Icon ? (
          <span className="grid h-10 w-10 place-items-center rounded-lg bg-teal-50 text-teal-700">
            <Icon className="h-5 w-5" />
          </span>
        ) : null}
      </div>
      {helper ? <p className="mt-3 text-sm text-slate-500">{helper}</p> : null}
    </article>
  );
}
