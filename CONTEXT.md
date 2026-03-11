# OrderFlow POS — Project Context Document

## Project Overview
Full-stack POS (Point of Sale) system for restaurants, built as a college project.
Real-time communication between waiters, kitchen, and manager via WebSocket.
Three user profiles with distinct permissions and interfaces.

---

## Tech Stack

### Frontend
- React + TypeScript + Vite
- Tailwind CSS v4 + Shadcn/ui + Lucide React
- Recharts (charts/analytics)
- Sonner (toast notifications)
- react-hook-form + Zod (form validation)
- react-dnd (drag and drop)
- motion/react (animations)
- socket.io-client (WebSocket)
- Axios — service layer at `services/api.ts`
- State: Context API + React Hooks

### Backend
- Python + Flask
- Flask-SQLAlchemy (ORM) + Flask-Migrate (Alembic migrations)
- Flask-JWT-Extended (stateless JWT auth with roles in payload)
- Flask-SocketIO (WebSocket) + Eventlet (worker for Render)
- Flask-CORS + Flask-Bcrypt + Marshmallow
- Stripe SDK (test mode — credit/debit only)
- Pytest + python-dotenv
- Blueprints: auth, menu, tables, orders, payments, admin
- WebSocket rooms: `kitchen`, `waiter_{id}`, `admin`

### Database
- PostgreSQL
- Dev: Docker Compose with postgres:15
- Prod: Neon (serverless, free tier)
- pool_pre_ping=True + pool_recycle required for Neon

### Deploy
- Frontend: Vercel
- Backend: Render (Gunicorn + Eventlet)
- Database: Neon

---

## API Contract

### Standard Response Envelope
All API endpoints return JSON in the following format:

**Success:**
```json
{ "data": { ... }, "message": "Action completed successfully" }
```
**Error:**
```json
{ "error": "Human-readable error description", "code": "ERROR_CODE" }
```
- HTTP status codes are always meaningful (200, 201, 400, 401, 403, 404, 409, 500)
- `data` is always an object or array, never null on success
- `code` is a machine-readable constant (e.g. `TABLE_NOT_AVAILABLE`, `ORDER_CANNOT_BE_CANCELLED`)

### JWT Authentication Strategy
- **Access token:** expires in **8 hours** (covers a full work shift — session ends automatically when the shift ends)
- **No refresh token** — login is required at the start of each shift; this is intentional for auditability and future work-hour tracking compatibility
- **Token payload:** `user_id`, `display_name`, `role`
- **Expiry behavior:** when the token expires, the frontend redirects to the login screen immediately; no silent renewal
- **Storage:** access token in memory (React Context) only — no cookies, no localStorage

---

## User Profiles & Permissions

| Feature | Waiter | Kitchen | Manager |
|---|---|---|---|
| Tables tab (serve tables) | ✅ | ❌ | ✅ (identical to waiter) |
| Kitchen tab (view) | ✅ read-only | ✅ full control | ✅ full control |
| History tab (own) | ✅ | ❌ | ✅ (all waiters) |
| Dashboard / Analytics | ❌ | ❌ | ✅ |
| Settings (tables, menu, users) | ❌ | ❌ | ✅ |
| Cancel order: Pending | ✅ | ✅ | ✅ |
| Cancel order: Preparing | ❌ | ✅ | ✅ |
| Cancel order: Done/Delivered | ❌ | ❌ | ✅ |

### Tabs per profile
- **Waiter:** Tables (default), Kitchen (read-only), History
- **Kitchen:** Kitchen only (single screen, full control)
- **Manager:** Dashboard, Tables, Kitchen (full control), Settings, History

---

## Entities & Fields

### User
- `id`, `full_name`, `display_name`, `username`, `password_hash`
- `role`: waiter | kitchen | manager
- `is_active` (soft delete)
- `created_at`, `updated_at`

### Table
- `id`, `number`, `seats`
- `status`: available | reserved | occupied
- `is_active` (soft delete)
- `waiter_id` (FK → User, nullable)
- `service_started_at` (nullable — set when status → occupied)
- Rules: editable only if status = available; waiter_id set on Start Service

### MenuCategory
- `id`, `name`, `is_active`

### MenuItem
- `id`, `name`, `description`, `price`, `image_url` (external URL — manager pastes a direct image link; no file upload supported)
- `category_id` (FK → MenuCategory)
- `is_available`, `is_active`
- Searchable by: name, description, category

### Bill (table's account/tab)
- `id`, `table_id` (FK), `waiter_id` (FK)
- `status`: open | closed | cancelled
- `split_method`: full | custom_amount | split_equally | by_items
- `payment_method`: credit | debit | cash
- `tip_percent`, `tip_amount`, `subtotal`, `total`
- `opened_at`, `closed_at`

