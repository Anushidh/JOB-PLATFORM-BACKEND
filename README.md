# Job Platform Backend

A comprehensive TypeScript/Express backend for a job portal platform with separate Employer and Employee flows, real-time messaging, AI features, subscription billing, and more.

## Tech Stack

- **Runtime:** Node.js + TypeScript
- **Framework:** Express.js
- **Database:** MongoDB (Mongoose)
- **Cache/Sessions:** Redis (ioredis)
- **Real-time:** Socket.IO
- **Payments:** Razorpay
- **File Storage:** Cloudinary
- **Email:** Nodemailer (SMTP)
- **AI:** Groq (Llama 3.3 70B) via OpenAI-compatible SDK
- **PDF Parsing:** pdf-parse v2
- **Auth:** JWT (access + refresh tokens)
- **Validation:** Zod
- **Error Tracking:** Sentry

## Getting Started

### Prerequisites

- Node.js 18+
- MongoDB (local or Atlas)
- Redis
- Cloudinary account
- Razorpay account
- OpenAI API key
- SMTP credentials (Gmail, SendGrid, etc.)

### Installation

```bash
git clone <repo-url>
cd job-platform-backend
npm install
cp .env.example .env  # Edit with your credentials
```

### Seed Admin

```bash
npm run seed:admin
```

### Run

```bash
npm run dev       # Development (hot reload)
npm run build     # Compile TypeScript
npm start         # Production
```

### Environment Variables

See `.env.example` for the full list. Critical ones:

| Variable | Description |
|----------|-------------|
| `MONGODB_URI` | MongoDB connection string |
| `REDIS_HOST` | Redis host |
| `JWT_ACCESS_SECRET` | Secret for access tokens |
| `JWT_REFRESH_SECRET` | Secret for refresh tokens |
| `CLOUDINARY_*` | Cloudinary credentials |
| `SMTP_*` | Email server config |
| `RAZORPAY_*` | Payment gateway keys |
| `GROQ_API_KEY` | Groq API key (AI features) |
| `SENTRY_DSN` | Sentry error tracking (optional) |
| `COMPANY_STATE` | Your registered state (for GST) |
| `COMPANY_GSTIN` | Your GSTIN |

---

## Architecture

```
src/
├── config/          # Database, Redis, Cloudinary, Passport, Sentry, env
├── controllers/     # Request handlers
├── jobs/            # Cron job definitions
├── middleware/      # Auth, rate limiting, validation, cache, subscription checks
├── models/          # Mongoose schemas
├── routes/          # Express route definitions
├── services/        # Business logic
├── socket/          # Socket.IO initialization and events
├── scripts/         # Seed scripts
├── types/           # TypeScript interfaces and enums
├── utils/           # ApiError, ApiResponse, constants
└── validators/      # Zod schemas (separated from routes)
```

---

## API Endpoints

Base URL: `http://localhost:5000/api/v1`

### Authentication

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/auth/employee/register` | Step 1: Submit data + send OTP |
| POST | `/auth/employee/verify-otp` | Step 2: Verify OTP + create account |
| POST | `/auth/employer/register` | Step 1: Submit data + send OTP |
| POST | `/auth/employer/verify-otp` | Step 2: Verify OTP + create account |
| POST | `/auth/employee/login` | Employee login |
| POST | `/auth/employer/login` | Employer login |
| POST | `/auth/admin/login` | Admin login |
| POST | `/auth/refresh-token` | Refresh access token |
| POST | `/auth/logout` | Logout (blacklists token) |
| GET | `/auth/me` | Get current user |
| POST | `/auth/forgot-password` | Send password reset OTP |
| POST | `/auth/reset-password` | Reset password with OTP |

### OAuth

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/auth/oauth/google?role=employee\|employer` | Initiate Google OAuth |
| GET | `/auth/oauth/google/callback` | Google callback |
| GET | `/auth/oauth/linkedin?role=employee\|employer` | Initiate LinkedIn OAuth |
| GET | `/auth/oauth/linkedin/callback` | LinkedIn callback |

