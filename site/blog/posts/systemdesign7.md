---
title: Sharding & Partitioning
date: 2026-04-10
readingtime: 8 min read
tags:
  - software-architecture
  - database
  - system-design
subtitle: From First Principles to Production-Grade Strategies
---

# Sharding & Partitioning

![System Design Patterns](/images/shardingcombined.PNG)

---
## From First Principles to Production-Grade Strategies

---
A system starts with a simple mental model where all data lives inside one database process. A browser initiates a request by resolving a domain through DNS, opening a TCP socket, and negotiating TLS to establish a secure channel. Once the connection is established, the browser sends an HTTP request that contains headers describing the intent and context of the request.

```json
    GET /users/123 HTTP/1.1
    Host: api.example.com
    Authorization: Bearer <token>
    Accept: application/json
```

The request reaches an edge layer, typically a load balancer or API gateway. At this point, the gateway terminates TLS, inspects headers, may perform authentication or rate limiting, and forwards the request to an application server. The application server deserializes the request, validates the token, extracts the user identifier, and prepares a database query.

```sql
    SELECT * FROM users WHERE user_id = 123;
```

Inside the database engine, the query planner evaluates available indexes. If a B-tree index exists on user_id, the planner selects an index lookup path. The execution engine navigates the tree structure, performs key comparisons, locates the leaf node containing the pointer to the data row, and fetches the row from memory or disk. The entire execution remains local to a single machine, and latency is primarily bounded by CPU cycles and disk access time.

![System Design Patterns](/images/sharding.PNG)

---

### Observing how scale exposes limits in a single database

As request volume increases, the database becomes a shared resource under contention. Concurrent writes introduce locking overhead. The write-ahead log grows rapidly, increasing disk flush frequency. Cache miss rates increase as the working set exceeds available memory. At high throughput, even well-optimized queries begin to experience latency spikes due to I/O wait and lock contention.

Scaling vertically by adding CPU or RAM delays the problem but does not eliminate it. The architecture remains constrained by a single machine boundary. This is the point where data distribution becomes necessary.

---

### Understanding partitioning as an internal optimization inside a database

Partitioning divides a table into multiple segments within the same database instance. The application remains unaware of this division. The database engine uses metadata about partitions to route queries internally.

```sql
    CREATE TABLE orders (
        order_id INT,
        created_at DATE
    ) PARTITION BY RANGE (created_at);
```

Each partition is stored as a separate physical segment. When a query includes a predicate on created_at, the planner evaluates which partitions are relevant. It eliminates non-matching partitions before execution. This is known as partition pruning. The execution engine scans only the required segments, reducing I/O and improving performance.

Despite these improvements, all partitions share the same CPU, memory, and disk. The database still operates as a single unit. Partitioning optimizes query execution but does not provide horizontal scalability.

---

### Moving to sharding introduces distributed responsibility

Sharding distributes data across multiple independent database instances. Each shard is a separate database with its own resources. The application now becomes responsible for routing queries to the correct shard. This introduces a new component in the execution flow, often called a shard resolver.

When a request arrives at the application server, the server must determine which shard contains the data before executing any query. This requires a deterministic mapping function.

---

### Using modulo hashing shows the simplest form of distribution

A straightforward approach is to map keys using modulo arithmetic.

```js
    def get_shard(user_id):
        return user_id % 3
```

In this function, user_id is divided by the number of shards, and the remainder determines the shard index. At runtime, the application computes this value, selects the corresponding database connection, and executes the query on that shard. This distributes data evenly if user_id values are uniformly distributed.

The internal execution is simple. The application performs a constant time arithmetic operation, resolves a connection pool, and sends the SQL query to the selected database. The database executes the query as before, but now each database handles only a subset of the data.

The limitation becomes visible when the system needs to scale. Adding a new shard changes the divisor. A mapping such as user_id % 3 becomes user_id % 4. This invalidates the mapping for most keys, forcing data to be redistributed. Data migration involves reading rows from existing shards, writing them to new shards, updating indexes, and ensuring consistency during the process. This creates operational overhead and can impact availability.

---

### Observing how range based distribution aligns with data ordering

Range-based sharding uses ordered boundaries instead of hashing.

```js
    def get_shard(user_id):
        if user_id <= 1000:
            return "DB1"
        elif user_id <= 2000:
            return "DB2"
        else:
            return "DB3"
```

The resolver checks the value of user_id and maps it to a predefined range. This approach aligns with queries that use ranges. When a query requests users between two values, the application can route it to a single shard.

```sql
    SELECT * FROM users WHERE user_id BETWEEN 1200 AND 1600;
```

