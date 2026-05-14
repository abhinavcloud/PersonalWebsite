---
title: Online Ticketing System on AWS
subtitle: Read‑heavy browsing with Redis caching, consistent seat locking, and surge control using per‑event waiting rooms
date: 2026-05-14
readingTime: 12 min read
tags: [system-design, aws, api-gateway, lambda, aurora, redis, cognito, websockets, consistency]
icon: 🎟️
---

# Designing a Disciplined Online Ticketing Platform

---

## A Production‑Ready Architecture for Read‑Heavy Discovery and Consistent Booking

---

### Executive Summary

This document presents the high‑level design, API model, and AWS architecture for an online ticketing system optimized for:

- read‑heavy browsing (100:1 read/write)
- highly available discovery flows (locations → events → performers → venues)
- strongly consistent booking (no double booking)
- sudden traffic surges on popular events (controlled admission via a waiting room)

The platform separates **browsing** and **booking** concerns explicitly:

- browsing is served from a Redis cache backed by Aurora for durability
- booking uses a Redis lock store (per‑seat TTL locks) backed by Aurora as the system of record
- queue admission is used as **capacity control**, not as correctness enforcement

---

### Problem Statement

Online ticketing systems are dominated by discovery traffic. Users browse across locations, venues, performers, and events far more often than they attempt to book. At the same time, booking must be correct under concurrency—no seat can be double‑sold—especially when a popular event triggers a sudden surge.

In most naïve designs, the same data path is used for both browsing and booking. This creates a set of predictable failure modes:

- browsing performance degrades under booking spikes
- seat maps become a hotspot and amplify load
- concurrent reservations cause race conditions and double booking if locking is weak
- large traffic surges overwhelm seat selection and reservation flows

The desired end state is a platform where:

- browsing remains highly available and fast at all times
- booking remains strongly consistent under concurrency
- surge events are handled by controlling admission to seat maps
- multi‑seat booking is **all‑or‑nothing** (no partial booking)
- lock release and failure paths are explicit and idempotent

This system addresses these issues by:

- caching high‑read entities (events/venues/performers/locations) in Redis
- introducing a per‑event, per‑category waiting room (queue) to throttle seat‑map traffic
- performing seat correctness checks against **Aurora + Redis locks** before reservations
- acquiring per‑seat locks atomically with a fixed TTL
- confirming bookings by writing the authoritative state to Aurora
- releasing locks deterministically on cancel/failure, while TTL acts as a safety net

The result is a design that stays responsive for browsing, remains correct for booking, and behaves predictably during viral surges.

---

### Architectural Goals

From the outset, the following constraints were enforced:

- **Read path optimized**: event discovery must tolerate extreme read volume (100:1 read/write)
- **Strong booking correctness**: no double booking under concurrency
- **High availability for browsing**: discovery must remain available even during booking spikes
- **Surge control**: popular event spikes must not overwhelm seat selection and reservation APIs
- **No partial booking**: multi‑seat reservations must succeed only if all requested seats can be locked
- **Explicit failure paths**: reservation/payment failure must release locks via an API, and also by TTL
- **JWT security**: all APIs secured via Cognito JWT; user identity derived server‑side from claims
- **Clear responsibility boundaries**: each service owns a single responsibility (browse, queue, seat availability, reservation, confirmation, notification)

---

### High‑Level Architecture

This architecture is intentionally split into two planes:

1) **Discovery Plane (read‑heavy)**
- Locations, events, performers, venues are served primarily from Redis
- Aurora remains the system of record, but Redis absorbs the read load

2) **Booking Plane (correctness‑heavy)**
- Seat availability is derived from:
  - **Aurora seat status** (authoritative: AVAILABLE/BOOKED)
  - **Redis seat locks** (temporary: LOCKED with TTL)
- Reservation acquires per‑seat locks atomically, stores a reservation record, and returns a short‑lived reservation window
- Confirmation writes BOOKED state transactions to Aurora and emits notifications

![High level design showing Discovery (Browse Service + Redis cache), Surge Admission (Queue Service), Correctness (Seat Availability + Reservation + Redis seat locks), and System of Record (Aurora).](/images/High_Level_Design.jpg)

---

### Design Strategy: Separate Performance from Correctness

The design strategy focuses on keeping the high‑volume discovery surfaces independent from the correctness‑critical booking surfaces.

The system follows these principles:

- **Redis cache for discovery** prevents Aurora from being overwhelmed by repeat reads
- **Queue admission** reduces seat map and booking contention for viral events
- **Redis locks** act as the concurrency control boundary for seat reservations
- **Aurora** remains the system of record for seat state and booking records
- **Idempotent cancellation** ensures retries do not cause inconsistent lock release
- **TTL lock expiry** provides a bounded recovery path for abandoned reservations

