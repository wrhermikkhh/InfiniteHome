import { useState, useEffect, useMemo, useRef } from "react";
import { useAdminAuth, AdminPermissions, DEFAULT_PERMISSIONS } from "@/lib/auth";
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
import { Product, formatCurrency, getVariantSalePrice } from "@/lib/products";
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
import { Switch } from "@/components/ui/switch";
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

// Helper function to resolve variant stock with fallback matching
function resolveVariantStock(variantStock: { [key: string]: number } | null, size: string, color: string): number {
  if (!variantStock || Object.keys(variantStock).length === 0) return 0;
  
  const variantKey = `${size}-${color}`;
  
  // Try exact match first
  if (variantStock[variantKey] !== undefined) {
    return variantStock[variantKey];
  }
  
  // Try case-insensitive match
  const matchingKey = Object.keys(variantStock).find(key => 
    key.toLowerCase() === variantKey.toLowerCase()
  );
  if (matchingKey) {
    return variantStock[matchingKey];
  }
  
  // Try partial match (just size or just color)
  const sizeMatch = Object.keys(variantStock).find(key => 
    key.toLowerCase().startsWith(size.toLowerCase() + '-')
  );
  const colorMatch = Object.keys(variantStock).find(key => 
    key.toLowerCase().endsWith('-' + color.toLowerCase())
  );
  if (sizeMatch) return variantStock[sizeMatch];
  if (colorMatch) return variantStock[colorMatch];
  
  return 0;
}

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
        {colorVar.image && (
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-8 text-[10px] rounded-none text-amber-600 flex-shrink-0"
            onClick={() => handleUrlChange("")}
          >
            <X size={12} className="mr-1" /> Clear
          </Button>
        )}
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
  const [orderNoteText, setOrderNoteText] = useState("");
  const [savingOrderNote, setSavingOrderNote] = useState(false);
  const [posNoteText, setPosNoteText] = useState("");
  const [savingPosNote, setSavingPosNote] = useState(false);
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
  const [newAdminPermissions, setNewAdminPermissions] = useState<AdminPermissions>({ ...DEFAULT_PERMISSIONS });
  const [editingAdminPermissions, setEditingAdminPermissions] = useState<{ [adminId: string]: AdminPermissions }>({});
  const [adminPasswordInputs, setAdminPasswordInputs] = useState<{ [adminId: string]: string }>({});
  const [savingPermissions, setSavingPermissions] = useState<{ [adminId: string]: boolean }>({});
  const [savingPassword, setSavingPassword] = useState<{ [adminId: string]: boolean }>({});

  // Search states for filtering
  const [inventorySearch, setInventorySearch] = useState("");
  const [orderFilter, setOrderFilter] = useState<"all" | "active" | "completed">("all");

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
  const [showPosLabelModal, setShowPosLabelModal] = useState(false);
  const [posLabelForm, setPosLabelForm] = useState({ recipientName: "", recipientEmail: "", streetAddress: "", atollIsland: "", phone: "", deliveryType: "standard" });
  const [posDeliveries, setPosDeliveries] = useState<any[]>([]);
  const [showPosVariantModal, setShowPosVariantModal] = useState(false);
  const [selectedPosProduct, setSelectedPosProduct] = useState<any>(null);
  const [selectedPosSize, setSelectedPosSize] = useState("");
  const [selectedPosColor, setSelectedPosColor] = useState("");

  const [productForm, setProductForm] = useState({
    name: "",
    price: "",
    salePrice: "",
    saleMode: "percentage" as "percentage" | "fixed",
    salePercent: "",
    isOnSale: false,
    category: "",
    description: "",
    image: "https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?auto=format&fit=crop&q=80",
    images: [] as string[],
    colorVariants: [{ name: "", image: "" }] as { name: string; image: string }[],
    variants: [{ size: "", price: "" }],
    variantStock: {} as { [key: string]: string },
    expressCharge: "",
    sizeGuide: [] as { measurement: string; sizes: { [key: string]: string } }[],
    certifications: [] as string[],
    isPreOrder: false,
    preOrderPrice: "",
    preOrderInitialPayment: "",
    preOrderEta: "",
    productDetails: "",
    materialsAndCare: "",
    maxOrderQty: ""
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
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow';
    document.head.appendChild(meta);
    return () => { document.head.removeChild(meta); };
  }, []);

  useEffect(() => {
    if (isAdminAuthenticated) {
      loadData();
    }
  }, [isAdminAuthenticated]);

  useEffect(() => {
    if (selectedOrder) setOrderNoteText((selectedOrder as any).adminNote || "");
    else setOrderNoteText("");
  }, [(selectedOrder as any)?.id]);

  useEffect(() => {
    if (selectedTransaction) setPosNoteText((selectedTransaction as any).adminNote || "");
    else setPosNoteText("");
  }, [(selectedTransaction as any)?.id]);

  const loadData = async () => {
    try {
      const [productsData, ordersData, couponsData, adminsData, categoriesData, posDeliveriesData] = await Promise.all([
        api.getProducts(),
        api.getOrders(),
        api.getCoupons(),
        api.getAdmins(),
        api.getCategories(),
        api.getPosTransactionsWithLabels(),
      ]);
      setProducts(productsData);
      setOrders(ordersData);
      setCoupons(couponsData);
      setAdmins(adminsData);
      setCategories(categoriesData);
      setPosDeliveries(posDeliveriesData);
    } catch (error) {
      console.error("Failed to load data:", error);
    }
  };

  const handleSaveOrderNote = async () => {
    if (!selectedOrder) return;
    setSavingOrderNote(true);
    try {
      const updated = await api.updateOrderAdminNote(selectedOrder.id, orderNoteText.trim() || null);
      setOrders(prev => prev.map(o => o.id === updated.id ? updated : o));
      setSelectedOrder(updated);
    } catch {}
    setSavingOrderNote(false);
  };

  const handleSavePosNote = async () => {
    if (!selectedTransaction) return;
    setSavingPosNote(true);
    try {
      const updated = await api.updatePosTransaction(selectedTransaction.id, { adminNote: posNoteText.trim() || null } as any);
      if (updated) {
        setPosTransactions((prev: any[]) => prev.map((t: any) => t.id === updated.id ? updated : t));
        setSelectedTransaction(updated);
      }
    } catch {}
    setSavingPosNote(false);
  };

  const handlePrintOrderInvoice = (order: typeof orders[0]) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    const esc = (s: string) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const items = (order.items as any[]) || [];
    const subtotal = items.reduce((s: number, i: any) => s + (i.price || 0) * (i.qty || 1), 0);
    const invoiceDate = order.invoicedAt ? new Date(order.invoicedAt) : new Date(order.createdAt || '');
    const dateStr = invoiceDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const rowsHtml = items.map((item: any) => `
      <tr>
        <td style="padding:10px 8px;border-bottom:1px solid #e7e5e4;">${esc(item.name)}${item.size && item.size !== 'Standard' ? ` <span style="color:#78716c;font-size:12px;">(${esc(item.size)})</span>` : ''}${item.color && item.color !== 'Default' ? ` <span style="color:#78716c;font-size:12px;">– ${esc(item.color)}</span>` : ''}</td>
        <td style="padding:10px 8px;border-bottom:1px solid #e7e5e4;text-align:center;">${item.qty}</td>
        <td style="padding:10px 8px;border-bottom:1px solid #e7e5e4;text-align:right;">MVR ${Number(item.price || 0).toLocaleString()}</td>
        <td style="padding:10px 8px;border-bottom:1px solid #e7e5e4;text-align:right;">MVR ${(Number(item.price || 0) * Number(item.qty || 1)).toLocaleString()}</td>
      </tr>`).join('');
    printWindow.document.write(`<!DOCTYPE html><html><head><title>Invoice ${esc(order.invoiceNumber || '')}</title>
      <style>@page{size:A4;margin:20mm 15mm;}*{margin:0;padding:0;box-sizing:border-box;}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1c1917;font-size:14px;line-height:1.5;}</style>
    </head><body>
      <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #1c1917;padding-bottom:20px;margin-bottom:28px;">
        <div><div style="font-size:24px;font-weight:300;letter-spacing:4px;">INFINITE HOME</div><div style="font-size:11px;color:#78716c;letter-spacing:2px;margin-top:4px;">PREMIUM LIVING</div></div>
        <div style="text-align:right;"><div style="font-size:22px;font-weight:300;letter-spacing:3px;">INVOICE</div><div style="font-family:monospace;font-size:14px;font-weight:700;margin-top:4px;">${esc(order.invoiceNumber || '')}</div><div style="font-size:12px;color:#78716c;margin-top:2px;">${dateStr}</div></div>
      </div>
      <div style="display:flex;gap:40px;margin-bottom:28px;">
        <div style="flex:1;"><div style="font-size:10px;text-transform:uppercase;letter-spacing:2px;color:#78716c;margin-bottom:6px;">Bill To</div><div style="font-weight:600;">${esc(order.customerName)}</div><div style="color:#57534e;">${esc(order.customerEmail || '')}</div><div style="color:#57534e;">${esc(order.customerPhone || '')}</div></div>
        <div><div style="font-size:10px;text-transform:uppercase;letter-spacing:2px;color:#78716c;margin-bottom:6px;">Order Details</div><div><span style="color:#78716c;">Order #</span> <span style="font-family:monospace;font-weight:600;">${esc(order.orderNumber)}</span></div><div style="margin-top:2px;"><span style="color:#78716c;">Payment</span> <span style="font-weight:500;">${esc(order.paymentMethod || '')}</span></div></div>
      </div>
      <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
        <thead><tr style="background:#f5f5f4;">
          <th style="padding:10px 8px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#78716c;">Item</th>
          <th style="padding:10px 8px;text-align:center;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#78716c;">Qty</th>
          <th style="padding:10px 8px;text-align:right;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#78716c;">Price</th>
          <th style="padding:10px 8px;text-align:right;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#78716c;">Total</th>
        </tr></thead>
        <tbody>${rowsHtml}</tbody>
      </table>
      <div style="display:flex;justify-content:flex-end;margin-bottom:40px;">
        <div style="width:240px;">
          <div style="display:flex;justify-content:space-between;padding:6px 0;color:#57534e;"><span>Subtotal</span><span>MVR ${subtotal.toLocaleString()}</span></div>
          ${order.discount ? `<div style="display:flex;justify-content:space-between;padding:6px 0;color:#16a34a;"><span>Discount</span><span>-MVR ${Number(order.discount).toLocaleString()}</span></div>` : ''}
          ${order.shipping ? `<div style="display:flex;justify-content:space-between;padding:6px 0;color:#57534e;"><span>Shipping</span><span>MVR ${Number(order.shipping).toLocaleString()}</span></div>` : ''}
          <div style="display:flex;justify-content:space-between;padding:10px 0;border-top:2px solid #1c1917;margin-top:6px;font-weight:700;font-size:16px;"><span>Total</span><span>MVR ${Number(order.total).toLocaleString()}</span></div>
        </div>
      </div>
      <div style="border-top:1px solid #e7e5e4;padding-top:16px;text-align:center;color:#78716c;font-size:11px;letter-spacing:1px;">THANK YOU FOR SHOPPING WITH INFINITE HOME</div>
    </body></html>`);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 250);
  };

  const handlePrintLabel = async () => {
    if (!selectedOrder) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const escHtml = (s: string) => String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

    const escJs = (s: string) => String(s)
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'")
      .replace(/\r/g, '\\r')
      .replace(/\n/g, '\\n');

    const itemsText = selectedOrder.items.map((item: any) =>
      escHtml(`${item.qty}x ${item.name}${item.size && item.size !== 'Standard' ? ` (${item.size})` : ''}${item.color && item.color !== 'Default' ? ` - ${item.color}` : ''}`)
    ).join(' | ');

    const deliveryLabel = (selectedOrder.deliveryType === 'express' || selectedOrder.shipping > 0)
      ? 'EXPRESS DELIVERY'
      : 'STANDARD DELIVERY';

    const orderDate = selectedOrder.createdAt
      ? new Date(selectedOrder.createdAt).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })
      : '';

    // Fetch QR code as base64 to ensure it loads
    const trackingRef = selectedOrder.trackingNumber || selectedOrder.orderNumber;
    const safeOrderNum = escJs(trackingRef);
    let qrCodeBase64 = '';
    try {
      const trackingUrl = `${window.location.origin}/track?order=${trackingRef}`;
      const response = await fetch(`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(trackingUrl)}`);
      const blob = await response.blob();
      qrCodeBase64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.error('Failed to load QR code:', error);
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <title>Shipping Label - ${selectedOrder.orderNumber}</title>
          <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"><\/script>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body {
              font-family: Arial, Helvetica, sans-serif;
              background: white;
              color: #000;
              width: 4in;
              margin: 0 auto;
            }
            .label {
              width: 4in;
              border: 2px solid #000;
              background: white;
            }

            /* TOP HEADER ROW */
            .top-header {
              display: flex;
              flex-direction: column;
              border-bottom: 3px solid #000;
            }
            .top-header-row {
              display: flex;
              align-items: stretch;
              min-height: 1.0in;
            }
            .top-left {
              flex: 1;
              padding: 0.1in 0.12in;
              display: flex;
              flex-direction: column;
              justify-content: center;
              border-right: 2px solid #000;
            }
            .company-name {
              font-size: 20pt;
              font-weight: 900;
              letter-spacing: -1px;
              line-height: 1;
            }
            .company-sub {
              font-size: 7pt;
              color: #333;
              margin-top: 3px;
              font-weight: bold;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
            .top-right {
              flex: 0 0 1.35in;
              padding: 0.08in 0.1in;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              gap: 4px;
            }
            .qr-img {
              width: 80px;
              height: 80px;
              image-rendering: pixelated;
            }
            .order-ref {
              font-size: 7.5pt;
              font-weight: bold;
              font-family: 'Courier New', monospace;
              letter-spacing: 1px;
              text-align: center;
            }
            .order-date {
              font-size: 6.5pt;
              color: #444;
              text-align: center;
            }
            .header-barcode-strip {
              border-top: 2px solid #000;
              padding: 0.04in 0.12in;
              overflow: hidden;
              background: white;
            }
            #header-barcode {
              width: 100%;
              height: 28px;
            }

            /* DELIVERY TYPE BANNER */
            .delivery-banner {
              border-bottom: 3px solid #000;
              padding: 0.09in 0.12in;
              text-align: center;
            }
            .delivery-banner-text {
              font-size: 17pt;
              font-weight: 900;
              letter-spacing: 0.5px;
              line-height: 1;
            }

            /* FROM & SHIP-TO */
            .addresses {
              border-bottom: 3px solid #000;
              padding: 0.1in 0.12in;
            }
            .from-block {
              margin-bottom: 0.1in;
            }
            .from-label {
              font-size: 7pt;
              font-weight: bold;
              text-transform: uppercase;
              color: #555;
            }
            .from-name {
              font-size: 9pt;
              font-weight: bold;
              margin-top: 2px;
            }
            .from-addr {
              font-size: 8.5pt;
              color: #222;
            }

            .ship-to-block {
              display: flex;
              gap: 0.08in;
              align-items: flex-start;
            }
            .ship-to-label-col {
              font-size: 9pt;
              font-weight: 900;
              text-transform: uppercase;
              line-height: 1.1;
              white-space: nowrap;
              padding-top: 2px;
            }
            .ship-to-details {
              flex: 1;
            }
            .ship-to-name {
              font-size: 14pt;
              font-weight: 900;
              line-height: 1.15;
            }
            .ship-to-addr {
              font-size: 11pt;
              line-height: 1.3;
              margin-top: 2px;
            }
            .ship-to-phone {
              font-size: 9pt;
              color: #333;
              margin-top: 3px;
            }

            /* ITEMS ROW */
            .items-section {
              border-bottom: 3px solid #000;
              padding: 0.07in 0.12in;
            }
            .items-label {
              font-size: 6.5pt;
              font-weight: bold;
              text-transform: uppercase;
              color: #666;
              margin-bottom: 3px;
            }
            .items-text {
              font-size: 8pt;
              line-height: 1.4;
            }
            .payment-info {
              font-size: 7pt;
              color: #444;
              margin-top: 3px;
              font-weight: bold;
            }

            /* TRACKING SECTION */
            .tracking-section {
              padding: 0.08in 0.12in 0.1in;
              text-align: center;
            }
            .tracking-label {
              font-size: 10pt;
              font-weight: 900;
              text-transform: uppercase;
              letter-spacing: 2px;
              margin-bottom: 0.06in;
            }
            .barcode-container {
              width: 100%;
              overflow: hidden;
            }
            #barcode {
              width: 100%;
              height: 70px;
            }
            .tracking-number {
              font-size: 11pt;
              font-weight: bold;
              font-family: 'Courier New', monospace;
              letter-spacing: 2px;
              margin-top: 0.05in;
            }

            @media print {
              @page { margin: 0; size: 4in 6in; }
              body { margin: 0; width: 4in; }
              .label { border: none; }
            }
          </style>
        </head>
        <body>
          <div class="label">

            <!-- TOP HEADER -->
            <div class="top-header">
              <div class="top-header-row">
                <div class="top-left">
                  <div class="company-name">INFINITE<br>HOME</div>
                  <div class="company-sub">Malé, Maldives</div>
                </div>
                <div class="top-right">
                  ${qrCodeBase64 ? `<img src="${qrCodeBase64}" alt="QR" class="qr-img">` : ''}
                  <div class="order-ref">${escHtml(selectedOrder.orderNumber)}</div>
                  <div class="order-date">${escHtml(orderDate)}</div>
                </div>
              </div>
              <!-- Thin barcode strip spanning full width -->
              <div class="header-barcode-strip">
                <svg id="header-barcode"></svg>
              </div>
            </div>

            <!-- DELIVERY BANNER -->
            <div class="delivery-banner">
              <div class="delivery-banner-text">${deliveryLabel}</div>
            </div>

            <!-- ADDRESSES -->
            <div class="addresses">
              <div class="from-block">
                <div class="from-label">From:</div>
                <div class="from-name">INFINITE HOME</div>
                <div class="from-addr">Malé, Maldives</div>
              </div>
              <div class="ship-to-block">
                <div class="ship-to-label-col">SHIP<br>TO:</div>
                <div class="ship-to-details">
                  <div class="ship-to-name">${escHtml(selectedOrder.customerName)}</div>
                  <div class="ship-to-addr">${escHtml(selectedOrder.shippingAddress)}${selectedOrder.customerAtollIsland ? `, ${escHtml(selectedOrder.customerAtollIsland)}` : ''}</div>
                  <div class="ship-to-phone">Tel: ${escHtml(selectedOrder.customerPhone)}</div>
                </div>
              </div>
            </div>

            <!-- ITEMS -->
            <div class="items-section">
              <div class="items-label">Package Contents</div>
              <div class="items-text">${itemsText}</div>
              <div class="payment-info">Payment: ${selectedOrder.paymentMethod === 'cod' ? 'Cash on Delivery' : 'Bank Transfer'}</div>
            </div>

            <!-- TRACKING -->
            <div class="tracking-section">
              <div class="tracking-label">Tracking #</div>
              <div class="barcode-container">
                <svg id="barcode"></svg>
              </div>
              <div class="tracking-number">${escHtml(trackingRef)}</div>
            </div>

          </div>

          <script>
            var printed = false;

            function renderAndPrint() {
              if (printed) return;
              printed = true;

              try {
                JsBarcode('#header-barcode', '${safeOrderNum}', {
                  format: 'CODE128',
                  width: 1.5,
                  height: 28,
                  displayValue: false,
                  margin: 0,
                });
                JsBarcode('#barcode', '${safeOrderNum}', {
                  format: 'CODE128',
                  width: 2.2,
                  height: 70,
                  displayValue: false,
                  margin: 0,
                });
              } catch (e) {
                document.body.innerHTML = '<p style="color:red;font-size:13pt;padding:20px;">Barcode render error: ' + e.message + '</p>';
                return;
              }

              var qrImg = document.querySelector('.qr-img');
              var qrReady = (qrImg && !qrImg.complete)
                ? new Promise(function(resolve) { qrImg.onload = resolve; qrImg.onerror = resolve; })
                : Promise.resolve();

              qrReady.then(function() {
                window.print();
                window.close();
              });
            }

            function onBarcodeLoadError() {
              printed = true;
              document.body.innerHTML = '<p style="color:red;font-size:13pt;padding:20px;">Could not load barcode library. Check your internet connection and try again.</p>';
            }

            var barcodeScript = document.querySelector('script[src*="jsbarcode"]');
            if (typeof JsBarcode !== 'undefined') {
              renderAndPrint();
            } else if (barcodeScript) {
              barcodeScript.addEventListener('load', renderAndPrint);
              barcodeScript.addEventListener('error', onBarcodeLoadError);
            } else {
              onBarcodeLoadError();
            }
          <\/script>
        </body>
      </html>
    `);
    printWindow.document.close();

    // Set delivery status to label_created after printing
    try {
      const updated = await api.updateOrderDeliveryStatus(selectedOrder.id, 'label_created');
      setOrders(prev => prev.map(o => o.id === updated.id ? updated : o));
      if (selectedOrder && selectedOrder.id === updated.id) {
        setSelectedOrder(updated);
      }
    } catch (e) {
      console.error("Failed to set label_created status", e);
    }
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
    try {
      const success = await login(email, password);
      if (!success) {
        setError("Invalid credentials");
      }
    } catch (err) {
      setError("Unable to connect. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handlePrintPosLabel = async () => {
    if (!selectedTransaction) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const escHtml = (s: string) => String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    const escJs = (s: string) => String(s)
      .replace(/\\/g, '\\\\').replace(/'/g, "\\'")
      .replace(/\r/g, '\\r').replace(/\n/g, '\\n');

    const itemsText = selectedTransaction.items.map((item: any) =>
      escHtml(`${item.qty}x ${item.name}${item.size && item.size !== 'Standard' ? ` (${item.size})` : ''}${item.color && item.color !== 'Default' ? ` - ${item.color}` : ''}`)
    ).join(' | ');

    const txDate = selectedTransaction.createdAt
      ? new Date(selectedTransaction.createdAt).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })
      : '';

    const cleanTrackingNumber = selectedTransaction.trackingNumber
      || selectedTransaction.transactionNumber.replace(/^POS-/, '').replace(/-/g, '');
    const safeRef = escJs(cleanTrackingNumber);
    const fullAddress = posLabelForm.atollIsland
      ? `${posLabelForm.streetAddress}, ${posLabelForm.atollIsland}`
      : posLabelForm.streetAddress;

    let qrCodeBase64 = '';
    try {
      const trackingUrl = `${window.location.origin}/track?order=${cleanTrackingNumber}`;
      const response = await fetch(`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(trackingUrl)}`);
      const blob = await response.blob();
      qrCodeBase64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });
    } catch {}

    printWindow.document.write(`
      <!DOCTYPE html><html><head>
        <meta charset="UTF-8">
        <title>Shipping Label - ${selectedTransaction.transactionNumber}</title>
        <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"><\/script>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: Arial, Helvetica, sans-serif; background: white; color: #000; width: 4in; margin: 0 auto; }
          .label { width: 4in; border: 2px solid #000; background: white; }
          .top-header { display: flex; flex-direction: column; border-bottom: 3px solid #000; }
          .top-header-row { display: flex; align-items: stretch; min-height: 1.0in; }
          .top-left { flex: 1; padding: 0.1in 0.12in; display: flex; flex-direction: column; justify-content: center; border-right: 2px solid #000; }
          .company-name { font-size: 20pt; font-weight: 900; letter-spacing: -1px; line-height: 1; }
          .company-sub { font-size: 7pt; color: #333; margin-top: 3px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; }
          .top-right { flex: 0 0 1.35in; padding: 0.08in 0.1in; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; }
          .qr-img { width: 80px; height: 80px; image-rendering: pixelated; }
          .order-ref { font-size: 7.5pt; font-weight: bold; font-family: 'Courier New', monospace; letter-spacing: 1px; text-align: center; }
          .order-date { font-size: 6.5pt; color: #444; text-align: center; }
          .header-barcode-strip { border-top: 2px solid #000; padding: 0.04in 0.12in; overflow: hidden; background: white; }
          #header-barcode { width: 100%; height: 28px; }
          .delivery-banner { border-bottom: 3px solid #000; padding: 0.09in 0.12in; text-align: center; }
          .delivery-banner-text { font-size: 17pt; font-weight: 900; letter-spacing: 0.5px; line-height: 1; }
          .addresses { border-bottom: 3px solid #000; padding: 0.1in 0.12in; }
          .from-block { margin-bottom: 0.1in; }
          .from-label { font-size: 7pt; font-weight: bold; text-transform: uppercase; color: #555; }
          .from-name { font-size: 9pt; font-weight: bold; margin-top: 2px; }
          .from-addr { font-size: 8.5pt; color: #222; }
          .ship-to-block { display: flex; gap: 0.08in; align-items: flex-start; }
          .ship-to-label-col { font-size: 9pt; font-weight: 900; text-transform: uppercase; line-height: 1.1; white-space: nowrap; padding-top: 2px; }
          .ship-to-details { flex: 1; }
          .ship-to-name { font-size: 14pt; font-weight: 900; line-height: 1.15; }
          .ship-to-addr { font-size: 11pt; line-height: 1.3; margin-top: 2px; }
          .ship-to-phone { font-size: 9pt; color: #333; margin-top: 3px; }
          .items-section { border-bottom: 3px solid #000; padding: 0.07in 0.12in; }
          .items-label { font-size: 6.5pt; font-weight: bold; text-transform: uppercase; color: #666; margin-bottom: 3px; }
          .items-text { font-size: 8pt; line-height: 1.4; }
          .payment-info { font-size: 7pt; color: #444; margin-top: 3px; font-weight: bold; }
          .tracking-section { padding: 0.08in 0.12in 0.1in; text-align: center; }
          .tracking-label { font-size: 10pt; font-weight: 900; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 0.06in; }
          .barcode-container { width: 100%; overflow: hidden; }
          #barcode { width: 100%; height: 70px; }
          .tracking-number { font-size: 11pt; font-weight: bold; font-family: 'Courier New', monospace; letter-spacing: 2px; margin-top: 0.05in; }
          @media print { @page { margin: 0; size: 4in 6in; } body { margin: 0; width: 4in; } .label { border: none; } }
        </style>
      </head><body>
        <div class="label">
          <div class="top-header">
            <div class="top-header-row">
              <div class="top-left">
                <div class="company-name">INFINITE<br>HOME</div>
                <div class="company-sub">Malé, Maldives</div>
              </div>
              <div class="top-right">
                ${qrCodeBase64 ? `<img src="${qrCodeBase64}" alt="QR" class="qr-img">` : ''}
                <div class="order-ref">${escHtml(cleanTrackingNumber)}</div>
                <div class="order-date">${escHtml(txDate)}</div>
              </div>
            </div>
            <div class="header-barcode-strip"><svg id="header-barcode"></svg></div>
          </div>
          <div class="delivery-banner"><div class="delivery-banner-text">${posLabelForm.deliveryType === 'express' ? 'EXPRESS DELIVERY' : 'STANDARD DELIVERY'}</div></div>
          <div class="addresses">
            <div class="from-block">
              <div class="from-label">From:</div>
              <div class="from-name">INFINITE HOME</div>
              <div class="from-addr">Malé, Maldives</div>
            </div>
            <div class="ship-to-block">
              <div class="ship-to-label-col">SHIP<br>TO:</div>
              <div class="ship-to-details">
                <div class="ship-to-name">${escHtml(posLabelForm.recipientName)}</div>
                <div class="ship-to-addr">${escHtml(fullAddress)}</div>
                <div class="ship-to-phone">Tel: ${escHtml(posLabelForm.phone)}</div>
              </div>
            </div>
          </div>
          <div class="items-section">
            <div class="items-label">Package Contents</div>
            <div class="items-text">${itemsText}</div>
            <div class="payment-info">Payment: ${escHtml(selectedTransaction.paymentMethod)}</div>
          </div>
          <div class="tracking-section">
            <div class="tracking-label">Tracking #</div>
            <div class="barcode-container"><svg id="barcode"></svg></div>
            <div class="tracking-number">${escHtml(cleanTrackingNumber)}</div>
          </div>
        </div>
        <script>
          var printed = false;
          function renderAndPrint() {
            if (printed) return; printed = true;
            try {
              JsBarcode('#header-barcode', '${safeRef}', { format: 'CODE128', width: 1.5, height: 28, displayValue: false, margin: 0 });
              JsBarcode('#barcode', '${safeRef}', { format: 'CODE128', width: 2.2, height: 70, displayValue: false, margin: 0 });
            } catch(e) { return; }
            var qrImg = document.querySelector('.qr-img');
            var qrReady = (qrImg && !qrImg.complete)
              ? new Promise(function(r) { qrImg.onload = r; qrImg.onerror = r; })
              : Promise.resolve();
            qrReady.then(function() { setTimeout(function() { window.print(); window.close(); }, 300); });
          }
          if (document.readyState === 'complete') renderAndPrint();
          else window.addEventListener('load', renderAndPrint);
        <\/script>
      </body></html>
    `);
    printWindow.document.close();
    setShowPosLabelModal(false);

    // Save label info to the transaction so it appears in Orders tab
    try {
      const updated = await api.updatePosTransaction(selectedTransaction.id, {
        labelRecipientName: posLabelForm.recipientName,
        labelRecipientEmail: posLabelForm.recipientEmail || null,
        labelAddress: fullAddress,
        labelPhone: posLabelForm.phone,
        labelDeliveryType: posLabelForm.deliveryType,
        deliveryStatus: "label_created",
      });
      setPosDeliveries(prev => {
        const exists = prev.find(d => d.id === updated.id);
        if (exists) return prev.map(d => d.id === updated.id ? updated : d);
        return [updated, ...prev];
      });
    } catch (e) {
      console.error("Failed to save label info", e);
    }
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
      salePrice: productForm.isOnSale && productForm.saleMode === 'fixed' && productForm.salePrice
        ? Number(productForm.salePrice) : null,
      salePercent: productForm.isOnSale && productForm.saleMode === 'percentage' && productForm.salePercent
        ? Number(productForm.salePercent) : null,
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
      variants: (() => {
        const filtered = productForm.variants.filter(v => v.size && v.price).map(v => ({
          size: v.size.trim(),
          price: Number(v.price)
        }));
        if (filtered.length > 0) return filtered;
        const basePrice = Number(productForm.price) || 0;
        return [{ size: 'Standard', price: basePrice }];
      })(),
      stock: 0,
      variantStock: (() => {
        const hasRealVariants = productForm.variants.filter(v => v.size && v.price).length > 0;
        if (hasRealVariants) return variantStockNumbers;
        const colorNames = productForm.colorVariants.filter(cv => cv.name.trim()).map(cv => cv.name.trim());
        if (colorNames.length > 0) {
          const defaults: { [key: string]: number } = {};
          colorNames.forEach(c => {
            const key = `Standard-${c}`;
            defaults[key] = variantStockNumbers[key] ?? 0;
          });
          return defaults;
        }
        return { 'Standard-Default': variantStockNumbers['Standard-Default'] ?? 0 };
      })(),
      expressCharge: productForm.expressCharge ? Number(productForm.expressCharge) : 0,
      sizeGuide: productForm.sizeGuide.filter(sg => sg.measurement && Object.keys(sg.sizes).length > 0),
      certifications: productForm.certifications,
      isPreOrder: productForm.isPreOrder,
      preOrderPrice: productForm.isPreOrder && productForm.preOrderPrice ? Number(productForm.preOrderPrice) : null,
      preOrderInitialPayment: productForm.isPreOrder && productForm.preOrderInitialPayment ? Number(productForm.preOrderInitialPayment) : null,
      preOrderEta: productForm.isPreOrder ? productForm.preOrderEta : null,
      productDetails: productForm.productDetails || null,
      materialsAndCare: productForm.materialsAndCare || null,
      maxOrderQty: productForm.maxOrderQty ? Number(productForm.maxOrderQty) : null
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
      saleMode: "percentage" as "percentage" | "fixed",
      salePercent: "",
      isOnSale: false,
      category: "", 
      description: "", 
      image: "https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?auto=format&fit=crop&q=80", 
      images: [],
      colorVariants: [{ name: "", image: "" }],
      variants: [{ size: "", price: "" }],
      variantStock: {},
      expressCharge: "",
      sizeGuide: [],
      certifications: [],
      isPreOrder: false,
      preOrderPrice: "",
      preOrderInitialPayment: "",
      preOrderEta: "",
      productDetails: "",
      materialsAndCare: "",
      maxOrderQty: ""
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
      saleMode: ((product as any).salePercent ? "percentage" : (product as any).salePrice ? "fixed" : "percentage") as "percentage" | "fixed",
      salePercent: ((product as any).salePercent || "").toString(),
      isOnSale: (product as any).isOnSale || false,
      category: product.category,
      description: product.description || "",
      image: product.image,
      images: (product as any).images || [],
      colorVariants: (() => {
        const colors = product.colors || [];
        const colorImages = (product as any).colorImages || {};
        if (colors.length === 0 && Object.keys(existingVariantStock).length > 0) {
          const derivedColors = Array.from(new Set(Object.keys(existingVariantStock).map(k => { const parts = k.split('-'); return parts.slice(1).join('-') || 'Default'; })));
          return derivedColors.map(c => ({ name: c, image: colorImages[c] || "" }));
        }
        if (colors.length === 0) return [{ name: "", image: "" }];
        return colors.map((c: string) => ({ name: c, image: colorImages[c] || "" }));
      })(),
      variants: product.variants && product.variants.length > 0 
        ? product.variants.map(v => ({ size: v.size, price: v.price.toString() }))
        : Object.keys(existingVariantStock).length > 0
          ? Array.from(new Set(Object.keys(existingVariantStock).map(k => k.split('-')[0]))).map(size => ({ size, price: product.price.toString() }))
          : [{ size: "", price: product.price.toString() }],
      variantStock: variantStockStrings,
      expressCharge: (product.expressCharge || 0).toString(),
      sizeGuide: (product as any).sizeGuide || [],
      certifications: (product as any).certifications || [],
      isPreOrder: (product as any).isPreOrder || false,
      preOrderPrice: ((product as any).preOrderPrice || "").toString(),
      preOrderInitialPayment: ((product as any).preOrderInitialPayment || "").toString(),
      preOrderEta: (product as any).preOrderEta || "",
      productDetails: (product as any).productDetails || "",
      materialsAndCare: (product as any).materialsAndCare || "",
      maxOrderQty: ((product as any).maxOrderQty || "").toString()
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
        password: newAdminPassword,
        permissions: newAdminPermissions,
      });
      await loadData();
      setNewAdminEmail("");
      setNewAdminPassword("");
      setNewAdminName("");
      setNewAdminPermissions({ ...DEFAULT_PERMISSIONS });
      toast({ title: "Admin added", description: `${newAdminName} can now access the panel` });
    } catch (error) {
      console.error("Failed to add admin:", error);
      toast({ title: "Error", description: "Failed to add admin", variant: "destructive" });
    }
  };

  const handleUpdatePermissions = async (adminId: string) => {
    const perms = editingAdminPermissions[adminId];
    if (!perms) return;
    setSavingPermissions(p => ({ ...p, [adminId]: true }));
    try {
      await fetch(`/api/admins/${adminId}/permissions`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(perms),
      });
      await loadData();
      toast({ title: "Permissions updated", description: "Admin permissions saved." });
    } catch {
      toast({ title: "Error", description: "Failed to update permissions", variant: "destructive" });
    } finally {
      setSavingPermissions(p => ({ ...p, [adminId]: false }));
    }
  };

  const handleChangeAdminPassword = async (adminId: string) => {
    const pw = adminPasswordInputs[adminId];
    if (!pw || pw.length < 6) {
      toast({ title: "Error", description: "Password must be at least 6 characters", variant: "destructive" });
      return;
    }
    setSavingPassword(p => ({ ...p, [adminId]: true }));
    try {
      await fetch(`/api/admins/${adminId}/password`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pw }),
      });
      setAdminPasswordInputs(p => ({ ...p, [adminId]: "" }));
      toast({ title: "Password changed", description: "Admin password updated successfully." });
    } catch {
      toast({ title: "Error", description: "Failed to change password", variant: "destructive" });
    } finally {
      setSavingPassword(p => ({ ...p, [adminId]: false }));
    }
  };

  const handleDeleteAdminUser = async (adminId: string, adminName: string) => {
    if (!confirm(`Remove ${adminName} from admin access? This cannot be undone.`)) return;
    try {
      await fetch(`/api/admins/${adminId}`, { method: "DELETE" });
      await loadData();
      toast({ title: "Admin removed", description: `${adminName} has been removed.` });
    } catch {
      toast({ title: "Error", description: "Failed to remove admin", variant: "destructive" });
    }
  };

  const isSuperAdmin = user?.isSuperAdmin === true;
  const perms = user?.permissions ?? DEFAULT_PERMISSIONS;

  const menuItems = [
    { icon: LayoutDashboard, label: "Overview" },
    ...(isSuperAdmin || perms.canManageProducts ? [{ icon: ShoppingBag, label: "Products" }] : []),
    ...(isSuperAdmin || perms.canManageStock ? [{ icon: Warehouse, label: "Inventory" }] : []),
    ...(isSuperAdmin || perms.canAccessPOS ? [{ icon: CreditCard, label: "POS" }] : []),
    ...(isSuperAdmin || perms.canManageOrders ? [{ icon: Package, label: "Orders" }] : []),
    ...(isSuperAdmin || perms.canManageOrders ? [{ icon: Receipt, label: "Transactions" }] : []),
    ...(isSuperAdmin || perms.canManageCoupons ? [{ icon: Tag, label: "Coupons" }] : []),
    ...(isSuperAdmin ? [{ icon: Settings, label: "Admin Management" }] : []),
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
                            <Label className="text-xs uppercase tracking-widest font-bold">Sale</Label>
                            <button
                              type="button"
                              className={`w-10 h-5 rounded-full transition-colors ${productForm.isOnSale ? 'bg-red-500' : 'bg-gray-300'}`}
                              onClick={() => setProductForm({...productForm, isOnSale: !productForm.isOnSale})}
                              data-testid="toggle-sale"
                            >
                              <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform ${productForm.isOnSale ? 'translate-x-5' : 'translate-x-0.5'}`} />
                            </button>
                          </div>
                          {productForm.isOnSale && (
                            <div className="space-y-2">
                              <div className="flex gap-1">
                                <button
                                  type="button"
                                  className={`flex-1 text-xs py-1 border transition-colors ${productForm.saleMode === 'percentage' ? 'bg-primary text-primary-foreground border-primary' : 'bg-transparent border-border text-muted-foreground'}`}
                                  onClick={() => setProductForm({...productForm, saleMode: 'percentage'})}
                                  data-testid="sale-mode-percentage"
                                >
                                  % Off
                                </button>
                                <button
                                  type="button"
                                  className={`flex-1 text-xs py-1 border transition-colors ${productForm.saleMode === 'fixed' ? 'bg-primary text-primary-foreground border-primary' : 'bg-transparent border-border text-muted-foreground'}`}
                                  onClick={() => setProductForm({...productForm, saleMode: 'fixed'})}
                                  data-testid="sale-mode-fixed"
                                >
                                  Fixed Price
                                </button>
                              </div>
                              {productForm.saleMode === 'percentage' ? (
                                <div className="space-y-1">
                                  <div className="relative">
                                    <Input 
                                      type="number"
                                      value={productForm.salePercent}
                                      onChange={(e) => setProductForm({...productForm, salePercent: e.target.value})}
                                      className="rounded-none pr-8"
                                      placeholder="e.g. 20"
                                      min="1"
                                      max="99"
                                      data-testid="input-sale-percent"
                                    />
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
                                  </div>
                                  {productForm.salePercent && (
                                    <div className="text-xs text-muted-foreground space-y-0.5">
                                      {productForm.variants.filter(v => v.size && v.price).length > 0 ? (
                                        productForm.variants.filter(v => v.size && v.price).map(v => (
                                          <p key={v.size}>
                                            {v.size}: <span className="line-through mr-1">{formatCurrency(Number(v.price))}</span>
                                            <span className="font-semibold text-red-600">{formatCurrency(Math.round(Number(v.price) * (1 - Number(productForm.salePercent) / 100) * 100) / 100)}</span>
                                          </p>
                                        ))
                                      ) : Number(productForm.price) > 0 ? (
                                        <p>
                                          Sale price: <span className="font-semibold text-red-600">{formatCurrency(Math.round(Number(productForm.price) * (1 - Number(productForm.salePercent) / 100) * 100) / 100)}</span>
                                        </p>
                                      ) : null}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <Input 
                                  type="number"
                                  value={productForm.salePrice}
                                  onChange={(e) => setProductForm({...productForm, salePrice: e.target.value})}
                                  className="rounded-none"
                                  placeholder="Sale price"
                                  data-testid="input-sale-price"
                                />
                              )}
                            </div>
                          )}
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
                        <Label className="text-xs uppercase tracking-widest font-bold">Max Order Qty Per Customer</Label>
                        <Input 
                          type="number"
                          min="1"
                          value={productForm.maxOrderQty}
                          onChange={(e) => setProductForm({...productForm, maxOrderQty: e.target.value})}
                          className="rounded-none"
                          placeholder="No limit"
                          data-testid="input-max-order-qty"
                        />
                        <p className="text-[10px] text-muted-foreground">Maximum quantity a customer can order for this product. Leave empty for no limit.</p>
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
                        <div className="flex justify-between items-center">
                          <Label className="text-xs uppercase tracking-widest font-bold">Main Product Image</Label>
                          {productForm.image && !productForm.image.includes('unsplash.com') && (
                            <Button 
                              type="button"
                              variant="ghost" 
                              size="sm" 
                              className="h-7 text-[10px] rounded-none uppercase tracking-widest text-destructive"
                              onClick={() => setProductForm({
                                ...productForm, 
                                image: "https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?auto=format&fit=crop&q=80"
                              })}
                            >
                              <Trash2 size={12} className="mr-1" /> Remove
                            </Button>
                          )}
                        </div>
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
                      <div className="space-y-4 pt-4 border-t border-border">
                        <div className="flex justify-between items-center">
                          <div>
                            <Label className="text-xs uppercase tracking-widest font-bold">Stock</Label>
                            <p className="text-[10px] text-muted-foreground">Set stock for each size/color combination</p>
                          </div>
                          <div className="text-right">
                            <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Base Stock</span>
                            <div className={`text-lg font-bold ${Object.values(productForm.variantStock).reduce((sum, v) => sum + (parseInt(v) || 0), 0) > 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {Object.values(productForm.variantStock).reduce((sum, v) => sum + (parseInt(v) || 0), 0)}
                            </div>
                          </div>
                        </div>
                        <div className="space-y-2 max-h-64 overflow-y-auto">
                          {(() => {
                            const sizes = productForm.variants.filter(v => v.size).map(v => v.size);
                            const colors = productForm.colorVariants.filter(cv => cv.name.trim()).map(cv => cv.name.trim());
                            const combos: { size: string; color: string; key: string }[] = [];
                            const addedKeys = new Set<string>();
                            
                            if (sizes.length > 0 && colors.length > 0) {
                              sizes.forEach(size => {
                                colors.forEach(color => {
                                  const key = `${size}-${color}`;
                                  combos.push({ size, color, key });
                                  addedKeys.add(key.toLowerCase());
                                });
                              });
                            } else if (sizes.length > 0) {
                              sizes.forEach(size => {
                                combos.push({ size, color: "Default", key: `${size}-Default` });
                                addedKeys.add(`${size}-default`.toLowerCase());
                              });
                            } else if (colors.length > 0) {
                              colors.forEach(color => {
                                combos.push({ size: "Standard", color, key: `Standard-${color}` });
                                addedKeys.add(`standard-${color}`.toLowerCase());
                              });
                            } else {
                              combos.push({ size: "Standard", color: "Default", key: "Standard-Default" });
                              addedKeys.add("standard-default");
                            }
                            
                            Object.keys(productForm.variantStock).forEach(key => {
                              if (!addedKeys.has(key.toLowerCase())) {
                                const parts = key.split('-');
                                const size = parts[0] || 'Standard';
                                const color = parts.slice(1).join('-') || 'Default';
                                combos.push({ size, color, key });
                                addedKeys.add(key.toLowerCase());
                              }
                            });
                            
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
                      </div>
                      
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
                          {(() => {
                            const variantStock = (product as any).variantStock as { [key: string]: number } | null;
                            const totalStock = variantStock ? Object.values(variantStock).reduce((sum, v) => sum + (v || 0), 0) : 0;
                            return (
                              <span className={cn(
                                "text-xs font-medium px-2 py-1",
                                totalStock > 0 
                                  ? "bg-green-100 text-green-700" 
                                  : "bg-red-100 text-red-700"
                              )} data-testid={`stock-${product.id}`}>
                                Stock: {totalStock}
                              </span>
                            );
                          })()}
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
                      {products.filter(p => {
                        const vs = (p as any).variantStock as { [key: string]: number } | null;
                        const total = vs ? Object.values(vs).reduce((sum, v) => sum + (v || 0), 0) : 0;
                        return total <= (p.lowStockThreshold || 5) && total > 0;
                      }).length}
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
                          const variantStock = (product as any).variantStock as { [key: string]: number } | null;
                          const totalStock = variantStock ? Object.values(variantStock).reduce((sum, v) => sum + (v || 0), 0) : 0;
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
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="rounded-none h-8"
                                    onClick={() => {
                                      handleEditProduct(product);
                                    }}
                                  >
                                    <Edit size={14} className="mr-1" /> Edit Stock
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
                      api.getAllPosTransactions()
                        .then(data => {
                          if (Array.isArray(data)) setPosTransactions(data);
                          else setPosTransactions([]);
                        })
                        .catch(() => setPosTransactions([]));
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
                                // Open variant selection modal
                                setSelectedPosProduct(product);
                                setSelectedPosSize(product.variants?.[0]?.size || "Standard");
                                setSelectedPosColor(product.colors?.[0] || "Default");
                                setShowPosVariantModal(true);
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
                                {formatCurrency(getVariantSalePrice(product, Number(product.price)))}
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
                                {((item.size && item.size !== 'Standard') || (item.color && item.color !== 'Default')) && (
                                  <p className="text-xs text-primary">{item.size && item.size !== 'Standard' ? item.size : ''}{item.size && item.size !== 'Standard' && item.color && item.color !== 'Default' ? " / " : ""}{item.color && item.color !== 'Default' ? item.color : ''}</p>
                                )}
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
                                    // Check stock before incrementing using fallback matching
                                    const product = products.find(p => p.id === item.productId);
                                    if (product) {
                                      const variantStock = product.variantStock as { [key: string]: number } | null;
                                      const stock = resolveVariantStock(variantStock, item.size || 'Standard', item.color || 'Default');
                                      if (item.qty + 1 > stock) {
                                        toast({ title: "Insufficient Stock", description: `Only ${stock} available`, variant: "destructive" });
                                        return;
                                      }
                                    }
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
                                <td className="p-4 font-mono text-sm">
                                  <span className="block font-bold text-primary">
                                    {tx.trackingNumber || tx.transactionNumber.replace(/^POS-/, '').replace(/-/g, '')}
                                  </span>
                                  <span className="text-xs text-muted-foreground">{tx.transactionNumber}</span>
                                </td>
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

              {/* Order Filter */}
              <div className="flex gap-2 mb-6">
                <Button
                  variant={orderFilter === "all" ? "default" : "outline"}
                  size="sm"
                  className="rounded-none uppercase tracking-widest text-xs font-bold"
                  onClick={() => setOrderFilter("all")}
                  data-testid="button-filter-all-orders"
                >
                  All Orders
                </Button>
                <Button
                  variant={orderFilter === "active" ? "default" : "outline"}
                  size="sm"
                  className="rounded-none uppercase tracking-widest text-xs font-bold"
                  onClick={() => setOrderFilter("active")}
                  data-testid="button-filter-active-orders"
                >
                  Active
                </Button>
                <Button
                  variant={orderFilter === "completed" ? "default" : "outline"}
                  size="sm"
                  className="rounded-none uppercase tracking-widest text-xs font-bold"
                  onClick={() => setOrderFilter("completed")}
                  data-testid="button-filter-completed-orders"
                >
                  Completed/Delivered
                </Button>
              </div>

              <Card className="rounded-none border-border shadow-none">
                <CardContent className="p-0">
                  <div className="divide-y divide-border">
                    {orders.filter(order => {
                      if (orderFilter === "completed") {
                        return order.status === "delivered" || order.status === "cancelled" || order.status === "refunded";
                      } else if (orderFilter === "active") {
                        return order.status !== "delivered" && order.status !== "cancelled" && order.status !== "refunded";
                      }
                      return true;
                    }).map((order) => (
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
                          <div className="flex flex-wrap items-center gap-2 mt-1">
                            {order.trackingNumber && <span className="text-xs text-muted-foreground font-mono">TRK: {order.trackingNumber}</span>}
                            {order.invoiceNumber && <span className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 font-medium">INV: {order.invoiceNumber}</span>}
                            {order.deliveryStatus && <span className={cn("text-xs px-1.5 py-0.5 border font-medium", order.deliveryStatus === "delivered" ? "bg-green-50 text-green-700 border-green-200" : order.deliveryStatus === "failed" ? "bg-red-50 text-red-700 border-red-200" : order.deliveryStatus === "out_for_delivery" ? "bg-orange-50 text-orange-700 border-orange-200" : "bg-blue-50 text-blue-700 border-blue-200")}>{order.deliveryStatus.replace(/_/g, " ")}</span>}
                          </div>
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
                                <DialogDescription asChild>
                                  <div className="flex flex-wrap items-center gap-2 mt-1">
                                    <span className="uppercase tracking-widest text-[10px] font-bold">Status: {selectedOrder?.status.replace(/_/g, " ")}</span>
                                    {selectedOrder?.trackingNumber && <span className="text-[10px] font-mono text-muted-foreground">· TRK: {selectedOrder.trackingNumber}</span>}
                                    {selectedOrder?.invoiceNumber && <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 font-bold">{selectedOrder.invoiceNumber}</span>}
                                    {selectedOrder?.deliveryStatus && <span className="text-[10px] bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.5 font-bold capitalize">{selectedOrder.deliveryStatus.replace(/_/g, " ")}</span>}
                                  </div>
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
                                      {selectedOrder.customerAtollIsland && (
                                        <p className="text-sm text-muted-foreground mt-0.5"><span className="text-muted-foreground">Atoll & Island:</span> {selectedOrder.customerAtollIsland}</p>
                                      )}
                                    </div>
                                    {selectedOrder.deliveryType === "boat" && (
                                      <div>
                                        <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Boat Delivery Details</p>
                                        <div className="text-sm space-y-0.5">
                                          {selectedOrder.boatName && <p><span className="text-muted-foreground">Boat:</span> {selectedOrder.boatName}</p>}
                                          {selectedOrder.boatNumber && <p><span className="text-muted-foreground">Contact:</span> {selectedOrder.boatNumber}</p>}
                                          {selectedOrder.boatLocation && <p><span className="text-muted-foreground">Mooring:</span> {selectedOrder.boatLocation}</p>}
                                          {selectedOrder.boatAtollIsland && <p><span className="text-muted-foreground">Atoll & Island:</span> {selectedOrder.boatAtollIsland}</p>}
                                        </div>
                                      </div>
                                    )}
                                    {selectedOrder.notes && (
                                      <div className="p-3 bg-amber-50 border border-amber-200 rounded">
                                        <p className="text-xs uppercase tracking-widest text-amber-700 font-semibold mb-1">Customer Notes</p>
                                        <p className="text-sm text-amber-900">{selectedOrder.notes}</p>
                                      </div>
                                    )}
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
                                {/* Admin Note */}
                                <div className="mt-4 pt-4 border-t border-border">
                                  <p className="text-xs uppercase tracking-widest font-bold text-muted-foreground mb-2">Admin Note <span className="normal-case font-normal">(visible to customer on tracking page)</span></p>
                                  <textarea
                                    className="w-full border border-border rounded-none p-3 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-primary bg-secondary/20"
                                    rows={3}
                                    placeholder="Leave a note for the customer (optional)…"
                                    value={orderNoteText}
                                    onChange={e => setOrderNoteText(e.target.value)}
                                    data-testid="textarea-order-admin-note"
                                  />
                                  <div className="flex justify-end mt-2">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="rounded-none uppercase tracking-widest text-xs font-bold px-5 h-9 gap-2"
                                      onClick={handleSaveOrderNote}
                                      disabled={savingOrderNote}
                                      data-testid="button-save-order-note"
                                    >
                                      {savingOrderNote ? <><span className="animate-spin">⟳</span> Saving…</> : "Save Note"}
                                    </Button>
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
                    {orders.filter(order => {
                      if (orderFilter === "completed") {
                        return order.status === "delivered" || order.status === "cancelled" || order.status === "refunded";
                      } else if (orderFilter === "active") {
                        return order.status !== "delivered" && order.status !== "cancelled" && order.status !== "refunded";
                      }
                      return true;
                    }).length === 0 && (
                      <div className="p-8 text-center text-muted-foreground">
                        {orderFilter === "completed" ? "No completed orders." : orderFilter === "active" ? "No active orders." : "No orders yet."}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* POS Deliveries */}
              {posDeliveries.length > 0 && (
                <div className="mt-10">
                  <h2 className="text-xl font-serif mb-4">POS Deliveries</h2>
                  <Card className="rounded-none border-border shadow-none">
                    <CardContent className="p-0">
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead className="bg-secondary/30">
                            <tr>
                              <th className="text-left p-4 text-xs uppercase tracking-wider font-semibold">Tracking #</th>
                              <th className="text-left p-4 text-xs uppercase tracking-wider font-semibold">Recipient</th>
                              <th className="text-left p-4 text-xs uppercase tracking-wider font-semibold">Address</th>
                              <th className="text-left p-4 text-xs uppercase tracking-wider font-semibold">Type</th>
                              <th className="text-left p-4 text-xs uppercase tracking-wider font-semibold">Date</th>
                              <th className="text-left p-4 text-xs uppercase tracking-wider font-semibold">Delivery Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            {posDeliveries.map((delivery: any) => {
                              const cleanNum = delivery.trackingNumber || delivery.transactionNumber.replace(/^POS-/, '').replace(/-/g, '');
                              const statusOptions = [
                                { value: "label_created", label: "Label Created" },
                                { value: "processing", label: "Processing" },
                                { value: "out_for_delivery", label: "Out for Delivery" },
                                { value: "delivered", label: "Delivered" },
                                { value: "failed", label: "Failed" },
                              ];
                              const statusColors: Record<string, string> = {
                                label_created: "bg-blue-50 text-blue-700 border-blue-200",
                                processing: "bg-yellow-50 text-yellow-700 border-yellow-200",
                                out_for_delivery: "bg-purple-50 text-purple-700 border-purple-200",
                                delivered: "bg-green-50 text-green-700 border-green-200",
                                failed: "bg-red-50 text-red-700 border-red-200",
                              };
                              return (
                                <tr key={delivery.id} className="hover:bg-secondary/10">
                                  <td className="p-4 font-mono text-sm">
                                    <span className="font-bold text-primary block">{cleanNum}</span>
                                    <span className="text-xs text-muted-foreground">{delivery.transactionNumber}</span>
                                  </td>
                                  <td className="p-4 text-sm">
                                    <span className="font-medium">{delivery.labelRecipientName}</span>
                                    {delivery.labelPhone && <span className="block text-xs text-muted-foreground">{delivery.labelPhone}</span>}
                                  </td>
                                  <td className="p-4 text-sm text-muted-foreground">{delivery.labelAddress}</td>
                                  <td className="p-4 text-sm">
                                    <span className={cn("text-[10px] uppercase font-bold px-2 py-1 border", delivery.labelDeliveryType === "express" ? "bg-orange-50 text-orange-700 border-orange-200" : "bg-slate-50 text-slate-700 border-slate-200")}>
                                      {delivery.labelDeliveryType === "express" ? "Express" : "Standard"}
                                    </span>
                                  </td>
                                  <td className="p-4 text-sm text-muted-foreground">
                                    {delivery.createdAt ? new Date(delivery.createdAt).toLocaleDateString() : "-"}
                                  </td>
                                  <td className="p-4">
                                    <select
                                      className={cn("text-xs font-semibold px-2 py-1.5 border rounded-none outline-none cursor-pointer", statusColors[delivery.deliveryStatus] || "bg-secondary/20 text-foreground border-border")}
                                      value={delivery.deliveryStatus || "label_created"}
                                      onChange={async (e) => {
                                        const newStatus = e.target.value;
                                        try {
                                          const updated = await api.updatePosTransaction(delivery.id, { deliveryStatus: newStatus });
                                          setPosDeliveries(prev => prev.map(d => d.id === updated.id ? updated : d));
                                        } catch {}
                                      }}
                                    >
                                      {statusOptions.map(opt => (
                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                      ))}
                                    </select>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>
          )}

          {activeTab === "Transactions" && (
            <div className="animate-in fade-in duration-500">
              <div className="mb-8">
                <h1 className="text-3xl font-serif">Transactions</h1>
                <p className="text-muted-foreground">Invoiced storefront orders — auto-created when order is confirmed</p>
              </div>

              {(() => {
                const invoicedOrders = orders.filter(o => o.invoiceNumber);
                const deliveryStatusColors: Record<string, string> = {
                  label_created: "bg-blue-50 text-blue-700 border-blue-200",
                  processing: "bg-amber-50 text-amber-700 border-amber-200",
                  out_for_delivery: "bg-orange-50 text-orange-700 border-orange-200",
                  delivered: "bg-green-50 text-green-700 border-green-200",
                  failed: "bg-red-50 text-red-700 border-red-200",
                };

                if (invoicedOrders.length === 0) {
                  return (
                    <Card className="rounded-none border-border shadow-none">
                      <CardContent className="p-12 text-center">
                        <Receipt className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                        <p className="text-muted-foreground">No transactions yet.</p>
                        <p className="text-sm text-muted-foreground mt-1">Invoices are created automatically when an order is set to <strong>Confirmed</strong>.</p>
                      </CardContent>
                    </Card>
                  );
                }

                return (
                  <div className="space-y-4">
                    {invoicedOrders.sort((a, b) => new Date(b.invoicedAt || b.createdAt || 0).getTime() - new Date(a.invoicedAt || a.createdAt || 0).getTime()).map(order => (
                      <Card key={order.id} className="rounded-none border-border shadow-none" data-testid={`card-transaction-${order.id}`}>
                        <CardContent className="p-6">
                          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                            <div className="flex-1 space-y-3">
                              {/* Invoice header */}
                              <div className="flex flex-wrap items-center gap-3">
                                <span className="text-xs uppercase tracking-widest font-bold text-muted-foreground">Invoice</span>
                                <span className="font-mono font-bold text-sm" data-testid={`text-invoice-number-${order.id}`}>{order.invoiceNumber}</span>
                                <span className="text-muted-foreground text-xs">·</span>
                                <span className="text-xs text-muted-foreground">{order.invoicedAt ? new Date(order.invoicedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : ''}</span>
                              </div>

                              {/* Order + tracking */}
                              <div className="flex flex-wrap gap-4 text-sm">
                                <div>
                                  <span className="text-muted-foreground text-xs uppercase tracking-wide">Order #</span>
                                  <p className="font-mono font-semibold">{order.orderNumber}</p>
                                </div>
                                <div>
                                  <span className="text-muted-foreground text-xs uppercase tracking-wide">Tracking #</span>
                                  <p className="font-mono font-semibold text-primary" data-testid={`text-tracking-${order.id}`}>{order.trackingNumber || order.orderNumber}</p>
                                </div>
                                <div>
                                  <span className="text-muted-foreground text-xs uppercase tracking-wide">Customer</span>
                                  <p className="font-medium">{order.customerName}</p>
                                </div>
                              </div>

                              {/* Items */}
                              <div className="text-sm text-muted-foreground">
                                {(order.items as any[]).map((item, i) => (
                                  <span key={i}>{i > 0 ? ' · ' : ''}{item.qty}× {item.name}{item.size && item.size !== 'Standard' ? ` (${item.size})` : ''}{item.color && item.color !== 'Default' ? ` – ${item.color}` : ''}</span>
                                ))}
                              </div>

                              {/* Total */}
                              <div className="text-sm font-semibold">MVR {order.total.toLocaleString()}</div>

                              {/* Delivery status — read only, change from Orders tab */}
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-muted-foreground uppercase tracking-wide">Delivery:</span>
                                {order.deliveryStatus ? (
                                  <span className={`text-xs font-semibold px-2 py-1 border ${deliveryStatusColors[order.deliveryStatus] || "bg-secondary/20 text-foreground border-border"}`}>
                                    {order.deliveryStatus.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())}
                                  </span>
                                ) : (
                                  <span className="text-xs text-muted-foreground italic">No label yet</span>
                                )}
                              </div>
                            </div>

                            {/* Actions */}
                            <div className="flex flex-row md:flex-col gap-2 shrink-0">
                              <Button
                                variant="outline"
                                size="sm"
                                className="rounded-none text-xs uppercase tracking-widest"
                                data-testid={`button-print-label-${order.id}`}
                                onClick={() => { setSelectedOrder(order); setTimeout(() => handlePrintLabel(), 50); }}
                              >
                                <Printer className="h-3.5 w-3.5 mr-1.5" />
                                Label
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="rounded-none text-xs uppercase tracking-widest"
                                data-testid={`button-print-invoice-${order.id}`}
                                onClick={() => handlePrintOrderInvoice(order)}
                              >
                                <Printer className="h-3.5 w-3.5 mr-1.5" />
                                Invoice
                              </Button>
                              <Button
                                variant="default"
                                size="sm"
                                className="rounded-none text-xs uppercase tracking-widest bg-foreground text-background"
                                data-testid={`button-view-order-${order.id}`}
                                onClick={() => { setSelectedOrder(order); setActiveTab("Orders"); }}
                              >
                                View Order
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                );
              })()}
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

          {activeTab === "Admin Management" && isSuperAdmin && (
            <div className="animate-in fade-in duration-500">
              <div className="mb-8">
                <h1 className="text-3xl font-serif">Admin Management</h1>
                <p className="text-muted-foreground">Add admins and control their access permissions</p>
              </div>

              {/* Add New Admin */}
              <Card className="rounded-none border-border shadow-none mb-8">
                <CardContent className="p-6">
                  <h3 className="font-bold mb-4 uppercase tracking-widest text-xs">Add New Admin</h3>
                  <div className="flex flex-wrap gap-4 mb-4">
                    <Input placeholder="Name" value={newAdminName} onChange={(e) => setNewAdminName(e.target.value)} className="rounded-none flex-1 min-w-[150px]" data-testid="input-new-admin-name" />
                    <Input type="email" placeholder="Email" value={newAdminEmail} onChange={(e) => setNewAdminEmail(e.target.value)} className="rounded-none flex-1 min-w-[200px]" data-testid="input-new-admin-email" />
                    <Input type="password" placeholder="Password (min 6 chars)" value={newAdminPassword} onChange={(e) => setNewAdminPassword(e.target.value)} className="rounded-none flex-1 min-w-[180px]" data-testid="input-new-admin-password" />
                  </div>
                  <div className="mb-4">
                    <p className="text-xs uppercase tracking-widest font-bold mb-3">Access Permissions</p>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {([ 
                        { key: "canManageProducts", label: "Manage Products" },
                        { key: "canManageStock", label: "Manage Inventory" },
                        { key: "canManageOrders", label: "Manage Orders" },
                        { key: "canManageCoupons", label: "Manage Coupons" },
                        { key: "canAccessPOS", label: "Access POS" },
                      ] as { key: keyof AdminPermissions; label: string }[]).map(({ key, label }) => (
                        <div key={key} className="flex items-center gap-2">
                          <Switch
                            checked={newAdminPermissions[key]}
                            onCheckedChange={(v) => setNewAdminPermissions(p => ({ ...p, [key]: v }))}
                          />
                          <span className="text-sm">{label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <Button onClick={handleAddAdmin} className="rounded-none" data-testid="button-add-admin">
                    <Plus size={14} className="mr-2" /> Add Admin
                  </Button>
                </CardContent>
              </Card>

              {/* Existing Admins */}
              <div className="space-y-4">
                {admins.map((admin) => {
                  const adminPerms: AdminPermissions = editingAdminPermissions[admin.id] ?? ((admin as any).permissions ?? DEFAULT_PERMISSIONS);
                  const isThisAdminSuper = (admin as any).isSuperAdmin === true;
                  const isMe = admin.id === user?.id;
                  return (
                    <Card key={admin.id} className="rounded-none border-border shadow-none">
                      <CardContent className="p-6">
                        <div className="flex items-start justify-between mb-4">
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-bold">{admin.name}</p>
                              {isThisAdminSuper && <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 uppercase tracking-widest">Super Admin</span>}
                              {isMe && <span className="text-xs bg-secondary text-secondary-foreground px-2 py-0.5 uppercase tracking-widest">You</span>}
                            </div>
                            <p className="text-sm text-muted-foreground">{admin.email}</p>
                          </div>
                          {!isThisAdminSuper && !isMe && (
                            <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive rounded-none text-xs" onClick={() => handleDeleteAdminUser(admin.id, admin.name)} data-testid={`button-delete-admin-${admin.id}`}>
                              <Trash2 size={14} className="mr-1" /> Remove
                            </Button>
                          )}
                        </div>

                        {/* Permission Toggles — not for super admins */}
                        {!isThisAdminSuper && (
                          <>
                            <p className="text-xs uppercase tracking-widest font-bold mb-3">Access Permissions</p>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
                              {([
                                { key: "canManageProducts", label: "Manage Products" },
                                { key: "canManageStock", label: "Manage Inventory" },
                                { key: "canManageOrders", label: "Manage Orders" },
                                { key: "canManageCoupons", label: "Manage Coupons" },
                                { key: "canAccessPOS", label: "Access POS" },
                              ] as { key: keyof AdminPermissions; label: string }[]).map(({ key, label }) => (
                                <div key={key} className="flex items-center gap-2">
                                  <Switch
                                    checked={adminPerms[key]}
                                    onCheckedChange={(v) => setEditingAdminPermissions(ep => ({
                                      ...ep,
                                      [admin.id]: { ...(ep[admin.id] ?? adminPerms), [key]: v }
                                    }))}
                                    data-testid={`switch-${key}-${admin.id}`}
                                  />
                                  <span className="text-sm">{label}</span>
                                </div>
                              ))}
                            </div>
                            <Button size="sm" variant="outline" className="rounded-none text-xs uppercase tracking-widest mb-4" onClick={() => handleUpdatePermissions(admin.id)} disabled={savingPermissions[admin.id]} data-testid={`button-save-permissions-${admin.id}`}>
                              {savingPermissions[admin.id] ? "Saving..." : "Save Permissions"}
                            </Button>
                          </>
                        )}

                        {/* Change Password */}
                        <div className="border-t border-border pt-4 mt-2">
                          <p className="text-xs uppercase tracking-widest font-bold mb-3">Change Password</p>
                          <div className="flex gap-3">
                            <Input
                              type="password"
                              placeholder="New password (min 6 chars)"
                              value={adminPasswordInputs[admin.id] ?? ""}
                              onChange={(e) => setAdminPasswordInputs(p => ({ ...p, [admin.id]: e.target.value }))}
                              className="rounded-none flex-1 max-w-xs"
                              data-testid={`input-admin-password-${admin.id}`}
                            />
                            <Button size="sm" variant="outline" className="rounded-none text-xs uppercase tracking-widest" onClick={() => handleChangeAdminPassword(admin.id)} disabled={savingPassword[admin.id]} data-testid={`button-change-password-${admin.id}`}>
                              {savingPassword[admin.id] ? "Saving..." : "Update Password"}
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
                {admins.length === 0 && (
                  <div className="p-8 text-center text-muted-foreground">No admins found.</div>
                )}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* POS Variant Selection Modal */}
      <Dialog open={showPosVariantModal} onOpenChange={setShowPosVariantModal}>
        <DialogContent className="max-w-md rounded-none">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl">Select Variant</DialogTitle>
          </DialogHeader>
          {selectedPosProduct && (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <img 
                  src={selectedPosProduct.image} 
                  alt={selectedPosProduct.name}
                  className="w-20 h-20 object-cover"
                />
                <div>
                  <h3 className="font-medium">{selectedPosProduct.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    {formatCurrency(
                      getVariantSalePrice(
                        selectedPosProduct,
                        selectedPosProduct.variants?.find((v: any) => v.size === selectedPosSize)?.price || 
                        selectedPosProduct.price
                      )
                    )}
                  </p>
                </div>
              </div>

              {/* Size Selection */}
              {selectedPosProduct.variants && selectedPosProduct.variants.length > 0 && !(selectedPosProduct.variants.length === 1 && selectedPosProduct.variants[0].size === 'Standard') && (
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-widest font-bold">Size</Label>
                  <div className="flex flex-wrap gap-2">
                    {selectedPosProduct.variants.map((variant: any) => {
                      const variantStock = selectedPosProduct.variantStock as { [key: string]: number } | null;
                      const stock = resolveVariantStock(variantStock, variant.size, selectedPosColor);
                      return (
                        <Button
                          key={variant.size}
                          variant={selectedPosSize === variant.size ? "default" : "outline"}
                          size="sm"
                          onClick={() => setSelectedPosSize(variant.size)}
                          className="rounded-none"
                          disabled={stock === 0}
                        >
                          {variant.size} ({stock})
                        </Button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Color Selection */}
              {selectedPosProduct.colors && selectedPosProduct.colors.length > 0 && !(selectedPosProduct.colors.length === 1 && selectedPosProduct.colors[0] === 'Default') && (
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-widest font-bold">Color</Label>
                  <div className="flex flex-wrap gap-2">
                    {selectedPosProduct.colors.map((color: string) => {
                      const variantStock = selectedPosProduct.variantStock as { [key: string]: number } | null;
                      const stock = resolveVariantStock(variantStock, selectedPosSize, color);
                      return (
                        <Button
                          key={color}
                          variant={selectedPosColor === color ? "default" : "outline"}
                          size="sm"
                          onClick={() => setSelectedPosColor(color)}
                          className="rounded-none"
                          disabled={stock === 0}
                        >
                          {color} ({stock})
                        </Button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Stock Info */}
              {(() => {
                const variantStock = selectedPosProduct.variantStock as { [key: string]: number } | null;
                const stock = resolveVariantStock(variantStock, selectedPosSize, selectedPosColor);
                return (
                  <div className="p-3 bg-secondary/20 rounded">
                    <p className="text-sm">
                      <span className="font-medium">Available Stock:</span>{" "}
                      <span className={stock > 0 ? "text-green-600" : "text-red-600"}>
                        {stock} units
                      </span>
                    </p>
                  </div>
                );
              })()}

              {/* Add to Cart Button */}
              <Button
                className="w-full rounded-none"
                onClick={() => {
                  const variantStock = selectedPosProduct.variantStock as { [key: string]: number } | null;
                  const stock = resolveVariantStock(variantStock, selectedPosSize, selectedPosColor);
                  
                  if (stock === 0) {
                    toast({ title: "Out of Stock", description: "This variant is out of stock", variant: "destructive" });
                    return;
                  }

                  const rawVariantPrice = selectedPosProduct.variants?.find((v: any) => v.size === selectedPosSize)?.price || selectedPosProduct.price;
                  const variantPrice = getVariantSalePrice(selectedPosProduct, Number(rawVariantPrice));
                  const cartKey = `${selectedPosProduct.id}-${selectedPosSize}-${selectedPosColor}`;
                  
                  const existing = posCart.find(item => 
                    item.productId === selectedPosProduct.id && 
                    item.size === selectedPosSize && 
                    item.color === selectedPosColor
                  );
                  
                  if (existing) {
                    if (existing.qty + 1 > stock) {
                      toast({ title: "Insufficient Stock", description: `Only ${stock} available`, variant: "destructive" });
                      return;
                    }
                    setPosCart(posCart.map(item => 
                      item.productId === selectedPosProduct.id && item.size === selectedPosSize && item.color === selectedPosColor
                        ? { ...item, qty: item.qty + 1 }
                        : item
                    ));
                  } else {
                    setPosCart([...posCart, {
                      productId: selectedPosProduct.id,
                      name: selectedPosProduct.name,
                      qty: 1,
                      price: variantPrice,
                      size: selectedPosSize,
                      color: selectedPosColor,
                      image: selectedPosProduct.image
                    }]);
                  }
                  
                  setShowPosVariantModal(false);
                  toast({ title: "Added to Cart", description: `${selectedPosProduct.name} (${selectedPosSize}/${selectedPosColor})` });
                }}
                disabled={(() => {
                  const variantStock = selectedPosProduct.variantStock as { [key: string]: number } | null;
                  return resolveVariantStock(variantStock, selectedPosSize, selectedPosColor) === 0;
                })()}
              >
                <Plus size={18} className="mr-2" />
                Add to Cart
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* POS Shipping Label Modal */}
      <Dialog open={showPosLabelModal} onOpenChange={setShowPosLabelModal}>
        <DialogContent className="max-w-md rounded-none">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl">Shipping Label Details</DialogTitle>
            <DialogDescription>Enter the customer delivery details for this POS transaction.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="text-xs uppercase tracking-widest text-muted-foreground block mb-1">Recipient Name *</label>
              <Input
                className="rounded-none"
                placeholder="Full name"
                value={posLabelForm.recipientName}
                onChange={(e) => setPosLabelForm(f => ({ ...f, recipientName: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-widest text-muted-foreground block mb-1">Customer Email <span className="normal-case text-muted-foreground">(for shipping notification)</span></label>
              <Input
                className="rounded-none"
                type="email"
                placeholder="customer@email.com"
                value={posLabelForm.recipientEmail}
                onChange={(e) => setPosLabelForm(f => ({ ...f, recipientEmail: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-widest text-muted-foreground block mb-1">Street Address *</label>
              <Input
                className="rounded-none"
                placeholder="e.g. Haveereege"
                value={posLabelForm.streetAddress}
                onChange={(e) => setPosLabelForm(f => ({ ...f, streetAddress: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-widest text-muted-foreground block mb-1">Atoll & Island</label>
              <Input
                className="rounded-none"
                placeholder="e.g. Aa. Mathiveri"
                value={posLabelForm.atollIsland}
                onChange={(e) => setPosLabelForm(f => ({ ...f, atollIsland: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-widest text-muted-foreground block mb-1">Phone Number *</label>
              <Input
                className="rounded-none"
                placeholder="Contact number"
                value={posLabelForm.phone}
                onChange={(e) => setPosLabelForm(f => ({ ...f, phone: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-widest text-muted-foreground block mb-2">Delivery Type *</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPosLabelForm(f => ({ ...f, deliveryType: "standard" }))}
                  className={`flex-1 py-2 px-3 border text-xs font-bold uppercase tracking-widest transition-colors ${posLabelForm.deliveryType === "standard" ? "bg-primary text-primary-foreground border-primary" : "bg-white text-foreground border-border hover:bg-secondary/20"}`}
                >
                  Standard
                </button>
                <button
                  type="button"
                  onClick={() => setPosLabelForm(f => ({ ...f, deliveryType: "express" }))}
                  className={`flex-1 py-2 px-3 border text-xs font-bold uppercase tracking-widest transition-colors ${posLabelForm.deliveryType === "express" ? "bg-primary text-primary-foreground border-primary" : "bg-white text-foreground border-border hover:bg-secondary/20"}`}
                >
                  Express
                </button>
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" className="rounded-none" onClick={() => setShowPosLabelModal(false)}>Cancel</Button>
            <Button
              className="rounded-none"
              disabled={!posLabelForm.recipientName || !posLabelForm.streetAddress || !posLabelForm.phone}
              onClick={handlePrintPosLabel}
            >
              <Printer size={16} className="mr-2" /> Print Label
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Invoice Modal */}
      <Dialog open={showInvoiceModal} onOpenChange={setShowInvoiceModal}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto rounded-none p-0">
          <DialogHeader className="sr-only">
            <DialogTitle>Invoice</DialogTitle>
          </DialogHeader>
          {selectedTransaction && (
            <div id="invoice-content" className="bg-white">
              {/* Elegant Header with Brand */}
              <div className="bg-gradient-to-r from-stone-900 to-stone-800 text-white px-10 py-8">
                <div className="flex justify-between items-center">
                  <div>
                    <h1 className="text-2xl font-light tracking-[0.3em] uppercase">Infinite Home</h1>
                    <p className="text-stone-400 text-xs tracking-wider mt-1">Premium Home Essentials</p>
                  </div>
                  <div className="text-right">
                    <p className="text-3xl font-light tracking-wider">INVOICE</p>
                  </div>
                </div>
              </div>

              {/* Invoice Details Bar */}
              <div className="bg-stone-100 px-10 py-4 flex justify-between items-center border-b border-stone-200">
                <div className="flex gap-8">
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-stone-500 mb-1">Invoice No.</p>
                    <p className="font-mono text-sm font-semibold">{selectedTransaction.transactionNumber}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-stone-500 mb-1">Date</p>
                    <p className="text-sm">
                      {selectedTransaction.createdAt ? new Date(selectedTransaction.createdAt).toLocaleDateString('en-US', { 
                        year: 'numeric', 
                        month: 'short', 
                        day: 'numeric' 
                      }) : "-"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-stone-500 mb-1">Time</p>
                    <p className="text-sm">
                      {selectedTransaction.createdAt ? new Date(selectedTransaction.createdAt).toLocaleTimeString('en-US', { 
                        hour: '2-digit', 
                        minute: '2-digit'
                      }) : "-"}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="inline-block px-3 py-1 bg-emerald-100 text-emerald-700 text-xs font-medium uppercase tracking-wider rounded-full">
                    {selectedTransaction.status || "Completed"}
                  </span>
                </div>
              </div>

              {/* Customer & Payment Info */}
              <div className="px-10 py-6 grid grid-cols-2 gap-8">
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-stone-500 mb-2">Billed To</p>
                  <p className="font-semibold text-stone-900">{selectedTransaction.customerName || "Walk-in Customer"}</p>
                  {selectedTransaction.customerPhone && (
                    <p className="text-sm text-stone-600 mt-1">{selectedTransaction.customerPhone}</p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-[10px] uppercase tracking-widest text-stone-500 mb-2">Payment Details</p>
                  <p className="font-semibold text-stone-900 capitalize">{selectedTransaction.paymentMethod}</p>
                  <p className="text-sm text-stone-600 mt-1">Served by {selectedTransaction.cashierName}</p>
                </div>
              </div>

              {/* Items Table */}
              <div className="px-10">
                <table className="w-full">
                  <thead>
                    <tr className="border-y border-stone-200 bg-stone-50">
                      <th className="text-left py-3 px-2 text-[10px] uppercase tracking-widest font-semibold text-stone-600">Item Description</th>
                      <th className="text-center py-3 px-2 text-[10px] uppercase tracking-widest font-semibold text-stone-600 w-20">Qty</th>
                      <th className="text-right py-3 px-2 text-[10px] uppercase tracking-widest font-semibold text-stone-600 w-28">Price</th>
                      <th className="text-right py-3 px-2 text-[10px] uppercase tracking-widest font-semibold text-stone-600 w-28">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedTransaction.items?.map((item: any, idx: number) => (
                      <tr key={idx} className="border-b border-stone-100">
                        <td className="py-4 px-2">
                          <p className="font-medium text-stone-900">{item.name}</p>
                          {((item.size && item.size !== 'Standard') || (item.color && item.color !== 'Default')) && (
                            <p className="text-xs text-stone-500 mt-0.5">
                              {[item.size !== 'Standard' ? item.size : '', item.color !== 'Default' ? item.color : ''].filter(Boolean).join(" • ")}
                            </p>
                          )}
                        </td>
                        <td className="py-4 px-2 text-center text-stone-700">{item.qty}</td>
                        <td className="py-4 px-2 text-right text-stone-700">{formatCurrency(item.price)}</td>
                        <td className="py-4 px-2 text-right font-semibold text-stone-900">{formatCurrency(item.price * item.qty)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Totals Section */}
              <div className="px-10 py-6">
                <div className="flex justify-end">
                  <div className="w-72">
                    <div className="space-y-2 pb-3">
                      <div className="flex justify-between text-sm text-stone-600">
                        <span>Subtotal</span>
                        <span>{formatCurrency(selectedTransaction.subtotal || 0)}</span>
                      </div>
                      {selectedTransaction.discount > 0 && (
                        <div className="flex justify-between text-sm text-emerald-600">
                          <span>Discount</span>
                          <span>-{formatCurrency(selectedTransaction.discount)}</span>
                        </div>
                      )}
                      {(selectedTransaction.gstPercentage || 0) > 0 && (
                        <div className="flex justify-between text-sm text-stone-600">
                          <span>GST ({selectedTransaction.gstPercentage}%)</span>
                          <span>{formatCurrency(selectedTransaction.gstAmount || 0)}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex justify-between items-center pt-3 border-t-2 border-stone-900">
                      <span className="text-lg font-semibold text-stone-900">Total</span>
                      <span className="text-xl font-bold text-stone-900">{formatCurrency(selectedTransaction.total || 0)}</span>
                    </div>
                    {selectedTransaction.paymentMethod === "cash" && selectedTransaction.amountReceived && (
                      <div className="mt-4 pt-3 border-t border-stone-200 space-y-1">
                        <div className="flex justify-between text-sm text-stone-600">
                          <span>Cash Received</span>
                          <span>{formatCurrency(selectedTransaction.amountReceived)}</span>
                        </div>
                        <div className="flex justify-between text-sm font-medium text-stone-800">
                          <span>Change Due</span>
                          <span>{formatCurrency(selectedTransaction.change || 0)}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Notes Section */}
              {selectedTransaction.notes && (
                <div className="mx-10 mb-6 p-4 bg-amber-50 border border-amber-200 rounded">
                  <p className="text-xs uppercase tracking-widest text-amber-700 font-semibold mb-1">Notes</p>
                  <p className="text-sm text-amber-900">{selectedTransaction.notes}</p>
                </div>
              )}

              {/* Footer */}
              <div className="bg-stone-50 px-10 py-6 text-center border-t border-stone-200">
                <p className="text-stone-900 font-medium mb-1">Thank you for shopping with us!</p>
                <p className="text-xs text-stone-500">Male', Maldives • support@infinitehome.mv</p>
              </div>
            </div>
          )}
          {/* Admin Note for POS */}
          <div className="px-6 py-4 border-t bg-secondary/10">
            <p className="text-xs uppercase tracking-widest font-bold text-muted-foreground mb-2">Admin Note <span className="normal-case font-normal">(visible to customer on tracking page)</span></p>
            <textarea
              className="w-full border border-border rounded-none p-3 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-primary bg-white"
              rows={3}
              placeholder="Leave a note for the customer (optional)…"
              value={posNoteText}
              onChange={e => setPosNoteText(e.target.value)}
              data-testid="textarea-pos-admin-note"
            />
            <div className="flex justify-end mt-2">
              <Button
                size="sm"
                variant="outline"
                className="rounded-none uppercase tracking-widest text-xs font-bold px-5 h-9 gap-2"
                onClick={handleSavePosNote}
                disabled={savingPosNote}
                data-testid="button-save-pos-note"
              >
                {savingPosNote ? <><span className="animate-spin">⟳</span> Saving…</> : "Save Note"}
              </Button>
            </div>
          </div>
          <div className="flex justify-end gap-3 p-4 bg-white border-t">
            <Button variant="outline" className="rounded-none" onClick={() => setShowInvoiceModal(false)}>
              Close
            </Button>
            <Button
              variant="outline"
              className="rounded-none"
              onClick={() => {
                setPosLabelForm({ recipientName: selectedTransaction?.customerName || "", recipientEmail: "", streetAddress: "", atollIsland: "", phone: selectedTransaction?.customerPhone || "", deliveryType: "standard" });
                setShowPosLabelModal(true);
              }}
            >
              <Printer size={16} className="mr-2" /> Shipping Label
            </Button>
            <Button
              className="rounded-none bg-stone-900 hover:bg-stone-800"
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
                          @page { size: A4; margin: 0; }
                          * { margin: 0; padding: 0; box-sizing: border-box; }
                          html, body { height: 100%; }
                          body { 
                            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                            line-height: 1.5;
                            color: #1c1917;
                            background: white;
                          }
                          .invoice-wrapper { display: flex; flex-direction: column; min-height: 100vh; }
                          .invoice-body { flex: 1 1 auto; }
                          .footer { flex-shrink: 0; margin-top: auto; }
                          .header { background: linear-gradient(to right, #1c1917, #292524); color: white; padding: 2rem 2.5rem; }
                          .header h1 { font-size: 1.5rem; font-weight: 300; letter-spacing: 0.3em; text-transform: uppercase; }
                          .header-subtitle { color: #a8a29e; font-size: 0.75rem; letter-spacing: 0.1em; margin-top: 0.25rem; }
                          .header-invoice { font-size: 1.875rem; font-weight: 300; letter-spacing: 0.1em; }
                          .details-bar { background: #f5f5f4; padding: 1rem 2.5rem; border-bottom: 1px solid #e7e5e4; display: flex; justify-content: space-between; }
                          .detail-item { }
                          .detail-label { font-size: 0.625rem; text-transform: uppercase; letter-spacing: 0.1em; color: #78716c; margin-bottom: 0.25rem; }
                          .detail-value { font-size: 0.875rem; }
                          .detail-value.mono { font-family: monospace; font-weight: 600; }
                          .status-badge { display: inline-block; padding: 0.25rem 0.75rem; background: #d1fae5; color: #047857; font-size: 0.75rem; font-weight: 500; text-transform: uppercase; letter-spacing: 0.05em; border-radius: 9999px; }
                          .customer-section { padding: 1.5rem 2.5rem; display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; }
                          .section-label { font-size: 0.625rem; text-transform: uppercase; letter-spacing: 0.1em; color: #78716c; margin-bottom: 0.5rem; }
                          .customer-name { font-weight: 600; color: #1c1917; }
                          .customer-phone { font-size: 0.875rem; color: #57534e; margin-top: 0.25rem; }
                          .text-right { text-align: right; }
                          table { width: 100%; border-collapse: collapse; margin: 0 2.5rem; width: calc(100% - 5rem); }
                          thead tr { border-top: 1px solid #e7e5e4; border-bottom: 1px solid #e7e5e4; background: #fafaf9; }
                          th { padding: 0.75rem 0.5rem; font-size: 0.625rem; text-transform: uppercase; letter-spacing: 0.1em; font-weight: 600; color: #57534e; }
                          th:first-child { text-align: left; }
                          th:nth-child(2) { text-align: center; width: 5rem; }
                          th:nth-child(3), th:nth-child(4) { text-align: right; width: 7rem; }
                          td { padding: 1rem 0.5rem; border-bottom: 1px solid #f5f5f4; }
                          td:first-child { }
                          td:nth-child(2) { text-align: center; color: #44403c; }
                          td:nth-child(3) { text-align: right; color: #44403c; }
                          td:nth-child(4) { text-align: right; font-weight: 600; color: #1c1917; }
                          .item-name { font-weight: 500; color: #1c1917; }
                          .item-variant { font-size: 0.75rem; color: #78716c; margin-top: 0.125rem; }
                          .totals-section { padding: 1.5rem 2.5rem; display: flex; justify-content: flex-end; }
                          .totals-box { width: 18rem; }
                          .total-row { display: flex; justify-content: space-between; font-size: 0.875rem; color: #57534e; padding: 0.25rem 0; }
                          .total-row.discount { color: #059669; }
                          .grand-total { display: flex; justify-content: space-between; align-items: center; padding-top: 0.75rem; margin-top: 0.75rem; border-top: 2px solid #1c1917; }
                          .grand-total-label { font-size: 1.125rem; font-weight: 600; color: #1c1917; }
                          .grand-total-value { font-size: 1.25rem; font-weight: 700; color: #1c1917; }
                          .cash-details { margin-top: 1rem; padding-top: 0.75rem; border-top: 1px solid #e7e5e4; }
                          .notes-section { margin: 0 2.5rem 1.5rem; padding: 1rem; background: #fffbeb; border: 1px solid #fde68a; border-radius: 0.25rem; }
                          .notes-label { font-size: 0.625rem; text-transform: uppercase; letter-spacing: 0.1em; color: #b45309; font-weight: 600; margin-bottom: 0.25rem; }
                          .notes-text { font-size: 0.875rem; color: #92400e; }
                          .footer { background: #fafaf9; padding: 1.5rem 2.5rem; text-align: center; border-top: 1px solid #e7e5e4; }
                          .footer-thanks { font-weight: 500; color: #1c1917; margin-bottom: 0.25rem; }
                          .footer-contact { font-size: 0.75rem; color: #78716c; }
                          @media print {
                            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                            .invoice-wrapper { min-height: 100vh; }
                            .footer { position: fixed; bottom: 0; left: 0; right: 0; }
                            .invoice-body { padding-bottom: 5rem; }
                          }
                        </style>
                      </head>
                      <body>
                        <div class="invoice-wrapper">
                        <div class="invoice-body">
                        <div class="header" style="display: flex; justify-content: space-between; align-items: center;">
                          <div>
                            <h1>Infinite Home</h1>
                            <p class="header-subtitle">Premium Home Essentials</p>
                          </div>
                          <div style="text-align: right;">
                            <p class="header-invoice">INVOICE</p>
                          </div>
                        </div>
                        <div class="details-bar">
                          <div style="display: flex; gap: 2rem;">
                            <div class="detail-item">
                              <p class="detail-label">Invoice No.</p>
                              <p class="detail-value mono">${selectedTransaction?.transactionNumber || ""}</p>
                            </div>
                            <div class="detail-item">
                              <p class="detail-label">Date</p>
                              <p class="detail-value">${selectedTransaction?.createdAt ? new Date(selectedTransaction.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : "-"}</p>
                            </div>
                            <div class="detail-item">
                              <p class="detail-label">Time</p>
                              <p class="detail-value">${selectedTransaction?.createdAt ? new Date(selectedTransaction.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : "-"}</p>
                            </div>
                          </div>
                          <div>
                            <span class="status-badge">${selectedTransaction?.status || "Completed"}</span>
                          </div>
                        </div>
                        <div class="customer-section">
                          <div>
                            <p class="section-label">Billed To</p>
                            <p class="customer-name">${selectedTransaction?.customerName || "Walk-in Customer"}</p>
                            ${selectedTransaction?.customerPhone ? `<p class="customer-phone">${selectedTransaction.customerPhone}</p>` : ""}
                          </div>
                          <div class="text-right">
                            <p class="section-label">Payment Details</p>
                            <p class="customer-name" style="text-transform: capitalize;">${selectedTransaction?.paymentMethod || ""}</p>
                            <p class="customer-phone">Served by ${selectedTransaction?.cashierName || ""}</p>
                          </div>
                        </div>
                        <table>
                          <thead>
                            <tr>
                              <th>Item Description</th>
                              <th>Qty</th>
                              <th>Price</th>
                              <th>Amount</th>
                            </tr>
                          </thead>
                          <tbody>
                            ${selectedTransaction?.items?.map((item: any) => `
                              <tr>
                                <td>
                                  <p class="item-name">${item.name}</p>
                                  ${(item.size && item.size !== 'Standard') || (item.color && item.color !== 'Default') ? `<p class="item-variant">${[item.size !== 'Standard' ? item.size : '', item.color !== 'Default' ? item.color : ''].filter(Boolean).join(" • ")}</p>` : ""}
                                </td>
                                <td>${item.qty}</td>
                                <td>${formatCurrency(item.price)}</td>
                                <td>${formatCurrency(item.price * item.qty)}</td>
                              </tr>
                            `).join("") || ""}
                          </tbody>
                        </table>
                        <div class="totals-section">
                          <div class="totals-box">
                            <div class="total-row">
                              <span>Subtotal</span>
                              <span>${formatCurrency(selectedTransaction?.subtotal || 0)}</span>
                            </div>
                            ${(selectedTransaction?.discount || 0) > 0 ? `
                              <div class="total-row discount">
                                <span>Discount</span>
                                <span>-${formatCurrency(selectedTransaction?.discount || 0)}</span>
                              </div>
                            ` : ""}
                            ${(selectedTransaction?.gstPercentage || 0) > 0 ? `
                              <div class="total-row">
                                <span>GST (${selectedTransaction?.gstPercentage}%)</span>
                                <span>${formatCurrency(selectedTransaction?.gstAmount || 0)}</span>
                              </div>
                            ` : ""}
                            <div class="grand-total">
                              <span class="grand-total-label">Total</span>
                              <span class="grand-total-value">${formatCurrency(selectedTransaction?.total || 0)}</span>
                            </div>
                            ${selectedTransaction?.paymentMethod === "cash" && selectedTransaction?.amountReceived ? `
                              <div class="cash-details">
                                <div class="total-row">
                                  <span>Cash Received</span>
                                  <span>${formatCurrency(selectedTransaction.amountReceived)}</span>
                                </div>
                                <div class="total-row" style="font-weight: 500; color: #1c1917;">
                                  <span>Change Due</span>
                                  <span>${formatCurrency(selectedTransaction?.change || 0)}</span>
                                </div>
                              </div>
                            ` : ""}
                          </div>
                        </div>
                        ${selectedTransaction?.notes ? `
                          <div class="notes-section">
                            <p class="notes-label">Notes</p>
                            <p class="notes-text">${selectedTransaction.notes}</p>
                          </div>
                        ` : ""}
                        </div>
                        <div class="footer">
                          <p class="footer-thanks">Thank you for shopping with us!</p>
                          <p class="footer-contact">Male', Maldives • support@infinitehome.mv</p>
                        </div>
                        </div>
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