The application resolves that both values fall within the same range and sends the query to DB2. The database executes the query efficiently using index scans or range scans.

Internally, the shard resolver often maintains a sorted list of ranges. The lookup is implemented using binary search, which ensures logarithmic time complexity even when the number of ranges grows.

The drawback appears in write-heavy systems with sequential keys. New records always fall into the highest range. This causes one shard to handle most writes, leading to uneven load distribution. CPU utilization, disk I/O, and replication lag become concentrated on a single shard. The system becomes imbalanced despite having multiple shards.

![System Design Patterns](/images/rangebased.PNG)

---

### Understanding how hashing removes ordering to improve distribution

Hash-based sharding breaks the ordering of keys by applying a hash function.

```js
    def get_shard(user_id):
        return hash(user_id) % 3
```

The hash function transforms sequential identifiers into pseudo-random values. This ensures that writes are distributed evenly across shards. Each shard receives a roughly equal share of traffic, which balances CPU and I/O usage.

At runtime, the application computes the hash, performs the modulo operation, and selects the shard. The database execution remains unchanged, but the distribution of data is more uniform.

The tradeoff is that range queries lose locality. A query that spans a range of user_ids cannot be routed to a single shard because the data is scattered. The application must send the query to all shards, wait for responses, and merge the results. This increases latency due to multiple network calls and introduces complexity in handling partial failures.

![System Design Patterns](/images/hashbasedsharding.PNG)

---

### Seeing how consistent hashing changes the mapping model

Consistent hashing removes the dependency on the number of shards. Instead of using modulo arithmetic, it maps both keys and servers into a fixed hash space.

```json
    server_map = {
        200: "DB1",
        500: "DB2",
        800: "DB3"
    }
```

Each server is assigned a position in the hash space. The keys in this map are sorted. When a request arrives, the application hashes the key into the same space.

```js
    def get_server(key):
        key_hash = hash(key)
        sorted_keys = sorted(server_map.keys())

        for server_hash in sorted_keys:
            if server_hash >= key_hash:
                return server_map[server_hash]

        return server_map[sorted_keys[0]]
```

The function computes the hash of the key and iterates over the sorted server positions. It selects the first server whose position is greater than or equal to the key hash. If no such server exists, it wraps around and selects the first server in the list. This wrap-around ensures that every key maps to a server.

Internally, this lookup is implemented using a balanced tree or a sorted array with binary search to achieve efficient lookup. The critical property is that when a new server is added, only a subset of keys need to be remapped. Specifically, keys that fall between the new server and its predecessor are reassigned. This minimizes data movement compared to modulo hashing.

To improve distribution, each physical server is assigned multiple positions in the hash space. These virtual nodes reduce uneven gaps and ensure a more balanced load across servers.

![System Design Patterns](/images/consistenthashing.PNG)

---

### Integrating geography introduces another layer of routing

In global systems, latency becomes a primary concern. Requests from users in different regions should not travel across continents unnecessarily. Geo-based routing addresses this by directing requests to the nearest data center.

At the DNS or load balancer level, the system resolves the user’s IP address to a region. The request is routed to a regional cluster. Within that region, the application applies sharding logic, often using consistent hashing.

This creates a multi-layer routing model. The first layer routes based on geography. The second layer distributes data across shards. The third layer may apply partitioning within each shard for query optimization.

![System Design Patterns](/images/geobasedsharding.PNG)

---

### Observing how these strategies coexist in a real system

A production system often combines these approaches. A request from a user in India is routed to an Indian data center. Within that region, the application uses consistent hashing on user_id to determine the shard. Inside each shard, tables may be partitioned by time to optimize queries on recent data.

The execution flow involves multiple decisions. The request enters the system, is routed geographically, resolved to a shard, and then executed against a partition within that shard. Each layer addresses a specific constraint. Geo routing reduces latency. Consistent hashing ensures scalability and minimizes data movement. Partitioning improves query efficiency.

![System Design Patterns](/images/hybridsharding.PNG)

The tradeoffs become clear in this layered design. Geo-based routing introduces challenges in maintaining consistency across regions. Replication between regions may be asynchronous, leading to eventual consistency. Consistent hashing reduces data movement but adds complexity to routing logic. Hash-based distribution improves load balancing but complicates range queries. Range-based approaches simplify certain queries but risk hotspots.

At scale, the system is no longer defined by a single technique. It is defined by how these techniques interact, how data is placed, how requests are routed, and how failures are handled. The design evolves from a single-node database into a distributed system where data locality, routing determinism, and operational complexity are tightly coupled.