### Users

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/users/profile` | Get own profile |
| GET | `/users/profile-completion` | Get profile completion % |
| PUT | `/users/profile/employee` | Update employee profile |
| PUT | `/users/profile/employer` | Update employer profile |
| PATCH | `/users/change-password` | Change password |
| PATCH | `/users/resume` | Update resume path |
| GET | `/users/employees/:id/public` | Public employee profile |
| GET | `/users/employers/:id/public` | Public employer profile |
| GET | `/users/employees/search` | Search employees |

### Jobs

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/jobs` | List jobs (with filters, cached) |
| GET | `/jobs/recently-viewed` | Last 10 viewed jobs |
| GET | `/jobs/employer/my-jobs` | Employer's own jobs |
| POST | `/jobs` | Create job (subscription gated) |
| GET | `/jobs/:id` | Get single job (cached) |
| GET | `/jobs/:id/similar` | 5 similar jobs |
| GET | `/jobs/:id/stats` | Quick stats (employer) |
| PUT | `/jobs/:id` | Update job |
| DELETE | `/jobs/:id` | Soft delete job |
| PATCH | `/jobs/:id/status` | Change status |

### Applications

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/applications/jobs/:jobId/apply` | Apply to job (subscription gated) |
| GET | `/applications/my-applications` | My applications |
| PATCH | `/applications/:id/withdraw` | Withdraw application |
| GET | `/applications/jobs/:jobId/applications` | View applicants (employer, priority sorted) |
| PATCH | `/applications/:id/status` | Update status (employer) |
| GET | `/applications/:id` | Get single application |

### Companies

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/companies` | List companies (cached) |
| GET | `/companies/my/company` | Get own company |
| POST | `/companies` | Create company |
| GET | `/companies/:id` | Get company |
| PUT | `/companies/:id` | Update company |
| DELETE | `/companies/:id` | Delete company |

### Company Follows

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/company-follows/:companyId/follow` | Follow company |
| DELETE | `/company-follows/:companyId/follow` | Unfollow |
| GET | `/company-follows/my/following` | My followed companies |
| GET | `/company-follows/:companyId/check` | Check if following |
| GET | `/company-follows/:companyId/followers/count` | Follower count |

### Messages (Premium+)

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/messages` | Send message |
| GET | `/messages/conversations` | List conversations |
| GET | `/messages/conversations/:id` | Get messages |
| GET | `/messages/unread-count` | Unread count |
| DELETE | `/messages/conversations/:id` | Delete conversation |

### Notifications

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/notifications` | List notifications |
| GET | `/notifications/unread-count` | Unread count |
| PATCH | `/notifications/read-all` | Mark all read |
| PATCH | `/notifications/:id/read` | Mark one read |
| DELETE | `/notifications/:id` | Delete |

### Saved Jobs (Tiered)

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/saved-jobs` | List saved jobs |
| POST | `/saved-jobs/:jobId` | Save job (limit checked) |
| DELETE | `/saved-jobs/:jobId` | Unsave |
| GET | `/saved-jobs/:jobId/check` | Check if saved |

### Job Alerts

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/job-alerts` | Create alert (max 5) |
| GET | `/job-alerts` | List my alerts |
| PUT | `/job-alerts/:id` | Update alert |
| DELETE | `/job-alerts/:id` | Delete alert |
| PATCH | `/job-alerts/:id/toggle` | Toggle active/inactive |

### Analytics

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/analytics/jobs/:jobId/view` | Track view (public) |
| POST | `/analytics/jobs/:jobId/click` | Track click (public) |
| GET | `/analytics/jobs/:jobId` | Job analytics (subscription gated) |
| GET | `/analytics/dashboard` | Employer dashboard (subscription gated) |

### Subscriptions

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/subscriptions/plans` | List plans (cached) |
| POST | `/subscriptions/create-order` | Create Razorpay order |
| POST | `/subscriptions/verify-payment` | Verify payment + activate |
| GET | `/subscriptions/my-subscription` | Current subscription |
| POST | `/subscriptions/cancel` | Cancel subscription |
| GET | `/subscriptions/invoice/:id` | Download PDF invoice |
| POST | `/subscriptions/webhook` | Razorpay webhook |

### Profile Views

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/profile-views/count` | View count (all users) |
| GET | `/profile-views/viewers` | Who viewed (Premium+) |

