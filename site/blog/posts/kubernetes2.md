---
title: Kubernetes Load Balancer vs Ingress Explained
date: 2026-01-15
readingTime: 5 min read
tags: [Kubernetes, Ingress, LoadBalancer, Networking]
subtitle: Understanding where load balancers, ingress controllers, and services actually sit
icon: 🌐
---

# Kubernetes Load Balancer vs Ingress Explained
---
### Understanding where load balancers, ingress controllers, and services actually sit
---
## Introduction

A common question in Kubernetes is how the **load balancer** and **ingress** actually interact, where each one sits, and why they are often confused as doing the same job.

The confusion usually comes from the fact that both components participate in getting **external traffic into the cluster**, but they operate at **different layers** and in **different places** in the architecture.

Understanding their roles becomes much easier once you follow the request path from the internet to a pod.

![Kubernetes Load Balancer vs Ingress Explained](/images/kubernetes2.jpeg)

---

## External Load Balancer: The Cluster Entry Point

The external load balancer sits **outside** the Kubernetes cluster.

It typically operates at **Layer 4 (TCP/UDP)** and has **no understanding of Kubernetes concepts** such as:

- Pods
- Services
- Namespaces
- URL paths or hostnames

Its responsibilities are intentionally limited:

- Accept traffic from the internet
- Distribute incoming connections across **worker nodes**
- Perform basic health checks to ensure node availability

From the load balancer’s perspective, a Kubernetes cluster is simply a **set of IP addresses and ports**.

---

## Ingress: Layer 7 Traffic Routing

Ingress is often misunderstood as a **control-plane component**.

While the **Ingress resource** (the routing rules) is stored in the Kubernetes control plane, the **Ingress controller** is a **data-plane component** that runs as pods on the worker nodes.

When traffic reaches a node:

- The load balancer forwards the request to a worker node
- The Ingress controller pod on that node receives the request
- The request is evaluated at **Layer 7 (HTTP/HTTPS)**

At this stage, the Ingress controller:

- Matches the **host** and **path**
- Applies routing rules
- Determines which **Kubernetes service** should receive the request

This is where URL-based routing, virtual hosts, and TLS termination occur.

---

## Kubernetes Service: Pod-Level Load Balancing

Kubernetes services provide a **stable abstraction** over a dynamic set of pods.

A service:

- Is **node-agnostic**
- Exposes a stable virtual IP (ClusterIP)
- Selects pods using labels

Once traffic is forwarded to a service:

- `kube-proxy` routes the request to one of the backing pods
- The selected pod may be on **any node** in the cluster
- If the pod is remote, the cluster network transparently forwards the request across nodes

This ensures that **pod placement does not affect reachability**.

---

## End-to-End Request Flow

Putting it all together, the request path looks like this:

1. Client sends a request from the internet
2. External load balancer receives the connection
3. Load balancer forwards traffic to a worker node
4. Ingress controller pod evaluates the request at Layer 7
5. Ingress routes the request to a Kubernetes service
6. Service forwards the request to one of the backing pods

Each component operates at a **different layer** and solves a **different problem**.

---

## Why These Components Are Often Confused

Because the load balancer, ingress controller, and service all participate in the same request path, it is easy to assume they overlap in responsibility.

In reality:

- **Load balancer** → Node-level traffic distribution (Layer 4)
- **Ingress** → HTTP-level routing and policy (Layer 7)
- **Service** → Pod-level load balancing and abstraction

Once their boundaries are understood, the Kubernetes networking model becomes much clearer.

---

## Summary

The load balancer and ingress do **not** compete with each other — they **complement** each other.

- The load balancer gets traffic **into** the cluster
- The ingress decides **where** HTTP traffic should go
- Services ensure traffic reaches **healthy pods**, regardless of location

Understanding where each component sits removes most of the confusion around Kubernetes ingress architecture.
