# INFINITE HOME - E-commerce Platform

## Overview

INFINITE HOME is an e-commerce platform specializing in premium bedding, furniture, and home appliances. The application features a full-stack architecture with a React frontend and Express backend, using PostgreSQL for data persistence. Key features include product catalog management, shopping cart functionality, order processing with coupon support, admin dashboard, and order tracking.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript, using Vite as the build tool
- **Routing**: Wouter for lightweight client-side routing
- **State Management**: Zustand for cart and authentication state with localStorage persistence
- **Data Fetching**: TanStack React Query for server state management
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with custom theme configuration supporting luxury brand aesthetics
- **Animations**: Framer Motion for smooth UI transitions

### Backend Architecture
- **Framework**: Express 5 on Node.js with TypeScript
- **API Design**: RESTful JSON API with `/api` prefix
- **Database ORM**: Drizzle ORM with PostgreSQL dialect
- **Schema Validation**: Zod with drizzle-zod for type-safe schema definitions
- **Development**: Vite dev server integration with HMR support

### Data Storage
- **Database**: PostgreSQL with Drizzle ORM
- **Schema Location**: `shared/schema.ts` contains all table definitions
- **Tables**: admins, customers, products, coupons, orders
- **ID Strategy**: UUID generation via PostgreSQL's `gen_random_uuid()`

### Key Design Patterns
- **Shared Types**: Schema definitions in `shared/` directory are accessible to both frontend and backend via path aliases
- **Storage Abstraction**: `IStorage` interface in `server/storage.ts` abstracts database operations
- **Path Aliases**: `@/` for client source, `@shared/` for shared code, `@assets/` for static assets

### Build System
- **Client Build**: Vite produces optimized static assets to `dist/public`
- **Server Build**: esbuild bundles server code to `dist/index.cjs` with selective dependency bundling
- **Database Migrations**: Drizzle Kit with `db:push` command for schema synchronization

## External Dependencies

### Database
- **PostgreSQL**: Primary database, connection via `DATABASE_URL` environment variable
- **Drizzle Kit**: Schema migration and push tooling

### UI Component Libraries
- **Radix UI**: Comprehensive set of accessible UI primitives (dialog, dropdown, tabs, etc.)
- **shadcn/ui**: Pre-styled component variants using class-variance-authority
- **Lucide React**: Icon library

### State & Data
- **TanStack React Query**: Async state management with caching
- **Zustand**: Lightweight client state management with persist middleware

### Form Handling
- **React Hook Form**: Form state management
- **Zod**: Schema validation integrated with forms via @hookform/resolvers

### Styling
- **Tailwind CSS v4**: Utility-first CSS with custom theme inline configuration
- **tw-animate-css**: Animation utilities

### Development Tools
- **Replit Plugins**: vite-plugin-cartographer, vite-plugin-dev-banner, vite-plugin-runtime-error-modal for enhanced Replit development experience

## API Endpoints

### Categories
- `GET /api/categories` - List all categories
- `POST /api/categories` - Create category (admin)
- `PATCH /api/categories/:id` - Update category (admin)
- `DELETE /api/categories/:id` - Delete category (admin)

### Products
- `GET /api/products` - List all products
- `GET /api/products/search?q={query}` - Search products by name/description
- `GET /api/products/:id` - Get single product
- `POST /api/products` - Create product (admin)
- `PATCH /api/products/:id` - Update product (admin)
- `DELETE /api/products/:id` - Delete product (admin)
- `PATCH /api/products/:id/stock` - Update product stock (admin)

### Coupons
- `GET /api/coupons` - List all coupons
- `GET /api/coupons/validate/:code` - Validate coupon code
- `POST /api/coupons` - Create coupon (admin)
- `DELETE /api/coupons/:id` - Delete coupon (admin)

### Orders
- `GET /api/orders` - List all orders (admin)
- `GET /api/orders/:id` - Get order by ID
- `GET /api/orders/track/:orderNumber` - Track order by number
- `GET /api/orders/customer/:email` - Get orders by customer email
- `POST /api/orders` - Create order
- `PATCH /api/orders/:id/status` - Update order status (admin)

