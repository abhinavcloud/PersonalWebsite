---
title: mytickets.click - Online Ticketing System on AWS
subtitle: Read‑heavy browsing with Redis caching, consistent seat locking, and surge control using per‑event waiting rooms
date: 2026-06-09
readingTime: 15 min read
tags: [system-design, aws, api-gateway, lambda, aurora, redis, cognito, websockets, consistency]
icon: 🎟️
---

# mytickets.click — A Complete Architecture Story of an Online Ticketing Platform on AWS

#### [Visit the website: mytickets.click](https://mytickets.click)

---

## From Read-Heavy Event Discovery to Consistent Seat Booking, Serverless Backend Services, and Terraform-Managed Cloud Infrastructure

---


A detailed solution architecture narrative for **mytickets.click**, covering the complete journey from requirements and design principles to frontend experience, backend service boundaries, cache-based seat coordination, Aurora-backed durable booking, Cognito security, KMS-verified booking tokens, SNS notifications, Terraform infrastructure, cost tradeoffs, risks, and future evolution.

---

### Introduction

**mytickets.click** is a cloud-native online ticketing platform designed to demonstrate how a real event booking system can be built using AWS managed services, serverless compute, cache-based coordination, relational durability, and a static frontend. The system is not positioned as a simple CRUD application. It is designed around the harder problems that appear in real ticketing platforms: read-heavy event discovery, sudden traffic surges, queue-based admission, seat contention, temporary reservations, payment handoff, booking confirmation, and notification publishing.

The application supports a complete booking journey. A user can browse locations and events, authenticate through Cognito, enter an event/category-specific queue, retrieve a seat map, select seats, reserve seats, complete a mock payment flow, confirm the booking, generate tickets, and receive a notification. The flow is intentionally decomposed into separate stages because ticketing correctness cannot be safely handled as a single request. Discovery, admission, reservation, payment, confirmation, and notification each have different consistency, latency, and failure-handling requirements.

From a solution architecture perspective, the project is important because it treats **frontend**, **backend services**, and **Terraform-managed infrastructure** as equally meaningful architecture layers. The frontend is responsible for a clean booking experience and browser-side orchestration. The backend services enforce security, admission, seat locking, payment validation, booking confirmation, and notification publishing. Terraform provisions the cloud foundation, wires the services together, controls IAM and security boundaries, and makes the system repeatable.

---

### The Core Problem

Online ticketing systems are dominated by browsing traffic but judged by booking correctness. In a typical sale event, thousands of users may browse locations, venues, performers, and event details, while only a smaller percentage attempt to purchase tickets. That creates a read-heavy workload profile. At the same time, popular events can create sudden spikes where many users compete for the same category and the same seats.

A naive architecture often uses one database-centric path for both browsing and booking. That design tends to fail in predictable ways. Browse traffic can overload the database. Seat maps become hotspots. Concurrent reservations can produce race conditions. Payment success can become disconnected from booking state. Abandoned seat holds may require operational cleanup. In the worst case, a weak locking design can double-sell seats.

The platform therefore separates the problem into two major concerns. The **discovery plane** is optimized for high-read traffic and can be served from cache. The **booking plane** is optimized for correctness and uses queue admission, short-lived cache locks, and durable database commits. This separation keeps browsing responsive while preserving booking correctness.

---

### Architecture Intent and Design Philosophy

The architecture follows a clear principle:

> Temporary coordination belongs in cache. Durable business truth belongs in the database.

This principle shapes almost every design choice. The database stores durable event, seat, reservation, ticket, and booking state. Cache stores short-lived queue sessions, admission state, reservation metadata, idempotency records, and seat locks. A seat is durably sold only when confirmation succeeds and the booking transaction commits to Aurora PostgreSQL.

The system also follows a strict service-boundary model. Browse services do not perform booking logic. Seat availability does not create locks. Reservation does not finalize tickets. Payment does not inspect seats. Confirmation is the only service that transitions seats to `BOOKED` and creates tickets. This keeps the system understandable and prevents hidden coupling between services.

Another deliberate design choice is that the frontend should remain user-friendly even though the backend uses UUIDs and technical contracts. Users select names such as locations, venues, performers, and events. The frontend internally maps those names to UUIDs required by the APIs. This preserves backend correctness while avoiding a developer-centric user experience.

---

### Original Design References, Diagrams and GitHub Repo Links

The original design documents included several important architecture and requirement links. These links are preserved below exactly as references within the project documentation.

