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

## Recent Changes (July 2025)

### Language and UI Updates
- Removed language switching functionality, set to Russian only
- Translated all UI elements to Russian language
- Updated i18n hooks to always use Russian locale
- Fixed currency and date formatting for Russian locale
- Completed comprehensive i18n system cleanup (January 2025):
  - Removed obsolete i18n library and translation files
  - Eliminated unused i18n imports across entire frontend codebase
  - Standardized direct Russian text usage throughout application
  - Fixed React hooks order issues caused by i18n cleanup
  - Simplified currency and date formatting with inline Intl functions

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
- Removed legacy Firms.tsx page and consolidated to use only FirmsManagement.tsx
- Updated routing to use /admin/firms path for the modern firm management interface

### Data Integration Fixes
- Fixed all TypeScript compilation errors
- Resolved React Query type annotations
- Fixed nullable field handling throughout the application
- Ensured proper data flow from database to frontend

### Development Testing System (July 2025)
- Implemented comprehensive test authentication system for development
- Created TestLogin.tsx component for easy user switching during development
- Added test login API endpoints supporting session-based authentication
- Modified authentication middleware to support both Replit Auth and test sessions
- Added test users: Thomas Mueller, Maria Schneider, Anna Weber, Klaus Richter, Petra Wagner
- Enabled easy testing of role-based access control and project sharing features
- Configured secure cookie handling for development environment

### Project History and Activity Tracking (July 2025)
- Completed comprehensive file and report history tracking system
- Extended project history schema with new change types: file_added, file_deleted, report_added, report_updated, report_deleted
- Added detailed history logging for all file operations (upload/delete) with file names and types
- Added detailed history logging for all report operations (create/update/delete) with ratings and star displays
- Enhanced invoice creation process to record history entries with invoice numbers and amounts
- Updated ProjectHistory.tsx component with icons, colors, and labels for new history types
- All project activities now tracked with proper user attribution and descriptive messages

### Enhanced Invoice Ninja Integration (July 2025)
- Fixed project creation error with empty date fields (workStartDate, workEndDate, etc.)
- Implemented comprehensive customer data integration in Invoice Ninja invoices
- Added installation person details (firstName, lastName, address, uniqueId, phone) to invoice public notes
- Enhanced custom fields in invoices: custom_value3 for customer ID, custom_value4 for phone number
- Created German-language installation notes formatting for professional invoice presentation
- Improved transaction handling for invoice creation and project history recording
- All invoice creation now includes detailed installation customer information from project data

### File System Integration Fixes (July 22, 2025)
- Fixed critical file viewing issues - GET /api/files/:id endpoint now properly handles legacy PDF files
- Resolved file upload problems by switching to legacy format for compatibility with existing UI
- Added dual-system support for both legacy project_files and new file_storage tables
- Fixed routing conflicts between fileRoutes.ts and main routes.ts endpoints
- Implemented proper file reading from uploads folder for legacy PDF invoices
- Added proper MIME-type detection by file extension for PDF and image files
- Replaced React Button components with direct HTML links for reliable file opening
- All file operations (upload, view, delete) now work seamlessly with existing project interface
- Maintained backward compatibility while preparing foundation for future file system migration

### Payment Status Synchronization (July 2025)
- Implemented bidirectional payment status synchronization with Invoice Ninja
- Fixed Invoice Ninja v5 API compatibility using correct bulk actions endpoint
- Added multi-level fallback approach for maximum Invoice Ninja version compatibility
- Successfully marks invoices as paid in both SCAC and Invoice Ninja systems
- Added comprehensive history tracking for payment status changes
- Enhanced error handling for Invoice Ninja API connectivity issues
- Fixed API request routing issues in Invoices page for proper project data loading
- Payment history entries include invoice numbers and payment confirmation details

### Comprehensive File Storage System (July 2025)
- Implemented complete file storage system with database schema and API endpoints
- Created file upload and management components (FileUpload, FileList, FileStorage page)
- Added automatic PDF download and storage when invoices are created in Invoice Ninja
- Removed URL-based file adding, keeping only direct file upload functionality
- Integrated file storage into project workflow with categorization system
- Added file management to main navigation with dedicated storage interface
- Implemented secure file access with user authentication and project association

### Internationalization and Code Standardization (July 2025)
- Created comprehensive localization system with shared/locales.ts file supporting Russian and English
- Implemented useLocale hook for easy language switching throughout the application
- Standardized all text strings into centralized locale files for consistent translation management
- Fixed Google OAuth integration issues: added prompt: 'consent' for proper refresh_token handling
- Resolved database constraints errors for google_tokens table with proper unique constraints
- Added proper error handling for missing refresh_token scenarios
- Ensured all variable names and code structure follow consistent TypeScript standards
- Prepared foundation for bilingual site functionality with complete text extraction