### Order (sent to kitchen — a Bill can have multiple Orders)
- `id`, `bill_id` (FK)
- `sequence_number` (integer — sequential within a Bill: 1, 2, 3... displayed as "Order #2")
- `status`: pending | preparing | done | delivered | cancelled
- `sent_to_kitchen_at`, `done_at`, `delivered_at`
- `cancelled_at`, `cancelled_by` (FK → User, nullable)

### OrderItem
- `id`, `order_id` (FK), `menu_item_id` (FK)
- `quantity`, `unit_price` (PRICE SNAPSHOT — immutable after creation)
- `special_instructions`

### Payment
- `id`, `bill_id` (FK)
- `method`: credit | debit | cash
- `amount`, `tip_amount`
- `stripe_payment_intent_id` (nullable — only for credit/debit)
- `created_at`

### TableEvent (immutable audit log)
- `id`, `table_id` (FK), `bill_id` (FK nullable), `order_id` (FK nullable)
- `event_type` (string enum: table_opened, service_started, item_added, item_removed, order_sent, order_cancelled, order_preparing, order_done, order_delivered, payment_confirmed, table_closed, reservation_made, reservation_released, table_released)
- `description`, `actor_id` (FK → User), `created_at`

---

## ID Strategy & UI Display Conventions

All entities use **integer auto-increment IDs** internally. IDs are never exposed as raw database values in the UI.

| Entity | Internal ID | What is displayed in the UI |
|---|---|---|
| User | ✅ (internal only) | `display_name` |
| Table | ✅ (internal only) | `number` (e.g. "Table 5") |
| MenuCategory | ✅ (internal only) | `name` |
| MenuItem | ✅ (internal only) | `name` + `price` |
| Bill | ✅ shown as reference | `id` displayed as "Bill #103" in History |
| Order | ✅ shown as reference | `sequence_number` displayed as "Order #2" (scoped to the Bill) |
| OrderItem | ✅ (internal only) | item name + quantity |
| Payment | ✅ (internal only) | method + amount |
| TableEvent | ✅ (internal only) | timestamp + description |

---

## State Machines

### Table Status
```
Available → [Start Service]        → Occupied   (creates Bill, sets waiter_id, service_started_at)
Available → [Reserve Table]        → Reserved   (sets waiter_id)
Reserved  → [Start Service]        → Occupied   (creates Bill, sets service_started_at)
Reserved  → [Release Reservation]  → Available  (clears waiter_id)
Occupied  → [Release Table]        → Available  (clears waiter_id, service_started_at — no payment)
Occupied  → [Close Table+Payment]  → Available  (closes Bill, processes payment)
           ↑ BLOCKED if any order is Pending, Preparing, or Done
```

### Table UI Popup Behavior by Status
- **Available click:** Start Service | Reserve Table | Cancel
- **Reserved click:** Start Service | Release Reservation | Cancel
- **Occupied click:** Continue Service | Release Table | Cancel
  - "Continue Service" → goes to Browse Menu / current bill (does NOT create a new Bill)

### Order Status
```
Pending   → [Kitchen/Manager: Start Preparing]  → Preparing
Pending   → [Cancel: waiter/kitchen/manager]    → Cancelled
Preparing → [Kitchen/Manager: Mark Done]        → Done
Preparing → [Cancel: kitchen/manager]           → Cancelled
Done      → [Waiter/Manager: Mark Delivered]    → Delivered
Done      → [Cancel: manager only]              → Cancelled
Delivered → [Cancel: manager only]              → Cancelled
```

### Bill Status
```
Open → Closed     (payment confirmed via Close Table+Payment)
Open → Cancelled  (released without payment — total shown as $0, history preserved)
```

---

## WebSocket Events

| Event | Emitted by | Target Room | Notification |
|---|---|---|---|
| `order:created` | Waiter (sends order) | `kitchen` | Visual + Sound + Vibration |
| `order:done` | Kitchen (Mark Done) | `waiter_{id}` | Visual + Sound + Vibration |
| `order:status_changed` | Kitchen | `kitchen`, `admin` | Silent re-render only |
| `table:status_changed` | Waiter/Manager | `admin` | Silent re-render only |

---

## Payment Flow (Close Table)
1. Display full bill breakdown (all orders, items, quantities, values)
2. Select **Tip:** 0% | 10% | 15% | Custom % → total recalculates live
3. Select **Split Method:**
   - `full` — single full payment
   - `custom_amount` — specific amount per person
   - `split_equally` — divide equally by N people
   - `by_items` — assign specific items to each person
4. Select **Payment Method:** Credit | Debit (→ Stripe) | Cash (local, no Stripe)
5. Confirm Payment → Bill closes → Table returns to Available

