---
title: "Cache Strategies and Proxy Layers"
subtitle: "How Proxies and Caches Work Together"
author: "Abhinav Kumar"
date: "2026-03-11"
tags:
  - software-architecture
  - distributed-systems
  - event-driven-architecture
  - system-design
reading_time: "8 minutes"
---

# Cache Strategies and Proxy Layers

---
## How Proxies and Caches Work Together in Distributed Systems

---
High traffic systems quickly run into database limits. The problem is not usually storage capacity but request volume. If every application request hits the database, latency increases and the database eventually becomes the system bottleneck.

Caching is introduced to reduce this pressure.

A typical production request path looks like this:

    Client
      ↓
    Reverse Proxy / CDN
      ↓
    API Layer
      ↓
    Cache
      ↓
    Database

The cache acts as a fast temporary store for frequently accessed data so the database does not have to serve every request.

This article explains how common cache strategies work and where they create inefficiencies, especially for database write load.

![System Design Patterns](/images/systemdesign2.PNG)

---

### Forward Proxy vs Reverse Proxy

Before discussing caching, it helps to understand where proxies fit into the architecture.

#### Forward Proxy

A forward proxy sits between a client and the external internet.

    Client → Forward Proxy → Internet → Server

The server only sees requests coming from the proxy.

Typical uses:

- Corporate internet filtering
- Security inspection
- Anonymous browsing
- Traffic logging

Forward proxies are mostly used for controlling outbound traffic.

#### Reverse Proxy

A reverse proxy sits in front of backend servers.

    Client → Reverse Proxy → Backend Services

The client never directly contacts application servers.

Reverse proxies typically handle:

- load balancing
- TLS termination
- routing requests to services
- rate limiting
- authentication
- edge caching

Common implementations include systems like NGINX or managed services such as CloudFront or API Gateway.

---

### Where the Cache Lives

A cache system such as Redis is not a proxy. It is simply a fast key-value store used by the application.

Example architecture:

    Client
      ↓
    Reverse Proxy
      ↓
    Application
      ↓
    Redis
      ↓
    Database

The application decides when to read from cache and when to read from the database.

The database remains the system of record.

---

### Why Caching Exists

Most large systems suffer from repeated reads of the same data.

Example:

    1,000,000 requests
    → same product information
    → same database query

Without caching:

    Application → Database → Application → Client

With caching:

    Application → Cache → Application → Client

The database now serves only a fraction of requests.

---

### Cache Aside Pattern

Cache-aside is the most widely used caching approach.

The application controls the cache explicitly.

Read flow:

1. Application checks cache.
2. If the key exists, return it.
3. If the key does not exist, read from database.
4. Store the result in cache.

Example flow:

    Application → Cache
           ↓
      Cache miss
           ↓
    Application → Database
           ↓
       Write to cache
           ↓
        Return result

Write flow:

    Application → Database
    Application → Invalidate cache entry

The next read will repopulate the cache.

This approach works well because only frequently accessed data ends up in cache.

---

### Refresh Ahead Pattern

Refresh ahead is an extension of cache-aside used for hot data.

Instead of waiting for cache expiration, the system refreshes entries shortly before they expire.

Example flow:

    Cached item approaching TTL
            ↓
    Background job reads database
            ↓
    Cache updated with fresh value

This avoids latency spikes caused by sudden cache misses.

Typical use cases include:

- product pricing
- stock information
- frequently viewed content

---

### Write Through Pattern

Write-through attempts to keep cache and database synchronized.

Whenever the application writes data:

    Application → Cache
                 ↓
              Database

The cache is always updated first, and the database update happens immediately afterward.

The idea is that the cache always contains the latest data.

However, this introduces several inefficiencies.



#### Unnecessary Database Writes

A common issue appears during cache population.

Example:

    Cache miss
    Read from database
    Store result in cache

In some implementations the write-through policy causes the value to be written again to the database.

Example scenario:

    Database value = 100
    Cache miss
    Application reads value
    Cache stores value
    Write-through policy triggers database update

The database receives a write even though the value has not changed.

At scale this becomes significant unnecessary write traffic.

---

#### Database Writer Bottleneck

Most production databases separate read and write workloads.

Example architecture:

    Primary database (writes)
          ↓
      Read replicas

Read traffic can scale horizontally through replicas.

Write traffic cannot. All writes must pass through the primary node.

If write-through generates extra writes, the primary database becomes saturated long before read capacity is exhausted.



#### Reduced Cache Benefit

Caching is intended to reduce database work.

Write-through partially defeats that goal by coupling cache operations with database writes.

Instead of reducing load, it sometimes increases it.

---

### Write Behind Pattern

Write-behind attempts to reduce write latency.

In this approach, writes are first stored in the cache and then asynchronously flushed to the database.

Flow:

    Application → Cache
    Cache queues update
    Background process writes to database

This allows applications to respond quickly without waiting for the database.

However it introduces reliability risks.

---

#### Risk of Data Loss

If the cache fails before queued writes are persisted, those writes disappear.

Example:

    Cache stores pending writes
    Cache node crashes
    Pending updates lost

The database never receives the changes.


#### Temporary Data Inconsistency

Another problem appears when different services read from different sources.

Example:

    Service A writes data
    Cache updated immediately
    Database updated later

If another service reads directly from the database during this window, it sees stale data.

Different services observe different system states.


#### Operational Complexity

Write-behind requires additional mechanisms:

- write queues
- retry logic
- durability guarantees
- failure recovery

Managing these correctly increases operational complexity.

---

### Database Architecture Considerations

Many modern relational databases follow a writer-replica pattern.

    Writer node
      ↓
    Multiple read replicas

Reads can scale by adding replicas.

Writes cannot. They must pass through the writer.

If caching strategies generate unnecessary writes, the writer becomes the first component to fail under load.

---

### Typical Production Setup

A simplified architecture used in many systems looks like this:

    Client
      ↓
    CDN or Reverse Proxy
      ↓
    API Gateway
      ↓
    Application Service
      ↓
    Redis Cache
      ↓
    Database

The most common caching strategy in this setup is:

    Cache Aside
    +
    Refresh Ahead for high-traffic keys

The database is updated only when real business events occur.

Examples:

    user updates profile
    order is placed
    product price changes

Everything else is served from cache.

---

#### Summary

Caching is introduced to reduce database pressure and improve latency.

Among common strategies:

Cache Aside and Refresh Ahead are widely used because they keep database writes minimal and are relatively simple to operate.

Write Through and Write Behind can be useful in specific scenarios but often introduce additional database load or operational complexity.

When designing a caching layer, the key question is simple:

How many database operations does this strategy eliminate, and how many does it accidentally create?

