/**
 * Shared interaction geometry for the operations console.
 *
 * Keep this deliberately small: it is a visual contract, not a second
 * component library. Consumers can still choose their existing Button
 * variants and permission/behavior logic.
 */
export const adminButtonClass = (tone: "primary" | "outline" | "quiet" | "danger" = "outline") => {
  const base =
    "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold leading-none tracking-[.04em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#16877f]/30 disabled:pointer-events-none disabled:opacity-50";
  const tones = {
    primary: "bg-[#12334a] text-white hover:bg-[#0c283b]",
    outline: "border border-slate-300 bg-white text-[#12334a] hover:border-[#16877f] hover:bg-[#f1f8f7]",
    quiet: "border border-transparent text-[#126f69] hover:bg-[#e8f5f2]",
    danger: "border border-[#ebc4be] bg-white text-[#a44539] hover:bg-[#fff0ee]",
  };
  return `${base} ${tones[tone]}`;
};

export const adminControlClass =
  "h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-[#12334a] outline-none transition-colors focus:border-[#16877f] focus:ring-2 focus:ring-[#16877f]/10";

export const adminActionRowClass =
  "flex flex-wrap items-center justify-end gap-2";