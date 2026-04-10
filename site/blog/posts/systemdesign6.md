---
title: Session Management in Applications
date: 2026-03-27
readingTime: 6 min read
tags:
  - software-architecture
  - distributed-systems
  - system-design
subtitle: End to End Walktrhough
---

# From Sessions to Zero Trust

---

## A Deep, End-to-End Walkthrough of Session Management in Applications

---

Modern authentication has shifted from stateful, server-side sessions—where every request depends on centralized lookups and becomes a scaling bottleneck—to a layered, verification-first model: identity and permissions are carried in signed JWTs that each service can verify locally, API gateways enforce edge concerns like TLS, auth, rate limiting, and routing, short‑lived access tokens with refresh tokens restore control without per-request state, services validate independently using scoped token exchange and mTLS to limit blast radius, and Zero Trust ties it together by continuously verifying user, service, context, and policy at every hop.

---
### Stateful Sessions — What Really Happens Under the Hood

Let’s start with the simplest system: a user logging into a web application.
When a user enters username and password, the server does not just “log them in.” It creates a stateful representation of that user session. This is a structured object that lives entirely on the server side. It contains identity, permissions, and often application data like cart items or preferences.
Imagine the server creates something like this internally:

```json
{  "session_id": "abc123",  
    "user_id": 42,  
    "roles": ["user"],  
    "permissions": ["read", "write"],  
    "cart": ["item1", "item2"],  
    "device": "chrome_windows",  
    "ip": "49.x.x.x",  
    "created_at": "...",  
    "expires_at": "..."}
```

This object is then stored somewhere — in memory, a database, or more commonly a distributed cache like Redis. The important thing is: this data is not sent to the client.

Instead, the server sends back a very small piece of information:

```json
Set-Cookie: session_id=abc123
```

The browser stores this cookie. From this point on, every request made by the browser includes that session ID. When the server receives a request, it extracts the session ID, queries its storage, retrieves the full session object, and then decides what to do.

Now here is the part most people underestimate: this lookup happens on every single request. Even for something trivial like fetching a product list, the system must first retrieve session data before doing anything meaningful.

This means every request involves:
A network call (if session store is external like Redis)Data deserialization (JSON/object reconstruction)Memory allocationPermission evaluation

At small scale, this is fine. But as traffic grows, this becomes the dominant cost.
The system is not slow because Redis is slow. It is slow because every request depends on a shared piece of state that must be fetched before doing any work.
That dependency is the real problem.

![System Design Patterns](/images/systemdesign6_1.png)

---

### Scaling Stateful Systems — Where the Pain Really Comes From

Now imagine your system grows. You move from one server to ten servers behind a load balancer. At this point, the session model starts breaking in subtle ways.

If a user logs in and their session is created on Server A, the next request might go to Server B. But Server B has no knowledge of that session unless you explicitly share it. This leads to the first workaround: sticky sessions, where a user is always routed to the same server. While this solves the consistency issue, it introduces uneven load distribution and makes the system fragile. If that one server fails, the session is lost.

The next attempt is session replication. Every server shares session data with every other server. This works in theory but becomes extremely expensive. Each session creation or update must be propagated across the cluster. At scale, this creates network storms and synchronization complexity.


The most common real-world solution is a centralized session store like Redis. Now all servers read and write session data from a shared cache. This solves consistency but introduces a different problem: every request now depends on a network round-trip to Redis.

Even if that round-trip is fast (say 2–3 ms), multiply it by tens of thousands of requests per second and you have a serious performance bottleneck. Redis becomes a critical dependency. If it slows down, your entire system slows down. If it fails, your system effectively goes down.

The key realization here is not “Redis is slow.” The realization is:
 The architecture forces every request to depend on centralized state.
That is what we are trying to eliminate.

![System Design Patterns](/images/systemdesign6_2.png)

---

### JWT — Removing the Need for Server-Side Lookups

JWT (JSON Web Token) changes the model fundamentally.
Instead of the server storing session data and giving the client a pointer, the server now packages the identity and permissions into the token itself and gives that to the client.
This token is not just plain JSON. It is cryptographically signed. That signature is the key to everything.
When a user logs in, the auth server creates a payload:

```json
{  "sub": "user_42",
   "roles": ["user"],  
   "scope": ["read", "write"],
   "exp": 1700000000}
```
This payload is then signed using a private key. The result is a token that cannot be modified without invalidating the signature.
Now when the client makes a request, it sends:Authorization: Bearer <JWT>The receiving service does not look up anything in a database. It simply verifies the signature using a public key. If the signature matches, it knows the token was issued by a trusted authority and has not been tampered with.
This is a huge shift.
In the session model, trust comes from lookup.In the JWT model, trust comes from verification.
Verification is a local computation. It does not require a network call. This removes the biggest bottleneck in the system.

![System Design Patterns](/images/systemdesign6_3.png)

---

### API Gateway — The Real Gatekeeper (Not Just a Router)

Now introduce an API Gateway in front of your services.
Most explanations reduce the gateway to “it validates JWT.” That’s only a small part of what it actually does.