#### High level design showing Discovery, Surge Admission, Correctness, and System of Record

![High level design showing Discovery, Surge Admission, Correctness, and System of Record](/images/High_Level_Design.jpg)

---

#### AWS architecture showing CloudFront, private S3, Cognito, API Gateway, Lambda services, Redis, and Aurora

![AWS architecture showing CloudFront, private S3, Cognito, API Gateway, Lambda services, Redis, and Aurora](/images/AWS_Architecture.jpg)

---

#### GitHub Repository link

[Visit the GitHub Repository Here](https://github.com/abhinavcloud/Online_Ticketing_System)

---

These links capture the original architecture intent: read-heavy discovery, surge control through waiting rooms, consistent seat locking, and Aurora as the durable system of record.

---

### End-to-End User Journey

The complete user journey is structured as a staged lifecycle rather than a single booking operation.

A user first lands on the public website and browses available locations and events. Public browsing is intentionally allowed without login because event discovery should be low-friction. When the user decides to book, authentication becomes mandatory. The frontend redirects the user to Cognito Hosted UI, where the user signs in using the configured identity provider.

After authentication, the user enters a queue for a specific event and category. The queue service either admits the user or places the user in a waiting state. When admitted, the queue service issues a booking token. This token becomes a proof of admission for later protected operations.

Once admitted, the user opens the seat selection page. The seat map is rendered in a controlled way. Seats are naturally sorted, displayed ten per row, and paginated into manageable groups of one hundred seats. The user can select a limited number of seats. For general seating, the frontend shows a visual VIP divider between the stage and general seats to make the layout more intuitive.

When the user continues, the reservation service attempts to lock all selected seats atomically. If any seat is unavailable or already locked, the whole reservation fails. There is no partial reservation. On success, the user receives a reservation identifier, total amount, currency, expiration time, and locked seat list.

The user then moves to payment. The current implementation uses a mock payment service to simulate an external payment provider. Payment is amount-based and tied to reservation ID. It does not own seat identity or event logic.

After payment succeeds, the confirmation service validates the reservation, verifies the booking token, checks lock ownership, validates database seat state, updates seats to `BOOKED`, updates the reservation to `CONFIRMED`, inserts tickets, cleans up cache locks, and publishes a notification. Only after this confirmation transaction succeeds does the frontend show booking success.

---

### Frontend Experience Layer

The frontend is implemented as a static multi-page application using HTML, CSS, and vanilla JavaScript modules. This design keeps the frontend lightweight and avoids introducing a build pipeline. The goal is not to demonstrate frontend framework complexity; the goal is to demonstrate a realistic booking experience over a cloud-native backend.

The main frontend pages are:

- `index.html`
- `locations.html`
- `events.html`
- `event-detail.html`
- `login.html`
- `callback.html`
- `queue.html`
- `seats.html`
- `reservation-review.html`
- `payment.html`
- `booking-processing.html`
- `booking-success.html`
- `reservation-conflict.html`
- `session-expired.html`

The frontend is hosted through S3 and CloudFront. This gives the project a low-cost, globally cacheable delivery model. The frontend uses query-string navigation to pass route context, for example:

```text
event-detail.html?event_id=<event_uuid>
queue.html?event_id=<event_uuid>&category_id=<category_uuid>
seats.html?event_id=<event_uuid>&category_id=<category_uuid>
```

Browser storage is used to carry temporary flow context across static pages. This includes the booking token, event/category IDs, selected seats, reservation details, payment result, and confirmation result. However, browser storage is never treated as a trusted source of truth. Backend services still validate identity, token scope, seat locks, payment status, and database state.

A major UX improvement was replacing technical wording with user-facing language. The frontend no longer speaks about Cognito callbacks, protected flows, backend services, cache locks, or UUID entry. Instead, users see flows such as “Continue with Google,” “Choose your seats,” “Complete your payment,” and “Your booking is confirmed.” This is important because a production-quality architecture should not expose implementation details in the user experience.

The seat map became the most complex frontend component. It supports natural sorting, selected-seat state, green selected seats, locked/booked visual states, ten seats per row, one hundred seats per page, pager controls, a stage label, and a VIP divider for general seating. Mobile layout required additional care because ten seats per row cannot fit naturally on small screens. The mobile solution uses horizontal scrolling while keeping the stage, pager, divider, and grid visually aligned.

---

### Backend Service Layer

The backend is implemented as capability-aligned serverless services. Each Lambda owns a single major responsibility. This keeps the architecture modular and makes the flow easier to reason about.

The main backend capabilities are:

- Browse service
- Queue service
- Seat availability service
- Reservation service
- Payment mock service
- Booking confirmation service
- Notification publishing

The browse service supports read-heavy discovery. It retrieves locations, venues, performers, events, and event details. It can use Redis/Valkey caching to absorb repeated read load while Aurora remains the durable source of truth.

The queue service controls admission into the protected booking flow. It stores queue state in cache and issues a KMS-signed booking token once a user is admitted. The queue is scoped by event and category so that a viral event does not affect unrelated events.

The seat availability service is deliberately read-only. It combines durable seat state from Aurora with temporary lock state from cache. A seat is `BOOKED` if Aurora says it is booked. A seat is `LOCKED` if the database still says available but a temporary lock exists in cache. A seat is `AVAILABLE` only when Aurora says available and no cache lock exists.

The reservation service is the first service that changes contention state. It validates the authenticated user, verifies the booking token, checks queue admission, validates seats against Aurora, calculates pricing, and attempts to acquire all requested seat locks atomically in cache. Reservation is all-or-nothing.

The payment service is intentionally mocked. It validates reservation ID and total amount, returns a payment ID and status, and does not inspect seat identities. This models a realistic separation where payment providers are amount-oriented, not seat-aware.

The confirmation service is the durable commit point. It validates the payment result, reservation metadata, seat locks, and database seat state. Then it updates seats to `BOOKED`, updates reservation status to `CONFIRMED`, inserts tickets, removes cache state, and publishes a notification.

---

### Infrastructure and Terraform Layer

Terraform is a first-class part of the architecture. The project is not only application code; it is an integrated cloud system where networking, database, cache, compute, authentication, API routing, hosting, and notification resources must be provisioned consistently.

The infrastructure is organized into logical modules:

```text
terraform/
  modules/
    network/
    database/
    cache/
    auth/
    compute/
    api-gateway/
    notification/
    frontend/
```

The network module owns the VPC, public and private subnets, routing, and security group foundations. This is critical because Lambdas that access Aurora and Valkey need VPC connectivity, while database and cache resources must remain private.

The database module provisions Aurora PostgreSQL, subnet groups, IAM database authentication, security groups, and endpoint outputs. Aurora stores durable business state such as events, seats, reservations, and tickets.

The cache module provisions Valkey/Redis-compatible cache resources. The system uses cache for browse acceleration, queue state, seat locks, reservation metadata, idempotency records, and active user counters. Cache endpoints and authentication details are exported to compute modules.

The auth module provisions Cognito resources, hosted UI configuration, app client settings, callback URLs, logout URLs, and identity provider integration. The same module outputs are used by the frontend configuration and API Gateway authorizer.

The compute module provisions Lambda functions, execution roles, IAM permissions, environment variables, VPC configuration, log groups, and Lambda layers. This module is where runtime integration becomes very important. Reservation and confirmation Lambdas need Aurora, Valkey, KMS, and logging permissions. Queue needs cache and KMS signing. Confirmation needs SNS publish permissions.

The API Gateway module exposes the backend routes, configures integrations, applies Cognito authorization where required, and manages CORS. This module is the contract boundary between frontend and backend.

The frontend module provisions S3 and CloudFront for static hosting. The frontend is served from a private S3 origin through CloudFront using an origin access model. This keeps hosting low-cost and globally cacheable.

The notification module provisions SNS resources and grants confirmation services permission to publish events after a successful booking.

---

### Discovery Plane: Read-Heavy Browsing

Discovery traffic is expected to dominate booking traffic. Users browse locations, performers, venues, and events far more frequently than they complete purchases. The architecture therefore treats discovery as a read-heavy plane.

The browse APIs include:

```text
GET /v1/location
GET /v1/venue?location=<locationId>
GET /v1/performers?location=<locationId>
GET /v1/events?location=<locationId>&performer=<performerId>&venue=<venueId>
GET /v1/event/{eventId}
```

The backend can serve these from Redis/Valkey cache with Aurora as the source of truth and fallback. This avoids putting repeat discovery load directly on Aurora. The frontend presents this data using names and cards, while internally carrying UUIDs for API calls.

This read-path optimization is important because booking surges should not degrade normal browsing. If a popular event creates a spike, the discovery plane should remain responsive.

---

### Queue Plane: Surge Admission and Waiting Room

The queue plane exists to control admission into seat selection. It is not the final correctness mechanism. Correctness is still enforced by reservation locks and confirmation transactions. The queue reduces pressure and contention by limiting how many users can actively compete for seats at the same time.

The queue is scoped per event and category. This prevents one viral event from affecting all events. The queue stores waiting sessions, allowed sessions, active counters, and expiration information in cache.

The queue service issues a signed booking token when a user is admitted. That token contains user, event, category, session, issue time, expiry, and scope. Reservation and confirmation services verify this token before proceeding. This prevents a logged-in user from bypassing the queue and directly calling booking APIs.

A useful way to understand the queue is:

```text
Cognito proves who the user is.
The booking token proves what the user is currently allowed to book.
```

Both are required.

---

### Seat Availability Plane: Database Truth plus Cache Overlay

Seat availability is computed from two sources:

1. Aurora PostgreSQL durable state
2. Valkey/Redis temporary lock state

Aurora stores only durable seat states:

```text
AVAILABLE
BOOKED
```

Cache stores temporary lock state. Therefore, `LOCKED` is not a durable database state. It is a computed state derived from the cache.

The seat availability service returns:

- `AVAILABLE` when the seat is available in Aurora and no lock exists in cache
- `LOCKED` when the seat is available in Aurora but temporarily locked in cache
- `BOOKED` when the seat is booked in Aurora

The frontend displays this state but does not rely on it for correctness. The reservation service always revalidates before locking.

---

### Reservation Plane: Atomic Seat Holds

Reservation is the temporary hold boundary. When the user selects seats, the frontend sends selected seat labels to the reservation service with the booking token and idempotency key.

Reservation performs several validations:

- Cognito identity validation
- booking token verification
- queue admission validation
- seat availability check in Aurora
- price lookup by event category
- existing lock check in cache

Then it attempts to acquire all requested seat locks atomically using Lua in Valkey/Redis. This is essential because multi-seat booking must be all-or-nothing. If the user selects five seats, the system should not reserve only three. Either every requested seat is locked or the reservation fails.

The reservation service writes temporary metadata to cache:

- selected seats
- reservation metadata
- reservation lookup by reservation ID
- idempotency mapping
- lock keys
- expiry

In the final implementation path, a successful reservation can also persist a `HOLD` reservation row in Aurora to support downstream ticket foreign key integrity. This reflects an implementation evolution from the earlier cache-only hold concept. The original design preferred cache-only holds to avoid database cleanup, while the implemented ticket schema required a reservation parent row before ticket insertion.

---

### Payment Plane: Externalized Payment Responsibility

Payment is intentionally modeled as an external concern. The mock payment service accepts reservation ID, amount, and currency. It returns payment status and payment ID.

The payment service does not know seat identity. It does not decide whether seats are available. It does not write tickets. It does not mark seats booked.

This is realistic because payment providers typically validate payment amounts and return payment outcomes. The application still has to confirm whether the reserved inventory is valid before completing the booking.

A key integration contract is that payment uses `totalAmount`, not a generic `amount` field. This aligns the frontend with the backend payment service contract.

---

### Confirmation Plane: Durable Commit and Ticket Generation

Confirmation is the most important correctness boundary. It turns temporary state into durable business state.

The confirmation service validates:

- Cognito identity
- booking token
- reservation lookup
- reservation metadata
- seat lock ownership
- payment status
- payment amount
- database seat state

Then it executes a transaction in Aurora:

```text
UPDATE seats SET status = BOOKED
UPDATE reservations SET status = CONFIRMED
INSERT tickets
```

This transaction ensures that seats, reservations, and tickets stay consistent. If any step fails, the transaction rolls back.

After the transaction commits, the service cleans up cache keys and publishes a notification event. Notification happens after durable commit and should remain best-effort.

---

### Notification Plane: Post-Commit Communication

Notifications are published after booking confirmation. The notification event can include user ID, reservation ID, payment ID, event details, venue details, selected seats, ticket IDs, total amount, and currency.

The notification system should not be part of the booking transaction. If notification publishing fails, the booking should remain confirmed. A production system can add retry queues, dead-letter queues, and delivery tracking, but the core booking transaction should not depend on notification success.

---

### Data Model and State Ownership

The database schema is intentionally focused on durable state. Important entities include:

- locations
- venues
- performers
- events
- event performers
- event categories
- seats
- reservations
- tickets

The most important state ownership rule is:

```text
Temporary lock state belongs to cache.
Durable sold state belongs to Aurora.
```

Seat lifecycle:

```text
AVAILABLE → BOOKED
```

Reservation lifecycle:

```text
HOLD → CONFIRMED
HOLD → EXPIRED
HOLD → CANCELLED
HOLD → FAILED
```

Ticket lifecycle begins after confirmation. Tickets are created only when the booking transaction succeeds.

---

### Cache Key Design and Cluster-Safe Locking

Cache key design is critical because Valkey/Redis cluster mode requires multi-key Lua operations to access keys in the same hash slot. The design uses hash tags based on event and category.

Examples:

```text
queue:{eventId:categoryId}:allowed
seatlock:{eventId:categoryId}:{seatId}
reservation:{eventId:categoryId}:{reservationId}:seats
reservation:{eventId:categoryId}:{reservationId}:meta
reservation:lookup:{reservationId}
```

Atomic reservation depends on the ability to check and set multiple seat locks together. TTLs ensure abandoned flows eventually release seats.

The system also tracks lock counts where needed to estimate available capacity for queue admission.

---

### Security Model

Security is layered across the platform.

Cognito authenticates users. API Gateway authorizers protect routes. Queue-issued booking tokens authorize booking scope. KMS signs and verifies booking tokens. IAM controls what each Lambda can access. VPC and security groups isolate Aurora and cache resources. IAM database authentication avoids static database passwords. Valkey IAM authentication and TLS protect cache access.

The frontend is not trusted for critical decisions. Backend services derive user identity from Cognito claims and verify tokens and server-side state before allowing protected operations.

---

### Consistency Model

The consistency model combines cache-based coordination with database durability.

Cache is used for short-lived state:

- queue sessions
- active admission
- seat locks
- reservation metadata
- idempotency records

Aurora is used for durable state:

- events
- seats
- reservations
- tickets

Reservation locks prevent concurrent users from holding the same seat during the payment window. Confirmation validates locks and commits final state to Aurora.

This model avoids using the database as a temporary lock manager, but still relies on the database as the final source of truth.

---

### Failure Handling and Recovery

The system treats failure paths explicitly.

If queue admission expires, downstream booking operations are rejected. If locks expire before confirmation, confirmation fails and the user must restart. If payment fails, no durable booking state is written. If confirmation fails after payment, refund handling is treated as an external payment concern. If notification publishing fails, booking remains confirmed.

TTL is used as a safety net for abandoned reservation flows. Explicit cleanup is used after successful confirmation. A future cancellation endpoint can improve deterministic lock release when users actively cancel.

---

### Terraform Module Architecture

Terraform is organized around service boundaries and infrastructure responsibilities.

#### Network Module

The network module provisions VPC, subnets, routing, and security groups. It gives private connectivity to Aurora and Valkey while allowing API Gateway and CloudFront to act as public entry points.

#### Database Module

The database module provisions Aurora PostgreSQL, subnet groups, IAM authentication, and database security groups. It outputs database connection information for Lambda services.

#### Cache Module

The cache module provisions Valkey/Redis resources for browse cache, queue state, and seat locks. It outputs endpoints and authentication-related configuration to the compute layer.

#### Auth Module

The auth module provisions Cognito user pool, app client, hosted UI domain, callback/logout URLs, and identity provider configuration. Its outputs are consumed by both frontend configuration and API Gateway authorizers.

#### Compute Module

The compute module provisions Lambda functions, IAM roles, policies, environment variables, VPC configuration, and Lambda layers. It is the primary integration point for database, cache, KMS, and notification resources.

#### API Gateway Module

The API Gateway module provisions resources, methods, integrations, authorizers, CORS, stages, and deployment outputs. It exposes the backend contract to the frontend.

#### Frontend Module

The frontend module provisions S3 and CloudFront. The frontend is static, private behind CloudFront origin access controls, and optimized for low-cost global delivery.

#### Notification Module

The notification module provisions SNS resources and publish permissions. Confirmation services use this module after booking commit.

---

### How Frontend, Backend, and Terraform Integrate

The value of the project is in the integration of all layers.

- Terraform provisions Cognito and exports hosted UI values. The frontend uses those values in `assets/js/config.js`. API Gateway uses the same Cognito resources to secure protected APIs. Lambdas receive user claims through API Gateway events.

- Terraform provisions API Gateway and Lambda integrations. The frontend calls the API Gateway base URL. The backend services implement the route contracts.

- Terraform provisions Aurora and Valkey. Lambda environment variables receive database and cache endpoints. Backend code uses those values to connect securely.

- Terraform provisions KMS. Queue signs booking tokens. Reservation and confirmation verify those tokens.

- Terraform provisions SNS. Confirmation publishes notification events after transaction commit.

- Without Terraform, the application code would be difficult to reproduce. Without backend services, the frontend would be only a visual shell. Without frontend UX, the backend would not demonstrate a realistic user journey. The project works because all three layers are connected.

---

### Cost Optimization and the Light Branch

The project includes an important cost optimization decision around database connectivity.

The production-oriented architecture uses:

```text
AWS Lambda → RDS Proxy → Aurora Serverless v2
```

This design is robust for Lambda connection bursts because RDS Proxy provides pooling and multiplexing. However, the project is a personal portfolio workload with low and infrequent traffic. Aurora Serverless v2 can auto-pause after inactivity, but RDS Proxy can keep database connections active and prevent the database from reaching its lowest-cost idle state.

The cost-optimized branch removes RDS Proxy and uses:

```text
AWS Lambda → Aurora Serverless v2
```

with direct IAM database authentication.

This is an intentional tradeoff. The production architecture demonstrates scalable database connectivity. The light branch prioritizes cost efficiency for demo usage. For a low-traffic portfolio environment, direct Lambda-to-Aurora connectivity is acceptable and allows Aurora auto-pause to be used more effectively.

This distinction is important from a solution architecture standpoint because the best architecture depends on workload profile. A design that is appropriate for production scale may be unnecessarily expensive for an intermittent demonstration environment.

---

### Implementation Lessons and Design Evolution

Several important lessons emerged during implementation.

The payment service expected `totalAmount`, while the frontend initially used a different field name. This showed the importance of strict API contracts.

The confirmation service required payment status, so the frontend had to pass `paymentStatus` explicitly.

The ticket table’s foreign key to reservations exposed a design gap. The earlier cache-only reservation model was operationally clean, but the final ticket schema required a reservation parent row. The implementation evolved to persist successful reservations as `HOLD` and update them to `CONFIRMED` during booking confirmation.

Redis Lua cleanup required careful key and argument handling. Passing `reservation_id` as a key instead of an argument caused cross-slot issues. Lua numeric conversion also had to use `tonumber`, not `int`.

Seat sorting and display required frontend refinement. Natural sorting and seat pagination were added to prevent labels such as `VIP-10` appearing before `VIP-2` and to prevent 1000 seats from rendering as 100 vertical rows.

Mobile layout required additional responsive CSS because the seat map needed horizontal scrolling while remaining visually connected to the stage, pager, divider, and stepper.

---

### Known Limitations

The current phase intentionally excludes some production features.

There is no full My Tickets page yet. Payment is mocked rather than integrated with a real gateway. Refund workflow is external. Confirmation idempotency can be strengthened. Reservation expiry can be persisted more explicitly in the database. Backend seat pagination can replace frontend-only pagination for very large venues. Notification delivery can be enhanced with retries and DLQs. Admin event management is not yet implemented. Multi-region active-active booking is outside current scope.

These are acceptable limitations for the current architecture showcase because the system already demonstrates the core correctness and integration patterns.

---

### Future Improvements

Natural next steps include:

- My Tickets page
- QR-code ticket artifacts
- real payment gateway integration
- refund workflow
- reservation cancellation endpoint
- confirmation idempotency
- reservation expiry worker
- backend seat pagination
- admin event management
- observability dashboards
- distributed tracing
- DLQ-backed notification reliability
- automated frontend deployment and CloudFront invalidation
- load testing for queue and reservation flows

---

### Conclusion

mytickets.click is a complete online ticketing architecture built around real system design concerns. It separates read-heavy discovery from correctness-heavy booking. It uses queue admission to control surge traffic. It uses cache locks for short-lived seat holds. It uses Aurora PostgreSQL for durable booking truth. It uses Cognito and KMS to secure the protected flow. It uses Terraform to provision and integrate all infrastructure repeatably.

The most important lesson is that ticket booking is not a single operation. It is a lifecycle:

```text
Discovery → Admission → Seat Selection → Reservation Hold → Payment → Confirmation → Ticketing → Notification
```

Each stage has a clear owner and a clear consistency responsibility. The frontend provides a clean user journey. Backend services enforce correctness. Terraform makes the system deployable and reproducible.

That combination makes mytickets.click a strong solution architecture example rather than just a frontend page or a backend API demo.