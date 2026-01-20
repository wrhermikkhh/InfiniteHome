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
  AlertCircle,
  Eye,
  FileText,
  ChevronDown
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from "@/components/ui/dialog";
import { products as initialProducts } from "@/lib/products";
import { cn } from "@/lib/utils";
import paymentSlip from "@assets/generated_images/bank_transfer_payment_slip_mockup.png";

export default function AdminPanel() {
  const { user, login, admins, addAdmin } = useAuth();
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("Products");
  const [products, setProducts] = useState(initialProducts);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [isProductDialogOpen, setIsProductDialogOpen] = useState(false);

  // Coupons State
  const [coupons, setCoupons] = useState([
    { code: "WELCOME10", discount: 10, type: "percentage", status: "active" },
    { code: "INFINITE20", discount: 20, type: "percentage", status: "active" },
    { code: "FLAT50", discount: 50, type: "flat", status: "active" },
  ]);
  const [newCouponCode, setNewCouponCode] = useState("");
  const [newCouponDiscount, setNewCouponDiscount] = useState("");
  const [newCouponType, setNewCouponType] = useState("percentage");

  // Product Form State
  const [productForm, setProductForm] = useState({
    name: "",
    price: "",
    category: "",
    description: "",
    image: "https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?auto=format&fit=crop&q=80",
    colors: "",
    variants: [{ size: "", price: "" }]
  });

  const handleSaveProduct = () => {
    const formattedProduct = {
      ...productForm,
      price: productForm.variants.length > 0 ? Number(productForm.variants[0].price) : Number(productForm.price),
      colors: productForm.colors.split(",").map(c => c.trim()).filter(Boolean),
      variants: productForm.variants.filter(v => v.size && v.price).map(v => ({
        size: v.size.trim(),
        price: Number(v.price)
      }))
    };

    if (editingProduct) {
      setProducts(products.map(p => p.id === editingProduct.id ? { ...p, ...formattedProduct } : p));
    } else {
      const newProduct = {
        ...formattedProduct,
        id: (products.length + 1).toString(),
        rating: 5,
        reviews: 0
      };
      setProducts([...products, newProduct]);
    }
    setIsProductDialogOpen(false);
    setEditingProduct(null);
    setProductForm({ 
      name: "", 
      price: "", 
      category: "", 
      description: "", 
      image: "https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?auto=format&fit=crop&q=80", 
      colors: "", 
      variants: [{ size: "", price: "" }] 
    });
  };

  const handleEditProduct = (product: any) => {
    setEditingProduct(product);
    setProductForm({
      name: product.name,
      price: product.price.toString(),
      category: product.category,
      description: product.description || "",
      image: product.image,
      colors: (product.colors || []).join(", "),
      variants: product.variants && product.variants.length > 0 
        ? product.variants.map((v: any) => ({ size: v.size, price: v.price.toString() }))
        : [{ size: "", price: product.price.toString() }]
    });
    setIsProductDialogOpen(true);
  };

  // New Admin Form State
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [newAdminPassword, setNewAdminPassword] = useState("");
  const [newAdminName, setNewAdminName] = useState("");

  // Simulated Orders
  const [orders, setOrders] = useState([
    { 
      id: "IH-12345", 
      customer: "Ahmed", 
      email: "ahmed@example.com",
      phone: "7771234",
      address: "H. Orchid, Male'",
      date: "Jan 18, 2026", 
      total: 4500, 
      status: "processing", 
      payment: "cod",
      items: [{ name: "Bamboo Sheet Set", qty: 1, price: 4500 }]
    },
    { 
      id: "IH-12346", 
      customer: "Mariyam", 
      email: "mariyam@example.com",
      phone: "7785678",
      address: "M. Rose, Male'",
      date: "Jan 19, 2026", 
      total: 1200, 
      status: "payment_verification", 
      payment: "bank",
      slip: paymentSlip,
      items: [{ name: "Premium Waffle Bath Towel", qty: 1, price: 1200 }]
    },
  ]);

  const orderStatuses = [
    "ordered",
    "payment_verification",
    "processing",
    "shipped",
    "delivered",
    "cancelled",
    "refunded"
  ];

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
                <Dialog open={isProductDialogOpen} onOpenChange={setIsProductDialogOpen}>
                  <DialogTrigger asChild>
                    <Button 
                      className="rounded-none uppercase tracking-widest font-bold"
                      onClick={() => {
                        setEditingProduct(null);
                        setProductForm({ name: "", price: "", category: "", description: "", image: "https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?auto=format&fit=crop&q=80" });
                      }}
                    >
                      <Plus className="mr-2" size={18} /> Add Product
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md rounded-none">
                    <DialogHeader>
                      <DialogTitle className="font-serif text-2xl">{editingProduct ? "Edit Product" : "Add New Product"}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label className="text-xs uppercase tracking-widest font-bold">Product Name</Label>
                        <Input 
                          value={productForm.name}
                          onChange={(e) => setProductForm({...productForm, name: e.target.value})}
                          className="rounded-none"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-xs uppercase tracking-widest font-bold">Price (MVR)</Label>
                          <Input 
                            type="number"
                            value={productForm.price}
                            onChange={(e) => setProductForm({...productForm, price: e.target.value})}
                            className="rounded-none"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs uppercase tracking-widest font-bold">Category</Label>
                          <Input 
                            value={productForm.category}
                            onChange={(e) => setProductForm({...productForm, category: e.target.value})}
                            className="rounded-none"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs uppercase tracking-widest font-bold">Description</Label>
                        <Input 
                          value={productForm.description}
                          onChange={(e) => setProductForm({...productForm, description: e.target.value})}
                          className="rounded-none"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs uppercase tracking-widest font-bold">Image URL</Label>
                        <Input 
                          value={productForm.image}
                          onChange={(e) => setProductForm({...productForm, image: e.target.value})}
                          className="rounded-none"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs uppercase tracking-widest font-bold">Colors (comma separated)</Label>
                        <Input 
                          placeholder="Cloud, Sand, Slate"
                          value={productForm.colors}
                          onChange={(e) => setProductForm({...productForm, colors: e.target.value})}
                          className="rounded-none"
                        />
                      </div>
                      <div className="space-y-4">
                        <div className="flex justify-between items-center">
                          <Label className="text-xs uppercase tracking-widest font-bold">Size Variations & Prices</Label>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="h-7 text-[10px] rounded-none uppercase tracking-widest"
                            onClick={() => setProductForm({
                              ...productForm, 
                              variants: [...productForm.variants, { size: "", price: "" }]
                            })}
                          >
                            <Plus size={12} className="mr-1" /> Add Size
                          </Button>
                        </div>
                        {productForm.variants.map((variant, index) => (
                          <div key={index} className="flex gap-2 items-end">
                            <div className="flex-1 space-y-1">
                              <Input 
                                placeholder="Size (e.g. Queen)" 
                                value={variant.size}
                                onChange={(e) => {
                                  const newVariants = [...productForm.variants];
                                  newVariants[index].size = e.target.value;
                                  setProductForm({...productForm, variants: newVariants});
                                }}
                                className="rounded-none h-9 text-xs"
                              />
                            </div>
                            <div className="flex-1 space-y-1">
                              <Input 
                                type="number"
                                placeholder="Price" 
                                value={variant.price}
                                onChange={(e) => {
                                  const newVariants = [...productForm.variants];
                                  newVariants[index].price = e.target.value;
                                  setProductForm({...productForm, variants: newVariants});
                                }}
                                className="rounded-none h-9 text-xs"
                              />
                            </div>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-9 w-9 text-destructive"
                              onClick={() => {
                                const newVariants = productForm.variants.filter((_, i) => i !== index);
                                setProductForm({...productForm, variants: newVariants.length > 0 ? newVariants : [{ size: "", price: "" }]});
                              }}
                            >
                              <Trash2 size={14} />
                            </Button>
                          </div>
                        ))}
                      </div>
                      <Button onClick={handleSaveProduct} className="w-full rounded-none">
                        {editingProduct ? "Update Product" : "Create Product"}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
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
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8"
                            onClick={() => handleEditProduct(product)}
                          >
                            <Edit size={14} />
                          </Button>
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
                <p className="text-muted-foreground">Manage and track customer orders</p>
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
                              order.status === "cancelled" ? "bg-red-100 text-red-700 border-red-200" :
                              "bg-blue-100 text-blue-700 border-blue-200"
                            )}>
                              {order.status.replace("_", " ")}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground">{order.customer} — {order.date}</p>
                          <p className="text-sm font-medium">MVR {order.total} via {order.payment.toUpperCase()}</p>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="flex flex-col gap-2">
                            <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Update Status</p>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm" className="rounded-none text-xs gap-2 min-w-[140px] justify-between">
                                  {order.status.replace("_", " ")}
                                  <ChevronDown size={14} />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent className="rounded-none">
                                {orderStatuses.map(status => (
                                  <DropdownMenuItem 
                                    key={status} 
                                    onClick={() => updateOrderStatus(order.id, status)}
                                    className="text-xs uppercase tracking-widest cursor-pointer"
                                  >
                                    {status.replace("_", " ")}
                                  </DropdownMenuItem>
                                ))}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>

                          <div className="h-12 w-px bg-border mx-2 hidden md:block" />

                          <Dialog>
                            <DialogTrigger asChild>
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className="rounded-none text-xs gap-2"
                                onClick={() => setSelectedOrder(order)}
                              >
                                <Eye size={14} /> Details
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-2xl rounded-none font-body">
                              <DialogHeader>
                                <DialogTitle className="font-serif text-2xl">Order Details: {selectedOrder?.id}</DialogTitle>
                                <DialogDescription className="uppercase tracking-widest text-[10px] font-bold">
                                  Placed on {selectedOrder?.date}
                                </DialogDescription>
                              </DialogHeader>
                              
                              <div className="grid md:grid-cols-2 gap-8 py-4">
                                <div className="space-y-6">
                                  <div>
                                    <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">Customer Info</h4>
                                    <p className="font-medium">{selectedOrder?.customer}</p>
                                    <p className="text-sm text-muted-foreground">{selectedOrder?.email}</p>
                                    <p className="text-sm text-muted-foreground">{selectedOrder?.phone}</p>
                                  </div>
                                  <div>
                                    <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">Shipping Address</h4>
                                    <p className="text-sm leading-relaxed">{selectedOrder?.address}</p>
                                  </div>
                                  <div>
                                    <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">Payment Info</h4>
                                    <p className="text-sm">Method: {selectedOrder?.payment.toUpperCase()}</p>
                                    <p className="text-sm font-bold">Total: MVR {selectedOrder?.total}</p>
                                  </div>
                                </div>

                                <div className="space-y-6">
                                  {selectedOrder?.slip && (
                                    <div>
                                      <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">Payment Slip</h4>
                                      <div className="aspect-[4/3] bg-secondary/20 overflow-hidden border border-border">
                                        <img src={selectedOrder.slip} alt="Payment Slip" className="w-full h-full object-cover" />
                                      </div>
                                      <Button variant="link" className="p-0 h-auto text-xs text-primary mt-2">
                                        <FileText size={12} className="mr-1" /> View Full Image
                                      </Button>
                                    </div>
                                  )}
                                  
                                  <div>
                                    <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">Items</h4>
                                    <div className="space-y-2">
                                      {selectedOrder?.items.map((item: any, i: number) => (
                                        <div key={i} className="flex justify-between text-sm">
                                          <span>{item.name} x {item.qty}</span>
                                          <span>MVR {item.price}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </DialogContent>
                          </Dialog>
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

          {activeTab === "Coupons" && (
            <div className="animate-in fade-in duration-500 max-w-2xl">
              <div className="mb-8">
                <h1 className="text-3xl font-serif">Coupons</h1>
                <p className="text-muted-foreground">Manage discount codes and promotions</p>
              </div>

              <Card className="rounded-none border-border shadow-none mb-8">
                <CardHeader>
                  <CardTitle className="text-sm uppercase tracking-widest">Create Coupon</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs uppercase tracking-widest font-bold">Coupon Code</Label>
                      <Input 
                        placeholder="SUMMER20" 
                        value={newCouponCode}
                        onChange={(e) => setNewCouponCode(e.target.value.toUpperCase())}
                        className="rounded-none"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs uppercase tracking-widest font-bold">Type</Label>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" className="w-full rounded-none justify-between h-10">
                            {newCouponType === "percentage" ? "Percentage (%)" : "Flat Amount (MVR)"}
                            <ChevronDown size={14} />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="rounded-none w-56">
                          <DropdownMenuItem onClick={() => setNewCouponType("percentage")}>Percentage (%)</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setNewCouponType("flat")}>Flat Amount (MVR)</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs uppercase tracking-widest font-bold">Discount Value</Label>
                    <Input 
                      type="number"
                      placeholder={newCouponType === "percentage" ? "20" : "100"} 
                      value={newCouponDiscount}
                      onChange={(e) => setNewCouponDiscount(e.target.value)}
                      className="rounded-none"
                    />
                  </div>
                  <Button 
                    className="w-full rounded-none"
                    onClick={() => {
                      if (newCouponCode && newCouponDiscount) {
                        setCoupons([...coupons, { code: newCouponCode, discount: Number(newCouponDiscount), type: newCouponType, status: "active" }]);
                        setNewCouponCode("");
                        setNewCouponDiscount("");
                      }
                    }}
                  >
                    Create Coupon
                  </Button>
                </CardContent>
              </Card>

              <Card className="rounded-none border-border shadow-none">
                <CardHeader>
                  <CardTitle className="text-sm uppercase tracking-widest">Active Coupons</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y divide-border">
                    {coupons.map((coupon) => (
                      <div key={coupon.code} className="p-4 flex items-center justify-between">
                        <div>
                          <p className="font-bold tracking-widest">{coupon.code}</p>
                          <p className="text-xs text-muted-foreground">
                            {coupon.type === "percentage" ? `${coupon.discount}% Off Entire Order` : `MVR ${coupon.discount} Off Entire Order`}
                          </p>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-[10px] uppercase font-bold text-green-700 bg-green-100 px-2 py-1">Active</span>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-destructive"
                            onClick={() => setCoupons(coupons.filter(c => c.code !== coupon.code))}
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

          {activeTab === "Overview" && (
            <div className="h-64 flex flex-col items-center justify-center text-muted-foreground animate-in fade-in duration-500">
              <LayoutDashboard size={48} className="mb-4 opacity-10" />
              <p>Overview module is coming soon in the full implementation.</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
