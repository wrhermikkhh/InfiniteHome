import { useState } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { 
  LayoutDashboard, 
  ShoppingBag, 
  Tag, 
  Settings, 
  Package, 
  Plus, 
  Edit, 
  Trash2,
  CheckCircle2,
  Clock,
  AlertCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { products as initialProducts } from "@/lib/products";
import { cn } from "@/lib/utils";

export default function AdminPanel() {
  const { user, login, admins, addAdmin } = useAuth();
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("Products");
  const [products, setProducts] = useState(initialProducts);

  // New Admin Form State
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [newAdminPassword, setNewAdminPassword] = useState("");
  const [newAdminName, setNewAdminName] = useState("");

  // Simulated Orders
  const [orders, setOrders] = useState([
    { id: "IH-12345", customer: "Ahmed", date: "Jan 18, 2026", total: 4500, status: "processing", payment: "cod" },
    { id: "IH-12346", customer: "Mariyam", date: "Jan 19, 2026", total: 1200, status: "payment_verification", payment: "bank" },
  ]);

  if (!user || user.role !== "admin") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md rounded-none shadow-none border-border">
          <CardHeader className="text-center">
            <h1 className="text-2xl font-serif">Admin Login</h1>
            <p className="text-sm text-muted-foreground">Secure access required</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Input 
                  type="email" 
                  placeholder="Email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="rounded-none h-12"
                />
              </div>
              <div className="space-y-2">
                <Input 
                  type="password" 
                  placeholder="Password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="rounded-none h-12"
                />
              </div>
              {error && <p className="text-xs text-destructive">{error}</p>}
            </div>
            <Button 
              className="w-full h-12 rounded-none uppercase tracking-widest font-bold"
              onClick={() => {
                if (login(email, password)) {
                  setError("");
                } else {
                  setError("Invalid credentials");
                }
              }}
            >
              Sign In
            </Button>
            <Button variant="link" className="w-full text-xs text-muted-foreground" onClick={() => setLocation("/")}>
              Back to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const menuItems = [
    { icon: LayoutDashboard, label: "Overview" },
    { icon: ShoppingBag, label: "Products" },
    { icon: Package, label: "Orders" },
    { icon: Tag, label: "Coupons" },
    { icon: Settings, label: "Admin Management" },
  ];

  const updateOrderStatus = (orderId: string, newStatus: string) => {
    setOrders(orders.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
  };

  const deleteProduct = (id: string) => {
    setProducts(products.filter(p => p.id !== id));
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="pt-24 flex h-[calc(100vh-64px)]">
        {/* Sidebar */}
        <aside className="w-64 border-r border-border bg-secondary/10 p-4 space-y-2 hidden md:block">
          <div className="px-4 py-6 mb-4">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">Control Panel</p>
          </div>
          {menuItems.map((item) => (
            <button
              key={item.label}
              onClick={() => setActiveTab(item.label)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-2 text-sm font-medium transition-colors",
                activeTab === item.label ? "bg-primary text-primary-foreground" : "hover:bg-secondary/20"
              )}
            >
              <item.icon size={18} />
              {item.label}
            </button>
          ))}
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-8">
          {activeTab === "Products" && (
            <div className="animate-in fade-in duration-500">
              <div className="flex justify-between items-end mb-8">
                <div>
                  <h1 className="text-3xl font-serif">Products</h1>
                  <p className="text-muted-foreground">Manage your storefront inventory</p>
                </div>
                <Button className="rounded-none uppercase tracking-widest font-bold">
                  <Plus className="mr-2" size={18} /> Add Product
                </Button>
              </div>

              <Card className="rounded-none border-border shadow-none">
                <CardContent className="p-0">
                  <div className="divide-y divide-border">
                    {products.map((product) => (
                      <div key={product.id} className="p-4 flex items-center justify-between hover:bg-secondary/5 transition-colors">
                        <div className="flex items-center gap-4">
                          <img src={product.image} className="w-12 h-16 object-cover bg-secondary/20" />
                          <div>
                            <h4 className="font-medium">{product.name}</h4>
                            <p className="text-xs text-muted-foreground uppercase tracking-wider">{product.category} — MVR {product.price}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button variant="ghost" size="icon" className="h-8 w-8"><Edit size={14} /></Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-destructive"
                            onClick={() => deleteProduct(product.id)}
                          >
                            <Trash2 size={14} />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === "Orders" && (
            <div className="animate-in fade-in duration-500">
              <div className="mb-8">
                <h1 className="text-3xl font-serif">Orders</h1>
                <p className="text-muted-foreground">Track and fulfill customer orders</p>
              </div>

              <Card className="rounded-none border-border shadow-none">
                <CardContent className="p-0">
                  <div className="divide-y divide-border">
                    {orders.map((order) => (
                      <div key={order.id} className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold">{order.id}</span>
                            <span className={cn(
                              "text-[10px] uppercase font-bold px-2 py-0.5 border",
                              order.status === "payment_verification" ? "bg-amber-100 text-amber-700 border-amber-200" : 
                              order.status === "delivered" ? "bg-green-100 text-green-700 border-green-200" :
                              "bg-blue-100 text-blue-700 border-blue-200"
                            )}>
                              {order.status.replace("_", " ")}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground">{order.customer} — {order.date}</p>
                          <p className="text-sm font-medium">MVR {order.total} via {order.payment.toUpperCase()}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex flex-col gap-2">
                            <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Update Status</p>
                            <div className="flex gap-2">
                              {order.status === "payment_verification" && (
                                <Button 
                                  size="sm" 
                                  variant="outline" 
                                  className="rounded-none text-xs border-green-200 text-green-700 hover:bg-green-50"
                                  onClick={() => updateOrderStatus(order.id, "processing")}
                                >
                                  Verify Payment
                                </Button>
                              )}
                              {order.status === "processing" && (
                                <Button 
                                  size="sm" 
                                  variant="outline" 
                                  className="rounded-none text-xs border-blue-200 text-blue-700 hover:bg-blue-50"
                                  onClick={() => updateOrderStatus(order.id, "shipped")}
                                >
                                  Mark Shipped
                                </Button>
                              )}
                              {order.status === "shipped" && (
                                <Button 
                                  size="sm" 
                                  variant="outline" 
                                  className="rounded-none text-xs border-green-200 text-green-700 hover:bg-green-50"
                                  onClick={() => updateOrderStatus(order.id, "delivered")}
                                >
                                  Mark Delivered
                                </Button>
                              )}
                              <Button size="sm" variant="ghost" className="rounded-none text-xs">View Details</Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === "Admin Management" && (
            <div className="animate-in fade-in duration-500 max-w-2xl">
              <div className="mb-8">
                <h1 className="text-3xl font-serif">Admin Management</h1>
                <p className="text-muted-foreground">Add and manage administrative users</p>
              </div>

              <Card className="rounded-none border-border shadow-none mb-8">
                <CardHeader>
                  <CardTitle className="text-sm uppercase tracking-widest">Add New Admin</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs uppercase tracking-widest font-bold">Name</Label>
                      <Input 
                        placeholder="Admin Name" 
                        value={newAdminName}
                        onChange={(e) => setNewAdminName(e.target.value)}
                        className="rounded-none"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs uppercase tracking-widest font-bold">Email</Label>
                      <Input 
                        placeholder="admin@example.com" 
                        value={newAdminEmail}
                        onChange={(e) => setNewAdminEmail(e.target.value)}
                        className="rounded-none"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs uppercase tracking-widest font-bold">Password</Label>
                    <Input 
                      type="password"
                      placeholder="Secure Password" 
                      value={newAdminPassword}
                      onChange={(e) => setNewAdminPassword(e.target.value)}
                      className="rounded-none"
                    />
                  </div>
                  <Button 
                    className="w-full rounded-none"
                    onClick={() => {
                      if (newAdminEmail && newAdminPassword && newAdminName) {
                        addAdmin(newAdminEmail, newAdminPassword, newAdminName);
                        setNewAdminEmail("");
                        setNewAdminPassword("");
                        setNewAdminName("");
                      }
                    }}
                  >
                    Add Administrator
                  </Button>
                </CardContent>
              </Card>

              <Card className="rounded-none border-border shadow-none">
                <CardHeader>
                  <CardTitle className="text-sm uppercase tracking-widest">Active Administrators</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y divide-border">
                    {admins.map((admin) => (
                      <div key={admin.email} className="p-4 flex items-center justify-between">
                        <div>
                          <p className="font-medium">{admin.name}</p>
                          <p className="text-xs text-muted-foreground">{admin.email}</p>
                        </div>
                        <div className="text-[10px] uppercase font-bold text-muted-foreground bg-secondary/20 px-2 py-1">
                          Active
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {(activeTab === "Overview" || activeTab === "Coupons") && (
            <div className="h-64 flex flex-col items-center justify-center text-muted-foreground animate-in fade-in duration-500">
              <LayoutDashboard size={48} className="mb-4 opacity-10" />
              <p>{activeTab} module is coming soon in the full implementation.</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