This separation ensures browsing remains responsive even when booking traffic spikes, while booking correctness remains anchored to explicit locking and authoritative writes.

---

### AWS Architecture

The AWS deployment uses managed services to enforce clear boundaries:

- **CloudFront**: single public entry point for static web + API routing
- **S3 (private)**: static web hosting, protected via Origin Access Control (OAC)
- **Cognito**: federated login + username/password; JWT issuance for API access
- **API Gateway**: routing, authorization, throttling/rate limiting, WebSocket where applicable
- **Lambda services**:
  - Browse Service
  - Queue Service
  - Seat Availability Service
  - Reservation Service
  - Confirmation Service
  - Notification Service
- **ElastiCache (Redis)**:
  - Redis Cache (events/venues/performers/locations)
  - Redis Lock (per‑seat locks + lock counts)
  - Queue state (waiting/allowed + active user counters)
- **Aurora (RDS)**: authoritative storage for seats, tickets, events, categories, performers, venues, locations

![AWS architecture showing CloudFront + private S3 + Cognito + API Gateway + Lambda microservices, backed by Redis (cache + locks) and Aurora as the system of record.](/images/AWS_Architecture.jpg)

---

### API Model (Surface Area)

All APIs are secured using Cognito JWT. Clients send:

`Authorization: Bearer <token>`

User identity is derived server‑side from JWT claims (e.g., `sub`), so request payloads do not carry `userId`.

#### Discovery APIs (Read‑Heavy)
- `GET v1/location`
- `GET v1/performers?location=<locationId>`
- `GET v1/venue?location=<locationId>`
- `GET v1/events?location=<locationId>&performer=<performerId>&venue=<venueId>`
- `GET v1/event/{eventId}`

These calls are served primarily from **Redis Cache** with Aurora as fallback / refresh source.

#### Queue Admission (Surge Control)
- `POST /queue/enter` → returns `WAITING | ALLOWED | SOLD_OUT` plus a short‑lived `bookingToken`

This is a **waiting room** per event and category. The purpose is controlled admission to seat map traffic.

#### Seat Map / Seat Availability
- `GET /v1/events/{eventId}/seats?category_id=<categoryId>`

Returns seat map status computed as:

- `AVAILABLE` if seat is AVAILABLE in Aurora **and** not locked in Redis
- `LOCKED` if lock exists in Redis (includes lock expiry time)
- `BOOKED` if seat is BOOKED in Aurora

Where WebSocket is used, live updates can be pushed to clients to avoid polling storms.

#### Reservation and Booking
- `POST /reserveTicket` → locks seats atomically, returns `reservationId`, `expiresAt`, pricing and next actions
- `POST /v1/reservations/{reservationId}/cancel` → releases locks deterministically (idempotent)
- `POST /v1/confirmTicket` → confirms booking after successful payment (payment itself is out of scope)

#### Notifications
- Email/SMS notification on success/failure via SES/SNS through a Notification Service.

---

### Queue Strategy: Admission Control, Not Correctness

The waiting room is scoped **per eventId (and categoryId)** to isolate viral events and avoid cross‑event contention.

The queue stores:

- `userId`
- `eventId`
- `queuePosition`
- `status` (`WAITING` or `ALLOWED`)
- `countActiveUsers` (or active user counters)
- TTL (short‑lived session, e.g., 10 minutes as indicated in design)

A key design choice is that the queue does not guarantee correctness. It only throttles how many users are allowed to fetch seat maps and attempt reservation.

#### Capacity and Release Formula (as designed)

The queue releases users based on approximate capacity:

- `dbAvailableCount = count(Seat.seatStatus == AVAILABLE)` in Aurora  
- `redisLockedCount = lockCount:{seatId}` (redis lock occupancy aggregated per event/category)
- `availableSeatCount = max(0, dbAvailableCount - redisLockedCount)`

Admission caps:

- `availableUsers = maxUser - activeUserCount`
- `releasableUsers = min(availableUsers, availableSeatCount * oversubscriptionFactor)`

Notes:
- oversubscriptionFactor starts at **2** (as indicated in the design) and is tunable.
- this intentionally oversubscribes admitted users to keep throughput high even when many users abandon checkout.

To avoid poll storms, the system can notify the client that the status is now `ALLOWED` via WebSocket.

---

### Seat Availability Strategy: Aurora + Redis Lock Overlay

Seat correctness requires acknowledging a race condition: users can request seat maps concurrently and attempt reservation at the same time.

Correctness is enforced by:

- **Aurora seat status**: `AVAILABLE | BOOKED` (authoritative durable state)
- **Redis seat locks**: temporary overlay that prevents concurrent reservation

