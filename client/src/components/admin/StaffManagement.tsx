import { useEffect, useState, type FormEvent } from "react";
import { Plus } from "lucide-react";
import { api, type StaffUser } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export function StaffManagement() {
  const { toast } = useToast();
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);

  const loadStaff = async () => {
    setLoading(true);
    setLoadError("");
    try {
      setStaff(await api.getStaffUsers());
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "User records could not be loaded.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadStaff(); }, []);

  const addStaff = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      const added = await api.createStaffUser({ name, email });
      setStaff(current => [added, ...current]);
      setName("");
      setEmail("");
      toast({ title: "User added", description: "This person has no sign-in access yet." });
    } catch (error) {
      toast({
        title: "Could not add user",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="mt-10" aria-labelledby="staff-management-title">
      <div className="mb-5">
        <p className="admin-kicker mb-2">Infinite Home / Users</p>
        <h2 id="staff-management-title" className="text-2xl font-serif">Users</h2>
        <p className="text-sm text-muted-foreground">
          Add non-admin users here. They cannot sign in or access the admin panel until you decide their access.
        </p>
      </div>

      <Card className="admin-surface-card rounded-none border-border shadow-none mb-5">
        <CardContent className="p-6">
          <h3 className="font-bold mb-4 uppercase tracking-widest text-xs">Add User</h3>
          <form onSubmit={addStaff} className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[180px]">
              <label htmlFor="new-user-name" className="block text-sm mb-2">Name</label>
              <Input id="new-user-name" value={name} onChange={event => setName(event.target.value)}
                autoComplete="off" required maxLength={100} className="rounded-none"
                data-testid="input-new-user-name" />
            </div>
            <div className="flex-1 min-w-[220px]">
              <label htmlFor="new-user-email" className="block text-sm mb-2">Email</label>
              <Input id="new-user-email" type="email" value={email} onChange={event => setEmail(event.target.value)}
                autoComplete="off" required maxLength={254} className="rounded-none"
                data-testid="input-new-user-email" />
            </div>
            <Button type="submit" disabled={saving} className="rounded-none" data-testid="button-add-user">
              <Plus size={14} className="mr-2" /> {saving ? "Adding..." : "Add User"}
            </Button>
          </form>
          <p className="mt-4 text-xs text-muted-foreground">
            No password or permissions are assigned. You can set up user access later.
          </p>
        </CardContent>
      </Card>

      {loading ? <p className="text-sm text-muted-foreground">Loading users...</p> : loadError ? (
        <div role="alert" className="text-sm text-destructive">
          {loadError} <Button variant="link" size="sm" onClick={() => void loadStaff()}>Retry</Button>
        </div>
      ) : staff.length === 0 ? (
        <p className="text-sm text-muted-foreground">No users added yet.</p>
      ) : (
        <div className="space-y-3">
          {staff.map(person => (
            <Card key={person.id} className="rounded-none border-border shadow-none">
              <CardContent className="p-5 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-bold">{person.name}</p>
                  <p className="text-sm text-muted-foreground">{person.email}</p>
                </div>
                <span className="text-xs uppercase tracking-widest text-muted-foreground">
                  {person.status === "pending_access" ? "Pending access" : person.status}
                </span>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}