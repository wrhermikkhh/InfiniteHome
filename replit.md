# INFINITE HOME - Luxury E-commerce Platform

## Overview

INFINITE HOME is a luxury e-commerce platform specializing in premium bedding, bath products, and loungewear. The application features a full-stack architecture with a React frontend and Express backend, using PostgreSQL for data persistence. Key features include product catalog management, shopping cart functionality, order processing with coupon support, admin dashboard, and order tracking.

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
- **Tables**: admins, products, coupons, orders
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

### Products
- `GET /api/products` - List all products
- `GET /api/products/:id` - Get single product
- `POST /api/products` - Create product (admin)
- `PATCH /api/products/:id` - Update product (admin)
- `DELETE /api/products/:id` - Delete product (admin)

### Coupons
- `GET /api/coupons` - List all coupons
- `GET /api/coupons/validate/:code` - Validate coupon code
- `POST /api/coupons` - Create coupon (admin)
- `DELETE /api/coupons/:id` - Delete coupon (admin)

### Orders
- `GET /api/orders` - List all orders (admin)
- `GET /api/orders/:id` - Get order by ID
- `GET /api/orders/track/:orderNumber` - Track order by number
- `POST /api/orders` - Create order
- `PATCH /api/orders/:id/status` - Update order status (admin)

### Admin
- `POST /api/admin/login` - Admin authentication
- `GET /api/admins` - List admin users
- `POST /api/admins` - Create admin user

## Default Credentials
- **Admin Email**: admin@infinitehome.mv
- **Admin Password**: admin123

## Currency & Payment
- **Currency**: MVR (Maldivian Rufiyaa)
- **Payment Methods**: Cash on Delivery (COD), Bank Transfer

## Recent Changes
- Converted prototype to full-stack application with PostgreSQL database
- Implemented complete API layer for products, orders, coupons, and admin users
- Connected all frontend pages to real API endpoints
- Added coupon validation and order tracking functionality
- Created admin panel with product/order/coupon management