# Architecture Decision Records (ADRs) for Three‑Tier AWS Platform

---

## ADR‑001: Adopt a Strict Three‑Tier Architecture with Explicit Network Boundaries

### Context

The platform requires a secure, auditable, and easily explainable application architecture suitable for multi‑environment enterprise deployment. Prior architectures observed in the organization suffered from implicit trust boundaries, accidental exposure, and unclear tier responsibilities.

The application workload itself is intentionally simple, allowing architectural decisions to be evaluated without complexity masking design weaknesses.

### Decision

Implement a **strict three‑tier architecture** consisting of:

*   Public ingress tier (Internet → Public ALB)
*   Web tier (public subnet EC2)
*   Application tier (private subnet EC2)

Each tier must:

*   Have a clearly defined responsibility
*   Be isolated by security groups
*   Communicate only with explicitly approved upstream or downstream components

No component outside the Public ALB is allowed direct internet access.

### Rationale

A strict three‑tier model:

*   Reduces cognitive load during design and review
*   Makes security boundaries explicit
*   Simplifies audit, threat modeling, and troubleshooting
*   Prevents accidental lateral movement

The design intentionally avoids “soft” isolation based on conventions or naming.

### Tradeoffs

*   Slightly higher infrastructure complexity
*   More configuration overhead than flat network designs

### Consequences

*   Improves security posture and predictability
*   Enables consistent reasoning across environments
*   Simplifies future scaling and evolution

---

## ADR‑002: Use EC2 Instead of Managed Compute (ECS/EKS/Lambda)

### Context

Managed compute services provide convenience but abstract away networking, security, and identity boundaries. This project prioritizes architectural clarity and explicit control over operational convenience.

### Decision

Deploy application workloads on **Amazon EC2 instances**, rather than ECS, EKS, or Lambda.

### Rationale

EC2:

*   Makes network paths visible and debuggable
*   Forces explicit security group design
*   Avoids hidden service control planes
*   Simplifies architecture reviews and incident analysis

This approach prioritizes architectural fundamentals over platform abstraction.

### Tradeoffs

*   Higher operational responsibility
*   Manual scaling management
*   Slower adoption of cloud‑native automation

### Consequences

*   Improved visibility and understanding of system behavior
*   Reduced architectural ambiguity
*   Stronger baseline for future managed‑service adoption, if desired

---

## ADR‑003: Enforce Full Environment Isolation with Separate Terraform State

### Context

Shared infrastructure state across environments leads to:

*   Accidental cross‑environment changes
*   Deployment ordering issues
*   Increased blast radius

Previous systems relied on conventions rather than enforcement.

### Decision

Each environment (Dev, Test, Staging, Production) will:

*   Use a dedicated Terraform backend
*   Maintain independent variable definitions
*   Pin exact module versions
*   Deploy independently

No Terraform state is shared across environments.

### Rationale

State isolation:

*   Enforces environment independence
*   Prevents unintended side effects
*   Aligns with least‑blast‑radius principles
*   Enables safe experimentation in lower environments

### Tradeoffs

*   Increased repository size
*   Some configuration duplication

### Consequences

*   Strong separation of concerns
*   Predictable deployments
*   Easier rollback and recovery

---

## ADR‑004: Restrict S3 Access via VPC Gateway Endpoint Only

### Context

Allowing private workloads outbound internet access introduces:

*   Unnecessary attack surface
*   Compliance challenges
*   Risk of data exfiltration

### Decision

All access from the application tier to Amazon S3 must occur exclusively via an **S3 Gateway VPC Endpoint**.

No NAT Gateway or public S3 endpoint access is permitted.

### Rationale

Using a VPC endpoint:

*   Keeps all data traffic within AWS backbone
*   Eliminates dependency on internet routing
*   Enables strict endpoint and bucket policy enforcement

This aligns with enterprise security and compliance requirements.

### Tradeoffs

*   More complex IAM and endpoint policy configuration
*   Increased debugging effort during initial setup

### Consequences

*   Stronger security posture
*   Improved auditability
*   Reduced external exposure risk

---

## ADR‑005: Use Promotion‑Based CI/CD with Immutable Artifacts

### Context

Branch‑per‑environment deployment strategies introduce divergence and inconsistency across environments, making failures difficult to reproduce.

### Decision

Implement a **promotion‑based deployment model**:

*   Dev is triggered by code changes
*   Test, Staging, and Production are promoted via pipeline triggers
*   The same commit SHA is used across all environments

### Rationale

Promotion‑based delivery:

*   Guarantees environment parity
*   Simplifies debugging and rollback
*   Eliminates configuration drift caused by branch divergence

### Tradeoffs

*   Slower deployments compared to independent environment triggers
*   Less flexibility for ad‑hoc changes in higher environments

### Consequences

*   Improved reliability of releases
*   Stronger alignment with change management practices
*   Predictable delivery flow

---

## ADR‑006: Treat Infrastructure Drift as an Incident, Not an Auto‑Fix

### Context

Automated reconciliation of infrastructure drift assumes intent and can overwrite legitimate manual changes or emergency fixes without review.

### Decision

Every deployment must begin with:

    terraform plan -refresh-only -detailed-exitcode

If drift is detected:

*   Deployment is blocked
*   A GitHub issue is automatically created
*   No auto‑apply occurs

### Rationale

Drift indicates uncertainty, not failure.
Human review is required to determine the correct state.

This decision prioritizes correctness over speed.

### Tradeoffs

*   Slower incident recovery
*   Increased manual involvement

### Consequences

*   Eliminates silent configuration divergence
*   Improves infrastructure governance
*   Strengthens operational accountability

***

## ADR‑007: Use OIDC‑Based Authentication for CI/CD Access to AWS

**Status**: ✅ Approved  
**Date**: 2026‑04‑10

### Context

Static credentials in CI/CD pipelines increase secret sprawl and compromise risk.

### Decision

Authenticate CI/CD pipelines to AWS using **OIDC with environment‑scoped IAM roles**.

No long‑lived credentials are stored.

### Rationale

OIDC:

*   Eliminates secret rotation overhead
*   Reduces credential exposure risk
*   Enables fine‑grained, environment‑specific access control

### Tradeoffs

*   Initial IAM role setup complexity
*   Requires familiarity with identity federation

### Consequences

*   Improved security posture
*   Simplified credential management
*   Better compliance alignment


