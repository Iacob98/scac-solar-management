# SCAC Platform

## Overview

The SCAC platform is a comprehensive web application designed to automate solar panel installation projects, managing invoices, crews, and firms. It serves as a centralized system for managing multiple solar installation companies, their projects, clients, and billing through integration with Invoice Ninja.

## User Preferences

Preferred communication style: Simple, everyday language.
Language: Russian only (no language switching)
Focus on real data integration and proper business logic implementation

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite for development and production builds
- **Styling**: Tailwind CSS with shadcn/ui component library
- **State Management**: TanStack Query (React Query) for server state management
- **Routing**: Wouter for lightweight client-side routing
- **Forms**: React Hook Form with Zod validation
- **UI Components**: Radix UI primitives with custom styling

### Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Language**: TypeScript with ES modules
- **Database**: PostgreSQL with Drizzle ORM
- **Database Provider**: Neon serverless PostgreSQL
- **Authentication**: Replit Auth with OpenID Connect
- **Session Management**: Express sessions with PostgreSQL store

## Key Components

### Database Schema
The system uses PostgreSQL with the following main entities:
- **Users**: Role-based access (admin/leiter) with Replit Auth integration
- **Firms**: Solar installation companies with Invoice Ninja integration
- **Clients**: End customers for solar installations
- **Crews**: Installation teams assigned to projects
- **Projects**: Solar panel installation projects with status tracking
- **Services**: Project line items with pricing
- **Invoices**: Billing records synced with Invoice Ninja
- **Project Files**: Document management for reports and approvals

### Role-Based Access Control
- **Admin**: Full system access, can manage all firms, users, and projects
- **Project Leiter**: Limited access to assigned firms and their projects

### External Integration
- **Invoice Ninja**: Third-party invoicing system for billing management
- **Replit Auth**: Authentication provider for user management

## Data Flow

1. **User Authentication**: Users authenticate through Replit Auth
2. **Firm Selection**: Users select which firm context to work in
3. **Project Management**: Create and manage solar installation projects
4. **Service Configuration**: Define project services and pricing
5. **Invoice Generation**: Create invoices in Invoice Ninja
6. **Status Tracking**: Monitor project progress from planning to completion
7. **File Management**: Upload and manage project documents

## External Dependencies

### Core Dependencies
- **@neondatabase/serverless**: Neon PostgreSQL connection
- **drizzle-orm**: Database ORM and query builder
- **@tanstack/react-query**: Server state management
- **@radix-ui/***: Headless UI components
- **react-hook-form**: Form management
- **zod**: Schema validation
- **axios**: HTTP client for API requests

### Development Dependencies
- **tsx**: TypeScript execution for development
- **esbuild**: Fast JavaScript bundler for production
- **tailwindcss**: Utility-first CSS framework
- **@vitejs/plugin-react**: React support for Vite

## Deployment Strategy

### Development
- Run server with `npm run dev` using tsx for hot reloading
- Vite handles client-side development server with HMR
- PostgreSQL database hosted on Neon cloud

### Production
- Build client assets with Vite
- Bundle server code with esbuild
- Deploy as single Node.js application
- Database migrations handled by Drizzle Kit

### Environment Configuration
- `DATABASE_URL`: PostgreSQL connection string
- `SESSION_SECRET`: Session encryption key
- `REPL_ID`: Replit environment identifier
- `ISSUER_URL`: OpenID Connect issuer URL

The application follows a monolithic architecture with clear separation between client and server code, utilizing modern tooling for optimal developer experience and production performance.

## Recent Changes (January 2025)

### Language and UI Updates
- Removed language switching functionality, set to Russian only
- Translated all UI elements to Russian language
- Updated i18n hooks to always use Russian locale
- Fixed currency and date formatting for Russian locale

### Dashboard and Statistics
- Completely redesigned Home page with working statistics
- Added real-time data display (active projects, clients, crews)
- Implemented quick action cards for navigation
- Connected statistics to actual database queries

### Profile Settings
- Added comprehensive Settings page with profile editing
- Implemented user profile update API endpoints
- Added avatar management and form validation
- Connected settings to user dropdown menu

### Service Management and Business Rules
- Implemented service modification restrictions after invoice creation
- Added service locking when project status is 'invoiced' or 'paid'
- Created warning messages and disabled UI elements for locked services
- Added project status validation in services interface

### Administrator Functions
- Created FirmsManagement page for administrator-only firm creation
- Added comprehensive firm creation form with Invoice Ninja integration
- Implemented role-based access control for firm management
- Added API endpoint for retrieving individual project information
- Implemented automatic firm data population using Invoice Ninja API
- Added test connection functionality to validate API credentials and auto-fill company data

### Data Integration Fixes
- Fixed all TypeScript compilation errors
- Resolved React Query type annotations
- Fixed nullable field handling throughout the application
- Ensured proper data flow from database to frontend