### By Items — Detailed Flow
- When "By Items" is selected, a section appears below with a default **Person 1** entry showing all unassigned items from the bill
- The waiter assigns items (and quantities) to Person 1 — e.g. 1 Coke + 1 Pasta from a bill with 2 Cokes + 2 Pastas
- Remaining unassigned items are shown as **pending** and must be assigned before payment can be confirmed
- The waiter can add **Person 2, Person 3, etc.** and assign remaining items to each
- **All items must be fully assigned** before the Confirm Payment button becomes active
- Each person's subtotal is calculated independently from their assigned items + proportional tip share
- Each person can pay with a different payment method (credit/debit/cash)

---

## Business Rules — MUST

- **MUST** use soft delete everywhere: User, Table, MenuCategory, MenuItem are never hard-deleted
- **MUST** enforce table editable only when status = available (number and seats)
- **MUST** block Close Table if any order has status pending, preparing, or done
- **MUST** snapshot unit_price in OrderItem at creation time — never recalculate from MenuItem.price
- **MUST** start table timer at service_started_at (Start Service) and freeze at close
- **MUST** start order timer at sent_to_kitchen_at and freeze order Done timer at done_at
- **MUST** require double confirmation in kitchen for Start Preparing, Mark Done, Cancel Order
- **MUST** preserve full history in cancelled Bills (show $0 total but keep all detail)
- **MUST** write to TableEvent log for every state change on tables, orders, and bills
- **MUST** monkey-patch Eventlet at the very top of wsgi.py before any other import
- **MUST** configure pool_pre_ping=True and pool_recycle for Neon connection pool
- **MUST** write all code, comments, variable names, and documentation in English
- **MUST** use JWT role in payload for authorization (roles: waiter, kitchen, manager)
- **MUST** use Stripe only for credit/debit; cash is processed locally without Stripe
- **MUST** resolve the active Bill for an occupied table by querying `bills WHERE table_id = X AND status = 'open' LIMIT 1` — this is how "Continue Service" finds the current bill
- **MUST** calculate `sequence_number` at Order creation as `SELECT COALESCE(MAX(sequence_number), 0) + 1 FROM orders WHERE bill_id = X` within the same transaction

## Business Rules — MUST NOT

- **MUST NOT** hard-delete any record from the database
- **MUST NOT** allow editing a table that is reserved or occupied
- **MUST NOT** allow Close Table if active orders exist (pending/preparing/done)
- **MUST NOT** allow waiter to cancel an order that is in Preparing or later status
- **MUST NOT** allow kitchen to cancel an order in Done or Delivered status
- **MUST NOT** mutate unit_price in OrderItem after creation (price changes in MenuItem must not affect existing orders)
- **MUST NOT** send visual+sound+vibration notifications for intermediate order status changes (only order:created and order:done trigger full notifications)
- **MUST NOT** write any code, comment, or documentation in Portuguese

---

## Analytics (Manager Dashboard)

### KPIs
- Total Sales, Average Ticket, Bills/Tables Closed, Total Tips
- Occupancy Rate, Table Turnover, Average Service Time
- Order status breakdown (pie/bar)
- Tables Overview (live status grid)

### Filters
- Waiter: All or specific waiter
- Period: Today | Last 7 Days | Last 30 Days | Current Month | Custom

---

## History Tab

### Waiter (own history) / Manager (all or filtered by waiter)

**Summary cards:** Total Sales, Tables Served, Total Tips, Avg Service Time, Avg Ticket

**Filters:** Period + Bill status (Open / Closed / Cancelled)

**Bill detail (expandable):**
- Table · Waiter · Opened At · Closed At · Total Duration
- Orders list → each order: sequence number, items (qty, unit price, subtotal), sent_to_kitchen_at, delivered_at
- Split method · Payment method · Subtotal · Tip (% and amount) · Total

**Event Log (per Bill):** Full chronological timeline of all actions on that table/bill

---

## Settings (Manager Only)

### Table Setup
- View tables as cards (number, seats, status)
- Filter: All / Active / Inactive
- Actions: Create, Edit (number + seats — only if available), Toggle active, Soft-delete

### Menu Management
- CRUD MenuCategories (name, active/inactive)
- CRUD MenuItems (name, category, price, description, image)
- Toggle: Available / Unavailable (affects waiter ordering screen)
- Toggle: Active / Inactive (soft delete)

### User Management
- View all users
- Create: full_name, display_name, username, password, confirm_password, role
- Edit profile info and role
- Toggle active / inactive
- Soft-delete

---

## Project Language Rule
The ENTIRE project — source code, variable names, function names, comments, commit messages, API responses, database field names, documentation files, and README — MUST be written in English.
The ONLY exception is the planning conversation in VS Code Copilot Chat.

---

## Code Quality & Best Practices

