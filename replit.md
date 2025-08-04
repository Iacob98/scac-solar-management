# SCAC Platform

## Overview
The SCAC platform is a comprehensive web application designed to automate solar panel installation projects. It centralizes the management of multiple solar installation companies, their projects, clients, and billing through integration with Invoice Ninja. The platform aims to streamline operations, manage invoices, crews, and firms, providing a robust system for the solar energy sector.

## User Preferences
Preferred communication style: Simple, everyday language.
Language: Russian only (no language switching)
Focus on real data integration and proper business logic implementation

## System Architecture

### Frontend
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS with shadcn/ui and Radix UI primitives
- **State Management**: TanStack Query (React Query)
- **Routing**: Wouter
- **Forms**: React Hook Form with Zod validation
- **UI/UX Decisions**: Responsive design with mobile adaptation for key modules (Users/Admin, Home, Clients, Invoices, Calendar, Crews, Projects). Uses card-based layouts for mobile views in some sections, while maintaining table views for larger screens or where preferred (Invoices, Clients). Consistent use of icons, badges, and professional formatting.

### Backend
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript with ES modules
- **Database**: PostgreSQL with Drizzle ORM (using Neon serverless PostgreSQL)
- **Authentication**: Replit Auth with OpenID Connect, supporting role-based access control (Admin, Project Leiter). Includes a robust test authentication system for development.
- **Session Management**: Express sessions with PostgreSQL store
- **Architecture Pattern**: Monolithic with clear separation between client and server code.

### Key Features & Design Choices
- **Role-Based Access Control**: Admins have full system access, while Project Leiters are restricted to assigned firms and projects.
- **Invoice Ninja Integration**: Core for billing management, including firm creation, invoice generation, and bidirectional payment status synchronization. Invoice creation includes detailed customer and installation information.
- **Project Management**: Comprehensive project lifecycle tracking from planning to completion, including service configuration, status updates, and document management.
- **Crew Management**: Detailed crew and member tracking, including historical composition, photo uploads (token-based), and Google Calendar integration for project assignments and schedule updates.
- **File Management**: Secure file storage system with database schema, API endpoints, and automatic PDF download/storage for invoices. Supports project-specific document uploads.
- **Email Integration**: Postmark service integration for sending invoices with PDF attachments, including configuration through firm settings.
- **Search Functionality**: Enhanced search across projects, clients, and crews using various criteria like customer ID, names, and crew numbers.
- **History Tracking**: Comprehensive activity logging for projects, files, reports, invoices, and crew composition changes with detailed entries and user attribution.
- **Internationalization**: Primarily Russian language with all UI elements translated. While a localization system is present, the current focus is Russian-only.
- **Data Integrity**: Focus on proper business logic implementation, data flow from database to frontend, and handling of nullable fields.
- **API Design**: RESTful APIs for core functionalities, including dedicated endpoints for firms, projects, clients, crews, invoices, files, and integrations.

## External Dependencies

- **Database Provider**: Neon (for PostgreSQL)
- **Third-Party Services**:
    - Invoice Ninja (invoicing and billing management)
    - Replit Auth (user authentication and identity management)
    - Google Calendar API (for crew scheduling and event management)
    - Postmark (email sending service)
- **Libraries/Frameworks (Frontend)**: React, Vite, Tailwind CSS, shadcn/ui, Radix UI, TanStack Query, Wouter, React Hook Form, Zod, Axios.
- **Libraries/Frameworks (Backend)**: Node.js, Express.js, Drizzle ORM, @neondatabase/serverless, tsx, esbuild, express-fileupload.