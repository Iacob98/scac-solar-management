# SCAC Platform

## Overview

The SCAC platform is a comprehensive web application designed to automate solar panel installation projects, managing invoices, crews, and firms. It serves as a centralized system for managing multiple solar installation companies, their projects, clients, and billing through integration with Invoice Ninja. The business vision is to provide a unified, efficient system for solar installation companies, streamlining operations and improving project management.

## User Preferences

Preferred communication style: Simple, everyday language.
Language: Russian only (no language switching)
Focus on real data integration and proper business logic implementation

## System Architecture

### Frontend
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS with shadcn/ui and Radix UI
- **State Management**: TanStack Query
- **Routing**: Wouter
- **Forms**: React Hook Form with Zod validation
- **UI/UX Decisions**: Responsive design adapted for mobile and desktop, with specific layouts for different modules (e.g., card-based for mobile users/admin, table-based for invoices/clients). Utilizes professional iconography and consistent styling for a clean user interface.

### Backend
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript with ES modules
- **Database**: PostgreSQL with Drizzle ORM (Neon serverless PostgreSQL)
- **Authentication**: Replit Auth with OpenID Connect
- **Session Management**: Express sessions with PostgreSQL store

### Key Features & Design Patterns
- **Role-Based Access Control**: Differentiates between 'Admin' (full access) and 'Project Leiter' (limited to assigned firms).
- **Data Flow**: Structured flow from user authentication, firm selection, project management, service configuration, to invoice generation and status tracking, including file management.
- **Invoice Ninja Integration**: Core for billing management, including customer data integration, payment status synchronization, and PDF attachment for emails.
- **Google Calendar Integration**: Automates event creation for crew members based on project assignments and schedule updates.
- **Postmark Email Integration**: Enables sending invoices with PDF attachments to clients.
- **Comprehensive File Storage System**: Securely manages project documents, including automated PDF downloads for invoices and a token-based photo upload system for crews with history tracking.
- **Crew Management**: Includes detailed statistics, project association, and comprehensive history tracking for crew composition changes.
- **Search Functionality**: Advanced search capabilities for projects by various criteria.

## External Dependencies

- **Invoice Ninja**: Third-party invoicing system.
- **Replit Auth**: Authentication provider.
- **Neon**: Serverless PostgreSQL database provider.
- **Postmark**: Email sending service.
- **Google Calendar API**: For calendar event management.
- **@neondatabase/serverless**: PostgreSQL client.
- **drizzle-orm**: ORM for database interaction.
- **@tanstack/react-query**: For server state management.
- **@radix-ui/**: Headless UI components library.
- **react-hook-form**: Form management library.
- **zod**: Schema validation library.
- **axios**: HTTP client.
- **express-fileupload**: Middleware for file handling.