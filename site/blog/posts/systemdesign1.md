---
title: "Architecture Pattern Every Solution Architect Should Know"
subtitle: "Understanding How Fundamental Communication Models aWork Together in Real-World"
author: "Abhinav Kumar"
date: "2026-03-10"
tags:
  - software-architecture
  - distributed-systems
  - event-driven-architecture
  - system-design
reading_time: "8 minutes"
---

# Architecture Pattern Every Solution Architect Should Know

---
## Understanding How Fundamental Communication Models aWork Together in Real-World

---

Modern distributed systems are built using different communication and state management models. 
Two fundamental dimensions define how systems interact:

1. **Communication style**
   - **Synchronous**
   - **Asynchronous**

2. **State management**
   - **Stateful**
   - **Stateless**

Combining these two dimensions results in **four architectural communication patterns**.

| Communication | State Management | Architecture Pattern |
|---|---|---|
| Synchronous | Stateless | Standard HTTP API / REST |
| Synchronous | Stateful | Session-based architectures |
| Asynchronous | Stateless | Event-driven architecture |
| Asynchronous | Stateful | Workflow orchestration |

Understanding these patterns is critical when designing scalable systems.

![System Design Patterns](/images/systemdesign1.jpg)


---

### The Four Architectural Combinations

#### 1. Synchronous + Stateless

This is the **most common architecture pattern used in modern web APIs**.

##### Definition

- Client sends a request
- Server processes the request
- Server immediately returns the response
- Server **does not store any session state**

Every request contains all the information needed to process it.

##### Example Architecture

Typical REST API.

Example flow:

User retrieves order details.

##### Step-by-step technical flow

- User sends request

```json
GET /orders/123
Authorization: Bearer JWT
```

- API Gateway receives request

- Gateway forwards request to Order Service

- Order Service:
   - Reads orderId
   - Validates JWT
   - Fetches order from database

- Response returned

```json
200 OK
{
  "orderId": 123,
  "status": "Shipped"
}
```

##### Characteristics

- No session stored on server
- Easy horizontal scaling
- Load balancer can route request to **any server**

##### Advantages

- Highly scalable
- Fault tolerant
- Cloud friendly

##### Typical technologies

- REST APIs
- GraphQL APIs
- gRPC

---

#### 2. Synchronous + Stateful

This architecture stores **session state on the server**.

##### Definition

Client sends requests synchronously but server **remembers previous interactions**.

##### Example

Traditional **session-based web applications**.

Example: login-based web application.

##### Step-by-step technical flow

##### Step 1 — User logs in

```json
POST /login
username
password
```

Server:

- Authenticates user
- Creates session object

```json
SessionID = ABC123
```

Session stored in server memory:

```json
SessionStore
{
 ABC123: {
   userId: 10
   role: admin
 }
}
```

Server response:

```json
Set-Cookie: SESSIONID=ABC123
```

##### Step 2 — Next request

Client sends:

```json
GET /profile
Cookie: SESSIONID=ABC123
```

Server:
- Reads session ID
- Looks up session
- Retrieves user context


##### Problem with Load Balancing

Since session exists on a **specific server**, next request **must go to the same server**.

This requires:

**Sticky Sessions (Server Affinity)**

Load balancer config:

```json
Client → Server A
Next request → Server A
```

##### Why this breaks under high load

Problems:

- Uneven load distribution
- Server memory limits
- Session loss if server crashes
- Hard to scale horizontally


##### Solutions

##### Option 1 — Distributed Session Store

Use Redis or Memcached.

```json
Server A → Redis
Server B → Redis
Server C → Redis
```

Sessions stored centrally.


##### Option 2 — Stateless Authentication

Use **JWT or OAuth tokens**.

Session moves to client.

Example:

```json
Authorization: Bearer JWT
```

Server decodes token and does not store session.

This converts the system into **synchronous + stateless architecture**.

---

#### 3. Asynchronous + Stateless

This is the **core pattern behind Event Driven Architecture (EDA).**

##### Definition

Services communicate through **events**, not direct requests.

No service stores conversational state about other services.

##### Example

E-commerce order processing.

Services:

- Order Service
- Payment Service
- Inventory Service
- Notification Service

Communication through **message broker**.

Example brokers:

- Kafka
- RabbitMQ
- SQS
- NATS


##### Step-by-step flow

##### Step 1 — Order created

Order Service publishes event:

```json
OrderCreated
{
 orderId: 1001
 userId: 10
 amount: 500
}
```

Event sent to message broker.


##### Step 2 — Payment Service consumes event

Payment Service receives event.

Processes payment.

Then emits new event:

```json
PaymentCompleted
{
 orderId: 1001
 paymentStatus: SUCCESS
}
```

##### Step 3 — Inventory Service reacts

Consumes PaymentCompleted event.

Reduces stock.

Publishes event:

```json
InventoryReserved
```

##### Step 4 — Notification Service reacts

Consumes InventoryReserved.

Sends confirmation email.

##### Characteristics

- Loose coupling
- High scalability
- Failure isolation
- Parallel processing

##### Why this scales extremely well

Services are:

- independent
- stateless
- horizontally scalable

Queues buffer load spikes.

---

#### 4. Asynchronous + Stateful

This pattern is used by **workflow orchestrators**.

Example technologies:

- AWS Step Functions
- Temporal
- Netflix Conductor
- Camunda

##### Definition

A central orchestrator **tracks workflow state** across multiple asynchronous steps.


##### Example

Order workflow.

Sequence:

```
Create Order
→ Process Payment
→ Reserve Inventory
→ Ship Order
```

Orchestrator maintains workflow state.



##### Step-by-step workflow

##### Step 1

API request:

```jsom
POST /create-order
```

System starts workflow.

Workflow state created.

```json
OrderWorkflow
status = STARTED
```


##### Step 2

Orchestrator calls Payment Service.

Payment runs asynchronously.


##### Step 3

Payment returns result.

Workflow engine updates state.

```json
paymentStatus = SUCCESS
```


##### Step 4

Next step triggered.

```json
Reserve Inventory
```


##### Why this is stateful

Workflow engine stores state like:

```json
{
 step: payment
 retries: 2
 status: running
}
```


##### Scaling challenge

If workflow engine stores large state:

Problems include:

- database pressure
- orchestration bottleneck
- centralized coordination

---

### Which Pattern Is Used Where

| Pattern | Common Use Case |
|---|---|
| Sync + Stateless | APIs, microservices communication |
| Sync + Stateful | legacy web apps, session-based systems |
| Async + Stateless | event driven architectures |
| Async + Stateful | long-running workflows |

---

### How Real Systems Combine These Patterns

Real applications use **multiple patterns simultaneously**.

Example e-commerce checkout flow.



#### Step 1 — User creates order

Frontend → API

```json
POST /orders
```

Pattern used:

**Synchronous + Stateless**



#### Step 2 — Order service publishes event

```json
OrderCreated
```

Pattern used:

**Async + Stateless**



#### Step 3 — Background services process events

Payment Service 
Inventory Service 
Fraud Detection

All consume events.

Pattern used:

**Async + Stateless**



#### Step 4 — Complex workflows

Refund process or shipment coordination may require orchestration.

Pattern used:

**Async + Stateful**

---

### Replacing Workflow Orchestration With Event Choreography

Instead of a central orchestrator, services react to events.

Example:

```json
OrderCreated
PaymentCompleted
InventoryReserved
OrderShipped
```

Each service listens and emits next event.

This is **event choreography**.



#### Advantages

- No central bottleneck
- Fully distributed
- Highly scalable



#### Downsides

- Hard to track workflow state
- Difficult debugging
- Event dependency complexity
- Harder error handling
- Lack of global visibility

Example problem:

If payment fails, which service cancels order?

Logic becomes scattered.

---

### Why the Best Systems Use All Patterns Together

The most scalable architectures combine these patterns.

Typical modern architecture:

```
User Request
     ↓
Sync Stateless API
     ↓
Event Published
     ↓
Async Stateless Microservices
     ↓
Optional Workflow Orchestration
     ↓
Final Events → Notifications
```

Each pattern solves a different problem:

| Pattern | Strength |
|---|---|
| Sync Stateless | fast user responses |
| Sync Stateful | session handling (legacy) |
| Async Stateless | massive scalability |
| Async Stateful | complex workflows |

---

### Final Conclusion

No single architecture pattern solves every problem.

The most resilient distributed systems combine:

- **Synchronous stateless APIs** for user interactions
- **Event-driven asynchronous systems** for scalability
- **Workflow orchestration** for complex multi-step processes
- **Minimal stateful components** where absolutely required

Understanding how and when to use each model is a core skill of modern **solution architecture and distributed system design**.
