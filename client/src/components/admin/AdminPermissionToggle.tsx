import { Switch } from "@/components/ui/switch";

type AdminPermissionToggleProps = {
  id: string;
  label: string;
  ariaLabel: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  testId?: string;
};

export function AdminPermissionToggle({
  id, label, ariaLabel, checked, onCheckedChange, testId,
}: AdminPermissionToggleProps) {
  return (
    <div className="flex min-h-12 items-center justify-between gap-3 rounded-md border border-border bg-background/70 px-3 py-2 transition-colors hover:bg-muted/40 focus-within:ring-2 focus-within:ring-ring/30">
      <label htmlFor={id} className="min-w-0 flex-1 cursor-pointer text-sm font-medium leading-5">
        {label}
      </label>
      <span aria-hidden="true" className={`text-[10px] font-bold uppercase tracking-widest ${checked ? "text-primary" : "text-muted-foreground"}`}>
        {checked ? "On" : "Off"}
      </span>
      <Switch
        id={id}
        className="admin-permission-switch"
        aria-label={ariaLabel}
        checked={checked}
        onCheckedChange={onCheckedChange}
        data-testid={testId}
      />
    </div>
  );
}