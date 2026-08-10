# Event Seat Booking System

Full-stack seat booking application built for the NeuBitAt full-stack internship assignment. Admin configures events and their seat layout; users view a seat map and book seats. The core focus is **concurrency-safe bookings** — no double-booking, and atomic multi-seat bookings — enforced at the database layer.

## Live demo

- **Frontend (Vercel):** https://event-seat-booking-nu.vercel.app
- **Backend API (Render):** https://event-seat-booking-api.onrender.com
- **API docs (Swagger UI):** https://event-seat-booking-api.onrender.com/docs

> The Render free tier sleeps after inactivity — the first request after a break may take 30–60 seconds to wake up.

## Tech stack

| Layer     | Choice                                                  |
|-----------|---------------------------------------------------------|
| Frontend  | Next.js 16 (App Router, TypeScript, Tailwind) on Vercel |
| Backend   | FastAPI + SQLAlchemy 2.0 on Render                      |
| Database  | MySQL 8 on Railway                                      |

## Concurrency — the core requirement

The assignment weights concurrency correctness the highest. The design is deliberately simple: **the database is the source of truth**, not application code.

### The single guarantee

The `bookings` table has a `UNIQUE` constraint on `seat_id`:

```sql
CREATE TABLE bookings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  seat_id INT NOT NULL,
  booker_name VARCHAR(120) NOT NULL,
  booker_email VARCHAR(200) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY (seat_id),
  FOREIGN KEY (seat_id) REFERENCES seats(id) ON DELETE RESTRICT
);
```

No matter how many booking requests for the same seat arrive simultaneously, MySQL InnoDB guarantees that only one `INSERT` succeeds. Every other request fails with an `IntegrityError`, which the API converts into a clean `409 Conflict` response.

There is **no application-level "is this seat available?" check** before the insert — that pattern is a race condition. Instead, the code attempts the insert and lets the database enforce correctness.

### Atomic multi-seat bookings

When a user selects multiple seats, all `INSERT`s happen inside a single transaction:

```python
# backend/app/routers/bookings.py (simplified)
bookings = [Booking(seat_id=sid, ...) for sid in payload.seat_ids]
db.add_all(bookings)
try:
    db.commit()
except IntegrityError:
    db.rollback()
    raise HTTPException(409, "One or more seats have just been booked.")
```

If any one seat's `INSERT` violates the unique constraint, the **entire transaction rolls back**. Partial bookings are impossible — either all seats in the request are booked, or none are.

### Why not `SELECT ... FOR UPDATE`?

Row-level locking gives the same guarantee, but adds complexity (lock ordering, deadlock risk) for no benefit here. A unique constraint + transaction is simpler, deadlock-free, and easier to reason about.

### Proof

Two test harnesses ship with the repo:

**Shell test** — `backend/tests/concurrency_test.sh` fires two parallel `POST /bookings` requests via `curl` background jobs. Sample run:

```
Firing two concurrent bookings for seat_id=15 ...
[B] HTTP 409  {"detail":"One or more selected seats have just been booked..."}
[A] HTTP 201  [{"id":20,"seat_id":15,"booker_name":"Alice",...}]
--- Final state (should show exactly one booking) ---
booked_seats=1, bookings=[{...single booking...}]
```

Exactly one request wins; the other is rejected cleanly.


**Python load test** — `backend/tests/concurrency_load_test.py` uses `threading.Barrier` to release requests truly simultaneously and asserts three invariants against the live backend:

1. **10 users, same seat** → exactly 1 × 201, 9 × 409.
2. **Overlapping multi-seat** (Alice `[a,b,c]` vs Bob `[c,d,e]`) → one wins all, the other gets 409 with zero partial writes.
3. **10 users, 10 different seats** → all succeed (no false conflicts).

Run it:

```bash
python3 backend/tests/concurrency_load_test.py                     # against live prod
API_URL=http://127.0.0.1:8000 python3 backend/tests/concurrency_load_test.py  # local
```

## Schema design decisions

Three tables — `events`, `seats`, `bookings` — with foreign keys and constraints.

- `seats` are **pre-created** when an event is created (`rows × cols` rows inserted in the same transaction as the event). Every seat has a stable ID, and the admin can block individual seats without nullable columns.
- **Layout is rows × columns** (not named sections). Simpler for a CSS grid to render, easier for the admin to configure with two numbers, and sufficient for the assignment.
- `seats.is_blocked` is a boolean flag on the seat itself — admin blocking is a property of the seat, not a fake "booking".
- `ON DELETE CASCADE` on `seats.event_id`: deleting an event removes its seats.
- `ON DELETE RESTRICT` on `bookings.seat_id`: a seat with a booking cannot be silently deleted — protects historical booking data.
- `UNIQUE (event_id, row_label, col_number)` on `seats` prevents duplicate seat positions within an event.