### Customer Addresses
- `GET /api/customers/:customerId/addresses` - Get customer addresses
- `POST /api/customers/:customerId/addresses` - Add new address
- `DELETE /api/customers/:customerId/addresses/:addressId` - Delete address
- `PATCH /api/customers/:customerId/addresses/:addressId/default` - Set as default address

### Admin
- `POST /api/admin/login` - Admin authentication
- `GET /api/admins` - List admin users
- `POST /api/admins` - Create admin user

### Customers
- `POST /api/customers` - Customer registration (signup)
- `POST /api/customers/login` - Customer login
- `GET /api/customers/:id` - Get customer profile
- `PATCH /api/customers/:id` - Update customer profile

## Default Credentials
- **Admin Email**: admin@infinitehome.mv
- **Admin Password**: admin123

## Currency & Payment
- **Currency**: MVR (Maldivian Rufiyaa)
- **Payment Methods**: Cash on Delivery (COD), Bank Transfer

## Order Status Flow
Professional shipping statuses matching major carriers:
- **pending**: Order received, awaiting confirmation
- **confirmed**: Order confirmed, payment verified
- **payment_verification**: Bank transfer pending verification
- **processing**: Being prepared for shipment
- **shipped**: Handed to delivery partner
- **in_transit**: Package moving through delivery network
- **out_for_delivery**: With delivery driver, arriving today
- **delivered**: Successfully delivered
- **delivery_exception**: Delivery issue requiring attention
- **cancelled**: Order cancelled
- **refunded**: Order refunded

## Product Categories
- Bedding (sheets, pillowcases, duvet covers, mattresses)
- Furniture (sofas, dining tables, beds, office chairs)
- Appliances (air purifiers, vacuums, espresso machines, mixers)

## Content Pages
- `/terms` - Terms of Service
- `/privacy` - Privacy Policy
- `/terms` - Terms of Service
- `/privacy` - Privacy Policy
- `/returns` - Returns & Exchanges (30-day return policy)
- `/shipping` - Shipping Information
- `/contact` - Contact Us with form

## Shipping Policy
- **Standard Delivery**: Free on all items throughout Maldives
- **Express Delivery**: Available in Male' and Hulhumale' only
  - Express charge per product (MVR 15-100) set in admin panel
  - Shown at checkout when customer selects express delivery
  - Same-day or next-day delivery
- **Returns**: 30-day free returns and exchanges policy

## Contact Information
- **Email**: info@infinitehome.mv, support@infinitehome.mv
- **Phone**: 7840001
- **WhatsApp**: 9607840001
- **Location**: Male', Maldives
- **Hours**: Sunday - Thursday, 9:00 AM - 6:00 PM

## Bank Account Details
- **MIB (Maldives Islamic Bank)**: INFINITE LOOP - 90401480025761000
- **BML (Bank of Maldives)**: INFINITE LOOP PVT LTD - 7730000725601

## Order ID Format
Alphanumeric 6-character format: IH-XXXXXX (e.g., IH-A3K7M9)

## Authentication

### Customer Authentication
- Separate customer auth system with signup, login, and account management
- Pages: `/login`, `/signup`, `/account`
- Auth state managed via Zustand (useAuth hook in `client/src/lib/auth.ts`)
- Customer accounts store: name, email, phone, password, shipping address

### Admin Authentication
- Admin panel accessible only via `/admin` URL (not in public navigation)
- Separate admin auth state (useAdminAuth hook in `client/src/lib/auth.ts`)
- Default credentials: admin@infinitehome.mv / admin123
- Mobile-responsive admin panel with hamburger menu navigation

