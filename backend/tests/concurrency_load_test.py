#!/usr/bin/env python3

from __future__ import annotations

import os
import sys
import threading
import time
from dataclasses import dataclass
from typing import Any

import requests

API_URL = os.environ.get(
    "API_URL", "https://event-seat-booking-api.onrender.com"
).rstrip("/")

# ANSI colors for readable terminal output
R = "\033[0m"; BOLD = "\033[1m"; DIM = "\033[2m"
GREEN = "\033[32m"; RED = "\033[31m"; YELLOW = "\033[33m"; BLUE = "\033[34m"


def hdr(title: str) -> None:
    print(f"\n{BOLD}{BLUE}{'=' * 70}{R}")
    print(f"{BOLD}{BLUE}  {title}{R}")
    print(f"{BOLD}{BLUE}{'=' * 70}{R}")


def ok(text: str) -> None:
    print(f"  {GREEN}PASS{R}  {text}")


def bad(text: str) -> None:
    print(f"  {RED}FAIL{R}  {text}")


def info(text: str) -> None:
    print(f"  {DIM}{text}{R}")


# ---------- HTTP helpers ----------

def create_event(rows: int, cols: int, name: str) -> int:
    r = requests.post(
        f"{API_URL}/events",
        json={"name": name, "event_date": "2027-01-01", "rows": rows, "cols": cols},
        timeout=30,
    )
    r.raise_for_status()
    return r.json()["id"]


def get_seats(event_id: int) -> list[dict]:
    r = requests.get(f"{API_URL}/events/{event_id}", timeout=30)
    r.raise_for_status()
    return r.json()["seats"]


def get_summary(event_id: int) -> dict:
    r = requests.get(f"{API_URL}/admin/events/{event_id}/summary", timeout=30)
    r.raise_for_status()
    return r.json()


# ---------- Booking + parallel runner ----------

@dataclass
class BookingResult:
    user: str
    seat_ids: list[int]
    status: int
    body: Any
    elapsed_ms: float


def book(user: str, event_id: int, seat_ids: list[int]) -> BookingResult:
    payload = {
        "event_id": event_id,
        "seat_ids": seat_ids,
        "booker_name": user,
        "booker_email": f"{user.lower()}@test.com",
    }
    t0 = time.perf_counter()
    r = requests.post(f"{API_URL}/bookings", json=payload, timeout=30)
    elapsed = (time.perf_counter() - t0) * 1000
    try:
        body = r.json()
    except Exception:
        body = r.text
    return BookingResult(user, seat_ids, r.status_code, body, elapsed)


def run_parallel(bookings: list[tuple[str, int, list[int]]]) -> list[BookingResult]:
    """Fire all bookings truly in parallel using a Barrier."""
    n = len(bookings)
    barrier = threading.Barrier(n)
    results: list[BookingResult | None] = [None] * n

    def worker(i: int, user: str, event_id: int, seat_ids: list[int]) -> None:
        barrier.wait()  # all threads pause here, released simultaneously
        results[i] = book(user, event_id, seat_ids)

    threads = []
    for i, (user, event_id, seat_ids) in enumerate(bookings):
        t = threading.Thread(target=worker, args=(i, user, event_id, seat_ids))
        threads.append(t)
        t.start()
    for t in threads:
        t.join()

    return [r for r in results if r is not None]


def format_body(body: Any) -> str:
    if isinstance(body, dict) and "detail" in body:
        return body["detail"][:60]
    if isinstance(body, list):
        return f"booked {len(body)} seat(s)"
    return str(body)[:60]


# ---------- Tests ----------