### General Principles
- **Single Responsibility:** every function, class, and module does one thing and does it well
- **DRY (Don't Repeat Yourself):** extract repeated logic into a shared utility or helper — never copy-paste code
- **KISS (Keep It Simple):** prefer the simplest solution that correctly solves the problem; avoid over-engineering
- **Fail fast:** validate inputs at system boundaries (API endpoints, form submissions) and return clear errors immediately
- **Consistency over cleverness:** predictable, readable code is always preferred over clever or terse code

### Backend (Python / Flask)
- Use **type hints** on all function signatures
- Keep route handlers thin — business logic belongs in a service layer or helper, not in the Blueprint route directly
- Use **constants or Enum classes** for all status strings (e.g. `OrderStatus.PENDING`) — never hardcode raw strings like `"pending"` across the codebase
- All database writes that involve multiple operations **must use a transaction** (`db.session` commit/rollback pattern)
- Return **meaningful HTTP status codes** — never return 200 with an error message in the body
- **Never expose internal exception messages** to the client — log internally, return a sanitized error response
- Use **Flask-Migrate** for every schema change — never alter the database manually
- Environment-specific config (DB URL, secret keys, Stripe keys) must come from `.env` via `python-dotenv` — never hardcoded

### Frontend (React / TypeScript)
- Use **TypeScript strictly** — no `any` types; define interfaces/types for all API responses and state shapes
- Keep components **small and focused** — if a component exceeds ~150 lines, consider splitting it
- Use **custom hooks** to encapsulate reusable logic (e.g. `useTableStatus`, `useCurrentBill`)
- All API calls go through `services/api.ts` — never call Axios directly from a component
- Use **Zod schemas** for all form validation — keep schemas co-located with their forms
- Handle **loading, error, and empty states** explicitly in every data-fetching component
- Use `const` by default; use `let` only when reassignment is necessary

### Database
- Every table must have `created_at` (and `updated_at` where applicable) with server-side defaults
- Use **database-level constraints** for NOT NULL, UNIQUE, and FK relationships — don't rely solely on application-level validation
- Avoid N+1 queries — use `joinedload` or `selectinload` with SQLAlchemy when fetching related data
- Index foreign keys and any column used in frequent `WHERE` filters (e.g. `table_id`, `bill_id`, `status`)

### Git & Version Control
- Commit messages must be clear and imperative: `Add order cancellation endpoint` not `fix stuff`
- One logical change per commit — avoid mixing unrelated changes in a single commit
- Never commit `.env` files, secrets, or credentials
- Branch naming: `feature/`, `fix/`, `chore/` prefixes (e.g. `feature/payment-flow`)

### Security
- Passwords must always be hashed with **Flask-Bcrypt** — never stored in plain text
- JWT secret key must be a strong random value stored in `.env` — never hardcoded
- All protected endpoints must verify JWT **and** check the user's role before executing any logic
- Sanitize and validate all user inputs before processing — reject unexpected fields
- Stripe operations must use **test mode keys** only in development; never expose secret keys to the frontend

---

## AI Assistant Rules (GitHub Copilot / LLM Guidelines)

These rules apply to every AI-assisted code generation session in this project.

### Developer Context
The developer is a **student**. Every AI-assisted session must account for this:
- **MUST** explain what needs to be installed before writing code that requires it
- **MUST** provide exact terminal commands with a brief explanation of what each command does
- **MUST** flag any manual steps required (e.g. creating accounts, setting up `.env` files, configuring third-party services)
- **MUST** indicate the correct order of execution when sequence matters
- **MUST** tell the developer how to verify that a step worked correctly
- **MUST** explain non-obvious concepts briefly when they appear for the first time

### Scope & Behavior — MUST
- **MUST** read and follow this document before generating any code
- **MUST** implement only what is explicitly requested in each prompt
- **MUST** ask for clarification if the request is ambiguous before generating code
- **MUST** respect the existing architecture: Blueprints, models, schemas, and folder structure already defined
- **MUST** follow the business rules and state machines defined in this document exactly
- **MUST** keep generated code consistent with the established tech stack

### Scope & Behavior — MUST NOT
- **MUST NOT** add features, fields, endpoints, or UI elements that were not requested
- **MUST NOT** refactor, rename, or restructure existing code unless explicitly asked
- **MUST NOT** add error handling, fallbacks, or validation beyond what is necessary for the current task
- **MUST NOT** create new files unless they are strictly required by the task
- **MUST NOT** add docstrings, comments, or type annotations to code that was not changed
- **MUST NOT** introduce new libraries or dependencies without explicit approval
- **MUST NOT** make assumptions about future requirements — implement only what exists in this document
- **MUST NOT** deviate from the data models, status enums, or permission rules defined here
- **MUST NOT** suggest architectural changes mid-task — raise concerns separately, not through code
- **MUST NOT** generate placeholder or "example" logic that is not real, functional implementation
