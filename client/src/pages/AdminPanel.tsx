import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { LayoutDashboard, ShoppingBag, Tag, Settings, Package, Plus, Edit, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { products } from "@/lib/products";
import { cn } from "@/lib/utils";

export default function AdminPanel() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  if (!user || user.role !== "admin") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-serif mb-4">Access Denied</h1>
          <Button onClick={() => setLocation("/")}>Go Home</Button>
        </div>
      </div>
    );
  }

  const menuItems = [
    { icon: LayoutDashboard, label: "Overview", active: true },
    { icon: ShoppingBag, label: "Products" },
    { icon: Package, label: "Orders" },
    { icon: Tag, label: "Coupons" },
    { icon: Settings, label: "Settings" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="pt-24 flex h-[calc(100vh-64px)]">
        {/* Sidebar */}
        <aside className="w-64 border-r border-border bg-secondary/10 p-4 space-y-2 hidden md:block">
          {menuItems.map((item) => (
            <button
              key={item.label}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-2 text-sm font-medium transition-colors",
                item.active ? "bg-primary text-primary-foreground" : "hover:bg-secondary/20"
              )}
            >
              <item.icon size={18} />
              {item.label}
            </button>
          ))}
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-8">
          <div className="flex justify-between items-end mb-8">
            <div>
              <h1 className="text-3xl font-serif">Product Management</h1>
              <p className="text-muted-foreground">Add and manage your inventory</p>
            </div>
            <Button className="rounded-none uppercase tracking-widest font-bold">
              <Plus className="mr-2" size={18} /> Add Product
            </Button>
          </div>

          <div className="grid gap-6">
            <Card className="rounded-none border-border shadow-none">
              <CardHeader className="bg-secondary/10 border-b border-border">
                <CardTitle className="text-sm uppercase tracking-widest">Active Inventory</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-border">
                  {products.map((product) => (
                    <div key={product.id} className="p-4 flex items-center justify-between hover:bg-secondary/5 transition-colors">
                      <div className="flex items-center gap-4">
                        <img src={product.image} className="w-12 h-16 object-cover bg-secondary/20" />
                        <div>
                          <h4 className="font-medium">{product.name}</h4>
                          <p className="text-xs text-muted-foreground uppercase tracking-wider">{product.category}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="icon" className="h-8 w-8"><Edit size={14} /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive"><Trash2 size={14} /></Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}
