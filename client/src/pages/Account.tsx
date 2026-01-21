import { useState } from "react";
import { useLocation } from "wouter";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { User, Package, LogOut, MapPin, Phone, Mail } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Account() {
  const [, setLocation] = useLocation();
  const { user, isAuthenticated, logout, updateProfile } = useAuth();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: user?.name || "",
    phone: user?.phone || "",
    address: user?.address || "",
  });

  if (!isAuthenticated || !user) {
    setLocation("/login");
    return null;
  }

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const updated = await api.updateCustomer(user.id, formData);
      updateProfile({
        name: updated.name,
        phone: updated.phone,
        address: updated.address,
      });
      setIsEditing(false);
      toast({
        title: "Profile Updated",
        description: "Your account details have been saved.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update profile. Please try again.",
        variant: "destructive",
      });
    }
    setIsSaving(false);
  };

  const handleLogout = () => {
    logout();
    setLocation("/");
  };

  return (
    <div className="min-h-screen bg-background font-body">
      <Navbar />
      <main className="pt-32 pb-24 px-4">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-10">
            <h1 className="text-3xl md:text-4xl font-serif mb-4">My Account</h1>
            <p className="text-muted-foreground">Manage your account details</p>
          </div>

          <div className="space-y-6">
            <Card className="rounded-none border-border">
              <CardHeader className="border-b border-border">
                <CardTitle className="flex items-center gap-2 text-sm uppercase tracking-widest font-bold">
                  <User size={16} /> Profile Information
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                {isEditing ? (
                  <>
                    <div className="space-y-2">
                      <Label className="text-xs uppercase tracking-widest font-bold">Name</Label>
                      <Input
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="rounded-none"
                        data-testid="input-edit-name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs uppercase tracking-widest font-bold">Phone</Label>
                      <Input
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        className="rounded-none"
                        placeholder="7XXXXXX"
                        data-testid="input-edit-phone"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs uppercase tracking-widest font-bold">Address</Label>
                      <Input
                        value={formData.address}
                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                        className="rounded-none"
                        placeholder="Your delivery address"
                        data-testid="input-edit-address"
                      />
                    </div>
                    <div className="flex gap-3 pt-4">
                      <Button 
                        onClick={handleSave} 
                        className="rounded-none text-xs uppercase tracking-widest"
                        disabled={isSaving}
                        data-testid="button-save-profile"
                      >
                        {isSaving ? "Saving..." : "Save Changes"}
                      </Button>
                      <Button 
                        variant="outline" 
                        onClick={() => setIsEditing(false)} 
                        className="rounded-none text-xs uppercase tracking-widest"
                        data-testid="button-cancel-edit"
                      >
                        Cancel
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-3 py-2">
                      <User size={16} className="text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-widest">Name</p>
                        <p className="font-medium">{user.name}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 py-2">
                      <Mail size={16} className="text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-widest">Email</p>
                        <p className="font-medium">{user.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 py-2">
                      <Phone size={16} className="text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-widest">Phone</p>
                        <p className="font-medium">{user.phone || "Not set"}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 py-2">
                      <MapPin size={16} className="text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-widest">Address</p>
                        <p className="font-medium">{user.address || "Not set"}</p>
                      </div>
                    </div>
                    <div className="pt-4">
                      <Button 
                        variant="outline" 
                        onClick={() => setIsEditing(true)} 
                        className="rounded-none text-xs uppercase tracking-widest"
                        data-testid="button-edit-profile"
                      >
                        Edit Profile
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <Card className="rounded-none border-border">
              <CardHeader className="border-b border-border">
                <CardTitle className="flex items-center gap-2 text-sm uppercase tracking-widest font-bold">
                  <Package size={16} /> Track Orders
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <p className="text-muted-foreground text-sm mb-4">
                  Track the status of your recent orders.
                </p>
                <Button 
                  variant="outline" 
                  onClick={() => setLocation("/track")} 
                  className="rounded-none text-xs uppercase tracking-widest"
                  data-testid="button-track-orders"
                >
                  Track Order
                </Button>
              </CardContent>
            </Card>

            <div className="pt-6 border-t border-border">
              <Button 
                variant="ghost" 
                onClick={handleLogout}
                className="text-destructive hover:text-destructive hover:bg-destructive/10 rounded-none text-xs uppercase tracking-widest gap-2"
                data-testid="button-logout"
              >
                <LogOut size={16} /> Sign Out
              </Button>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
