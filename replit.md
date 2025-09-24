# CrewStay MVP - Construction Worker Housing Management

## Overview

CrewStay is a construction worker housing management system that facilitates seamless communication and coordination between construction companies and hotels for worker accommodation. The MVP focuses on core functionality without payment processing, providing real-time updates and streamlined worker assignment workflows.

The application serves two primary user types: Construction Company Admins who manage worker accommodations and Hotel Partner Admins who handle room assignments and occupancy management.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript using Vite as the build tool
- **UI Library**: Shadcn/ui components built on Radix UI primitives with Tailwind CSS styling
- **State Management**: TanStack Query for server state management and caching
- **Routing**: Wouter for lightweight client-side routing
- **Forms**: React Hook Form with Zod validation for type-safe form handling
- **Real-time Communication**: WebSocket integration for live updates between construction companies and hotels

### Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Language**: TypeScript with ES modules
- **Authentication**: Passport.js with local strategy using session-based authentication
- **Session Management**: Express sessions with PostgreSQL session store
- **Real-time Features**: WebSocket Server for live notifications and updates
- **API Design**: RESTful API endpoints with consistent error handling and logging middleware

### Data Storage Solutions
- **Database**: PostgreSQL with Neon serverless hosting
- **ORM**: Drizzle ORM for type-safe database operations
- **Schema Management**: Drizzle Kit for migrations and schema updates
- **Validation**: Drizzle-Zod integration for runtime type validation

### Authentication and Authorization
- **Strategy**: Session-based authentication using Passport.js Local Strategy
- **Password Security**: Scrypt-based password hashing with salt
- **Session Storage**: PostgreSQL-backed session store using connect-pg-simple
- **Route Protection**: Middleware-based route protection with user type validation
- **User Types**: Role-based access control for "construction" and "hotel" user types

### Real-time Communication
- **WebSocket Implementation**: Native WebSocket server with user authentication
- **Message Broadcasting**: Type-specific message broadcasting to construction companies and hotels
- **Event Types**: New worker requests, room assignments, worker discontinuation, and extension requests
- **Connection Management**: Automatic reconnection and error handling on the client side

### Database Schema Design
- **Users Table**: Stores company information with user type enumeration
- **Workers Table**: Contains worker details with unique ID generation (CWS-[COMPANY]-[NUMBER])
- **Accommodation Requests Table**: Manages the request/approval workflow between companies and hotels
- **Extensions Table**: Handles stay duration extension requests and approvals
- **Enums**: Type-safe status management using PostgreSQL enums for worker status, request status, and extension status

### Key Features Implementation
- **Worker Management**: CRUD operations with automatic ID generation and status tracking
- **Room Assignment**: Hotel-side interface for accepting/rejecting requests and assigning rooms
- **Extension Workflow**: Request and approval system for extending worker stays
- **CSV Export**: Server-side CSV generation for worker data export
- **Statistics Dashboard**: Aggregated data views for both construction companies and hotels

## External Dependencies

- **Database Hosting**: Neon serverless PostgreSQL for scalable database hosting
- **UI Components**: Radix UI for accessible, unstyled component primitives
- **Styling**: Tailwind CSS for utility-first styling approach
- **Validation**: Zod for runtime type validation and schema definition
- **Date Handling**: date-fns for date manipulation and formatting
- **Icons**: Lucide React for consistent iconography
- **Development Tools**: Replit-specific plugins for development environment integration