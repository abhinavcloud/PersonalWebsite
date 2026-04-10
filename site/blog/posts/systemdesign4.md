---
title: "API Gateway vs Load Balancers"
date: "2026-03-24"
reading_time: "8 minutes"
tags:
  - software-architecture
  - distributed-systems
  - system-design
subtitle: "A Decision Matrix"
author: "Abhinav Kumar"

---
# API Gateway vs Load Balancers

---

## How I Approach API Routing, API Gateway, Load Balancing, and Scaling in Real-World Architectures

---

Designing scalable APIs in modern cloud-native environments is not just about writing code—it’s about making **architectural decisions** that balance **routing complexity, traffic management, API features, and scaling**.



In this blog, I present a **decision-tree approach** to determine the **right combination of API Gateway, load balancer, and backend scaling strategy** in real-world scenarios. This helps avoid **over-engineering**, ensures **high availability**, and optimizes **cost and performance**.

![System Design Patterns](/images/systemdesign4.png)


---



### Step 1: Identify API Feature Requirements



**Question:** Does this API require **authentication, rate limiting, caching, or advanced routing (header/cookie-based)?**



- **YES → Step 2 (API Gateway required)**  

- **NO → Step 4 (Path and weight-based routing only)**  



**Rationale:**  

API Gateway introduces latency and cost, so it should only be used if your API truly needs **management features** like:



- **Authentication:** JWT, OAuth2, API key-based access  

- **Rate limiting:** Protect the backend from spikes or abuse  

- **Caching:** Improve performance for repeated requests  

- **Header/Cookie-based routing or advanced canaries:** Direct traffic based on user session, headers, or versioning  



If none of these are required, using just a load balancer (ALB/NLB) keeps your architecture simpler and cheaper.



---



### Step 2: Determine Backend Type



Once you know whether you need API Gateway, ask:



> **What type of backend are you using?**



- **Serverless (Lambda)**  

- **EC2 instances**  

- **Kubernetes (EKS)**  



---



### Step 3a: Serverless (Lambda)



- **Decision:** **API Gateway → Lambda**  

- **Scaling:** Automatic (Lambda handles concurrency and pre-warming)  

- **Rationale:** Lambda cannot be called directly via HTTP without API Gateway. Advanced API features are handled naturally by API Gateway.  

- **Example:** A public authentication API on Lambda requiring JWT validation, rate limiting, and caching.  



> ✅ End of flow for serverless.



---



### Step 3b: EC2 Backend (Production-grade)



- **Decision:** **API Gateway → ALB → EC2**  

- **Rationale:**  

  - Multiple EC2 instances are required for reliability and HA.  

  - API Gateway alone **cannot load balance** across multiple instances.  

  - ALB provides **path-based and weight-based routing**, integrates with **auto-scaling**, and ensures traffic distribution.  

  - Direct API Gateway → single EC2 is technically possible but **not recommended** in production.  



- **Scaling:** Metric-driven via **HPA/KEDA or EC2 Auto Scaling**  

- **Example:** Internal payment service requiring JWT auth, rate limiting, and canary deployments.



---



### Step 3c: Kubernetes (EKS)



**Question:** Is routing **complex (header/cookie-based or advanced canary)?**



- **YES → API Gateway → NLB → NGINX/HAProxy GatewayClass → Pods**  

  - **NLB:** Handles L4 traffic and VPC integration  

  - **NGINX/HAProxy:** Handles L7 routing, header/cookie rules, weighted canaries  



- **NO → API Gateway → ALB → Pods**  

  - ALB is sufficient for path-based routing and weighted canaries  



**Scaling:** Metric-driven via **HPA + KEDA**, scraping custom metrics like RPS or queue depth.  

**Example:** Multi-tenant analytics API requiring **per-user routing** and advanced canary releases.



---



### Step 4: If API Features Are Not Required (Simple Routing Only)



If your API does **not need auth, rate limiting, caching, or complex routing**:



- **Serverless (Lambda):** API Gateway is still required for HTTP exposure  

- **EC2:** ALB → EC2 → metric-driven scaling via HPA/KEDA  

- **EKS:**  



  **Question:** Is routing complex?  



  - **YES → NLB → NGINX/HAProxy → Pods → HPA/KEDA**  

  - **NO → ALB → Pods → HPA/KEDA**  



**Rationale:** ALB or NLB handles simple routing efficiently, and scaling is metric-driven.



---



### Step 5: Scaling Strategy Summary



| Backend | Scaling Mechanism |
|---------|----------------|
| Lambda  | Auto-scaling; pre-warmed functions |
| EC2     | Metrics (RPS) → HPA/KEDA or Auto Scaling |
| EKS     | Metrics (RPS, queue depth) → HPA/KEDA on pods |



---



### Step 6: Load Balancer Choice



| Scenario | Recommended LB |
|----------|----------------|
| Simple path + weight routing | ALB |
| Complex routing inside Kubernetes | NLB + internal gateway (NGINX/HAProxy) |
| Serverless | API Gateway only |
| EC2 with API Gateway | ALB required (production-grade) |



---



### Step 7: Complete Yes/No Decision Tree

Does API need auth, rate limiting, caching, header/cookie routing?

    │
    |    
    |─ YES → Backend Type?
    |   |
    |   |── Serverless → API Gateway → Lambda → Scale Auto
    |   |
    |   │── EC2 → API Gateway → ALB → EC2 → Metric-driven Scaling
    |   |
    |   |─ EKS → Complex Routing?
    |        |─ YES → API Gateway → NLB → NGINX/HAProxy → Pods → HPA/KEDA
    |        |─ NO  → API Gateway → ALB → Pods → HPA/KEDA
    |
    │
    |
    |─ NO → Backend Type?
    |
    |─ Serverless → API Gateway → Lambda → Scale Auto
    |
    |─ EC2 → ALB → EC2 → Metric-driven Scaling
    |
    |─ EKS → Complex Routing?
        |
        |─ YES → NLB → NGINX/HAProxy → Pods → HPA/KEDA
        |
        |─ NO  → ALB → Pods → HPA/KEDA

---
### Key Takeaways



1. **API Gateway** is only necessary if advanced API features are required.  

2. **Lambda always needs API Gateway** for HTTP exposure.  

3. **ALB is sufficient** for simple path + weight routing.  

4. **NLB + internal gateway** is required only for complex routing in Kubernetes.  

5. **EC2 in production** with API Gateway **always uses ALB** for HA and scaling.  

6. **Scaling is backend-dependent**: Lambda auto-scales; EC2/EKS scale via metrics + HPA/KEDA.  

7. This model provides a **clear yes/no framework** for **production-ready API architectures**.  



*This decision-tree approach ensures you pick the **right architecture** without over-engineering, while handling **routing, load balancing, and scaling** effectively.*