The API Gateway is the first line of defense and control in the system. It sits at the edge and handles everything before the request even touches your backend services.
When a request arrives, the gateway performs multiple steps in sequence.

First, it terminates TLS. This means it handles HTTPS encryption, offloading that work from backend services. Then it extracts the JWT from the request and validates it. This includes verifying the signature, checking expiration, and ensuring the token was issued by a trusted authority.

But it doesn’t stop there.

The gateway can enforce rate limits. For example, it might allow only 100 requests per minute per user. This protects your backend from abuse and accidental overload.

It can also perform routing. Based on the URL path, it decides which service should handle the request. For example, /orders might go to the Order Service, while /payments goes to the Payment Service.

It can cache responses for certain endpoints, reducing load on backend systems. It can also transform requests by adding headers, removing sensitive data, or normalizing formats.

The important point is this:
 The gateway reduces unnecessary load on backend services by filtering, validating, and shaping traffic at the edge.
However, it has a limitation. It primarily deals with user-level concerns. Once the request enters the backend, the gateway is no longer involved. That’s where the next layer of complexity begins.

![System Design Patterns](/images/systemdesign6_4.png)

---

### Hybrid Model — Bringing Back Control Without Killing Performance

JWT solved performance issues, but it created new problems. There is no easy way to revoke a token once issued. If a token is stolen, it can be used until it expires.

To fix this, systems introduce a hybrid model using access tokens and refresh tokens.
The access token is short-lived, typically valid for a few minutes. It is used for all API calls and is validated locally without any database lookup.

The refresh token is long-lived and stored securely on the server side. When the access token expires, the client sends the refresh token to request a new access token.

This is where state comes back into the system — but in a controlled way. The server maintains a mapping of refresh tokens to sessions. This allows it to revoke access when needed, track devices, and enforce policies.

The important shift is this:
 State is no longer required for every request. State is only used during token refresh or control operations.
This drastically reduces the load on the session store while still allowing centralized control.

![System Design Patterns](/images/systemdesign6_5.png)

---

### Service-to-Service Authentication — What Actually Happens Internally

Now we enter the backend, where most confusion happens.
Consider a request flow:

```json
Client → Gateway → Order Service → Payment Service → Inventory Service
```

The gateway validates the token and forwards the request to the Order Service. The Order Service does not blindly trust the gateway. It validates the token again. This might feel redundant, but it is intentional. Each service is responsible for its own security.

When the Order Service needs to call the Payment Service, it forwards the same token. The Payment Service again validates the token locally. This continues across services.

At first glance, this seems inefficient. If there are 50 services in a chain, does that mean 50 validations? Yes. But each validation is a local cryptographic operation, which is extremely fast compared to a network call.
This is why the system scales. Instead of one centralized check, you have many distributed checks, each cheap and independent.

![System Design Patterns](/images/systemdesign6_6.png)


---

### The Problem with Token Propagation — Lateral Movement

Now let’s look at the downside of this model.
If the same token is passed across all services, then compromising any one service becomes dangerous. An attacker who gains access to a service can extract the token and use it to call other services.

This is known as lateral movement. The attacker moves sideways within the system, using the same credentials.
The root cause is that the token is over-privileged. It carries more authority than is necessary for any single service interaction.

![System Design Patterns](/images/systemdesign6_7.png)

---

### Token Exchange — Reducing Blast Radius

To fix this, systems use token exchange.
Instead of passing the same token, a service requests a new token from the auth server for the specific downstream service. This new token has limited scope and a short lifetime.

For example, the Order Service might request a token that only allows calling the Payment Service and nothing else. If that token is compromised, the attacker cannot use it to access other services.

This reduces the blast radius significantly.

![System Design Patterns](/images/systemdesign6_8.png)

---

### mTLS — Proving Service Identity

JWT proves who the user is. But it does not prove which service is making the call.
mTLS (mutual TLS) solves this problem.

In mTLS, both the client and server present certificates during the TLS handshake. Each service has its own certificate issued by a trusted authority. When Service A connects to Service B, both sides verify each other’s certificates.

This ensures that Service B knows it is actually talking to Service A, not an attacker pretending to be Service A.

This adds a second layer of identity: service identity.

![System Design Patterns](/images/systemdesign6_9.png)

---

### Zero Trust — Continuous Verification Across the System

Now we put everything together.
Zero Trust is not a single technology. It is a design principle.

The principle is simple:
 Do not trust any request by default. Verify everything.

In a zero trust system, every request is evaluated based on multiple factors:
User identity (JWT)Service identity (mTLS)Context (IP, device, behavior)Policy rules (what is allowed)

Each service does not assume that a request is safe just because it came from inside the network. It performs its own checks. These checks happen continuously, not just once at login.

This means trust is not a one-time decision. It is a continuous process.

![System Design Patterns](/images/systemdesign6_10.png)

---
### Final Mental Model

What we ended up building is not a stateless system.
It is a layered system:
- Stateless tokens for fast execution.
- Stateful control for revocation and monitoring
- API Gateway for edge  enforcementService-level validation for internal security
- mTLS for service identity
- Policy engines for decision-making

---

### Final One-Line Truth

 Modern authentication is not about trusting requests — it is about continuously verifying them at every layer.