### Google Calendar Integration for Brigade Members (July 2025)
- Implemented comprehensive Google Calendar integration replacing email notifications system
- Added googleCalendarId field to crew members schema for automatic calendar event creation
- Successfully configured OAuth 2.0 authentication with Google Calendar API
- Created automated calendar event generation for:
  - Project assignments with detailed project information (location, dates, contacts)
  - Work schedule updates with timing and location details
  - Equipment arrival notifications when ready for installation
  - Equipment delivery date updates
- All calendar events include complete project details and installation information
- German-language event descriptions with professional formatting
- Automatic calendar event creation integrated into project assignment workflows
- Events created in individual crew member calendars with proper Google Calendar IDs
- Enhanced crew member management forms to include Google Calendar ID fields
- Real calendar event creation working with live Google Calendar API
- Added /google-setup page for OAuth configuration and status monitoring
- Calendar widget component for project details page with real event creation
- System successfully creates events in user's actual Google Calendar

### Postmark Email Integration (July 2025)
- Implemented Postmark email service integration for sending invoices to clients
- Added Postmark configuration fields to firms schema (postmarkServerToken, postmarkFromEmail, postmarkMessageStream)
- Created comprehensive FirmEdit.tsx component for managing firm settings including Postmark configuration
- Added email sending functionality for invoices with PDF attachments
- Created new project statuses: 'send_invoice' and 'invoice_sent' for email workflow
- Implemented test email functionality to verify Postmark configuration
- Added send invoice button in ProjectDetail page that appears when invoice is created and client has email
- API endpoints created: /api/postmark/test for testing and /api/invoice/send-email/:projectId for sending invoices
- Integrated with existing invoice PDF download functionality to attach PDFs to emails
- Email templates created in German language with professional formatting
- Automatic project status update and history tracking when invoices are sent
- Fixed TypeScript errors in storage.ts by adding missing Postmark fields to getFirmsByUserId method
- Added edit button to FirmsManagement page for easy access to firm configuration

### Search Functionality and Crew Snapshots (July 2025)
- Fixed comprehensive search functionality in ProjectsWrapper.tsx (the actual component used, not Projects.tsx)
- Added search by unique customer ID (installationPersonUniqueId field)
- Fixed search by crew number to use crew.uniqueNumber from crews table instead of empty project.teamNumber
- Search now works for: installation person names, client names, crew unique numbers, and customer unique IDs
- Implemented automatic crew snapshot creation when projects are created with assigned crews
- Added createProjectCrewSnapshot call to POST /api/projects route with proper error handling
- Crew snapshots now automatically preserve complete crew and member information at project assignment time
- Added crew snapshot history entries with crewSnapshotId references for tracking
- Removed unnecessary "Update" button from Invoices page per user request
- Fixed TypeScript errors in ProjectsWrapper.tsx by correcting form default values

### Enhanced Project Creation History (July 24, 2025)
- Fixed project creation workflow to include complete crew assignment information in history
- When creating project with assigned crew, history now shows: "Бригада '[Name]' назначена (участники: [Member Names])"
- Added clickable crew assignment entries in project history that display crew snapshots
- Retroactively fixed Project #38 history by adding missing crew assignment entry with proper snapshot reference
- Project creation now automatically generates descriptive history entries showing actual crew member names
- Consistent history format between project creation and crew changes for better tracking

### Fixed Historical Crew Snapshot Preservation (July 24, 2025)
- CRITICAL FIX: Removed automatic crew snapshot updates when brigade composition changes
- Historical crew snapshots now remain PERMANENTLY unchanged when crew members are added/deleted/modified
- This preserves the exact crew composition that worked on each project at the time of assignment
- Ensures historical accuracy - you can always see who specifically worked on a project regardless of future crew changes
- Removed updateCrewSnapshotsForProjects function and related automatic update mechanisms
- Crew snapshots are created ONLY when crew is initially assigned to project, never updated afterwards
- This maintains the "snapshot" concept - capturing crew state at a specific moment in time

