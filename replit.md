# INFINITE HOME - E-commerce Platform

## Overview

INFINITE HOME is an e-commerce platform specializing in premium bedding, furniture, and home appliances. It features a full-stack architecture designed to handle product catalog management, shopping cart functionality, order processing with coupon support, an administrative dashboard, and comprehensive order tracking. The platform aims to provide a luxury online shopping experience with robust features for both customers and administrators.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
- **Framework**: React with TypeScript and Vite.
- **Routing**: Wouter.
- **State Management**: Zustand for cart and authentication, with localStorage persistence; TanStack React Query for server state.
- **UI/Styling**: shadcn/ui built on Radix UI, styled with Tailwind CSS for a luxury aesthetic, and Framer Motion for animations.

### Backend
- **Framework**: Express 5 on Node.js with TypeScript.
- **API Design**: RESTful JSON API.
- **Database ORM**: Drizzle ORM with PostgreSQL.
- **Schema Validation**: Zod with drizzle-zod for type-safety.

### Data Storage
- **Database**: PostgreSQL managed by Drizzle ORM.
- **Schema**: Centralized in `shared/schema.ts`, including tables for admins, customers, products, coupons, and orders. UUIDs are used for identifiers.
- **File Storage**: Supabase Storage for product images (public) and payment slips (private, admin-only access via signed URLs).

### Key Design Patterns
- **Shared Types**: Type definitions are shared between frontend and backend via path aliases.
- **Storage Abstraction**: An `IStorage` interface abstracts database operations.
- **Path Aliases**: Used for organizing client, shared, and asset code.

### Build System
- **Client**: Vite builds to `dist/public`.
- **Server**: esbuild bundles server code to `dist/index.cjs`.
- **Database Migrations**: Drizzle Kit handles schema synchronization.

### Core Features
- **Product Management**: Supports pre-orders, variant-level stock, multiple images, certifications, and sale pricing.
- **Order Management**: Comprehensive order status flow, order tracking, and payment slip viewing for admins.
- **Customer Accounts**: Secure registration, login, profile management, order history, and address book.
- **Admin Panel**: Secure access with separate authentication, managing products, orders, coupons, and categories.
- **Search**: Debounced product search functionality.
- **Email Notifications**: Automated email notifications for order status changes.
- **Image Specifications**: Recommended 1200x1500px (4:5 aspect ratio) JPG/PNG under 2MB, displayed using `object-contain`.

## External Dependencies

### Database & ORM
- **PostgreSQL**: Primary database.
- **Drizzle ORM**: Database interaction.
- **Drizzle Kit**: Schema migration tool.

### UI & Styling
- **Radix UI**: Accessible UI primitives.
- **shadcn/ui**: Styled component library.
- **Lucide React**: Icon library.
- **Tailwind CSS v4**: Utility-first CSS framework.

### State Management & Data Fetching
- **TanStack React Query**: Server state management.
- **Zustand**: Client-side state management.

### Form Handling & Validation
- **React Hook Form**: Form state management.
- **Zod**: Schema validation.

### Development Tools
- **Vite**: Frontend build tool.
- **esbuild**: Backend bundler.
- **Replit Plugins**: Enhanced Replit development experience plugins.

### Cloud Services
- **Supabase Storage**: File storage for images and documents.

### Other
- **Framer Motion**: Animation library.
- **Wouter**: Client-side router.