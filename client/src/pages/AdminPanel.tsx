import { useState, useEffect } from "react";
import { useAdminAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { api, Coupon, Order, Admin } from "@/lib/api";
import { Product, formatCurrency } from "@/lib/products";
import { 
  LayoutDashboard, 
  ShoppingBag, 
  Tag, 
  Settings, 
  Package, 
  Plus, 
  Edit, 
  Trash2,
  Eye,
  ChevronDown,
  Upload,
  CheckCircle,
  Image,
  Menu,
  X
} from "lucide-react";
import { useUpload } from "@/hooks/use-upload";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem,
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
import { cn } from "@/lib/utils";

export default function AdminPanel() {
  const { admin: user, adminLogin: login, adminLogout: logout, isAdminAuthenticated } = useAdminAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("Products");
  const [isLoading, setIsLoading] = useState(false);
  
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [admins, setAdmins] = useState<Admin[]>([]);
  
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isProductDialogOpen, setIsProductDialogOpen] = useState(false);
  
  const [newCouponCode, setNewCouponCode] = useState("");
  const [newCouponDiscount, setNewCouponDiscount] = useState("");
  const [newCouponType, setNewCouponType] = useState("percentage");
  
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [newAdminPassword, setNewAdminPassword] = useState("");
  const [newAdminName, setNewAdminName] = useState("");

  const [productForm, setProductForm] = useState({
    name: "",
    price: "",
    category: "",
    description: "",
    image: "https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?auto=format&fit=crop&q=80",
    colors: "",
    variants: [{ size: "", price: "" }]
  });

  const orderStatuses = [
    "pending",
    "confirmed",
    "payment_verification",
    "processing",
    "shipped",
    "in_transit",
    "out_for_delivery",
    "delivered",
    "delivery_exception",
    "cancelled",
    "refunded"
  ];

  useEffect(() => {
    if (user?.role === "admin") {
      loadData();
    }
  }, [user]);

  const loadData = async () => {
    try {
      const [productsData, ordersData, couponsData, adminsData] = await Promise.all([
        api.getProducts(),
        api.getOrders(),
        api.getCoupons(),
        api.getAdmins()
      ]);
      setProducts(productsData);
      setOrders(ordersData);
      setCoupons(couponsData);
      setAdmins(adminsData);
    } catch (error) {
      console.error("Failed to load data:", error);
    }
  };

  const handleLogin = async () => {
    setIsLoading(true);
    setError("");
    const success = await login(email, password);
    if (!success) {
      setError("Invalid credentials");
    }
    setIsLoading(false);
  };

  const handleSaveProduct = async () => {
    const formattedProduct = {
      name: productForm.name,
      price: productForm.variants.length > 0 && productForm.variants[0].price 
        ? Number(productForm.variants[0].price) 
        : Number(productForm.price),
      category: productForm.category,
      description: productForm.description,
      image: productForm.image,
      colors: productForm.colors.split(",").map(c => c.trim()).filter(Boolean),
      variants: productForm.variants.filter(v => v.size && v.price).map(v => ({
        size: v.size.trim(),
        price: Number(v.price)
      }))
    };

    try {
      if (editingProduct) {
        await api.updateProduct(editingProduct.id, formattedProduct);
      } else {
        await api.createProduct(formattedProduct);
      }
      await loadData();
      setIsProductDialogOpen(false);
      setEditingProduct(null);
      resetProductForm();
    } catch (error) {
      console.error("Failed to save product:", error);
    }
  };

  const resetProductForm = () => {
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

  const handleEditProduct = (product: Product) => {
    setEditingProduct(product);
    setProductForm({
      name: product.name,
      price: product.price.toString(),
      category: product.category,
      description: product.description || "",
      image: product.image,
      colors: (product.colors || []).join(", "),
      variants: product.variants && product.variants.length > 0 
        ? product.variants.map(v => ({ size: v.size, price: v.price.toString() }))
        : [{ size: "", price: product.price.toString() }]
    });
    setIsProductDialogOpen(true);
  };

  const deleteProduct = async (id: string) => {
    try {
      await api.deleteProduct(id);
      await loadData();
    } catch (error) {
      console.error("Failed to delete product:", error);
    }
  };

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    try {
      await api.updateOrderStatus(orderId, newStatus);
      await loadData();
    } catch (error) {
      console.error("Failed to update order status:", error);
    }
  };

  const handleAddCoupon = async () => {
    if (!newCouponCode || !newCouponDiscount) return;
    try {
      await api.createCoupon({
        code: newCouponCode.toUpperCase(),
        discount: Number(newCouponDiscount),
        type: newCouponType,
        status: "active"
      });
      await loadData();
      setNewCouponCode("");
      setNewCouponDiscount("");
    } catch (error) {
      console.error("Failed to add coupon:", error);
    }
  };

  const handleDeleteCoupon = async (id: string) => {
    try {
      await api.deleteCoupon(id);
      await loadData();
    } catch (error) {
      console.error("Failed to delete coupon:", error);
    }
  };

  const handleAddAdmin = async () => {
    if (!newAdminEmail || !newAdminPassword || !newAdminName) return;
    try {
      await api.createAdmin({
        name: newAdminName,
        email: newAdminEmail,
        password: newAdminPassword
      });
      await loadData();
      setNewAdminEmail("");
      setNewAdminPassword("");
      setNewAdminName("");
    } catch (error) {
      console.error("Failed to add admin:", error);
    }
  };

  if (!isAdminAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md rounded-none shadow-none border-border">
          <div className="p-6 text-center">
            <h1 className="text-2xl font-serif mb-2">Admin Login</h1>
            <p className="text-sm text-muted-foreground mb-6">Secure access required</p>
          </div>
          <CardContent className="space-y-4">
            <div className="space-y-4">
              <Input 
                type="email" 
                placeholder="Email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="rounded-none h-12"
                data-testid="input-admin-email"
              />
              <Input 
                type="password" 
                placeholder="Password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="rounded-none h-12"
                data-testid="input-admin-password"
              />
              {error && <p className="text-xs text-destructive">{error}</p>}
            </div>
            <Button 
              className="w-full h-12 rounded-none uppercase tracking-widest font-bold"
              onClick={handleLogin}
              disabled={isLoading}
              data-testid="button-admin-login"
            >
              {isLoading ? "Signing In..." : "Sign In"}
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

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-background border-b border-border px-4 py-3 flex items-center justify-between">
        <h1 className="font-serif text-lg">INFINITE HOME</h1>
        <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-2">
          {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-40 bg-background pt-16">
          <div className="p-4 space-y-2">
            {menuItems.map((item) => (
              <button
                key={item.label}
                onClick={() => { setActiveTab(item.label); setMobileMenuOpen(false); }}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors",
                  activeTab === item.label ? "bg-primary text-primary-foreground" : "hover:bg-secondary/20"
                )}
              >
                <item.icon size={18} />
                {item.label}
              </button>
            ))}
            <div className="pt-4 border-t border-border mt-4">
              <Button 
                variant="ghost" 
                className="w-full justify-start text-destructive hover:text-destructive gap-3"
                onClick={logout}
              >
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="flex h-screen md:pt-0 pt-14">
        {/* Sidebar - Desktop only */}
        <aside className="w-64 border-r border-border bg-secondary/10 p-4 space-y-2 hidden md:block">
          <div className="px-4 py-6 mb-4">
            <h1 className="font-serif text-xl">INFINITE HOME</h1>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground mt-2">Control Panel</p>
          </div>
          {menuItems.map((item) => (
            <button
              key={item.label}
              onClick={() => setActiveTab(item.label)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-2 text-sm font-medium transition-colors",
                activeTab === item.label ? "bg-primary text-primary-foreground" : "hover:bg-secondary/20"
              )}
              data-testid={`tab-${item.label.toLowerCase().replace(' ', '-')}`}
            >
              <item.icon size={18} />
              {item.label}
            </button>
          ))}
          <div className="pt-8">
            <Button variant="outline" className="w-full rounded-none" onClick={() => { logout(); setLocation("/"); }}>
              Sign Out
            </Button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-8">
          {activeTab === "Overview" && (
            <div className="animate-in fade-in duration-500">
              <h1 className="text-3xl font-serif mb-8">Dashboard Overview</h1>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <Card className="rounded-none">
                  <CardContent className="p-6">
                    <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Products</p>
                    <p className="text-3xl font-bold">{products.length}</p>
                  </CardContent>
                </Card>
                <Card className="rounded-none">
                  <CardContent className="p-6">
                    <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Orders</p>
                    <p className="text-3xl font-bold">{orders.length}</p>
                  </CardContent>
                </Card>
                <Card className="rounded-none">
                  <CardContent className="p-6">
                    <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Active Coupons</p>
                    <p className="text-3xl font-bold">{coupons.filter(c => c.status === "active").length}</p>
                  </CardContent>
                </Card>
                <Card className="rounded-none">
                  <CardContent className="p-6">
                    <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Revenue</p>
                    <p className="text-3xl font-bold">{formatCurrency(orders.reduce((sum, o) => sum + o.total, 0))}</p>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

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
                      onClick={() => { setEditingProduct(null); resetProductForm(); }}
                      data-testid="button-add-product"
                    >
                      <Plus className="mr-2" size={18} /> Add Product
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md rounded-none max-h-[90vh] overflow-y-auto">
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
                          <Label className="text-xs uppercase tracking-widest font-bold">Base Price (MVR)</Label>
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
                            placeholder="Bedding, Furniture, Appliances"
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
                        <Label className="text-xs uppercase tracking-widest font-bold">Product Image</Label>
                        <ProductImageUploader
                          currentImage={productForm.image}
                          onImageUploaded={(path) => setProductForm({...productForm, image: path})}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs uppercase tracking-widest font-bold">Colors (comma separated)</Label>
                        <Input 
                          placeholder="White, Oat, Charcoal"
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
                            <div className="flex-1">
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
                            <div className="flex-1">
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
                          <img src={product.image} className="w-12 h-16 object-cover bg-secondary/20" alt={product.name} />
                          <div>
                            <h4 className="font-medium">{product.name}</h4>
                            <p className="text-xs text-muted-foreground uppercase tracking-wider">{product.category} — {formatCurrency(product.price)}</p>
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
                    {products.length === 0 && (
                      <div className="p-8 text-center text-muted-foreground">No products found. Add your first product!</div>
                    )}
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
                            <span className="font-bold">{order.orderNumber}</span>
                            <span className={cn(
                              "text-[10px] uppercase font-bold px-2 py-0.5 border",
                              order.status === "payment_verification" ? "bg-amber-100 text-amber-700 border-amber-200" : 
                              order.status === "delivered" ? "bg-green-100 text-green-700 border-green-200" :
                              order.status === "cancelled" || order.status === "delivery_exception" ? "bg-red-100 text-red-700 border-red-200" :
                              order.status === "in_transit" ? "bg-indigo-100 text-indigo-700 border-indigo-200" :
                              order.status === "out_for_delivery" ? "bg-blue-100 text-blue-700 border-blue-200" :
                              order.status === "shipped" ? "bg-cyan-100 text-cyan-700 border-cyan-200" :
                              order.status === "confirmed" ? "bg-emerald-100 text-emerald-700 border-emerald-200" :
                              order.status === "pending" ? "bg-gray-100 text-gray-700 border-gray-200" :
                              "bg-blue-100 text-blue-700 border-blue-200"
                            )}>
                              {order.status.replace("_", " ")}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground">{order.customerName} — {order.customerPhone}</p>
                          <p className="text-sm font-medium">{formatCurrency(order.total)} via {order.paymentMethod.toUpperCase()}</p>
                        </div>
                        <div className="flex items-center gap-4">
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
                            <DialogContent className="max-w-2xl rounded-none">
                              <DialogHeader>
                                <DialogTitle className="font-serif text-2xl">Order: {selectedOrder?.orderNumber}</DialogTitle>
                                <DialogDescription className="uppercase tracking-widest text-[10px] font-bold">
                                  Status: {selectedOrder?.status.replace("_", " ")}
                                </DialogDescription>
                              </DialogHeader>
                              {selectedOrder && (
                                <div className="grid md:grid-cols-2 gap-8 py-4">
                                  <div className="space-y-4">
                                    <div>
                                      <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Customer</p>
                                      <p className="font-medium">{selectedOrder.customerName}</p>
                                      <p className="text-sm text-muted-foreground">{selectedOrder.customerEmail}</p>
                                      <p className="text-sm text-muted-foreground">{selectedOrder.customerPhone}</p>
                                    </div>
                                    <div>
                                      <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Shipping Address</p>
                                      <p className="text-sm">{selectedOrder.shippingAddress}</p>
                                    </div>
                                    <div>
                                      <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Payment Method</p>
                                      <p className="font-medium">{selectedOrder.paymentMethod === "cod" ? "Cash on Delivery" : "Bank Transfer"}</p>
                                    </div>
                                  </div>
                                  <div className="space-y-4">
                                    <div>
                                      <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Items</p>
                                      <div className="space-y-2">
                                        {selectedOrder.items.map((item: any, i: number) => (
                                          <div key={i} className="flex justify-between text-sm">
                                            <span>{item.name} x {item.qty}</span>
                                            <span>{formatCurrency(item.price * item.qty)}</span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                    <div className="border-t pt-4 space-y-1">
                                      <div className="flex justify-between text-sm">
                                        <span>Subtotal</span>
                                        <span>{formatCurrency(selectedOrder.subtotal)}</span>
                                      </div>
                                      {selectedOrder.discount > 0 && (
                                        <div className="flex justify-between text-sm text-green-600">
                                          <span>Discount</span>
                                          <span>-{formatCurrency(selectedOrder.discount)}</span>
                                        </div>
                                      )}
                                      <div className="flex justify-between text-sm">
                                        <span>Shipping</span>
                                        <span>{selectedOrder.shipping === 0 ? "FREE" : formatCurrency(selectedOrder.shipping)}</span>
                                      </div>
                                      <div className="flex justify-between font-bold pt-2">
                                        <span>Total</span>
                                        <span>{formatCurrency(selectedOrder.total)}</span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </DialogContent>
                          </Dialog>
                        </div>
                      </div>
                    ))}
                    {orders.length === 0 && (
                      <div className="p-8 text-center text-muted-foreground">No orders yet.</div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === "Coupons" && (
            <div className="animate-in fade-in duration-500">
              <div className="mb-8">
                <h1 className="text-3xl font-serif">Coupons</h1>
                <p className="text-muted-foreground">Manage discount codes</p>
              </div>

              <Card className="rounded-none border-border shadow-none mb-8">
                <CardContent className="p-6">
                  <h3 className="font-bold mb-4 uppercase tracking-widest text-xs">Add New Coupon</h3>
                  <div className="flex flex-wrap gap-4">
                    <Input 
                      placeholder="Code" 
                      value={newCouponCode}
                      onChange={(e) => setNewCouponCode(e.target.value)}
                      className="rounded-none w-32"
                    />
                    <Input 
                      type="number"
                      placeholder="Discount" 
                      value={newCouponDiscount}
                      onChange={(e) => setNewCouponDiscount(e.target.value)}
                      className="rounded-none w-24"
                    />
                    <select 
                      value={newCouponType}
                      onChange={(e) => setNewCouponType(e.target.value)}
                      className="border px-3 py-2 text-sm rounded-none"
                    >
                      <option value="percentage">Percentage (%)</option>
                      <option value="flat">Flat (MVR)</option>
                    </select>
                    <Button onClick={handleAddCoupon} className="rounded-none">
                      <Plus size={14} className="mr-2" /> Add Coupon
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-none border-border shadow-none">
                <CardContent className="p-0">
                  <div className="divide-y divide-border">
                    {coupons.map((coupon) => (
                      <div key={coupon.id} className="p-4 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <span className="font-mono font-bold text-lg">{coupon.code}</span>
                          <span className="text-sm text-muted-foreground">
                            {coupon.type === "percentage" ? `${coupon.discount}% off` : `MVR ${coupon.discount} off`}
                          </span>
                          <span className={cn(
                            "text-[10px] uppercase font-bold px-2 py-0.5",
                            coupon.status === "active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"
                          )}>
                            {coupon.status}
                          </span>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-destructive"
                          onClick={() => handleDeleteCoupon(coupon.id)}
                        >
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    ))}
                    {coupons.length === 0 && (
                      <div className="p-8 text-center text-muted-foreground">No coupons found.</div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === "Admin Management" && (
            <div className="animate-in fade-in duration-500">
              <div className="mb-8">
                <h1 className="text-3xl font-serif">Admin Management</h1>
                <p className="text-muted-foreground">Manage administrative users</p>
              </div>

              <Card className="rounded-none border-border shadow-none mb-8">
                <CardContent className="p-6">
                  <h3 className="font-bold mb-4 uppercase tracking-widest text-xs">Add New Admin</h3>
                  <div className="flex flex-wrap gap-4">
                    <Input 
                      placeholder="Name" 
                      value={newAdminName}
                      onChange={(e) => setNewAdminName(e.target.value)}
                      className="rounded-none flex-1 min-w-[150px]"
                    />
                    <Input 
                      type="email"
                      placeholder="Email" 
                      value={newAdminEmail}
                      onChange={(e) => setNewAdminEmail(e.target.value)}
                      className="rounded-none flex-1 min-w-[200px]"
                    />
                    <Input 
                      type="password"
                      placeholder="Password" 
                      value={newAdminPassword}
                      onChange={(e) => setNewAdminPassword(e.target.value)}
                      className="rounded-none flex-1 min-w-[150px]"
                    />
                    <Button onClick={handleAddAdmin} className="rounded-none">
                      <Plus size={14} className="mr-2" /> Add Admin
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-none border-border shadow-none">
                <CardContent className="p-0">
                  <div className="divide-y divide-border">
                    {admins.map((admin) => (
                      <div key={admin.id} className="p-4 flex items-center justify-between">
                        <div>
                          <p className="font-medium">{admin.name}</p>
                          <p className="text-sm text-muted-foreground">{admin.email}</p>
                        </div>
                      </div>
                    ))}
                    {admins.length === 0 && (
                      <div className="p-8 text-center text-muted-foreground">No admins found.</div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function ProductImageUploader({ 
  currentImage, 
  onImageUploaded 
}: { 
  currentImage: string; 
  onImageUploaded: (path: string) => void;
}) {
  const { uploadFile, isUploading } = useUpload({
    onSuccess: (response) => {
      onImageUploaded(response.objectPath);
    },
  });

  return (
    <div className="space-y-2">
      <label className="block">
        <input
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) uploadFile(file);
          }}
          disabled={isUploading}
        />
        <div className={`flex items-center justify-center gap-2 p-4 border-2 border-dashed cursor-pointer hover:bg-secondary/30 transition-colors ${currentImage ? 'border-green-500' : 'border-border'}`}>
          {isUploading ? (
            <span className="text-sm">Uploading...</span>
          ) : currentImage ? (
            <div className="flex items-center gap-2">
              <CheckCircle size={16} className="text-green-600" />
              <span className="text-sm text-green-700">Image uploaded</span>
            </div>
          ) : (
            <>
              <Upload size={20} />
              <span className="text-sm">Click to upload product image</span>
            </>
          )}
        </div>
      </label>
      {currentImage && (
        <div className="mt-2">
          <img 
            src={currentImage} 
            alt="Product preview" 
            className="h-24 w-24 object-cover border border-border"
          />
        </div>
      )}
    </div>
  );
}
