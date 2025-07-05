# Product Requirements Document: LinkCullen

## 1. Overview

LinkCullen is a secure file-sharing and link management application. It is an automated process to track share links to files in SharePoint or OneDrive. The application is built as a three-tier MVC application, utilizing a database, message queue, and frontend UI that leverages a backend API to render user controls.

## 2. Target Audience

The primary users of this application are:
*   **Employees** to show which files are currently shared with colleagues and external partners.
*   **IT and Cybersecurity Administrators** who need to audit file-sharing activities across the organization.

## 3. Key Features

### 3.1. Link harvesting from SharePoint and OneDrive
*   A non-interactive process monitors a queue that lists Microsoft Graph audit events
    *   **AnonymousLinkCreated**
    *   **SecureLinkCreated**
    *   **SharingInvitationCreated**
    *   **SharingSet**
*   Links can be configured with different sharing permissions:
    *   **View**
    *   **Edit**
    *   **Block Download**
*   Links can be shared with internal or external persons
    *   **Specific People:** Only specified users can access the link.
    *   **Anyone:** Anyone with the link can access the file.

### 3.2. Role-Based Access Control (RBAC)
*   **User Role:** Can view, unshare, or extend the expiration of their own shared links.
*   **Admin Role:** Can view and manage all shared links in the system.
*   Authentication is handled through Azure Active Directory using SAML or OAuth 2.0. No local user database is used.

### 3.3. Link Management
*   Users can view a list of their shared links.
*   Users can stop sharing a link.
*   Users can update the sharing settings (permissions and expiration date) of their links.

### 3.4. Expiration Notifications
*   A scheduled job runs daily to identify links that are about to expire.
*   Email notifications are sent to link owners, reminding them to renew or let their links expire.

### 3.5. Auditing and Logging
*   All major actions (link creation, updates, deletion, access attempts) are logged for auditing purposes.
*   This provides a clear trail of who shared what, with whom, and when.

### 3.6. State Synchronization
*   In addition to real-time event tracking, the application will perform a full synchronization of all shared files from SharePoint and OneDrive.
*   This process gathers all shared files and their current attributes, ensuring the application's database is consistent with the source.
*   The synchronization can be manually triggered by an administrator from the application's UI.

## 4. Functional Requirements

### 4.1 Link Processing
*   **Azure Functions:** Application batch processing runs as an Azure function triggered by cron from the application.
*   **Expiration Dates:**
    * All links that are considered internally shared expire at a configurable time limit, defined by the application Admin using a configuration page
    * All links that are considered externally shared expire at a configurable time limit, defined by the application Admin using a configuration page
    * A user can extend an expiration date for an additional amount of time defined by the application Admin using a configuration page
*   **Link Tracking:** Use a SHA256 hash to track the unique ID for a link, so that if a user changes the location of the underlying file, the application can still track the sharing of the link.

## 5. Non-Functional Requirements

### 5.1. Security
*   **Input Validation:** All user input, especially on the API, must be rigorously validated to prevent common vulnerabilities like Cross-Site Scripting (XSS) and NoSQL injection.
*   **Principle of Least Privilege:** The permissions for each role will be reviewed to ensure they have only the minimum necessary access to perform their functions.
*   **Dependency Management:** The project will use Dependabot to regularly scan and update dependencies to patch security vulnerabilities.
*   **Secrets Management:** All secrets (API keys, database credentials, etc.) will be stored securely in Azure Key Vault and not hardcoded in the application or committed to version control.

### 5.2. Maintainability
*   **Code Style and Linting:** The project will use a consistent code style enforced by ESLint.
*   **Testing:** The project will aim for a test coverage of at least 90% for all new features and bug fixes.
*   **API Documentation:** The API will be documented using the OpenAPI (Swagger) standard, and the documentation will be kept up-to-date.

### 5.3. Efficiency
*   **Database Indexing:** Database queries will be analyzed, and appropriate indexes will be created to ensure efficient data retrieval.
*   **Caching:** A caching layer (e.g., with Redis) will be implemented for frequently accessed data that doesn't change often to reduce database load and improve API response times.
*   **Asynchronous Operations:** Long-running tasks, like sending emails, will be handled asynchronously to avoid blocking the main application thread.

### 5.4. Usability
*   **User Experience (UX):** The application will provide clear and concise error messages and an intuitive and easy-to-navigate user interface.
*   **Accessibility:** The application will be accessible to users with disabilities, following the Web Content Accessibility Guidelines (WCAG).

## 6. Technical Stack

*   **Frontend:** Next.js, React, Tailwind CSS
*   **Backend:** Next.js API Routes using REST interfaces
*   **Database:** MongoDB with Prisma as the ORM for storing tracked links, RBAC permissions tied to roles, and audit logs.
*   **Authentication:** Azure AD with MSAL and NextAuth.js
*   **Log Processing**: Azure Event Grid reads the sharing events and triggers an Azure function to run the application.
*   **Queue** Azure AD Storage Queue and Next.js
*   **Scheduled Jobs:** `node-cron`
*   **Email:** `nodemailer`

## 7. API Endpoints

The application exposes a RESTful API for managing links:
*   `GET /api/v1/links`: Get a paginated list of tracked links (with RBAC).
*   `POST /api/v1/links`: Create a new tracked link.
*   `GET /api/v1/links/{id}`: Get a specific tracked link by its ID.
*   `PUT /api/v1/links/{id}`: Update a link's settings.
*   `DELETE /api/v1/links/{id}`: Delete a tracked link.
*   `POST /api/v1/sync`: Trigger a manual synchronization of all shared links (Admin role only).