A seat is considered available if:

- Aurora: `Seat.seatStatus == AVAILABLE`
- Redis Lock: no existing lock for that seat key

In practice:

- seat map responses can include `LOCKED` as a computed state (Redis‑derived)
- the reservation service re‑checks both stores before locking to prevent stale seat map decisions

---

### Reservation Strategy: Atomic Multi‑Seat Locking (No Partial Booking)

Partial booking is explicitly disallowed. Therefore, multi‑seat reservation must be **all‑or‑nothing**:

- if any requested seat cannot be locked, the reservation fails
- locks must be acquired atomically as a set

A disciplined approach is:

1) validate requested seats:
   - Aurora status must be AVAILABLE
   - no existing Redis lock for those seatIds

2) acquire locks for all requested seats:
   - keys: `locks:{seatId}`
   - TTL: 10 minutes (as per design)
   - acquisition must fail fast if any lock cannot be obtained

3) create a reservation record and return:
   - `reservationId`
   - `expiresAt` (aligned to lock TTL)
   - pricing (unitPrice × quantity)
   - explicit next actions (canProceedToPayment, canCancel)

#### Lock Semantics (Redis)
Example key patterns aligned to your design:

- `locks:{seatId} -> {reservationId, expiresAt}`
- `lockCount:{eventId}:{categoryId} -> integer` (optional aggregated counter to compute capacity cheaply)

The TTL is the primary time boundary for reservation windows.

---

### Failure / Cancellation Path: Deterministic Lock Release + TTL Safety Net

Two things can go wrong after reservation:

- reservation fails during lock acquisition (fast fail)
- payment fails (payment itself is out of scope, but state transitions are in scope)

The design includes a dedicated cancel endpoint:

`POST /v1/reservations/{reservationId}/cancel`

This endpoint:
- validates idempotency (`idempotencyKey`)
- releases all locks associated with the reservation
- returns released seatIds and timestamp

TTL still exists as a safety net for abandoned sessions, but the explicit cancel path provides faster seat recycling and better user experience.

---

### Confirmation Strategy: Authoritative Writes to Aurora

Confirmation happens after payment success (payment integration is out of scope, but confirmation handling is in scope).

The Confirmation Service:

- validates reservation is still active (not expired / not cancelled)
- writes `Seat.seatStatus = BOOKED` in Aurora (transactional update)
- creates a Ticket/Booking record (e.g., BookingId / Ticket entity)
- emits success notification events

This implies the durable source of truth is Aurora, meaning:

- Redis locks prevent race conditions pre‑commit
- Aurora transaction finalizes the outcome post‑payment

---

### Data Model (As Represented in the Design)

Aurora stores the canonical entities:

- **Location**
- **Venue** (linked to Location)
- **Performer**
- **Event** (linked to Venue + Performer(s) + Location)
- **Category** (price, unit)
- **Seat** (seatId, eventId, categoryId, seatStatus [AVAILABLE/BOOKED], dateTime)
- **Ticket/Booking** (reservationId, eventId, seatId(s), amount, unit, userId, venueId, seatStatus)
- **Reservation** (implied by API; stores reservationId, seats, expiresAt, status)

Redis holds:
- discovery cache (events/venues/performers/locations)
- queue state
- seat locks + lock counts

---

### Security Model

- Cognito JWT auth for all APIs
- API Gateway authorization + routing + throttling / rate limiting
- Private S3 static hosting protected via CloudFront OAC
- Server‑side derivation of user identity from JWT claims (no userId in payload)
- Minimal trust boundaries: clients do not decide correctness; servers enforce lock + write rules

---

### Operational Observations

- **Per‑event waiting room** isolates viral surges and reduces global contention.
- **Admission is approximate** by design; correctness is always enforced again at reservation.
- **Seat map can be informational**; final authority is the reservation lock step.
- **Atomic multi‑seat locks** enforce the “no partial booking” constraint cleanly.
- **Explicit cancel endpoint** improves seat recycling vs relying purely on TTL expiry.
- **Read/write separation** keeps browsing available even during booking spikes.

---

### Conclusion

This system demonstrates a disciplined ticketing architecture where read‑heavy discovery and correctness‑heavy booking are separated intentionally.

Browsing remains fast and highly available by serving the majority of discovery traffic from Redis. Booking correctness is enforced through an explicit concurrency boundary: per‑seat Redis locks with TTL and authoritative transactional writes to Aurora during confirmation. Sudden surges are handled by a per‑event waiting room that throttles admission to seat selection traffic without pretending to guarantee correctness.

The resulting platform remains responsive under heavy browsing load, correct under booking concurrency, and controllable during viral demand spikes—while staying aligned to the core constraints: **no double booking** and **no partial booking**.

---