### Uploads

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/uploads/avatar` | Upload avatar (2MB, images) |
| POST | `/uploads/company-logo` | Upload logo (2MB, images) |
| POST | `/uploads/resume` | Upload resume (5MB, PDF/DOC) |
| DELETE | `/uploads/file` | Delete file from Cloudinary |

### AI

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/ai/parse-resume` | Parse PDF resume into structured data |
| POST | `/ai/apply-parsed-resume` | Save parsed data to profile |
| POST | `/ai/generate-cover-letter` | AI cover letter for a job |
| POST | `/ai/generate-job-description` | AI job description (employer) |
| GET | `/ai/match-score/:jobId` | Match score + explanation |
| GET | `/ai/applicant-match/:jobId/:applicantId` | Applicant match (employer) |

### Admin

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/admin/employees` | List employees |
| GET | `/admin/employers` | List employers |
| PATCH | `/admin/users/:role/:id/suspend` | Suspend user |
| PATCH | `/admin/users/:role/:id/reactivate` | Reactivate |
| DELETE | `/admin/users/:role/:id` | Delete (blocked if active jobs) |
| GET | `/admin/jobs/pending` | Moderation queue |
| PATCH | `/admin/jobs/:id/approve` | Approve job |
| PATCH | `/admin/jobs/:id/reject` | Reject job |
| GET | `/admin/stats` | Platform statistics |
| GET | `/admin/revenue` | Revenue dashboard |
| GET | `/admin/revenue/payments` | Payment history |

---

## Real-time (Socket.IO)

Connect to `ws://localhost:5000` with JWT in `auth.token`.

### Events

| Direction | Event | Description |
|-----------|-------|-------------|
| Client → Server | `conversation:join` | Join conversation room |
| Client → Server | `conversation:leave` | Leave room |
| Client → Server | `typing:start` | Typing indicator |
| Client → Server | `typing:stop` | Stop typing |
| Client → Server | `message:read` | Read receipt |
| Server → Client | `message:new` | New message received |
| Server → Client | `notification:new` | New notification |
| Server → Client | `typing:start` | Someone is typing |
| Server → Client | `typing:stop` | Stopped typing |
| Server → Client | `user:online` | User came online |
| Server → Client | `user:offline` | User went offline |

---

## Subscription Plans

| Feature | Free | Basic (₹999/mo) | Premium (₹2,499/mo) | Enterprise (₹9,999/mo) |
|---------|------|-----------------|---------------------|----------------------|
| Job posts | 3 | 10 | 50 | Unlimited |
| Applications/month | 10 | 50 | 200 | Unlimited |
| Saved jobs | 10 | 50 | Unlimited | Unlimited |
| Analytics | ❌ | ✅ | ✅ | ✅ |
| Resume access | ❌ | ✅ | ✅ | ✅ |
| Premium placement | ❌ | ❌ | ✅ | ✅ |
| Messaging | ❌ | ❌ | ✅ | ✅ |
| Profile viewers | Count only | Count only | Full list | Full list |
| Application priority | ❌ | ❌ | ✅ | ✅ |

All prices are GST inclusive (18%). Invoices show CGST+SGST or IGST breakdown based on buyer's state.

---

## Cron Jobs

| Schedule | Job | Description |
|----------|-----|-------------|
| Midnight | Subscription expiry | Marks expired subscriptions, sends notification |
| 1:00 AM | Job expiry | Auto-closes jobs past deadline |
| 8:00 AM | Job alerts | Sends daily/weekly job alert emails |
| 9:00 AM | Expiry warnings | "Subscription expires in 3 days" email |

---

## Key Design Decisions

- **Separate models** for Employee, Employer, and Admin (not a single User model)
- **Registration data stored in Redis** until OTP is verified (never exposed to frontend between steps)
- **Refresh tokens in Redis** with rotation on every refresh
- **Access token blacklisting** on logout/suspend via Redis
- **Soft delete** for users and jobs (audit trail preserved)
- **Rate limiting backed by Redis** (works across multiple instances)
- **Response caching** on public endpoints (5 min TTL)
- **Subscription middleware** gates features at the route level
- **Application priority** — Premium applicants sorted first for employers
- **GST-compliant invoices** with dynamic CGST+SGST vs IGST based on buyer's state

---

## Scripts

```bash
npm run dev          # Development server (tsx watch)
npm run build        # TypeScript compilation
npm start            # Production server
npm run seed:admin   # Create admin account
```

---

## License

ISC
