# Architecture Decision Records - Three‑Tier AWS Platform

This section captures the intentional architectural decisions made for the Three‑Tier AWS Platform. Each ADR records the context, decision, rationale, trade‑offs, and consequences to ensure long‑term clarity and repeatability.

---

## ADR‑001 — Strict Three‑Tier Architecture with Explicit Network Boundaries  

### Context
Prior platforms suffered from implicit trust boundaries, accidental internet
exposure, and unclear tier responsibilities. A predictable, reviewable baseline
architecture was required.

### Decision
Adopt a strict three‑tier model consisting of:
- Public ingress layer
- Web tier
- Private application tier  

Each tier communicates only with explicitly authorized adjacent layers.

### Rationale
Explicit tiering reduces cognitive load, strengthens security posture, and
simplifies security audits and incident analysis.

### Trade‑offs
- Slightly increased infrastructure complexity
- Additional configuration overhead

### Consequences
- Predictable traffic flow
- Reduced blast radius
- Improved long‑term maintainability

> **Design principle:**  
> If traffic reaches a tier, it is because the design explicitly allowed it.

---

## ADR‑002 — Use EC2 Instead of Managed Compute Services  

### Context
Managed compute services abstract networking and security boundaries, which
makes architectural reasoning, threat modeling, and auditing more difficult.

### Decision
Deploy workloads directly on Amazon EC2 instances rather than fully managed
compute abstractions.

### Rationale
Using EC2 enforces deliberate ownership of:
- Network design
- Identity boundaries
- Security controls  

This avoids hidden control planes that complicate reviews.

### Trade‑offs
- Higher operational overhead
- Manual responsibility for scaling and lifecycle management

### Consequences
- Improved clarity of system behavior
- Stronger architectural fundamentals
- Easier long‑term evolution

---

## ADR‑003 — Full Environment Isolation via Separate Terraform State  

### Context
Sharing Terraform state across environments increases blast radius and leads to
unpredictable behavior during deployments and recovery scenarios.

### Decision
Each environment must use an independent Terraform backend and lifecycle.

### Rationale
Environment isolation enforces safe experimentation and predictable deployments
without cross‑environment side effects.

### Consequences
- Cleaner promotion paths
- Safer rollbacks
- Clear ownership boundaries per environment

---

## ADR‑004 — S3 Access Restricted via VPC Gateway Endpoint  

### Decision
Application workloads access Amazon S3 exclusively through a VPC Gateway
Endpoint. No internet routing is permitted.

### Rationale
- Keeps data traffic internal to AWS
- Reduces attack surface
- Supports compliance and audit requirements

### Trade‑offs
- Increased complexity in IAM policies
- Additional endpoint policy management

---

## ADR‑005 — Promotion‑Based CI/CD with Immutable Commits  

### Decision
Use commit‑based promotion from Development to Production environments without
branch divergence.

### Rationale
This ensures:
- Infrastructure parity across environments
- Simplified rollback
- Easier debugging and traceability

---

## ADR‑006 — Infrastructure Drift Treated as an Incident  

### Decision
Terraform drift detection blocks deployments and requires explicit human
intervention.

### Rationale
Drift represents loss of certainty in system state and must be investigated,
not automatically corrected.

> **Principle:**  
> Drift represents uncertainty — not an automation opportunity.