### Enhanced Crew Statistics Interface with Full Admin Access (July 24, 2025)
- Redesigned crew statistics page to display all crews with project counts on single page
- Added tooltip explanations for statistics like "доля просроченных" (overdue percentage) and "средний срок" (average duration)
- Implemented clickable project navigation from crew statistics to individual project details
- Created new API endpoint `/api/crews/stats/summary` for aggregated crew statistics display
- FIXED admin access control: Administrators now have full unrestricted access to all crew information
- Simplified access logic for admin role across all crew-related endpoints:
  - `/api/crews/stats/summary` - shows all crews without access restrictions for admins
  - `/api/crews/:id/stats` - provides unrestricted crew statistics access for admins
  - `/api/crews/:id/projects` - allows full crew project access for administrators
- Enhanced UX with comprehensive crew overview, explanatory tooltips, and seamless navigation

### Crew Photo Upload System Implementation (July 25, 2025)
- Implemented comprehensive "Фотоссылка бригады" (Crew Photo Link) system for secure field photo uploads
- Added crew_upload_token and crew_upload_token_expires fields to projects schema
- Created CrewUpload.tsx frontend component with drag-and-drop interface for file uploads
- Implemented secure token-based access system with 30-day expiration
- Added API endpoints for token validation, email verification, and file upload processing
- Integrated email validation against crew_members table for access control
- Added automatic token generation when crew is assigned to project
- Enhanced Google Calendar event descriptions to include photo upload links
- Security features: HTTPS-only, rate limiting, file type/size validation (JPEG/PNG ≤ 10MB, max 20 files)
- Automatic project history logging for all photo uploads with user attribution
- Files stored in uploads directory with UUID naming for security
- Express-fileupload middleware configured for robust file handling
- Complete integration with existing project workflow and authentication system

### Crew Composition History Tracking System (July 25, 2025)
- Implemented comprehensive crew composition history tracking with crew_history database table
- Added automatic logging of crew member additions and removals with work period details
- Created CrewHistory.tsx React component for displaying chronological member changes timeline
- Added API endpoints: GET/POST /api/crews/:crewId/history for history management
- Integrated history logging into existing crew member add/remove operations
- History entries include change types (crew_created, member_added, member_removed), member names, specializations, and work periods
- Added getCrewMemberById method to storage.ts for proper member data retrieval before deletion
- UI component shows expandable history with icons, badges, and detailed change descriptions
- Automatic user attribution for all history entries with timestamps
- Enhanced crew management interface with integrated history display showing member work periods and change tracking

### Crew Management Interface Improvements (July 25, 2025)
- Fixed critical crew member deletion issue by adding proper cache invalidation with queryClient.invalidateQueries
- Moved crew history component from settings panel to main crew descriptions as expandable interface
- Added Calendar icon and "История" button to each crew card for easy access to composition history
- Enhanced crew card layout with properly spaced action buttons and integrated history display
- Implemented expandedHistory state management to track which crew's history is currently visible
- Fixed React Query cache updates for both member additions and deletions to ensure immediate UI refresh
- Crew history now appears directly within crew cards when "История" button is clicked
- Simplified CrewHistory component styling for better integration with main crew interface
- All crew member operations (add/delete) now properly update both member lists and history displays

### Complete Mobile UI Adaptation (July 25, 2025)
- Successfully completed mobile adaptation of Users/Admin page with card-based responsive design
- Replaced desktop table layout with responsive card format for mobile devices (screen width < 768px)
- Added automatic device detection with useEffect and resize event listeners for seamless user experience
- Implemented beautiful gradient empty state for users page with "Пользователи не найдены" message and call-to-action
- Enhanced user cards display comprehensive user information: profile image, name, email, role badges, firm assignments, and creation dates
- Optimized dialog forms for mobile with responsive grid layouts (single column on mobile, two columns on desktop)
- Added vertical button stacking for form actions on mobile devices for better touch interaction
- Fixed critical TypeScript compilation errors related to Firm type annotations in user.firms.map() function
- Maintained desktop table view for larger screens while providing optimal mobile experience
- Added gradient icons and improved spacing across all page elements for consistent mobile-friendly design
- Platform now 100% mobile-responsive across all major modules: Home dashboard, Clients, Invoices, Calendar, Users/Admin, Crews, Projects

### Invoices Page Restoration and Enhancement (July 25, 2025)
- Restored original table layout for invoices page on all screen sizes (removed mobile card adaptation per user request)
- Added clickable invoice icon (Receipt) navigation that redirects to corresponding project detail page
- Integrated wouter useLocation hook for seamless project navigation from invoice records
- Maintained all existing functionality: payment marking, synchronization, PDF viewing
- Enhanced table structure with proper project information display and status badges
- Improved user experience with clear visual feedback for clickable invoice elements