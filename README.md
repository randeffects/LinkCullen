# CullenLinks

A secure link sharing and management application built with Next.js, TypeScript, and Azure services.

## Architecture & Technology Stack

- **Framework**: Next.js (TypeScript)
- **Database**: Azure Cosmos DB with Prisma ORM
- **Authentication**: OAuth 2.0 via Microsoft Authentication Library (MSAL)
- **API**: Versioned REST API (/api/v1) with auto-generated OpenAPI 3.0 documentation
- **Monitoring**: Structured JSON logging for Datadog
- **Testing**: Jest & React Testing Library for unit, integration, and component tests

## Security & Compliance Features

- **Vulnerability Scan Readiness**: The application is developed to pass SCA, SAST, and DAST scans:
  - **SCA (Software Composition Analysis)**: Dependencies are carefully selected and continuously monitored
  - **SAST (Static Application Security Testing)**: Secure coding practices with rigorous input validation and output encoding
  - **DAST (Dynamic Application Security Testing)**: Implements strict Content Security Policy (CSP) headers, anti-CSRF tokens, and other security-related HTTP headers

- **Encryption**: Data is secured with TLS 1.3 in transit and AES-256 at rest (via Azure Cosmos DB)
- **Role-Based Access Control (RBAC)**: The API strictly enforces data access rules, ensuring users see only their data, while admins have global read/write access
- **Audit Logging**: All significant operations are recorded in an immutable, append-only AuditLogs collection in Cosmos DB for full traceability

## Core Features

- **Data Models**: Users, SharedLinks, Policies, and AuditLogs in Cosmos DB
- **Link Lifecycle Management**: List, track, remove, and extend links via the secure, role-based REST API
- **Automated Notifications**: Scheduled jobs send email reminders for expiring links based on configurable policies

## Project Structure

```
src/
├── app/                    # Next.js app directory
│   ├── api/                # API routes
│   │   └── v1/             # API version 1
│   │       ├── links/      # Link management endpoints
│   │       ├── init/       # Service initialization endpoint
│   │       └── openapi.json # API documentation
│   └── page.tsx            # Main application page
├── components/             # React components
│   └── auth/               # Authentication components
├── config/                 # Configuration files
│   └── authConfig.ts       # MSAL authentication configuration
├── jobs/                   # Background jobs
│   └── expiringLinksNotifier.ts # Notification job for expiring links
├── lib/                    # Utility libraries
│   └── logger.ts           # Structured JSON logger for Datadog
├── middleware.ts           # Next.js middleware for security headers
├── prisma/                 # Prisma ORM
│   └── schema.prisma       # Database schema
└── services/               # Business logic services
    └── linkService.ts      # Link management service
```

## API Documentation

The API is documented using OpenAPI 3.0 and is available at `/api/v1/openapi.json`. The API follows RESTful principles and includes the following endpoints:

- **GET /api/v1/links**: Get all links with pagination and RBAC
- **POST /api/v1/links**: Create a new shared link
- **GET /api/v1/links/:id**: Get a specific shared link by ID
- **PUT /api/v1/links/:id**: Update a specific shared link
- **DELETE /api/v1/links/:id**: Delete a specific shared link
- **GET /api/v1/policies**: Get all sharing policies
- **GET /api/v1/audit-logs**: Get audit logs (admin only)

## Getting Started

### Prerequisites

- Node.js 18.x or later
- Azure Cosmos DB account
- Azure AD application registration

### Environment Variables

Create a `.env.local` file in the root directory with the following variables:

```
# Azure AD Authentication
NEXT_PUBLIC_AZURE_AD_CLIENT_ID=your_client_id
NEXT_PUBLIC_AZURE_AD_TENANT_ID=your_tenant_id

# Database
DATABASE_URL=your_cosmos_db_connection_string

# Email Configuration
EMAIL_HOST=smtp.example.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=your_email_user
EMAIL_PASSWORD=your_email_password
EMAIL_FROM=noreply@cullenlinks.com

# Application Settings
NEXT_PUBLIC_BASE_URL=http://localhost:3000
EXPIRATION_NOTIFICATION_DAYS=7
EXPIRATION_CRON_SCHEDULE="0 9 * * *"
```

### Installation

```bash
# Install dependencies
npm install

# Generate Prisma client
npx prisma generate

# Run development server
npm run dev
```

### Building for Production

```bash
# Build the application
npm run build

# Start the production server
npm start
```

## Testing

```bash
# Run tests
npm test

# Run tests with coverage
npm test -- --coverage
```

## Security Best Practices

- Always validate user input on both client and server sides
- Use the RBAC system to ensure users can only access their own data
- Keep dependencies updated to avoid security vulnerabilities
- Use the audit logging system to track all significant operations
- Follow the principle of least privilege when assigning roles

## License

This project is proprietary and confidential.