def test_1_same_seat(n: int = 10) -> bool:
    hdr(f"TEST 1: {n} users compete for the SAME seat")
    info(f"Expectation: exactly 1 x 201, {n - 1} x 409")

    event_id = create_event(3, 4, f"LoadTest-1-N{n}")
    seats = get_seats(event_id)
    target = seats[len(seats) // 2]
    info(f"Event #{event_id}, target: seat {target['row_label']}{target['col_number']} (id={target['id']})")

    bookings = [(f"User{i+1:02d}", event_id, [target["id"]]) for i in range(n)]

    t0 = time.perf_counter()
    results = run_parallel(bookings)
    wall = (time.perf_counter() - t0) * 1000

    print()
    for r in sorted(results, key=lambda r: (r.status != 201, r.elapsed_ms)):
        color = GREEN if r.status == 201 else RED
        print(f"    [{r.user}] {color}{r.status}{R}  {r.elapsed_ms:>6.0f}ms  {format_body(r.body)}")
    print()

    successes = sum(1 for r in results if r.status == 201)
    conflicts = sum(1 for r in results if r.status == 409)
    others = [r for r in results if r.status not in (201, 409)]

    passed = (successes == 1 and conflicts == n - 1 and not others)
    (ok if passed else bad)(
        f"{successes} x 201, {conflicts} x 409, {len(others)} x other  (wall time: {wall:.0f}ms)"
    )

    summary = get_summary(event_id)
    db_ok = summary["booked_seats"] == 1
    (ok if db_ok else bad)(f"DB state: booked_seats = {summary['booked_seats']} (expected 1)")

    return passed and db_ok


def test_2_overlapping_multiseat() -> bool:
    hdr("TEST 2: Overlapping multi-seat bookings (atomic all-or-nothing)")
    info("Alice books [id1, id2, id3], Bob books [id3, id4, id5] simultaneously")
    info("Expectation: exactly one gets 201 (3 seats), other gets 409 (0 seats). No partial state.")

    event_id = create_event(3, 4, "LoadTest-2-Overlap")
    seats = get_seats(event_id)
    a = [seats[0]["id"], seats[1]["id"], seats[2]["id"]]  # ids 1,2,3
    b = [seats[2]["id"], seats[3]["id"], seats[4]["id"]]  # ids 3,4,5 (overlap on seats[2])
    info(f"Event #{event_id}, Alice seats: {a}, Bob seats: {b}, overlap: {seats[2]['row_label']}{seats[2]['col_number']}")

    results = run_parallel([("Alice", event_id, a), ("Bob", event_id, b)])

    print()
    for r in results:
        color = GREEN if r.status == 201 else RED
        print(f"    [{r.user}] {color}{r.status}{R}  {r.elapsed_ms:>6.0f}ms  {format_body(r.body)}")
    print()

    successes = [r for r in results if r.status == 201]
    conflicts = [r for r in results if r.status == 409]

    request_split_ok = len(successes) == 1 and len(conflicts) == 1
    (ok if request_split_ok else bad)(
        f"{len(successes)} success + {len(conflicts)} conflict (expected 1+1)"
    )

    summary = get_summary(event_id)
    # Whoever won should have booked exactly 3 seats. No partials.
    db_ok = summary["booked_seats"] == 3
    (ok if db_ok else bad)(
        f"DB state: booked_seats = {summary['booked_seats']} (expected 3 — no partial booking)"
    )

    return request_split_ok and db_ok


def test_3_independent_seats(n: int = 10) -> bool:
    hdr(f"TEST 3: {n} users, {n} DIFFERENT seats (independence)")
    info(f"Expectation: all {n} bookings succeed. No false conflicts.")

    # Grid big enough
    rows = 4
    cols = max(3, (n + rows - 1) // rows)
    event_id = create_event(rows, cols, f"LoadTest-3-N{n}")
    seats = get_seats(event_id)
    picks = seats[:n]

    bookings = [
        (f"User{i+1:02d}", event_id, [picks[i]["id"]])
        for i in range(n)
    ]

    t0 = time.perf_counter()
    results = run_parallel(bookings)
    wall = (time.perf_counter() - t0) * 1000

    print()
    successes = sum(1 for r in results if r.status == 201)
    conflicts = sum(1 for r in results if r.status == 409)
    others = [r for r in results if r.status not in (201, 409)]

    if conflicts or others:
        for r in results:
            if r.status != 201:
                print(f"    [{r.user}] {RED}{r.status}{R}  {r.elapsed_ms:>6.0f}ms  {format_body(r.body)}")

    passed = successes == n and not conflicts and not others
    (ok if passed else bad)(
        f"{successes} x 201, {conflicts} x 409, {len(others)} x other  (wall time: {wall:.0f}ms)"
    )
    info(f"Throughput: {n / (wall / 1000):.1f} bookings/sec")

    summary = get_summary(event_id)
    db_ok = summary["booked_seats"] == n
    (ok if db_ok else bad)(f"DB state: booked_seats = {summary['booked_seats']} (expected {n})")

    return passed and db_ok


# ---------- Main ----------

def warmup() -> None:
    print(f"{BOLD}Target: {API_URL}{R}")
    print(f"{DIM}Warming up server (Render free tier may cold-start)...{R}", end=" ", flush=True)
    t0 = time.perf_counter()
    r = requests.get(f"{API_URL}/health", timeout=90)
    elapsed = time.perf_counter() - t0
    r.raise_for_status()
    print(f"OK ({elapsed:.1f}s)")


def main() -> int:
    warmup()
    passed = []
    passed.append(("Test 1 — same seat contention", test_1_same_seat(n=10)))
    passed.append(("Test 2 — overlapping multi-seat atomicity", test_2_overlapping_multiseat()))
    passed.append(("Test 3 — independent seats throughput", test_3_independent_seats(n=10)))

    hdr("SUMMARY")
    for name, p in passed:
        (ok if p else bad)(name)

    all_passed = all(p for _, p in passed)
    print()
    print(f"{BOLD}{GREEN if all_passed else RED}{'ALL TESTS PASSED' if all_passed else 'SOME TESTS FAILED'}{R}\n")
    return 0 if all_passed else 1


if __name__ == "__main__":
    sys.exit(main())