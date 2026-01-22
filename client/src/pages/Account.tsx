import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth";
import { api, type Order, type CustomerAddress } from "@/lib/api";
import { formatCurrency } from "@/lib/products";
import { User, Package, LogOut, MapPin, Phone, Mail, Plus, Trash2, Star, Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Account() {
  const [, setLocation] = useLocation();
  const { user, isAuthenticated, logout, updateProfile } = useAuth();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [loadingAddresses, setLoadingAddresses] = useState(true);
  const [showAddAddress, setShowAddAddress] = useState(false);
  const [newAddress, setNewAddress] = useState({ 
    label: "", 
    fullName: "",
    streetAddress: "",
    addressLine2: "",
    cityIsland: "",
    zipCode: "",
    mobileNo: ""
  });
  const [formData, setFormData] = useState({
    name: user?.name || "",
    phone: user?.phone || "",
    address: user?.address || "",
  });

  useEffect(() => {
    if (isAuthenticated && user) {
      loadOrders();
      loadAddresses();
    }
  }, [isAuthenticated, user]);

  const loadOrders = async () => {
    if (!user?.email) return;
    setLoadingOrders(true);
    try {
      const email = user.email.trim();
      const customerOrders = await api.getCustomerOrders(email);
      setOrders(customerOrders.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()));
    } catch (error) {
      console.error("Failed to load orders:", error);
    }
    setLoadingOrders(false);
  };

  const loadAddresses = async () => {
    if (!user?.id) return;
    setLoadingAddresses(true);
    try {
      const customerAddresses = await api.getCustomerAddresses(user.id);
      setAddresses(customerAddresses);
    } catch (error) {
      console.error("Failed to load addresses:", error);
    }
    setLoadingAddresses(false);
  };

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

  const handleAddAddress = async () => {
    if (!newAddress.label || !newAddress.fullName || !newAddress.streetAddress || !newAddress.cityIsland || !newAddress.mobileNo) {
      toast({ title: "Error", description: "Please fill in all required fields.", variant: "destructive" });
      return;
    }
    try {
      const fullAddress = [
        newAddress.streetAddress,
        newAddress.addressLine2,
        newAddress.cityIsland,
        newAddress.zipCode
      ].filter(Boolean).join(", ");
      
      const created = await api.createCustomerAddress(user.id, {
        label: newAddress.label,
        fullName: newAddress.fullName,
        streetAddress: newAddress.streetAddress,
        addressLine2: newAddress.addressLine2 || undefined,
        cityIsland: newAddress.cityIsland,
        zipCode: newAddress.zipCode || undefined,
        mobileNo: newAddress.mobileNo,
        fullAddress: fullAddress,
        isDefault: addresses.length === 0,
      });
      setAddresses([...addresses, created]);
      setNewAddress({ 
        label: "", 
        fullName: "",
        streetAddress: "",
        addressLine2: "",
        cityIsland: "",
        zipCode: "",
        mobileNo: ""
      });
      setShowAddAddress(false);
      toast({ title: "Address Added", description: "Your new address has been saved." });
    } catch (error) {
      toast({ title: "Error", description: "Failed to add address.", variant: "destructive" });
    }
  };

  const handleDeleteAddress = async (id: string) => {
    try {
      await api.deleteCustomerAddress(id);
      setAddresses(addresses.filter(a => a.id !== id));
      toast({ title: "Address Deleted" });
    } catch (error) {
      toast({ title: "Error", description: "Failed to delete address.", variant: "destructive" });
    }
  };

  const handleSetDefault = async (addressId: string) => {
    try {
      await api.setDefaultAddress(user.id, addressId);
      setAddresses(addresses.map(a => ({ ...a, isDefault: a.id === addressId })));
      toast({ title: "Default Address Updated" });
    } catch (error) {
      toast({ title: "Error", description: "Failed to set default address.", variant: "destructive" });
    }
  };

  const handleLogout = () => {
    logout();
    setLocation("/");
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "delivered": return "bg-green-100 text-green-700";
      case "cancelled": case "delivery_exception": return "bg-red-100 text-red-700";
      case "in_transit": case "out_for_delivery": return "bg-blue-100 text-blue-700";
      case "pending": return "bg-gray-100 text-gray-700";
      default: return "bg-amber-100 text-amber-700";
    }
  };

  return (
    <div className="min-h-screen bg-background font-body">
      <Navbar />
      <main className="pt-32 pb-24 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <h1 className="text-3xl md:text-4xl font-serif mb-4">My Account</h1>
            <p className="text-muted-foreground">Manage your account, orders, and addresses</p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
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
              <CardHeader className="border-b border-border flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-sm uppercase tracking-widest font-bold">
                  <MapPin size={16} /> Address Book
                </CardTitle>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="rounded-none text-xs gap-1"
                  onClick={() => setShowAddAddress(true)}
                  data-testid="button-add-address"
                >
                  <Plus size={14} /> Add
                </Button>
              </CardHeader>
              <CardContent className="pt-4">
                {loadingAddresses ? (
                  <p className="text-muted-foreground text-sm">Loading addresses...</p>
                ) : addresses.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No saved addresses yet.</p>
                ) : (
                  <div className="space-y-3">
                    {addresses.map((addr) => (
                      <div key={addr.id} className="p-3 border border-border relative">
                        {addr.isDefault && (
                          <span className="absolute top-2 right-2 text-[10px] uppercase font-bold text-primary flex items-center gap-1">
                            <Star size={10} fill="currentColor" /> Default
                          </span>
                        )}
                        <p className="font-medium text-sm">{addr.label}</p>
                        {addr.fullName && <p className="text-xs mt-1">{addr.fullName}</p>}
                        <p className="text-xs text-muted-foreground mt-1">{addr.fullAddress}</p>
                        {addr.mobileNo && <p className="text-xs text-muted-foreground">Tel: {addr.mobileNo}</p>}
                        <div className="flex gap-2 mt-2">
                          {!addr.isDefault && (
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="text-xs h-7 px-2"
                              onClick={() => handleSetDefault(addr.id)}
                            >
                              Set Default
                            </Button>
                          )}
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-xs h-7 px-2 text-destructive hover:text-destructive"
                            onClick={() => handleDeleteAddress(addr.id)}
                          >
                            <Trash2 size={12} />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <Dialog open={showAddAddress} onOpenChange={setShowAddAddress}>
                  <DialogContent className="rounded-none max-w-md">
                    <DialogHeader>
                      <DialogTitle className="font-serif">Add New Address</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-4">
                      <div className="space-y-2">
                        <Label className="text-xs uppercase tracking-widest font-bold">Label *</Label>
                        <Input
                          placeholder="e.g., Home, Office, etc."
                          value={newAddress.label}
                          onChange={(e) => setNewAddress({ ...newAddress, label: e.target.value })}
                          className="rounded-none"
                          data-testid="input-address-label"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs uppercase tracking-widest font-bold">Full Name *</Label>
                        <Input
                          placeholder="Recipient's full name"
                          value={newAddress.fullName}
                          onChange={(e) => setNewAddress({ ...newAddress, fullName: e.target.value })}
                          className="rounded-none"
                          data-testid="input-address-fullname"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs uppercase tracking-widest font-bold">Street Address *</Label>
                        <Input
                          placeholder="House/Apt no., Street name"
                          value={newAddress.streetAddress}
                          onChange={(e) => setNewAddress({ ...newAddress, streetAddress: e.target.value })}
                          className="rounded-none"
                          data-testid="input-address-street"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs uppercase tracking-widest font-bold">Address Line 2</Label>
                        <Input
                          placeholder="Building name, floor, etc. (optional)"
                          value={newAddress.addressLine2}
                          onChange={(e) => setNewAddress({ ...newAddress, addressLine2: e.target.value })}
                          className="rounded-none"
                          data-testid="input-address-line2"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-xs uppercase tracking-widest font-bold">City/Island *</Label>
                          <Input
                            placeholder="e.g., Male', Hulhumale'"
                            value={newAddress.cityIsland}
                            onChange={(e) => setNewAddress({ ...newAddress, cityIsland: e.target.value })}
                            className="rounded-none"
                            data-testid="input-address-city"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs uppercase tracking-widest font-bold">Zip Code</Label>
                          <Input
                            placeholder="Optional"
                            value={newAddress.zipCode}
                            onChange={(e) => setNewAddress({ ...newAddress, zipCode: e.target.value })}
                            className="rounded-none"
                            data-testid="input-address-zip"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs uppercase tracking-widest font-bold">Mobile No. *</Label>
                        <Input
                          placeholder="e.g., 7840001"
                          value={newAddress.mobileNo}
                          onChange={(e) => setNewAddress({ ...newAddress, mobileNo: e.target.value })}
                          className="rounded-none"
                          data-testid="input-address-mobile"
                        />
                      </div>
                      <Button 
                        onClick={handleAddAddress} 
                        className="w-full rounded-none text-xs uppercase tracking-widest"
                        data-testid="button-save-address"
                      >
                        Save Address
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </CardContent>
            </Card>
          </div>

          <Card className="rounded-none border-border mt-6">
            <CardHeader className="border-b border-border">
              <CardTitle className="flex items-center gap-2 text-sm uppercase tracking-widest font-bold">
                <Package size={16} /> Order History
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              {loadingOrders ? (
                <p className="text-muted-foreground text-sm">Loading orders...</p>
              ) : orders.length === 0 ? (
                <div className="text-center py-8">
                  <Package size={48} className="mx-auto text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground">No orders yet</p>
                  <Button 
                    variant="outline" 
                    className="mt-4 rounded-none text-xs uppercase tracking-widest"
                    onClick={() => setLocation("/shop")}
                  >
                    Start Shopping
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {orders.map((order) => (
                    <div key={order.id} className="p-4 border border-border">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold">{order.orderNumber}</span>
                            <span className={`text-[10px] uppercase font-bold px-2 py-0.5 ${getStatusColor(order.status)}`}>
                              {order.status.replace("_", " ")}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {order.items.length} item(s) • {formatCurrency(order.total)}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="rounded-none text-xs gap-1"
                            onClick={() => setLocation(`/track?id=${order.orderNumber}`)}
                            data-testid={`button-track-${order.id}`}
                          >
                            <Eye size={12} /> Track
                          </Button>
                        </div>
                      </div>
                      <div className="mt-3 pt-3 border-t border-border/50">
                        <div className="flex flex-wrap gap-2">
                          {order.items.slice(0, 3).map((item, i) => (
                            <span key={i} className="text-xs bg-secondary/50 px-2 py-1">
                              {item.name} x{item.qty}
                            </span>
                          ))}
                          {order.items.length > 3 && (
                            <span className="text-xs text-muted-foreground">+{order.items.length - 3} more</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="pt-6 border-t border-border mt-6">
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
      </main>
      <Footer />
    </div>
  );
}
