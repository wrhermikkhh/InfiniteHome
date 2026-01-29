import { useState, useEffect, useMemo, useRef } from "react";
import { useAdminAuth } from "@/lib/auth";
import { useUpload } from "@/hooks/use-upload";
import { useLocation } from "wouter";
import { api, Coupon, Order, Admin, Category } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area
} from "recharts";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  EyeOff,
  ChevronDown,
  Upload,
  CheckCircle,
  Image,
  Menu,
  X,
  Printer,
  TrendingUp,
  Users,
  DollarSign,
  ShoppingCart,
  ArrowUpRight,
  ArrowDownRight,
  Warehouse,
  AlertTriangle,
  Search,
  CreditCard,
  Receipt,
  Minus,
  Calculator,
  FileText
} from "lucide-react";
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

// Payment Slip Viewer - displays payment slip image
function PaymentSlipViewer({ paymentSlip }: { paymentSlip: string }) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [isLegacy, setIsLegacy] = useState(false);

  useEffect(() => {
    // If it's already a full Supabase URL, use it directly
    if (paymentSlip.startsWith('http')) {
      setImageUrl(paymentSlip);
      setLoading(false);
      return;
    }

    // Legacy Replit Object Storage paths - these files don't exist in Supabase
    if (paymentSlip.startsWith('/objects/')) {
      setIsLegacy(true);
      setLoading(false);
      return;
    }

    // For Supabase paths (uploads/...), fetch the URL from API
    api.getPaymentSlipUrl(paymentSlip)
      .then((res) => {
        setImageUrl(res.url);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, [paymentSlip]);

  if (loading) {
    return (
      <div className="w-full h-32 bg-secondary/30 flex items-center justify-center">
        <span className="text-xs text-muted-foreground">Loading payment slip...</span>
      </div>
    );
  }

  if (isLegacy) {
    return (
      <div className="w-full h-20 bg-amber-50 flex items-center justify-center border border-dashed border-amber-500/50 rounded">
        <span className="text-xs text-amber-700">Legacy upload - file was stored before Supabase migration</span>
      </div>
    );
  }

  if (error || !imageUrl) {
    return (
      <div className="w-full h-32 bg-secondary/30 flex items-center justify-center border border-dashed border-destructive/50">
        <span className="text-xs text-destructive">Failed to load payment slip</span>
      </div>
    );
  }

  return (
    <a 
      href={imageUrl} 
      target="_blank" 
      rel="noopener noreferrer"
      className="block"
    >
      <img 
        src={imageUrl} 
        alt="Payment slip" 
        className="max-w-full max-h-48 object-contain border border-border cursor-pointer hover:opacity-80 transition-opacity"
      />
      <p className="text-xs text-primary underline mt-1">Click to view full size</p>
    </a>
  );
}

// Color Variant Row with file upload support
function ColorVariantRow({ 
  colorVar, 
  index, 
  productForm, 
  setProductForm,
  onUploadSuccess,
  onUploadError
}: { 
  colorVar: { name: string; image: string }; 
  index: number; 
  productForm: any; 
  setProductForm: (form: any) => void;
  onUploadSuccess?: () => void;
  onUploadError?: (error: Error) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { uploadFile, isUploading } = useUpload({
    endpoint: "/api/uploads/product-images",
    onSuccess: (response) => {
      const newColorVariants = [...productForm.colorVariants];
      newColorVariants[index].image = response.objectPath;
      setProductForm({...productForm, colorVariants: newColorVariants});
      onUploadSuccess?.();
    },
    onError: (error) => {
      onUploadError?.(error);
    },
  });
  
  const handleUrlChange = (url: string) => {
    const newColorVariants = [...productForm.colorVariants];
    newColorVariants[index].image = url;
    setProductForm({...productForm, colorVariants: newColorVariants});
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await uploadFile(file);
    }
  };

  return (
    <div className="p-3 bg-secondary/5 border border-border space-y-2">
      <div className="flex gap-2 items-center">
        <div className="w-10 h-10 rounded-full overflow-hidden bg-secondary/30 flex-shrink-0">
          {colorVar.image ? (
            <img src={colorVar.image} alt={colorVar.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-[8px] text-muted-foreground">Preview</div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <Input 
            placeholder="Color name (e.g. White)" 
            value={colorVar.name}
            onChange={(e) => {
              const newColorVariants = [...productForm.colorVariants];
              newColorVariants[index].name = e.target.value;
              setProductForm({...productForm, colorVariants: newColorVariants});
            }}
            className="rounded-none h-8 text-xs"
          />
        </div>
        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          accept="image/*"
          onChange={handleFileChange}
        />
        <Button 
          variant="outline" 
          size="sm" 
          className="h-8 text-[10px] rounded-none flex-shrink-0"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
        >
          {isUploading ? "..." : <><Upload size={12} className="mr-1" /> Upload</>}
        </Button>
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-8 w-8 text-destructive flex-shrink-0"
          onClick={() => {
            const newColorVariants = productForm.colorVariants.filter((_: any, i: number) => i !== index);
            setProductForm({...productForm, colorVariants: newColorVariants.length > 0 ? newColorVariants : [{ name: "", image: "" }]});
          }}
        >
          <Trash2 size={14} />
        </Button>
      </div>
      {/* Optional URL input for manual entry */}
      <Input 
        placeholder="Or paste image URL here" 
        value={colorVar.image}
        onChange={(e) => handleUrlChange(e.target.value)}
        className="rounded-none h-7 text-[10px]"
      />
    </div>
  );
}

export default function AdminPanel() {
  const { admin: user, adminLogin: login, adminLogout: logout, isAdminAuthenticated } = useAdminAuth();
  const { toast } = useToast();
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
  const [categories, setCategories] = useState<Category[]>([]);
  const [showNewCategoryInput, setShowNewCategoryInput] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isProductDialogOpen, setIsProductDialogOpen] = useState(false);
  
  const [newCouponCode, setNewCouponCode] = useState("");
  const [newCouponDiscount, setNewCouponDiscount] = useState("");
  const [newCouponType, setNewCouponType] = useState("percentage");
  const [newCouponScope, setNewCouponScope] = useState("store");
  const [newCouponCategories, setNewCouponCategories] = useState<string[]>([]);
  const [newCouponProducts, setNewCouponProducts] = useState<string[]>([]);
  const [newCouponAllowPreOrder, setNewCouponAllowPreOrder] = useState(false);
  
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [newAdminPassword, setNewAdminPassword] = useState("");
  const [newAdminName, setNewAdminName] = useState("");

  // Search states for filtering
  const [inventorySearch, setInventorySearch] = useState("");

  // POS State
  const [posCart, setPosCart] = useState<{ productId: string; name: string; qty: number; price: number; color?: string; size?: string; image?: string }[]>([]);
  const [posSearch, setPosSearch] = useState("");
  const [posDiscount, setPosDiscount] = useState(0);
  const [posGstPercentage, setPosGstPercentage] = useState(0);
  const [posPaymentMethod, setPosPaymentMethod] = useState("cash");
  const [posAmountReceived, setPosAmountReceived] = useState("");
  const [posCustomerName, setPosCustomerName] = useState("");
  const [posCustomerPhone, setPosCustomerPhone] = useState("");
  const [posNotes, setPosNotes] = useState("");
  const [posTransactions, setPosTransactions] = useState<any[]>([]);
  const [showPosReceipt, setShowPosReceipt] = useState(false);
  const [lastTransaction, setLastTransaction] = useState<any>(null);
  const [posViewMode, setPosViewMode] = useState<"checkout" | "history">("checkout");
  const [selectedTransaction, setSelectedTransaction] = useState<any>(null);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);

  const [productForm, setProductForm] = useState({
    name: "",
    price: "",
    salePrice: "",
    isOnSale: false,
    category: "",
    description: "",
    image: "https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?auto=format&fit=crop&q=80",
    images: [] as string[],
    colorVariants: [{ name: "", image: "" }] as { name: string; image: string }[],
    variants: [{ size: "", price: "" }],
    stock: "",
    variantStock: {} as { [key: string]: string },
    expressCharge: "",
    sizeGuide: [] as { measurement: string; sizes: { [key: string]: string } }[],
    certifications: [] as string[],
    isPreOrder: false,
    preOrderPrice: "",
    preOrderInitialPayment: "",
    preOrderEta: "",
    productDetails: "",
    materialsAndCare: ""
  });
  
  const availableCertifications = [
    "OEKO-TEX Standard 100",
    "GOTS (Global Organic Textile Standard)",
    "BSCI Certified",
    "ISO 9001",
    "ISO 14001",
    "FSC Certified",
    "CE Certified",
    "RoHS Compliant",
    "Energy Star",
    "CertiPUR-US"
  ];

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
    if (isAdminAuthenticated) {
      loadData();
    }
  }, [isAdminAuthenticated]);

  const loadData = async () => {
    try {
      const [productsData, ordersData, couponsData, adminsData, categoriesData] = await Promise.all([
        api.getProducts(),
        api.getOrders(),
        api.getCoupons(),
        api.getAdmins(),
        api.getCategories()
      ]);
      setProducts(productsData);
      setOrders(ordersData);
      setCoupons(couponsData);
      setAdmins(adminsData);
      setCategories(categoriesData);
    } catch (error) {
      console.error("Failed to load data:", error);
    }
  };

  const handlePrintLabel = () => {
    if (!selectedOrder) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const itemsHtml = selectedOrder.items.map((item: any) => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #eee;">${item.name}${item.size ? ` (${item.size})` : ''}${item.color ? ` - ${item.color}` : ''} x ${item.qty}</td>
      </tr>
    `).join('');

    printWindow.document.write(`
      <html>
        <head>
          <title>Shipping Label - ${selectedOrder.orderNumber}</title>
          <style>
            body { font-family: sans-serif; padding: 40px; color: #333; }
            .label-container { border: 2px solid #000; padding: 30px; max-width: 500px; margin: 0 auto; }
            .header { border-bottom: 2px solid #000; padding-bottom: 20px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; }
            .order-no { font-size: 24px; font-weight: bold; }
            .section { margin-bottom: 20px; }
            .section-title { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #666; margin-bottom: 5px; }
            .address { font-size: 18px; line-height: 1.4; }
            .footer { border-top: 1px solid #eee; pt: 20px; mt: 20px; font-size: 12px; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            @media print { .no-print { display: none; } }
          </style>
        </head>
        <body>
          <div class="label-container">
            <div class="header">
              <div class="order-no">${selectedOrder.orderNumber}</div>
              <div style="text-align: right;">
                <div style="font-weight: bold; font-size: 14px;">INFINITE HOME</div>
                <div style="font-size: 10px;">Male', Maldives</div>
              </div>
            </div>
            
            <div class="section">
              <div class="section-title">Delivery To:</div>
              <div class="address">
                <strong>${selectedOrder.customerName}</strong><br>
                ${selectedOrder.shippingAddress}<br>
                Tel: ${selectedOrder.customerPhone}
              </div>
            </div>

            <div class="section">
              <div class="section-title">Order Items:</div>
              <table>
                ${itemsHtml}
              </table>
            </div>

            <div class="footer">
              <div style="display: flex; justify-content: space-between; align-items: flex-end;">
                <div>
                  <p><strong>Payment Method:</strong> ${selectedOrder.paymentMethod.toUpperCase()}</p>
                  <p><strong>Status:</strong> ${selectedOrder.status.replace("_", " ").toUpperCase()}</p>
                </div>
                <div style="text-align: right;">
                  <p><strong>Order Date:</strong> ${selectedOrder.createdAt ? new Date(selectedOrder.createdAt).toLocaleDateString() : 'N/A'}</p>
                </div>
              </div>
              <p style="margin-top: 20px; text-align: center; border-top: 1px dashed #eee; pt: 10px;">Thank you for shopping with INFINITE HOME!</p>
            </div>
          </div>
          <script>
            setTimeout(() => {
              window.print();
              window.close();
            }, 500);
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) return;
    try {
      const newCategory = await api.createCategory({ name: newCategoryName.trim() });
      setCategories([...categories, newCategory]);
      setProductForm({ ...productForm, category: newCategory.name });
      setNewCategoryName("");
      setShowNewCategoryInput(false);
      window.dispatchEvent(new CustomEvent('category-updated'));
      toast({ title: "Category created", description: `${newCategory.name} added` });
    } catch (error) {
      console.error("Failed to create category:", error);
      toast({ title: "Error", description: "Failed to create category", variant: "destructive" });
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
    const variantStockNumbers: { [key: string]: number } = {};
    Object.entries(productForm.variantStock).forEach(([key, val]) => {
      variantStockNumbers[key] = parseInt(val) || 0;
    });
    
    const formattedProduct = {
      name: productForm.name,
      price: productForm.variants.length > 0 && productForm.variants[0].price 
        ? Number(productForm.variants[0].price) 
        : Number(productForm.price),
      salePrice: productForm.isOnSale && productForm.salePrice ? Number(productForm.salePrice) : null,
      isOnSale: productForm.isOnSale,
      category: productForm.category,
      description: productForm.description,
      image: productForm.image,
      images: productForm.images,
      colors: productForm.colorVariants.filter(cv => cv.name.trim()).map(cv => cv.name.trim()),
      colorImages: productForm.colorVariants.filter(cv => cv.name.trim()).reduce((acc, cv) => {
        if (cv.image.trim()) acc[cv.name.trim()] = cv.image.trim();
        return acc;
      }, {} as { [key: string]: string }),
      variants: productForm.variants.filter(v => v.size && v.price).map(v => ({
        size: v.size.trim(),
        price: Number(v.price)
      })),
      stock: productForm.stock ? Number(productForm.stock) : 0,
      variantStock: variantStockNumbers,
      expressCharge: productForm.expressCharge ? Number(productForm.expressCharge) : 0,
      sizeGuide: productForm.sizeGuide.filter(sg => sg.measurement && Object.keys(sg.sizes).length > 0),
      certifications: productForm.certifications,
      isPreOrder: productForm.isPreOrder,
      preOrderPrice: productForm.isPreOrder && productForm.preOrderPrice ? Number(productForm.preOrderPrice) : null,
      preOrderInitialPayment: productForm.isPreOrder && productForm.preOrderInitialPayment ? Number(productForm.preOrderInitialPayment) : null,
      preOrderEta: productForm.isPreOrder ? productForm.preOrderEta : null,
      productDetails: productForm.productDetails || null,
      materialsAndCare: productForm.materialsAndCare || null
    };

    try {
      if (editingProduct) {
        await api.updateProduct(editingProduct.id, formattedProduct);
        toast({ title: "Product updated", description: "Changes saved successfully" });
      } else {
        await api.createProduct(formattedProduct);
        toast({ title: "Product created", description: "New product added successfully" });
      }
      await loadData();
      setIsProductDialogOpen(false);
      setEditingProduct(null);
      resetProductForm();
    } catch (error) {
      console.error("Failed to save product:", error);
      toast({ title: "Error", description: "Failed to save product", variant: "destructive" });
    }
  };

  const resetProductForm = () => {
    setProductForm({ 
      name: "", 
      price: "",
      salePrice: "",
      isOnSale: false,
      category: "", 
      description: "", 
      image: "https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?auto=format&fit=crop&q=80", 
      images: [],
      colorVariants: [{ name: "", image: "" }],
      variants: [{ size: "", price: "" }],
      stock: "",
      variantStock: {},
      expressCharge: "",
      sizeGuide: [],
      certifications: [],
      isPreOrder: false,
      preOrderPrice: "",
      preOrderInitialPayment: "",
      preOrderEta: "",
      productDetails: "",
      materialsAndCare: ""
    });
    setShowNewCategoryInput(false);
    setNewCategoryName("");
  };

  const handleEditProduct = (product: Product) => {
    setEditingProduct(product);
    const existingVariantStock = (product as any).variantStock || {};
    const variantStockStrings: { [key: string]: string } = {};
    Object.entries(existingVariantStock).forEach(([key, val]) => {
      variantStockStrings[key] = String(val);
    });
    setProductForm({
      name: product.name,
      price: product.price.toString(),
      salePrice: ((product as any).salePrice || "").toString(),
      isOnSale: (product as any).isOnSale || false,
      category: product.category,
      description: product.description || "",
      image: product.image,
      images: (product as any).images || [],
      colorVariants: (() => {
        const colors = product.colors || [];
        const colorImages = (product as any).colorImages || {};
        if (colors.length === 0) return [{ name: "", image: "" }];
        return colors.map((c: string) => ({ name: c, image: colorImages[c] || "" }));
      })(),
      variants: product.variants && product.variants.length > 0 
        ? product.variants.map(v => ({ size: v.size, price: v.price.toString() }))
        : [{ size: "", price: product.price.toString() }],
      stock: ((product as any).stock || 0).toString(),
      variantStock: variantStockStrings,
      expressCharge: (product.expressCharge || 0).toString(),
      sizeGuide: (product as any).sizeGuide || [],
      certifications: (product as any).certifications || [],
      isPreOrder: (product as any).isPreOrder || false,
      preOrderPrice: ((product as any).preOrderPrice || "").toString(),
      preOrderInitialPayment: ((product as any).preOrderInitialPayment || "").toString(),
      preOrderEta: (product as any).preOrderEta || "",
      productDetails: (product as any).productDetails || "",
      materialsAndCare: (product as any).materialsAndCare || ""
    });
    setShowNewCategoryInput(false);
    setNewCategoryName("");
    setIsProductDialogOpen(true);
  };

  const deleteProduct = async (id: string) => {
    try {
      await api.deleteProduct(id);
      await loadData();
      toast({ title: "Product deleted", description: "Product removed successfully" });
    } catch (error) {
      console.error("Failed to delete product:", error);
      toast({ title: "Error", description: "Failed to delete product", variant: "destructive" });
    }
  };

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    try {
      await api.updateOrderStatus(orderId, newStatus);
      await loadData();
      toast({ title: "Order updated", description: `Status changed to ${newStatus.replace('_', ' ')}` });
    } catch (error) {
      console.error("Failed to update order status:", error);
      toast({ title: "Error", description: "Failed to update order status", variant: "destructive" });
    }
  };

  const handleAddCoupon = async () => {
    if (!newCouponCode || !newCouponDiscount) return;
    if (newCouponScope === "category" && newCouponCategories.length === 0) {
      toast({ title: "Error", description: "Please select at least one category", variant: "destructive" });
      return;
    }
    if (newCouponScope === "product" && newCouponProducts.length === 0) {
      toast({ title: "Error", description: "Please select at least one product", variant: "destructive" });
      return;
    }
    try {
      await api.createCoupon({
        code: newCouponCode.toUpperCase(),
        discount: Number(newCouponDiscount),
        type: newCouponType,
        status: "active",
        scope: newCouponScope,
        allowedCategories: newCouponScope === "category" ? newCouponCategories : [],
        allowedProducts: newCouponScope === "product" ? newCouponProducts : [],
        allowPreOrder: newCouponAllowPreOrder
      });
      await loadData();
      setNewCouponCode("");
      setNewCouponDiscount("");
      setNewCouponScope("store");
      setNewCouponCategories([]);
      setNewCouponProducts([]);
      setNewCouponAllowPreOrder(false);
      toast({ title: "Coupon created", description: `Code ${newCouponCode.toUpperCase()} added` });
    } catch (error) {
      console.error("Failed to add coupon:", error);
      toast({ title: "Error", description: "Failed to create coupon", variant: "destructive" });
    }
  };

  const handleDeleteCoupon = async (id: string) => {
    try {
      await api.deleteCoupon(id);
      await loadData();
      toast({ title: "Coupon deleted", description: "Coupon removed successfully" });
    } catch (error) {
      console.error("Failed to delete coupon:", error);
      toast({ title: "Error", description: "Failed to delete coupon", variant: "destructive" });
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
      toast({ title: "Admin added", description: `${newAdminName} can now access the panel` });
    } catch (error) {
      console.error("Failed to add admin:", error);
      toast({ title: "Error", description: "Failed to add admin", variant: "destructive" });
    }
  };

  const menuItems = [
    { icon: LayoutDashboard, label: "Overview" },
    { icon: ShoppingBag, label: "Products" },
    { icon: Warehouse, label: "Inventory" },
    { icon: CreditCard, label: "POS" },
    { icon: Package, label: "Orders" },
    { icon: Tag, label: "Coupons" },
    { icon: Settings, label: "Admin Management" },
  ];

  // Dashboard Analytics Calculations - must be before conditional returns
  const analytics = useMemo(() => {
    if (!orders.length) return { 
      totalRevenue: 0, 
      avgOrderValue: 0, 
      growth: 0, 
      chartData: [], 
      statusData: [],
      recentActivity: []
    };

    const totalRevenue = orders.reduce((sum, o) => sum + o.total, 0);
    const avgOrderValue = totalRevenue / orders.length;

    // Group orders by day for chart
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      return d.toISOString().split('T')[0];
    });

    const chartData = last7Days.map(date => {
      const dayOrders = orders.filter(o => o.createdAt && new Date(o.createdAt).toISOString().split('T')[0] === date);
      return {
        name: new Date(date).toLocaleDateString('en-US', { weekday: 'short' }),
        revenue: dayOrders.reduce((sum, o) => sum + o.total, 0),
        orders: dayOrders.length
      };
    });

    // Order status distribution
    const statusCounts: Record<string, number> = {};
    orders.forEach(o => {
      statusCounts[o.status] = (statusCounts[o.status] || 0) + 1;
    });
    
    const statusData = Object.entries(statusCounts).map(([name, value]) => ({ 
      name: name.replace('_', ' ').toUpperCase(), 
      value 
    }));

    // Recent activity (last 5 orders)
    const recentActivity = [...orders]
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
      .slice(0, 5);

    return { totalRevenue, avgOrderValue, chartData, statusData, recentActivity };
  }, [orders]);

  const COLORS = ['#1a1a1a', '#4a4a4a', '#8a8a8a', '#c0c0c0', '#e0e0e0'];

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
        <main className="flex-1 overflow-x-hidden overflow-y-auto p-4 md:p-8">
          {activeTab === "Overview" && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-8">
              <div>
                <h1 className="text-2xl md:text-3xl font-serif mb-2">Dashboard Overview</h1>
                <p className="text-muted-foreground">Welcome back, {user?.name || 'Admin'}. Here's what's happening today.</p>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card className="rounded-none border-border shadow-sm">
                  <CardContent className="p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div className="p-2 bg-primary/5 rounded-none">
                        <DollarSign size={20} className="text-primary" />
                      </div>
                      <span className="flex items-center text-xs font-medium text-emerald-600">
                        <ArrowUpRight size={14} className="mr-1" /> 12%
                      </span>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Total Revenue</p>
                      <p className="text-2xl font-bold">{formatCurrency(analytics.totalRevenue)}</p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="rounded-none border-border shadow-sm">
                  <CardContent className="p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div className="p-2 bg-primary/5 rounded-none">
                        <ShoppingCart size={20} className="text-primary" />
                      </div>
                      <span className="flex items-center text-xs font-medium text-emerald-600">
                        <ArrowUpRight size={14} className="mr-1" /> 8%
                      </span>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Total Orders</p>
                      <p className="text-2xl font-bold">{orders.length}</p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="rounded-none border-border shadow-sm">
                  <CardContent className="p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div className="p-2 bg-primary/5 rounded-none">
                        <Package size={20} className="text-primary" />
                      </div>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Total Products</p>
                      <p className="text-2xl font-bold">{products.length}</p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="rounded-none border-border shadow-sm">
                  <CardContent className="p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div className="p-2 bg-primary/5 rounded-none">
                        <TrendingUp size={20} className="text-primary" />
                      </div>
                      <span className="flex items-center text-xs font-medium text-emerald-600">
                        <ArrowUpRight size={14} className="mr-1" /> 5%
                      </span>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Avg. Order Value</p>
                      <p className="text-2xl font-bold">{formatCurrency(analytics.avgOrderValue)}</p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Charts Row */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-2 rounded-none border-border shadow-sm">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="font-serif text-lg">Revenue Trend</h3>
                      <Select defaultValue="7d">
                        <SelectTrigger className="w-[120px] rounded-none h-8 text-xs">
                          <SelectValue placeholder="Period" />
                        </SelectTrigger>
                        <SelectContent className="rounded-none">
                          <SelectItem value="7d">Last 7 Days</SelectItem>
                          <SelectItem value="30d">Last 30 Days</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="h-[300px] w-full">
                      {analytics.chartData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={analytics.chartData}>
                            <defs>
                              <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#1a1a1a" stopOpacity={0.1}/>
                                <stop offset="95%" stopColor="#1a1a1a" stopOpacity={0}/>
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                            <XAxis 
                              dataKey="name" 
                              axisLine={false} 
                              tickLine={false} 
                              tick={{ fontSize: 10, fill: '#888' }}
                            />
                            <YAxis 
                              axisLine={false} 
                              tickLine={false} 
                              tick={{ fontSize: 10, fill: '#888' }}
                              tickFormatter={(value) => `${value}`}
                            />
                            <Tooltip 
                              contentStyle={{ borderRadius: '0px', border: '1px solid #eee', fontSize: '12px' }}
                              formatter={(value: any) => [formatCurrency(value), "Revenue"]}
                            />
                            <Area 
                              type="monotone" 
                              dataKey="revenue" 
                              stroke="#1a1a1a" 
                              fillOpacity={1} 
                              fill="url(#colorRev)" 
                              strokeWidth={2}
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                          No revenue data yet
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card className="rounded-none border-border shadow-sm">
                  <CardContent className="p-6">
                    <h3 className="font-serif text-lg mb-6">Order Status</h3>
                    <div className="h-[250px] w-full">
                      {analytics.statusData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={analytics.statusData}
                              cx="50%"
                              cy="50%"
                              innerRadius={60}
                              outerRadius={80}
                              paddingAngle={5}
                              dataKey="value"
                            >
                              {analytics.statusData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip 
                              contentStyle={{ borderRadius: '0px', border: '1px solid #eee', fontSize: '12px' }}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                          No orders yet
                        </div>
                      )}
                    </div>
                    <div className="mt-4 space-y-2">
                      {analytics.statusData.slice(0, 4).map((status, index) => (
                        <div key={status.name} className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-none" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                            <span className="text-muted-foreground">{status.name}</span>
                          </div>
                          <span className="font-bold">{status.value}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Bottom Row: Recent Orders */}
              <Card className="rounded-none border-border shadow-sm">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="font-serif text-lg">Recent Orders</h3>
                    <Button variant="outline" size="sm" className="rounded-none text-xs" onClick={() => setActiveTab("Orders")}>
                      View All
                    </Button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border text-left">
                          <th className="pb-4 font-bold uppercase tracking-widest text-[10px] text-muted-foreground">Order ID</th>
                          <th className="pb-4 font-bold uppercase tracking-widest text-[10px] text-muted-foreground">Customer</th>
                          <th className="pb-4 font-bold uppercase tracking-widest text-[10px] text-muted-foreground">Amount</th>
                          <th className="pb-4 font-bold uppercase tracking-widest text-[10px] text-muted-foreground">Status</th>
                          <th className="pb-4 font-bold uppercase tracking-widest text-[10px] text-muted-foreground">Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {analytics.recentActivity.map((order) => (
                          <tr key={order.id} className="border-b border-border/50 hover:bg-secondary/5 transition-colors group">
                            <td className="py-4 font-medium text-primary">#{order.orderNumber}</td>
                            <td className="py-4">
                              <div className="flex flex-col">
                                <span>{order.customerName}</span>
                                <span className="text-[10px] text-muted-foreground">{order.customerEmail}</span>
                              </div>
                            </td>
                            <td className="py-4 font-bold">{formatCurrency(order.total)}</td>
                            <td className="py-4">
                              <span className={cn(
                                "text-[10px] uppercase tracking-tighter font-bold px-2 py-1",
                                order.status === 'delivered' ? "bg-emerald-100 text-emerald-800" : 
                                order.status === 'cancelled' ? "bg-rose-100 text-rose-800" :
                                "bg-amber-100 text-amber-800"
                              )}>
                                {order.status.replace('_', ' ')}
                              </span>
                            </td>
                            <td className="py-4 text-muted-foreground">
                              {order.createdAt ? new Date(order.createdAt).toLocaleDateString() : 'N/A'}
                            </td>
                          </tr>
                        ))}
                        {analytics.recentActivity.length === 0 && (
                          <tr>
                            <td colSpan={5} className="py-12 text-center text-muted-foreground italic">
                              No orders yet to display.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
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
                  <DialogContent className="max-w-md md:max-w-2xl lg:max-w-4xl rounded-none max-h-[90vh] overflow-y-auto">
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
                          <div className="flex items-center gap-2">
                            <Label className="text-xs uppercase tracking-widest font-bold">Sale Price</Label>
                            <button
                              type="button"
                              className={`w-10 h-5 rounded-full transition-colors ${productForm.isOnSale ? 'bg-red-500' : 'bg-gray-300'}`}
                              onClick={() => setProductForm({...productForm, isOnSale: !productForm.isOnSale})}
                              data-testid="toggle-sale"
                            >
                              <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform ${productForm.isOnSale ? 'translate-x-5' : 'translate-x-0.5'}`} />
                            </button>
                          </div>
                          <Input 
                            type="number"
                            value={productForm.salePrice}
                            onChange={(e) => setProductForm({...productForm, salePrice: e.target.value})}
                            className="rounded-none"
                            placeholder="Sale price"
                            disabled={!productForm.isOnSale}
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-xs uppercase tracking-widest font-bold">Category</Label>
                          {showNewCategoryInput ? (
                            <div className="flex gap-2">
                              <Input 
                                value={newCategoryName}
                                onChange={(e) => setNewCategoryName(e.target.value)}
                                placeholder="New category name"
                                className="rounded-none flex-1"
                                data-testid="input-new-category"
                              />
                              <Button 
                                type="button"
                                size="sm"
                                onClick={handleCreateCategory}
                                className="rounded-none"
                                data-testid="button-save-category"
                              >
                                Save
                              </Button>
                              <Button 
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => { setShowNewCategoryInput(false); setNewCategoryName(""); }}
                                className="rounded-none"
                              >
                                Cancel
                              </Button>
                            </div>
                          ) : (
                            <Select
                              value={productForm.category}
                              onValueChange={(value) => {
                                if (value === "__add_new__") {
                                  setShowNewCategoryInput(true);
                                } else {
                                  setProductForm({...productForm, category: value});
                                }
                              }}
                            >
                              <SelectTrigger className="rounded-none" data-testid="select-category">
                                <SelectValue placeholder="Select a category" />
                              </SelectTrigger>
                              <SelectContent className="rounded-none">
                                {categories.map((cat) => (
                                  <SelectItem key={cat.id} value={cat.name}>
                                    {cat.name}
                                  </SelectItem>
                                ))}
                                <SelectItem value="__add_new__" className="text-primary font-medium">
                                  + Add new category
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs uppercase tracking-widest font-bold">Stock</Label>
                          <Input 
                            type="number"
                            value={productForm.stock}
                            onChange={(e) => setProductForm({...productForm, stock: e.target.value})}
                            className="rounded-none"
                            placeholder="0"
                            data-testid="input-stock"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs uppercase tracking-widest font-bold">Express Charge (MVR)</Label>
                          <Input 
                            type="number"
                            value={productForm.expressCharge}
                            onChange={(e) => setProductForm({...productForm, expressCharge: e.target.value})}
                            className="rounded-none"
                            placeholder="0"
                            data-testid="input-express-charge"
                          />
                          <p className="text-[10px] text-muted-foreground">Extra charge for express delivery (Male'/Hulhumale')</p>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <Label className="text-xs uppercase tracking-widest font-bold">Product Certifications</Label>
                        <p className="text-[10px] text-muted-foreground">Select applicable certifications for this product</p>
                        <div className="grid grid-cols-2 gap-2 p-3 border border-border bg-secondary/10">
                          {availableCertifications.map((cert) => (
                            <label key={cert} className="flex items-center gap-2 cursor-pointer text-sm">
                              <input
                                type="checkbox"
                                checked={productForm.certifications.includes(cert)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setProductForm({...productForm, certifications: [...productForm.certifications, cert]});
                                  } else {
                                    setProductForm({...productForm, certifications: productForm.certifications.filter(c => c !== cert)});
                                  }
                                }}
                                className="w-4 h-4"
                                data-testid={`checkbox-cert-${cert.replace(/\s+/g, '-').toLowerCase()}`}
                              />
                              <span className="text-xs">{cert}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                      
                      <div className="border border-border p-4 space-y-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <Label className="text-xs uppercase tracking-widest font-bold">Pre-Order Mode</Label>
                            <p className="text-[10px] text-muted-foreground mt-1">Enable for items not currently in stock</p>
                          </div>
                          <Button
                            type="button"
                            variant={productForm.isPreOrder ? "default" : "outline"}
                            size="sm"
                            className="h-8 text-xs uppercase tracking-widest rounded-none"
                            onClick={() => setProductForm({...productForm, isPreOrder: !productForm.isPreOrder})}
                            data-testid="button-toggle-preorder"
                          >
                            {productForm.isPreOrder ? "Pre-Order ON" : "Pre-Order OFF"}
                          </Button>
                        </div>
                        
                        {productForm.isPreOrder && (
                          <div className="grid grid-cols-3 gap-4 pt-2 border-t border-border">
                            <div className="space-y-2">
                              <Label className="text-xs uppercase tracking-widest font-bold">Pre-Order Total Price (MVR)</Label>
                              <Input 
                                type="number"
                                value={productForm.preOrderPrice}
                                onChange={(e) => setProductForm({...productForm, preOrderPrice: e.target.value})}
                                className="rounded-none"
                                placeholder="Full price for pre-order"
                                data-testid="input-preorder-price"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-xs uppercase tracking-widest font-bold">Initial Payment (MVR)</Label>
                              <Input 
                                type="number"
                                value={productForm.preOrderInitialPayment}
                                onChange={(e) => setProductForm({...productForm, preOrderInitialPayment: e.target.value})}
                                className="rounded-none"
                                placeholder="Deposit required"
                                data-testid="input-preorder-initial"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-xs uppercase tracking-widest font-bold">Estimated Arrival (ETA)</Label>
                              <Input 
                                value={productForm.preOrderEta}
                                onChange={(e) => setProductForm({...productForm, preOrderEta: e.target.value})}
                                className="rounded-none"
                                placeholder="e.g., 2-3 weeks"
                                data-testid="input-preorder-eta"
                              />
                            </div>
                          </div>
                        )}
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
                        <Label className="text-xs uppercase tracking-widest font-bold">Product Details</Label>
                        <textarea 
                          value={productForm.productDetails}
                          onChange={(e) => setProductForm({...productForm, productDetails: e.target.value})}
                          className="w-full min-h-[100px] p-3 border border-border rounded-none bg-background text-foreground resize-y focus:outline-none focus:ring-2 focus:ring-ring text-sm"
                          placeholder="Enter product details. Press Enter for new lines."
                          data-testid="textarea-product-details"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs uppercase tracking-widest font-bold">Materials & Care</Label>
                        <textarea 
                          value={productForm.materialsAndCare}
                          onChange={(e) => setProductForm({...productForm, materialsAndCare: e.target.value})}
                          className="w-full min-h-[100px] p-3 border border-border rounded-none bg-background text-foreground resize-y focus:outline-none focus:ring-2 focus:ring-ring text-sm"
                          placeholder="Enter materials and care instructions. Press Enter for new lines."
                          data-testid="textarea-materials-care"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs uppercase tracking-widest font-bold">Main Product Image</Label>
                        <ProductImageUploader
                          currentImage={productForm.image}
                          onImageUploaded={(path) => setProductForm({...productForm, image: path})}
                          onUploadSuccess={() => toast({ title: "Image uploaded", description: "Main product image saved" })}
                          onUploadError={(error) => toast({ title: "Upload failed", description: error.message || "Failed to upload image", variant: "destructive" })}
                        />
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <Label className="text-xs uppercase tracking-widest font-bold">Additional Images</Label>
                          <Button 
                            type="button"
                            variant="outline" 
                            size="sm" 
                            className="h-7 text-[10px] rounded-none uppercase tracking-widest"
                            onClick={() => setProductForm({
                              ...productForm, 
                              images: [...productForm.images, ""]
                            })}
                            data-testid="button-add-image"
                          >
                            <Plus size={12} className="mr-1" /> Add Image
                          </Button>
                        </div>
                        {productForm.images.map((img, index) => (
                          <div key={index} className="flex gap-2 items-start">
                            <div className="flex-1">
                              <ProductImageUploader
                                currentImage={img}
                                onImageUploaded={(path) => {
                                  const newImages = [...productForm.images];
                                  newImages[index] = path;
                                  setProductForm({...productForm, images: newImages});
                                }}
                                onUploadSuccess={() => toast({ title: "Image uploaded", description: "Additional product image saved" })}
                                onUploadError={(error) => toast({ title: "Upload failed", description: error.message || "Failed to upload image", variant: "destructive" })}
                              />
                            </div>
                            <Button 
                              type="button"
                              variant="ghost" 
                              size="icon" 
                              className="h-9 w-9 text-destructive mt-1"
                              onClick={() => {
                                const newImages = productForm.images.filter((_, i) => i !== index);
                                setProductForm({...productForm, images: newImages});
                              }}
                            >
                              <Trash2 size={14} />
                            </Button>
                          </div>
                        ))}
                        {productForm.images.length === 0 && (
                          <p className="text-xs text-muted-foreground">No additional images. Click "Add Image" to add more.</p>
                        )}
                      </div>
                      {/* Color Variants */}
                      <div className="space-y-4">
                        <div className="flex justify-between items-center">
                          <div>
                            <Label className="text-xs uppercase tracking-widest font-bold">Color Variants</Label>
                            <p className="text-[10px] text-muted-foreground">Add colors with swatch images (upload or URL)</p>
                          </div>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="h-7 text-[10px] rounded-none uppercase tracking-widest"
                            onClick={() => setProductForm({
                              ...productForm, 
                              colorVariants: [...productForm.colorVariants, { name: "", image: "" }]
                            })}
                          >
                            <Plus size={12} className="mr-1" /> Add Color
                          </Button>
                        </div>
                        {productForm.colorVariants.map((colorVar, index) => (
                          <ColorVariantRow 
                            key={index} 
                            colorVar={colorVar} 
                            index={index}
                            productForm={productForm}
                            setProductForm={setProductForm}
                            onUploadSuccess={() => toast({ title: "Image uploaded", description: "Color variant image saved" })}
                            onUploadError={(error) => toast({ title: "Upload failed", description: error.message || "Failed to upload image", variant: "destructive" })}
                          />
                        ))}
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
                      
                      {/* Variant Stock Management */}
                      {(productForm.variants.some(v => v.size) || productForm.colorVariants.some(cv => cv.name.trim())) && (
                        <div className="space-y-4 pt-4 border-t border-border">
                          <div>
                            <Label className="text-xs uppercase tracking-widest font-bold">Variant Stock</Label>
                            <p className="text-[10px] text-muted-foreground">Set stock for each size/color combination</p>
                          </div>
                          <div className="space-y-2 max-h-64 overflow-y-auto">
                            {(() => {
                              const sizes = productForm.variants.filter(v => v.size).map(v => v.size);
                              const colors = productForm.colorVariants.filter(cv => cv.name.trim()).map(cv => cv.name.trim());
                              const combos: { size: string; color: string; key: string }[] = [];
                              
                              if (sizes.length > 0 && colors.length > 0) {
                                sizes.forEach(size => {
                                  colors.forEach(color => {
                                    combos.push({ size, color, key: `${size}-${color}` });
                                  });
                                });
                              } else if (sizes.length > 0) {
                                sizes.forEach(size => {
                                  combos.push({ size, color: "Default", key: `${size}-Default` });
                                });
                              } else if (colors.length > 0) {
                                colors.forEach(color => {
                                  combos.push({ size: "Standard", color, key: `Standard-${color}` });
                                });
                              }
                              
                              return combos.map(({ size, color, key }) => (
                                <div key={key} className="flex items-center gap-2 p-2 bg-secondary/5 border border-border">
                                  <span className="text-xs flex-1 font-medium">{size} / {color}</span>
                                  <Input 
                                    type="number"
                                    placeholder="0"
                                    value={productForm.variantStock[key] || ""}
                                    onChange={(e) => {
                                      setProductForm({
                                        ...productForm,
                                        variantStock: { ...productForm.variantStock, [key]: e.target.value }
                                      });
                                    }}
                                    className="rounded-none h-8 w-24 text-xs text-right"
                                    data-testid={`input-variant-stock-${key}`}
                                  />
                                </div>
                              ));
                            })()}
                          </div>
                          {!productForm.variants.some(v => v.size) && !productForm.colorVariants.some(cv => cv.name.trim()) && (
                            <p className="text-[10px] text-muted-foreground">Add sizes or colors above to manage variant stock</p>
                          )}
                        </div>
                      )}
                      
                      <div className="space-y-4 pt-4 border-t border-border">
                        <div className="flex justify-between items-center">
                          <div>
                            <Label className="text-xs uppercase tracking-widest font-bold">Size Guide</Label>
                            <p className="text-[10px] text-muted-foreground">Add measurements to display in the size guide page</p>
                          </div>
                          <Button 
                            type="button"
                            variant="outline" 
                            size="sm" 
                            className="h-7 text-[10px] rounded-none uppercase tracking-widest"
                            onClick={() => {
                              const sizes = productForm.variants.filter(v => v.size).map(v => v.size);
                              const sizeObj: { [key: string]: string } = {};
                              sizes.forEach(s => { sizeObj[s] = ""; });
                              setProductForm({
                                ...productForm, 
                                sizeGuide: [...productForm.sizeGuide, { measurement: "", sizes: sizeObj }]
                              });
                            }}
                            data-testid="button-add-size-guide"
                          >
                            <Plus size={12} className="mr-1" /> Add Measurement
                          </Button>
                        </div>
                        {productForm.sizeGuide.length === 0 ? (
                          <p className="text-xs text-muted-foreground py-2">No size guide entries. Add measurements like "Length", "Width", "Chest", etc.</p>
                        ) : (
                          <div className="space-y-3">
                            {productForm.sizeGuide.map((entry, idx) => (
                              <div key={idx} className="p-3 border border-border bg-secondary/5 space-y-2">
                                <div className="flex gap-2 items-center">
                                  <Input 
                                    placeholder="Measurement (e.g. Length, Width)" 
                                    value={entry.measurement}
                                    onChange={(e) => {
                                      const newGuide = [...productForm.sizeGuide];
                                      newGuide[idx].measurement = e.target.value;
                                      setProductForm({...productForm, sizeGuide: newGuide});
                                    }}
                                    className="rounded-none h-8 text-xs flex-1"
                                  />
                                  <Button 
                                    type="button"
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-8 w-8 text-destructive"
                                    onClick={() => {
                                      const newGuide = productForm.sizeGuide.filter((_, i) => i !== idx);
                                      setProductForm({...productForm, sizeGuide: newGuide});
                                    }}
                                  >
                                    <Trash2 size={12} />
                                  </Button>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                  {Object.entries(entry.sizes).map(([size, value]) => (
                                    <div key={size} className="flex items-center gap-1">
                                      <span className="text-[10px] uppercase w-16 truncate">{size}:</span>
                                      <Input 
                                        placeholder="Value" 
                                        value={value}
                                        onChange={(e) => {
                                          const newGuide = [...productForm.sizeGuide];
                                          newGuide[idx].sizes[size] = e.target.value;
                                          setProductForm({...productForm, sizeGuide: newGuide});
                                        }}
                                        className="rounded-none h-7 text-xs flex-1"
                                      />
                                    </div>
                                  ))}
                                </div>
                                {Object.keys(entry.sizes).length === 0 && (
                                  <p className="text-[10px] text-muted-foreground">Add size variations above first to populate size columns</p>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
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
                        <div className="flex items-center gap-4">
                          <span className={cn(
                            "text-xs font-medium px-2 py-1",
                            ((product as any).stock || 0) > 0 
                              ? "bg-green-100 text-green-700" 
                              : "bg-red-100 text-red-700"
                          )} data-testid={`stock-${product.id}`}>
                            Stock: {(product as any).stock || 0}
                          </span>
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

          {activeTab === "Inventory" && (
            <div className="animate-in fade-in duration-500">
              <div className="mb-8">
                <h1 className="text-3xl font-serif">Inventory Management</h1>
                <p className="text-muted-foreground">Manage product visibility and stock levels</p>
              </div>

              {/* Inventory Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                <Card className="rounded-none border-border shadow-none">
                  <CardContent className="p-4">
                    <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">Total Products</div>
                    <div className="text-2xl font-bold">{products.length}</div>
                  </CardContent>
                </Card>
                <Card className="rounded-none border-border shadow-none">
                  <CardContent className="p-4">
                    <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">Visible on Store</div>
                    <div className="text-2xl font-bold text-green-600">
                      {products.filter(p => p.showOnStorefront !== false).length}
                    </div>
                  </CardContent>
                </Card>
                <Card className="rounded-none border-border shadow-none">
                  <CardContent className="p-4">
                    <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">Hidden</div>
                    <div className="text-2xl font-bold text-gray-400">
                      {products.filter(p => p.showOnStorefront === false).length}
                    </div>
                  </CardContent>
                </Card>
                <Card className="rounded-none border-border shadow-none">
                  <CardContent className="p-4">
                    <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">Low Stock</div>
                    <div className="text-2xl font-bold text-amber-600">
                      {products.filter(p => (p.stock || 0) <= (p.lowStockThreshold || 5) && (p.stock || 0) > 0).length}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Inventory Search */}
              <Card className="rounded-none border-border shadow-none mb-6">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <Search size={18} className="text-muted-foreground" />
                    <Input
                      placeholder="Search products by name, SKU, or barcode..."
                      className="rounded-none flex-1"
                      value={inventorySearch}
                      onChange={(e) => setInventorySearch(e.target.value)}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Inventory Table */}
              <Card className="rounded-none border-border shadow-none">
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-border bg-secondary/30">
                          <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-widest">Product</th>
                          <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-widest">SKU</th>
                          <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-widest">Stock</th>
                          <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-widest">Status</th>
                          <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-widest">Visible</th>
                          <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-widest">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {products
                          .filter(p => {
                            const query = inventorySearch.toLowerCase();
                            return !query || 
                              (p.name && p.name.toLowerCase().includes(query)) ||
                              (p.sku && p.sku.toLowerCase().includes(query)) ||
                              (p.barcode && p.barcode.toLowerCase().includes(query)) ||
                              (p.category && p.category.toLowerCase().includes(query));
                          })
                          .map((product) => {
                          const totalStock = product.stock || 0;
                          const lowThreshold = product.lowStockThreshold || 5;
                          const isLowStock = totalStock <= lowThreshold && totalStock > 0;
                          const isOutOfStock = totalStock <= 0;
                          const isVisible = product.showOnStorefront !== false;

                          return (
                            <tr key={product.id} className="hover:bg-secondary/10">
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-3">
                                  <img 
                                    src={product.image} 
                                    alt={product.name} 
                                    className="w-12 h-12 object-cover border border-border"
                                  />
                                  <div>
                                    <p className="font-medium text-sm">{product.name}</p>
                                    <p className="text-xs text-muted-foreground">{product.category}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-sm text-muted-foreground">
                                {product.sku || '-'}
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <span className={`text-sm font-medium ${isOutOfStock ? 'text-red-600' : isLowStock ? 'text-amber-600' : 'text-green-600'}`}>
                                    {totalStock}
                                  </span>
                                  {isLowStock && <AlertTriangle size={14} className="text-amber-500" />}
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                {isOutOfStock ? (
                                  <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-red-100 text-red-700">Out of Stock</span>
                                ) : isLowStock ? (
                                  <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-amber-100 text-amber-700">Low Stock</span>
                                ) : (
                                  <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-green-100 text-green-700">In Stock</span>
                                )}
                              </td>
                              <td className="px-4 py-3">
                                <button
                                  onClick={async () => {
                                    try {
                                      await api.updateProduct(product.id, { showOnStorefront: !isVisible });
                                      await loadData();
                                      toast({ 
                                        title: isVisible ? "Product hidden" : "Product visible",
                                        description: isVisible ? "Product is now hidden from storefront" : "Product is now visible on storefront"
                                      });
                                    } catch (error) {
                                      toast({ title: "Error", description: "Failed to update visibility", variant: "destructive" });
                                    }
                                  }}
                                  className={`p-2 rounded transition-colors ${isVisible ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                                  title={isVisible ? "Click to hide from storefront" : "Click to show on storefront"}
                                >
                                  {isVisible ? <Eye size={16} /> : <EyeOff size={16} />}
                                </button>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <Input
                                    type="number"
                                    min="0"
                                    defaultValue={totalStock}
                                    className="w-20 h-8 rounded-none text-sm"
                                    onBlur={async (e) => {
                                      const newStock = parseInt(e.target.value);
                                      if (!isNaN(newStock) && newStock !== totalStock) {
                                        try {
                                          await api.updateProductStock(product.id, newStock);
                                          await loadData();
                                          toast({ title: "Stock updated", description: `Stock updated to ${newStock}` });
                                        } catch (error) {
                                          toast({ title: "Error", description: "Failed to update stock", variant: "destructive" });
                                        }
                                      }
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        (e.target as HTMLInputElement).blur();
                                      }
                                    }}
                                  />
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="rounded-none h-8"
                                    onClick={() => {
                                      setEditingProduct(product);
                                      setIsProductDialogOpen(true);
                                    }}
                                  >
                                    <Edit size={14} />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="rounded-none h-8 text-red-500 hover:bg-red-50 hover:text-red-600"
                                    onClick={async () => {
                                      if (confirm(`Are you sure you want to delete ${product.name}?`)) {
                                        try {
                                          await api.deleteProduct(product.id);
                                          await loadData();
                                          toast({ title: "Product deleted", description: "Product has been removed successfully" });
                                        } catch (error) {
                                          toast({ title: "Error", description: "Failed to delete product", variant: "destructive" });
                                        }
                                      }
                                    }}
                                  >
                                    <Trash2 size={14} />
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                        {products.length === 0 && (
                          <tr>
                            <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                              No products found.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === "POS" && (
            <div className="animate-in fade-in duration-500">
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h1 className="text-3xl font-serif">Point of Sale</h1>
                  <p className="text-muted-foreground">Process in-store sales quickly</p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant={posViewMode === "checkout" ? "default" : "outline"}
                    className="rounded-none"
                    onClick={() => setPosViewMode("checkout")}
                  >
                    <ShoppingCart size={16} className="mr-2" /> Checkout
                  </Button>
                  <Button
                    variant={posViewMode === "history" ? "default" : "outline"}
                    className="rounded-none"
                    onClick={() => {
                      setPosViewMode("history");
                      api.getAllPosTransactions().then(setPosTransactions);
                    }}
                  >
                    <FileText size={16} className="mr-2" /> Transaction History
                  </Button>
                </div>
              </div>

              {posViewMode === "checkout" && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Product Search & Selection */}
                <div className="lg:col-span-2 space-y-4">
                  <Card className="rounded-none border-border shadow-none">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-4">
                        <Search size={18} className="text-muted-foreground" />
                        <Input
                          placeholder="Search products by name, SKU, or barcode..."
                          className="rounded-none flex-1"
                          value={posSearch}
                          onChange={(e) => setPosSearch(e.target.value)}
                        />
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-[400px] overflow-y-auto">
                        {products
                          .filter(p => {
                            const query = posSearch.toLowerCase();
                            return !query || 
                              (p.name && p.name.toLowerCase().includes(query)) ||
                              (p.sku && p.sku.toLowerCase().includes(query)) ||
                              (p.barcode && p.barcode.toLowerCase().includes(query)) ||
                              (p.category && p.category.toLowerCase().includes(query));
                          })
                          .slice(0, 20)
                          .map(product => (
                            <button
                              key={product.id}
                              onClick={() => {
                                const existing = posCart.find(item => item.productId === product.id);
                                if (existing) {
                                  setPosCart(posCart.map(item => 
                                    item.productId === product.id 
                                      ? { ...item, qty: item.qty + 1 } 
                                      : item
                                  ));
                                } else {
                                  setPosCart([...posCart, {
                                    productId: product.id,
                                    name: product.name,
                                    qty: 1,
                                    price: product.isOnSale && product.salePrice ? Number(product.salePrice) : Number(product.price),
                                    image: product.image
                                  }]);
                                }
                              }}
                              className="flex flex-col items-center p-3 border border-border hover:bg-secondary/20 transition-colors text-center"
                            >
                              <img 
                                src={product.image} 
                                alt={product.name} 
                                className="w-16 h-16 object-cover mb-2"
                              />
                              <p className="text-xs font-medium line-clamp-2">{product.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {formatCurrency(Number(product.isOnSale && product.salePrice ? product.salePrice : product.price))}
                              </p>
                            </button>
                          ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Cart & Checkout */}
                <div className="space-y-4">
                  <Card className="rounded-none border-border shadow-none">
                    <CardContent className="p-4">
                      <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                        <ShoppingCart size={18} /> Cart ({posCart.reduce((sum, item) => sum + item.qty, 0)})
                      </h3>
                      
                      <div className="space-y-3 max-h-[250px] overflow-y-auto mb-4">
                        {posCart.length === 0 ? (
                          <p className="text-muted-foreground text-sm text-center py-8">Cart is empty</p>
                        ) : (
                          posCart.map((item, index) => (
                            <div key={index} className="flex items-center justify-between gap-2 p-2 bg-secondary/10">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{item.name}</p>
                                <p className="text-xs text-muted-foreground">{formatCurrency(item.price)} each</p>
                              </div>
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 w-7 p-0 rounded-none"
                                  onClick={() => {
                                    if (item.qty <= 1) {
                                      setPosCart(posCart.filter((_, i) => i !== index));
                                    } else {
                                      setPosCart(posCart.map((c, i) => i === index ? { ...c, qty: c.qty - 1 } : c));
                                    }
                                  }}
                                >
                                  <Minus size={14} />
                                </Button>
                                <span className="w-6 text-center text-sm">{item.qty}</span>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 w-7 p-0 rounded-none"
                                  onClick={() => {
                                    setPosCart(posCart.map((c, i) => i === index ? { ...c, qty: c.qty + 1 } : c));
                                  }}
                                >
                                  <Plus size={14} />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 p-0 text-red-500 hover:bg-red-100"
                                  onClick={() => setPosCart(posCart.filter((_, i) => i !== index))}
                                >
                                  <Trash2 size={14} />
                                </Button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>

                      <div className="border-t border-border pt-4 space-y-3">
                        <div className="flex justify-between text-sm">
                          <span>Subtotal</span>
                          <span>{formatCurrency(posCart.reduce((sum, item) => sum + item.price * item.qty, 0))}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span>Discount</span>
                          <Input
                            type="number"
                            min="0"
                            className="w-24 h-7 rounded-none text-right text-sm"
                            value={posDiscount}
                            onChange={(e) => setPosDiscount(parseFloat(e.target.value) || 0)}
                          />
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span>GST %</span>
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            placeholder="0"
                            className="w-24 h-7 rounded-none text-right text-sm"
                            value={posGstPercentage || ""}
                            onChange={(e) => setPosGstPercentage(parseFloat(e.target.value) || 0)}
                          />
                        </div>
                        {posGstPercentage > 0 && (
                          <div className="flex justify-between text-sm text-muted-foreground">
                            <span>GST ({posGstPercentage}%)</span>
                            <span>{formatCurrency((posCart.reduce((sum, item) => sum + item.price * item.qty, 0) - posDiscount) * (posGstPercentage / 100))}</span>
                          </div>
                        )}
                        <div className="flex justify-between font-bold text-lg border-t border-border pt-2">
                          <span>Total</span>
                          <span>{formatCurrency(Math.max(0, (posCart.reduce((sum, item) => sum + item.price * item.qty, 0) - posDiscount) * (1 + posGstPercentage / 100)))}</span>
                        </div>
                      </div>

                      <div className="mt-4 space-y-3">
                        <div className="flex gap-2">
                          <Button
                            variant={posPaymentMethod === "cash" ? "default" : "outline"}
                            size="sm"
                            className="flex-1 rounded-none"
                            onClick={() => setPosPaymentMethod("cash")}
                          >
                            Cash
                          </Button>
                          <Button
                            variant={posPaymentMethod === "card" ? "default" : "outline"}
                            size="sm"
                            className="flex-1 rounded-none"
                            onClick={() => setPosPaymentMethod("card")}
                          >
                            Card
                          </Button>
                          <Button
                            variant={posPaymentMethod === "transfer" ? "default" : "outline"}
                            size="sm"
                            className="flex-1 rounded-none"
                            onClick={() => setPosPaymentMethod("transfer")}
                          >
                            Transfer
                          </Button>
                        </div>

                        {posPaymentMethod === "cash" && (
                          <div>
                            <Label className="text-xs">Amount Received</Label>
                            <Input
                              type="number"
                              placeholder="Enter amount"
                              className="rounded-none"
                              value={posAmountReceived}
                              onChange={(e) => setPosAmountReceived(e.target.value)}
                            />
                            {posAmountReceived && (() => {
                              const subtotal = posCart.reduce((sum, item) => sum + item.price * item.qty, 0);
                              const afterDiscount = subtotal - posDiscount;
                              const gstAmount = afterDiscount * (posGstPercentage / 100);
                              const grandTotal = Math.max(0, afterDiscount + gstAmount);
                              return (
                                <p className="text-sm mt-1">
                                  Change: {formatCurrency(Math.max(0, parseFloat(posAmountReceived) - grandTotal))}
                                </p>
                              );
                            })()}
                          </div>
                        )}

                        <div>
                          <Label className="text-xs">Customer Name (optional)</Label>
                          <Input
                            placeholder="Customer name"
                            className="rounded-none"
                            value={posCustomerName}
                            onChange={(e) => setPosCustomerName(e.target.value)}
                          />
                        </div>

                        <Button
                          className="w-full rounded-none h-12 text-lg"
                          disabled={posCart.length === 0}
                          onClick={async () => {
                            try {
                              const subtotal = posCart.reduce((sum, item) => sum + item.price * item.qty, 0);
                              const afterDiscount = subtotal - posDiscount;
                              const gstAmount = afterDiscount * (posGstPercentage / 100);
                              const total = Math.max(0, afterDiscount + gstAmount);
                              const amountReceived = posPaymentMethod === "cash" ? parseFloat(posAmountReceived) || total : total;
                              
                              const res = await fetch("/api/pos/transactions", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                  items: posCart.map(item => ({
                                    productId: item.productId,
                                    name: item.name,
                                    qty: item.qty,
                                    price: item.price,
                                    color: item.color,
                                    size: item.size
                                  })),
                                  subtotal,
                                  discount: posDiscount,
                                  gstPercentage: posGstPercentage,
                                  gstAmount: gstAmount,
                                  tax: 0,
                                  total,
                                  paymentMethod: posPaymentMethod,
                                  amountReceived,
                                  change: posPaymentMethod === "cash" ? Math.max(0, amountReceived - total) : 0,
                                  customerName: posCustomerName || null,
                                  customerPhone: posCustomerPhone || null,
                                  cashierId: admins[0]?.id || "default-cashier",
                                  cashierName: admins[0]?.name || "Admin",
                                  notes: posNotes || undefined,
                                  status: "completed"
                                })
                              });

                              if (!res.ok) {
                                const errorData = await res.json();
                                throw new Error(errorData.message || "Failed to process sale");
                              }

                              const transaction = await res.json();

                              if (!transaction || typeof transaction !== 'object' || !transaction.transactionNumber) {
                                console.error("Invalid transaction response:", transaction);
                                throw new Error("Transaction completed but response was invalid");
                              }

                              setLastTransaction(transaction);
                              setShowPosReceipt(true);
                              
                              // Reset cart
                              setPosCart([]);
                              setPosDiscount(0);
                              setPosGstPercentage(0);
                              setPosAmountReceived("");
                              setPosCustomerName("");
                              setPosCustomerPhone("");
                              setPosNotes("");
                              
                              // Reload products to update stock
                              await loadData();
                              
                              toast({ title: "Sale completed!", description: `Transaction ${transaction.transactionNumber} completed` });
                            } catch (error: any) {
                              console.error("POS Checkout Error:", error);
                              toast({ 
                                title: "Error", 
                                description: error.message || "Failed to process sale", 
                                variant: "destructive" 
                              });
                            }
                          }}
                        >
                          <Calculator size={20} className="mr-2" />
                          Complete Sale
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
              )}

              {posViewMode === "history" && (
                <Card className="rounded-none border-border shadow-none">
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-secondary/30">
                          <tr>
                            <th className="text-left p-4 text-xs uppercase tracking-wider font-semibold">Transaction #</th>
                            <th className="text-left p-4 text-xs uppercase tracking-wider font-semibold">Date</th>
                            <th className="text-left p-4 text-xs uppercase tracking-wider font-semibold">Items</th>
                            <th className="text-left p-4 text-xs uppercase tracking-wider font-semibold">Customer</th>
                            <th className="text-right p-4 text-xs uppercase tracking-wider font-semibold">Subtotal</th>
                            <th className="text-right p-4 text-xs uppercase tracking-wider font-semibold">GST</th>
                            <th className="text-right p-4 text-xs uppercase tracking-wider font-semibold">Total</th>
                            <th className="text-center p-4 text-xs uppercase tracking-wider font-semibold">Payment</th>
                            <th className="text-center p-4 text-xs uppercase tracking-wider font-semibold">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {posTransactions.length === 0 ? (
                            <tr>
                              <td colSpan={9} className="p-8 text-center text-muted-foreground">
                                No transactions found
                              </td>
                            </tr>
                          ) : (
                            posTransactions.map((tx: any) => (
                              <tr key={tx.id} className="hover:bg-secondary/10">
                                <td className="p-4 font-mono text-sm">{tx.transactionNumber}</td>
                                <td className="p-4 text-sm">
                                  {tx.createdAt ? new Date(tx.createdAt).toLocaleDateString() : "-"}
                                  <br />
                                  <span className="text-xs text-muted-foreground">
                                    {tx.createdAt ? new Date(tx.createdAt).toLocaleTimeString() : ""}
                                  </span>
                                </td>
                                <td className="p-4 text-sm">
                                  {tx.items?.length || 0} items
                                </td>
                                <td className="p-4 text-sm">
                                  {tx.customerName || "-"}
                                  {tx.customerPhone && <span className="block text-xs text-muted-foreground">{tx.customerPhone}</span>}
                                </td>
                                <td className="p-4 text-sm text-right">{formatCurrency(tx.subtotal || 0)}</td>
                                <td className="p-4 text-sm text-right">
                                  {tx.gstPercentage ? `${tx.gstPercentage}%` : "-"}
                                  {tx.gstAmount ? <span className="block text-xs text-muted-foreground">{formatCurrency(tx.gstAmount)}</span> : null}
                                </td>
                                <td className="p-4 text-sm text-right font-bold">{formatCurrency(tx.total || 0)}</td>
                                <td className="p-4 text-center">
                                  <span className={cn(
                                    "text-[10px] uppercase font-bold px-2 py-1 border",
                                    tx.paymentMethod === "cash" ? "bg-green-100 text-green-700 border-green-200" :
                                    tx.paymentMethod === "card" ? "bg-blue-100 text-blue-700 border-blue-200" :
                                    "bg-purple-100 text-purple-700 border-purple-200"
                                  )}>
                                    {tx.paymentMethod}
                                  </span>
                                </td>
                                <td className="p-4 text-center">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="rounded-none"
                                    onClick={() => {
                                      setSelectedTransaction(tx);
                                      setShowInvoiceModal(true);
                                    }}
                                  >
                                    <FileText size={14} className="mr-1" /> Invoice
                                  </Button>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              )}
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
                            <DropdownMenuContent className="rounded-none bg-background border border-border">
                              {orderStatuses.map(status => (
                                <DropdownMenuItem 
                                  key={status} 
                                  onClick={() => updateOrderStatus(order.id, status)}
                                  className="text-xs uppercase tracking-widest cursor-pointer bg-background hover:bg-secondary"
                                >
                                  {status.replace("_", " ")}
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>

                          <Dialog open={selectedOrder !== null} onOpenChange={(open) => { if (!open) setSelectedOrder(null); }}>
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
                            <DialogContent 
                              className="max-w-2xl rounded-none [&>button]:hidden max-h-[90vh] overflow-y-auto"
                              onPointerDownOutside={(e) => {
                                e.preventDefault();
                                setSelectedOrder(null);
                              }}
                              onEscapeKeyDown={(e) => {
                                e.preventDefault();
                                setSelectedOrder(null);
                              }}
                            >
                              <DialogHeader className="relative pr-8">
                                <DialogTitle className="font-serif text-2xl">Order: {selectedOrder?.orderNumber}</DialogTitle>
                                <DialogDescription className="uppercase tracking-widest text-[10px] font-bold">
                                  Status: {selectedOrder?.status.replace("_", " ")}
                                </DialogDescription>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="absolute -right-2 -top-2 h-10 w-10 rounded-none hover:bg-secondary transition-colors"
                                  onClick={() => setSelectedOrder(null)}
                                  data-testid="button-close-dialog-top"
                                >
                                  <X size={24} />
                                  <span className="sr-only">Close</span>
                                </Button>
                              </DialogHeader>
                              {selectedOrder && (
                                <div className="space-y-6">
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
                                    {selectedOrder.paymentMethod === "bank" && selectedOrder.paymentSlip && (
                                      <div>
                                        <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Payment Slip</p>
                                        <PaymentSlipViewer paymentSlip={selectedOrder.paymentSlip} />
                                      </div>
                                    )}
                                    {selectedOrder.paymentMethod === "bank" && !selectedOrder.paymentSlip && (
                                      <div>
                                        <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Payment Slip</p>
                                        <p className="text-sm text-amber-600">No payment slip uploaded</p>
                                      </div>
                                    )}
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
                                <div className="flex justify-end pt-4 border-t border-border mt-4 gap-4">
                                  <Button 
                                    variant="outline" 
                                    className="rounded-none uppercase tracking-widest text-xs font-bold px-8 h-10 gap-2"
                                    onClick={() => handlePrintLabel()}
                                    data-testid="button-print-label"
                                  >
                                    <Printer size={16} /> Print Label
                                  </Button>
                                  <Button 
                                    variant="outline" 
                                    className="rounded-none uppercase tracking-widest text-xs font-bold px-8 h-10"
                                    onClick={() => setSelectedOrder(null)}
                                    data-testid="button-close-dialog-bottom"
                                  >
                                    Close
                                  </Button>
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
                  <div className="space-y-4">
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
                    </div>
                    
                    <div className="flex flex-wrap gap-4 items-center">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold uppercase tracking-widest">Scope:</span>
                        <select 
                          value={newCouponScope}
                          onChange={(e) => setNewCouponScope(e.target.value)}
                          className="border px-3 py-2 text-sm rounded-none"
                        >
                          <option value="store">Store-wide</option>
                          <option value="category">Specific Categories</option>
                          <option value="product">Specific Products</option>
                        </select>
                      </div>
                      
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={newCouponAllowPreOrder}
                          onChange={(e) => setNewCouponAllowPreOrder(e.target.checked)}
                          className="w-4 h-4"
                        />
                        <span className="text-sm">Allow for Pre-orders</span>
                      </label>
                    </div>
                    
                    {newCouponScope === "category" && (
                      <div className="border p-3 bg-secondary/30">
                        <p className="text-xs font-bold uppercase tracking-widest mb-2">Select Categories:</p>
                        <div className="flex flex-wrap gap-2">
                          {categories.map((cat) => (
                            <label key={cat.id} className="flex items-center gap-2 cursor-pointer px-3 py-1.5 border bg-white">
                              <input
                                type="checkbox"
                                checked={newCouponCategories.includes(cat.name)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setNewCouponCategories([...newCouponCategories, cat.name]);
                                  } else {
                                    setNewCouponCategories(newCouponCategories.filter(c => c !== cat.name));
                                  }
                                }}
                                className="w-4 h-4"
                              />
                              <span className="text-sm">{cat.name}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {newCouponScope === "product" && (
                      <div className="border p-3 bg-secondary/30">
                        <p className="text-xs font-bold uppercase tracking-widest mb-2">Select Products:</p>
                        <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto">
                          {products.map((prod) => (
                            <label key={prod.id} className="flex items-center gap-2 cursor-pointer px-3 py-1.5 border bg-white">
                              <input
                                type="checkbox"
                                checked={newCouponProducts.includes(prod.id)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setNewCouponProducts([...newCouponProducts, prod.id]);
                                  } else {
                                    setNewCouponProducts(newCouponProducts.filter(p => p !== prod.id));
                                  }
                                }}
                                className="w-4 h-4"
                              />
                              <span className="text-sm">{prod.name}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
                    
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
                      <div key={coupon.id} className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4 flex-wrap">
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
                            <span className="text-[10px] uppercase font-bold px-2 py-0.5 bg-blue-100 text-blue-700">
                              {coupon.scope === "store" ? "Store-wide" : 
                               coupon.scope === "category" ? "Category" : "Product"}
                            </span>
                            {coupon.allowPreOrder && (
                              <span className="text-[10px] uppercase font-bold px-2 py-0.5 bg-purple-100 text-purple-700">
                                Pre-order OK
                              </span>
                            )}
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
                        {coupon.scope === "category" && coupon.allowedCategories && coupon.allowedCategories.length > 0 && (
                          <div className="mt-2 text-xs text-muted-foreground">
                            Categories: {coupon.allowedCategories.join(", ")}
                          </div>
                        )}
                        {coupon.scope === "product" && coupon.allowedProducts && coupon.allowedProducts.length > 0 && (
                          <div className="mt-2 text-xs text-muted-foreground">
                            Products: {coupon.allowedProducts.map(pId => 
                              products.find(p => p.id === pId)?.name || pId
                            ).join(", ")}
                          </div>
                        )}
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

      {/* Invoice Modal */}
      <Dialog open={showInvoiceModal} onOpenChange={setShowInvoiceModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto rounded-none">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl">Invoice</DialogTitle>
          </DialogHeader>
          {selectedTransaction && (
            <div id="invoice-content" className="p-8 bg-white">
              {/* Professional Invoice Header */}
              <div className="border-b-2 border-primary pb-6 mb-6">
                <div className="flex justify-between items-start">
                  <div>
                    <h1 className="text-3xl font-serif font-bold text-primary">INFINITE HOME</h1>
                    <p className="text-sm text-muted-foreground mt-1">Premium Home Essentials</p>
                    <p className="text-sm text-muted-foreground">Male', Maldives</p>
                  </div>
                  <div className="text-right">
                    <h2 className="text-2xl font-bold text-primary">INVOICE</h2>
                    <p className="text-sm font-mono mt-2">#{selectedTransaction.transactionNumber}</p>
                    <p className="text-sm text-muted-foreground">
                      {selectedTransaction.createdAt ? new Date(selectedTransaction.createdAt).toLocaleDateString('en-US', { 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                      }) : "-"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {selectedTransaction.createdAt ? new Date(selectedTransaction.createdAt).toLocaleTimeString() : ""}
                    </p>
                  </div>
                </div>
              </div>

              {/* Bill To Section */}
              <div className="grid grid-cols-2 gap-8 mb-8">
                <div>
                  <h3 className="text-xs uppercase tracking-wider font-semibold text-muted-foreground mb-2">Bill To</h3>
                  <p className="font-semibold">{selectedTransaction.customerName || "Walk-in Customer"}</p>
                  {selectedTransaction.customerPhone && (
                    <p className="text-sm text-muted-foreground">{selectedTransaction.customerPhone}</p>
                  )}
                </div>
                <div className="text-right">
                  <h3 className="text-xs uppercase tracking-wider font-semibold text-muted-foreground mb-2">Payment Method</h3>
                  <p className="font-semibold capitalize">{selectedTransaction.paymentMethod}</p>
                  <p className="text-sm text-muted-foreground">Cashier: {selectedTransaction.cashierName}</p>
                </div>
              </div>

              {/* Items Table */}
              <table className="w-full mb-8">
                <thead>
                  <tr className="border-b-2 border-primary">
                    <th className="text-left py-3 text-xs uppercase tracking-wider font-semibold">#</th>
                    <th className="text-left py-3 text-xs uppercase tracking-wider font-semibold">Item</th>
                    <th className="text-center py-3 text-xs uppercase tracking-wider font-semibold">Qty</th>
                    <th className="text-right py-3 text-xs uppercase tracking-wider font-semibold">Unit Price</th>
                    <th className="text-right py-3 text-xs uppercase tracking-wider font-semibold">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {selectedTransaction.items?.map((item: any, idx: number) => (
                    <tr key={idx}>
                      <td className="py-3 text-sm">{idx + 1}</td>
                      <td className="py-3">
                        <p className="font-medium">{item.name}</p>
                        {(item.color || item.size) && (
                          <p className="text-xs text-muted-foreground">
                            {[item.color, item.size].filter(Boolean).join(" / ")}
                          </p>
                        )}
                      </td>
                      <td className="py-3 text-center text-sm">{item.qty}</td>
                      <td className="py-3 text-right text-sm">{formatCurrency(item.price)}</td>
                      <td className="py-3 text-right text-sm font-medium">{formatCurrency(item.price * item.qty)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Totals Section */}
              <div className="flex justify-end">
                <div className="w-72 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Subtotal</span>
                    <span>{formatCurrency(selectedTransaction.subtotal || 0)}</span>
                  </div>
                  {selectedTransaction.discount > 0 && (
                    <div className="flex justify-between text-sm text-red-600">
                      <span>Discount</span>
                      <span>-{formatCurrency(selectedTransaction.discount)}</span>
                    </div>
                  )}
                  {(selectedTransaction.gstPercentage || 0) > 0 && (
                    <div className="flex justify-between text-sm">
                      <span>GST ({selectedTransaction.gstPercentage}%)</span>
                      <span>{formatCurrency(selectedTransaction.gstAmount || 0)}</span>
                    </div>
                  )}
                  {(selectedTransaction.gstPercentage || 0) === 0 && (
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <span>GST</span>
                      <span>N/A</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-lg border-t-2 border-primary pt-2">
                    <span>Total</span>
                    <span>{formatCurrency(selectedTransaction.total || 0)}</span>
                  </div>
                  {selectedTransaction.paymentMethod === "cash" && selectedTransaction.amountReceived && (
                    <>
                      <div className="flex justify-between text-sm">
                        <span>Amount Received</span>
                        <span>{formatCurrency(selectedTransaction.amountReceived)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Change</span>
                        <span>{formatCurrency(selectedTransaction.change || 0)}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="mt-12 pt-6 border-t border-border text-center text-sm text-muted-foreground">
                <p className="font-medium text-foreground mb-1">Thank you for your purchase!</p>
                <p>For any queries, please contact us at support@infinitehome.mv</p>
              </div>

              {selectedTransaction.notes && (
                <div className="mt-6 p-4 bg-secondary/30 text-sm">
                  <span className="font-semibold">Notes:</span> {selectedTransaction.notes}
                </div>
              )}
            </div>
          )}
          <div className="flex justify-end gap-3 mt-4">
            <Button variant="outline" className="rounded-none" onClick={() => setShowInvoiceModal(false)}>
              Close
            </Button>
            <Button
              className="rounded-none"
              onClick={() => {
                const printContent = document.getElementById("invoice-content");
                if (printContent) {
                  const printWindow = window.open("", "_blank");
                  if (printWindow) {
                    printWindow.document.write(`
                      <!DOCTYPE html>
                      <html>
                      <head>
                        <title>Invoice ${selectedTransaction?.transactionNumber || ""}</title>
                        <style>
                          @page { size: A4; margin: 20mm; }
                          body { 
                            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                            line-height: 1.6;
                            color: #333;
                            padding: 0;
                            margin: 0;
                          }
                          table { width: 100%; border-collapse: collapse; }
                          th, td { padding: 10px; text-align: left; }
                          th { border-bottom: 2px solid #333; }
                          td { border-bottom: 1px solid #eee; }
                          .text-right { text-align: right; }
                          .text-center { text-align: center; }
                          .font-bold { font-weight: bold; }
                          .text-sm { font-size: 0.875rem; }
                          .text-xs { font-size: 0.75rem; }
                          .text-muted { color: #666; }
                          .border-primary { border-color: #333; }
                          .uppercase { text-transform: uppercase; }
                          .tracking-wider { letter-spacing: 0.05em; }
                          @media print {
                            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                          }
                        </style>
                      </head>
                      <body>
                        ${printContent.innerHTML}
                      </body>
                      </html>
                    `);
                    printWindow.document.close();
                    printWindow.focus();
                    setTimeout(() => {
                      printWindow.print();
                      printWindow.close();
                    }, 250);
                  }
                }
              }}
            >
              <Printer size={16} className="mr-2" /> Print Invoice
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ProductImageUploader({ 
  currentImage, 
  onImageUploaded,
  onUploadSuccess,
  onUploadError
}: { 
  currentImage: string; 
  onImageUploaded: (path: string) => void;
  onUploadSuccess?: () => void;
  onUploadError?: (error: Error) => void;
}) {
  const { uploadFile, isUploading } = useUpload({
    endpoint: "/api/uploads/product-images",
    onSuccess: (response) => {
      onImageUploaded(response.objectPath);
      onUploadSuccess?.();
    },
    onError: (error) => {
      onUploadError?.(error);
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