## Recent Changes
- Added pre-order system with toggle per product, custom pricing (initial payment + total price), and ETA tracking
- Products can be marked as pre-order in admin panel with separate pre-order price from base price
- Pre-order items display amber-styled badges on product page, cart, and checkout
- Cart and checkout handle pre-order items without stock restrictions (unlimited quantity for pre-orders)
- Order items now include isPreOrder, preOrderTotalPrice, and preOrderEta fields
- Checkout shows balance due at delivery for pre-order items
- Implemented variant-level stock management (e.g., "King-White" vs "King-Blue" tracked separately)
- Added variantStock JSON field to products schema with compound key format "Size-Color"
- Helper functions `getVariantStockKey()` and `getVariantStock()` in `client/src/lib/products.ts`
- Admin panel enhanced with variant stock UI showing all size/color combinations
- Product page, cart, and checkout now enforce variant-specific stock limits
- Server-side order validation requires productId, validates size/color against product options, checks variant stock
- Cart caps quantities to available variant stock; checkout displays "Only X available" warnings
- Added categories management system with CRUD operations and dropdown selection in admin
- Added stock management for products with inventory tracking
- Added support for multiple product images (primary + additional gallery)
- Admin product form now uses category dropdown with ability to create new categories inline
- Added product search feature with debounced search dialog in navbar
- Added customer order history viewing in Account page
- Implemented cart persistence linked to customer accounts (saves/loads per user)
- Added address book feature for customers with multiple saved addresses
- Admin panel now displays payment slip images for bank transfer orders
- Fixed order status dropdown styling with solid background (was transparent)
- Added customer authentication system with signup, login, and account management
- Implemented separate admin authentication (useAdminAuth) from customer auth (useAuth)
- Removed admin panel access from public navbar - admin only accessible via /admin URL
- Made admin panel fully mobile-responsive with hamburger menu navigation
- Removed trust/warranty banner from homepage hero section
- Added scroll-to-top functionality that resets page position on route changes
- Converted prototype to full-stack application with PostgreSQL database
- Implemented complete API layer for products, orders, coupons, and admin users
- Connected all frontend pages to real API endpoints
- Added coupon validation and order tracking functionality
- Created admin panel with product/order/coupon management
- Enhanced order tracking with professional shipping statuses (In Transit, Out for Delivery, Delivery Exception)
- Improved tracking page design with carrier-style timeline and status badges
- Updated product categories from Bedding/Bath/Apparel to Bedding/Furniture/Appliances
- Added 10+ sample products across all categories with color and size variants
- Created comprehensive content pages (Terms, Privacy, Returns, Shipping, Contact)
- Updated order ID format to alphanumeric 6-character format (IH-XXXXXX)
- Enhanced product color selection to display as text buttons with color indicators
- Added more color options support (Navy, Emerald, Blush, Natural Oak, etc.)
- Added automatic email notifications for order status changes (confirmed, processing, shipped, in_transit, out_for_delivery, delivered, cancelled, refunded)
- Added email debug endpoints (GET /api/email/status, POST /api/email/test) for Vercel troubleshooting
- Made admin product dialog responsive for desktop (expands to larger width on md/lg screens)
- Fixed SelectContent dropdown background (now solid bg-background instead of transparent)
- Added Size Guide link on product detail page next to size selection
- Created Custom Size Mattress page (/custom-mattress) with friendly messaging and request form
- Custom mattress page includes terms and conditions (45-90 day delivery, 50% deposit, non-refundable)
- Added "Can't find your size? Get a custom mattress" link on bedding/mattress product pages
- Added Custom Size Mattress link to footer navigation
- Added product certifications feature (OEKO-TEX Standard 100, GOTS, BSCI, ISO, FSC, CE, RoHS, Energy Star, CertiPUR-US)
- Admin panel now has checkbox selection for certifications in product form
- Product detail page displays certifications with green badges when available
- Added product image slider with swipe gestures, navigation arrows, and image counter
- Changed product images to object-contain for full visibility without cropping
- Added sale price system with isOnSale toggle and salePrice field in products schema
- Admin panel now has sale toggle and sale price input for each product
- Product cards show sale badge with discount percentage (-10%, -25%, etc.)
- Product page shows original price with strikethrough and discount badge when on sale
- Homepage redesigned with clean, modern styling inspired by furnituremaldives.com:
  - Added rotating announcement bar at top with delivery/return info
  - Horizontal scrolling product sections for each category (Bedding, Furniture, Appliances)
  - Sale section displays products marked as on sale with red badges
  - Cleaner product cards with hover effects and smooth animations
  - Category cards with gradient overlays and hover effects
  - "Why Choose Us" section with features grid
- Added ProductScrollSection component for horizontal product carousels with navigation arrows
- Added AnnouncementBar component with rotating messages and close button