## API surface

| Method | Endpoint                              | Purpose                             |
|--------|---------------------------------------|-------------------------------------|
| GET    | `/health`                             | Liveness check                      |
| POST   | `/events`                             | Create event + generate seats       |
| GET    | `/events/{event_id}`                  | Fetch event + seat map              |
| POST   | `/bookings`                           | Submit a booking (concurrency-safe) |
| GET    | `/admin/events/{event_id}/summary`    | Admin dashboard summary             |
| PATCH  | `/admin/seats/{seat_id}/block`        | Block or unblock a seat             |

Full interactive docs at `/docs` on the backend.

Meaningful HTTP status codes throughout — `201` on create, `409` on double-booking or blocked seat, `422` on invalid input (Pydantic), `404` on missing resources.

## Local development

### Prerequisites

- Python 3.12+
- Node.js 20+ and npm
- MySQL 8

### 1. Database

```bash
mysql -u root -p
```

```sql
CREATE DATABASE seat_booking;
CREATE USER 'seatapp'@'localhost' IDENTIFIED BY 'seatapp_dev_pw';
GRANT ALL PRIVILEGES ON seat_booking.* TO 'seatapp'@'localhost';
FLUSH PRIVILEGES;
```

### 2. Backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
python create_tables.py
uvicorn app.main:app --reload
```

Backend runs at http://127.0.0.1:8000 — Swagger UI at `/docs`.

### 3. Frontend

```bash
cd frontend
npm install
echo "NEXT_PUBLIC_API_URL=http://127.0.0.1:8000" > .env.local
npm run dev
```

Frontend runs at http://localhost:3000.

### 4. Concurrency test

With the backend running and at least one event created:

```bash
./backend/tests/concurrency_test.sh
```

## Project structure

```
event-seat-booking/
├── backend/
│   ├── app/
│   │   ├── main.py            # FastAPI app + CORS + lifespan
│   │   ├── database.py        # SQLAlchemy engine + session dependency
│   │   ├── models.py          # Event, Seat, Booking with UNIQUE(seat_id)
│   │   ├── schemas.py         # Pydantic request/response shapes
│   │   ├── config.py          # env config via pydantic-settings
│   │   └── routers/
│   │       ├── events.py      # create event, get seat map
│   │       ├── bookings.py    # concurrency-critical booking logic
│   │       └── admin.py       # dashboard + seat block/unblock
│   ├── tests/
│   │   └── concurrency_test.sh
│   ├── create_tables.py       # dev helper to create/reset tables
│   ├── requirements.txt
│   ├── Procfile               # Render start command
│   └── runtime.txt            # Python version for Render
└── frontend/
    └── src/
        ├── app/
        │   ├── page.tsx                       # home (event ID → booking)
        │   ├── events/[id]/page.tsx           # user booking page
        │   ├── admin/page.tsx                 # create event + open dashboard
        │   └── admin/events/[id]/page.tsx     # admin dashboard
        ├── components/
        │   ├── SeatButton.tsx
        │   └── SeatGrid.tsx
        └── lib/
            └── api.ts                         # typed API client
```

## Known limitations and trade-offs

- **No admin authentication.** The assignment explicitly said none was required; the `/admin` route is open. In production this would sit behind a login or a proxy.
- **Refetch on window focus, no live push.** The assignment allowed polling or refetch-on-focus; WebSockets were out of scope. If two users are looking at the same seat map, one has to refocus the tab to see the other's booking.
- **Render free tier cold starts.** The backend sleeps after ~15 minutes of inactivity; the first request wakes it in 30–60 seconds. Not a code issue — a hosting trade-off.
- **`is_blocked` pre-check is not race-safe.** Admin blocking and user booking are assumed to not race (admin configures the event before the doors open). The core double-booking guarantee is still enforced by the unique constraint regardless.
- **No booking cancellation, no pricing tiers, no email.** These were listed as optional bonuses and intentionally skipped to keep the submission focused on the required correctness.

## What I would add next

- Admin authentication + role-based access
- Alembic migrations instead of `create_all()`
- A load test in addition to the parallel-request script — 100 concurrent requests for one seat, assert exactly 1 success and 99 conflicts
- Rate limiting on `POST /bookings` per email/IP