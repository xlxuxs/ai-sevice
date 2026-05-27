export function LoadingState({ label = "Loading", fullScreen = false }) {
  return (
    <div className={fullScreen ? "grid min-h-screen place-items-center bg-slate-50" : "grid min-h-48 place-items-center"}>
      <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-600 shadow-sm">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-teal-700" />
        {label}
      </div>
    </div>
  );
}
