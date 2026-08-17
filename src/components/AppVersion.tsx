import { getAppVersionLabel } from "@/lib/app-version";

export function AppVersion() {
  return (
    <p className="px-4 pb-6 text-center text-xs text-slate-400">{getAppVersionLabel()}</p>
  );
}
