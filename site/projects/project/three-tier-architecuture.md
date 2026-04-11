---
title: Multi Environment AWS Production Ready Architecture
subtitle: with Private, Public Instances, Load Balancers, VPC Endpoints and S3 bucket using Terraform 
date: 2026-01-14
readingTime: 4 min read
tags: [private, public, load-balancer, vpc-endpoints, s3]
icon: ▶️
---


# Designing a Disciplined Three‑Tier AWS Platform

---

## A Production‑Ready Architecture and Deployment Strategy

---

### Executive Summary

This document presents the architecture, deployment strategy, and operational model for a production‑ready Three‑Tier AWS platform provisioned using Terraform. While the application itself is intentionally simple, the system is designed to demonstrate **enterprise‑grade discipline** in environment isolation, network security, infrastructure drift management, and promotion‑based delivery.

This is not a showcase of tooling.  
It is a deliberate exercise in **architectural restraint and operational clarity**.

<a href="https://github.com/abhinavcloud/Three-Tier-AWS-Architecture-Terraform" target="_blank">Link to GitHub repository containing Three-Tier AWS Architecture Terraform implementation</a>

<a href="ADR.html?post=three-tier-arch-ADR">Link to Architecture Decision Records</a>

---

### Problem Statement (Why This Exists)

Over time, I’ve noticed a recurring issue across organizations: infrastructure complexity increases faster than infrastructure discipline.

Teams start with good intentions, but slowly:

*   environments bleed into each other
*   manual changes become normalized
*   drift goes unnoticed
*   pipelines become “push and pray”

I wanted to answer one core question honestly:

> *If the application is trivial, can the architecture still be excellent?*

This project exists to prove that **good architecture is not a function of scale**, but of intent.

---

### Architectural Goals

From the beginning, the following constraints were non‑negotiable:

*   Clear separation of public, web, and application layers
*   Zero internet exposure for private compute
*   No hidden or implicit data access paths
*   Environment isolation by default, not convention
*   Promotion‑based deployments with immutable artifacts
*   Drift is surfaced, not silently corrected

These goals shaped every technical decision that follows.

---

### High‑Level Architecture Overview

At a glance, this is a familiar three‑tier design. The difference lies in how strictly the boundaries are enforced.

![Three-tier AWS architecture diagram showing public load balancer layer connected to web tier EC2 instances in public subnets, which connect to application tier EC2 instances in private subnets, with private ALB controlling access. S3 bucket accessed through VPC endpoint. All components organized within VPC with explicit security group boundaries, emphasizing strict network isolation](/images/3tierarch.png)

---

### Architecture Call‑Out

**If a packet reaches a tier, it is because the design explicitly allowed it.**

There are no default routes, convenience rules, or “temporary” allowances.

---

### Why I Chose EC2 Over Managed Compute

I consciously chose **EC2** over ECS, EKS, or Lambda.

Not because managed services are inferior — but because abstractions hide mistakes.

This project required:

*   explicit security group reasoning
*   visible network flows
*   debuggable IAM boundaries

EC2 makes architectural intent harder to ignore.

#### Tradeoff Acknowledged

*   More operational overhead
*   Slower scalability

#### Tradeoff Accepted

*   Greater architectural clarity
*   Easier review, audit, and reasoning

---

### Network Design

The network is where most architecture systems quietly fail. I treated it as a first‑class concern.

#### Public Layer

*   Only the public ALB is internet‑facing
*   No EC2 instance accepts direct internet traffic
*   Security groups allow ingress only from known sources

#### Web Layer

*   Public subnet, limited role
*   Serves frontend assets
*   Forwards requests, does not own data

#### Application Layer

*   Fully private subnets
*   No egress to the internet
*   Access limited to the private ALB only

#### Architecture Call‑Out

**“Private subnet” actually means private here — no NAT hacks, no outbound internet.**

---

### Storage and S3 Access Strategy

One of the earliest and most intentional decisions was **how S3 is accessed**.

I explicitly avoided:

*   NAT Gateways
*   Public S3 endpoints
*   Open outbound rules

Instead, I introduced an **S3 Gateway VPC Endpoint** and enforced access through:

*   Endpoint policies
*   Bucket policies
*   Role‑based IAM permissions

#### Why This Matters

*   Data traffic never leaves AWS backbone
*   Prevents accidental data exfiltration paths
*   Strengthens the overall trust model

#### Tradeoff

*   More complex policy debugging
*   Slightly higher configuration overhead

This tradeoff is acceptable in any system expected to operate under audit or compliance pressure.

---

### Terraform Design and Repository Structure

Terraform was structured for **ownership clarity**, not speed.

Modules are organized by responsibility:

*   Network
*   Security
*   Compute
*   Ingress
*   Storage

Environments do not define resources.  
They compose pinned, versioned modules.

    modules/
     ├── network
     ├── security_groups
     ├── ingress
     ├── compute
     └── storage
    environments/
     ├── dev
     ├── test
     ├── staging
     └── production

#### Design Review Note

If a module becomes difficult to consume, that usually implies an architectural violation, not a Terraform problem.

---

### Environment Strategy and Isolation

Each environment:

*   has a dedicated remote state backend
*   owns its own variable files
*   pins explicit module versions
*   deploys independently

There is **no shared state** between environments.

This eliminates:

*   accidental cross‑environment impact
*   partial rollouts
*   silent dependency coupling

---

### CI/CD and Promotion Model

The pipeline enforces a strict promotion flow:

**Dev → Test → Staging → Production**

Only Dev allows direct triggers.  
All other environments are promoted using the **same commit SHA** via `workflow_run`.

#### Key Benefit

Infrastructure is immutable across environments.  
If it passes staging, prod receives the same artifact.

---

### Drift‑First Deployment Strategy

Before any apply:

    terraform plan -refresh-only -detailed-exitcode

Drift is treated as a **signal**, not something to auto‑fix.

*   Drift detected → deployment blocked
*   GitHub issue created
*   Human decision required

#### Design Review Call‑Out

Auto‑healing drift assumes intent. This system assumes uncertainty.

---

### Security and Access Model

*   AWS access via GitHub OIDC
*   No static credentials
*   Environment‑scoped IAM roles
*   Least‑privilege policies

Concurrency controls prevent overlapping runs per environment, protecting Terraform state integrity.

---

### Operational and Organizational Fit

This architecture is intentionally conservative.

It may feel slower in early stages, but it:

*   scales well across teams
*   simplifies audits
*   reduces surprise outages
*   encourages deliberate change

It aligns well with:

*   regulated environments
*   large engineering orgs
*   platform teams supporting multiple product teams

---





