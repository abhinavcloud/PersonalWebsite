---
title: "Load Balancing in Kubernetes"
subtitle: "A Deep Dive"
author: "Abhinav Kumar"
date: "2026-03-23"
tags:
  - system-design
  - kubernetes
  - load-balancers
  - network-policies
  - ingress
  - auto-scaling
reading_time: "8 minutes"
---

# Load Balancing in Kubernetes

---
## A Deep Dive

Kubernetes networking is easy to simplify and harder to explain precisely in production. I worked through it by following a chain of practical questions. Each answer sharpened the model of **what does routing**, **what does load distribution**, and **what drives scaling**—and where each behavior actually happens in a Kubernetes setup.

![System Design Patterns](/images/ystemdesign3.png)

---

### What components map to Layer 4 vs Layer 7 in Kubernetes?

- **NetworkPolicy**: traffic control at **L3/L4** (IP/port/protocol) — security/segmentation (allow/deny), not traffic distribution.
- **Service**: stable virtual endpoint (VIP/DNS) + **L4 distribution** to pods (implemented by the cluster data plane).
- **Ingress / Gateway API**: Kubernetes objects that express **L7 routing intent** (hosts, paths, etc.) and must be fulfilled by a controller.
- **Ingress Controller / Gateway Controller (proxy runtime)**: the **actual L7 data plane** that terminates TLS, parses HTTP, applies routing rules, and can perform L7 balancing behaviors.

---

### What does NetworkPolicy do (and what doesn’t it do)?

NetworkPolicy is application-centric traffic control. It restricts which connections are allowed to/from selected pods at the IP/port level. It does **not** distribute traffic across replicas.

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-all
  namespace: app
spec:
  podSelector: {}
  policyTypes:
    - Ingress
    - Egress
```

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-frontend-to-backend
  namespace: app
spec:
  podSelector:
    matchLabels:
      app: backend
  policyTypes:
    - Ingress
  ingress:
    - from:
        - podSelector:
            matchLabels:
              app: frontend
      ports:
        - protocol: TCP
          port: 8080
```

---

### Where does Layer 4 load distribution happen in Kubernetes?

L4 distribution in Kubernetes is primarily provided via **Services** (`ClusterIP`, `NodePort`, `LoadBalancer`), which create a stable way to reach a set of pods.

When `type: LoadBalancer` is used (in a supported environment), Kubernetes can provision an **external load balancer** that provides an externally reachable IP and forwards traffic into the cluster.

```yaml
apiVersion: v1
kind: Service
metadata:
  name: web-lb
  namespace: app
spec:
  type: LoadBalancer
  selector:
    app: web
  ports:
    - name: http
      port: 80
      targetPort: 8080
```

**Operational mental model:**
- **External Load Balancer**: handles L4 distribution at the edge/outside the cluster boundary (cloud/provider dependent).
- **Kubernetes Service**: stable endpoint + internal L4 distribution toward pod endpoints.

---

### Ingress/Gateway do L7 routing—who performs “L7 load balancing” in practice?

Ingress (and Gateway API routes) define **routing intent**, but do not handle traffic by themselves. The runtime behavior comes from the **controller/proxy** (NGINX, HAProxy, Envoy, etc.) that fulfills those objects.

**Ingress**
```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: web-ingress
  namespace: app
spec:
  rules:
    - host: web.example.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: web-svc
                port:
                  number: 80
```

**GatewayClass (which controller implements this)**
```yaml
apiVersion: gateway.networking.k8s.io/v1
kind: GatewayClass
metadata:
  name: example-gwclass
spec:
  controllerName: example.com/gateway-controller
```

**Gateway (entrypoint + listeners)**
```yaml
apiVersion: gateway.networking.k8s.io/v1
kind: Gateway
metadata:
  name: public-gateway
  namespace: gateway-system
spec:
  gatewayClassName: example-gwclass
  listeners:
    - name: http
      protocol: HTTP
      port: 80
      allowedRoutes:
        namespaces:
          from: All
```

**HTTPRoute (routing rules to a Service backend)**
```yaml
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: web-route
  namespace: app
spec:
  parentRefs:
    - name: public-gateway
      namespace: gateway-system
  hostnames:
    - web.example.com
  rules:
    - matches:
        - path:
            type: PathPrefix
            value: /
      backendRefs:
        - name: web-svc
          port: 80
```

**Key takeaway:** Ingress/Gateway resources describe **routing intent**; the **controller/proxy runtime** fulfills those rules and provides the real L7 behavior (TLS termination, HTTP processing, request-level decisions).

---

### What does the end‑to‑end traffic path look like?


**Client → External L4 Load Balancer → L7 Proxy/Controller → Service → Pods**

- `Service type: LoadBalancer` often creates the external L4 entry point.
- The Ingress/Gateway controller is the L7 proxy doing TLS + HTTP behaviors.
- The Service routes/distributes traffic internally to pods.

---

### Why can HPA fail to protect the system during instantaneous spikes?

HPA is a **reactive control loop**. It periodically reads metrics and adjusts replica counts. That means there is unavoidable delay from:
- metrics collection/sampling
- control-loop reconciliation
- pod scheduling, startup, and warm‑up

So for sudden bursts, HPA alone may not scale fast enough to prevent saturation.

**HPA (autoscaling/v2) with behavior tuning**
```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: web-hpa
  namespace: app
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: web
  minReplicas: 6
  maxReplicas: 60
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
  behavior:
    scaleUp:
      stabilizationWindowSeconds: 0
      policies:
        - type: Percent
          value: 100
          periodSeconds: 60
        - type: Pods
          value: 10
          periodSeconds: 60
      selectPolicy: Max
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
        - type: Percent
          value: 10
          periodSeconds: 60
      selectPolicy: Min
```

---

### What prevents crashes while scaling catches up?

You need “shock absorbers” that buy time and reduce blast radius while the scaler reacts:

#### A) Baseline headroom (minReplicas + buffer)
Keep enough replicas running to handle predictable bursts without waiting for scale-out.

#### B) Edge protection (throttling / rate limiting / buffering)
Apply controls at the ingress/gateway proxy layer so extreme bursts don’t overload downstream pods.

#### C) Traffic gating (startup + readiness probes)
Ensure pods receive traffic only when they are ready; readiness is the mechanism that removes pods from Service backends.

**Startup + readiness probes (traffic gating)**
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web
  namespace: app
spec:
  replicas: 6
  selector:
    matchLabels:
      app: web
  template:
    metadata:
      labels:
        app: web
    spec:
      containers:
        - name: web
          image: ghcr.io/example/web:1.0.0
          ports:
            - containerPort: 8080
          startupProbe:
            httpGet:
              path: /startup
              port: 8080
            periodSeconds: 5
            failureThreshold: 24
          readinessProbe:
            httpGet:
              path: /ready
              port: 8080
            periodSeconds: 5
            timeoutSeconds: 2
            failureThreshold: 3
          livenessProbe:
            httpGet:
              path: /healthz
              port: 8080
            periodSeconds: 10
            timeoutSeconds: 2
            failureThreshold: 3
```

#### D) PodDisruptionBudget (protect availability during voluntary disruptions)
PDB ensures a minimum number of pods remain available during voluntary disruptions (e.g., drains/maintenance). This doesn’t solve spikes directly, but avoids sudden capacity drops during operations.

```yaml
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: web-pdb
  namespace: app
spec:
  minAvailable: 4
  selector:
    matchLabels:
      app: web
```

**Bottom line:** HPA helps with sustained load; spike resilience usually requires **baseline headroom + edge protection + readiness gating**.

---

### How do I scale based on requests per second (RPS)?

Capture request metrics where HTTP requests are visible (ingress proxy or app), store them in Prometheus, and then surface them to a scaler.

Two common patterns:

#### Option A: Prometheus → Prometheus Adapter → HPA (custom/external metrics)
- Ingress/app emits `requests_total`
- Prometheus scrapes it
- Adapter maps a PromQL query like `sum(rate(requests_total[1m]))`
- HPA scales based on that exposed metric

#### Option B: Prometheus → KEDA Prometheus scaler (often simpler operationally)
KEDA evaluates a PromQL query and scales the target workload based on a threshold.

**KEDA ScaledObject scaling on ingress RPS**
```yaml
apiVersion: keda.sh/v1alpha1
kind: ScaledObject
metadata:
  name: web-rps
  namespace: app
spec:
  scaleTargetRef:
    name: web
  minReplicaCount: 6
  maxReplicaCount: 60
  triggers:
    - type: prometheus
      metadata:
        serverAddress: http://prometheus-operated.monitoring.svc:9090
        metricName: ingress_rps
        query: |
          sum(rate(nginx_ingress_controller_requests_total{namespace="app", ingress="web-ingress"}[1m]))
        threshold: "200"
        activationThreshold: "20"
```

**Practical note:** Scaling on RPS improves sensitivity to real demand compared to CPU-only signals, but it’s still reactive—keep baseline capacity and edge protection for true bursts.

---

### Final mental model

- **NetworkPolicy**: L3/L4 access control (security).
- **Service**: stable endpoint + L4 distribution to pods.
- **Service type LoadBalancer**: external L4 entrypoint in supported environments.
- **Ingress/Gateway API**: routing intent (configuration).
- **Controller/Proxy**: actual L7 runtime behavior (TLS termination + L7 behaviors).
- **HPA/KEDA**: metrics-driven scaling control loops.
- **Spike resilience**: headroom + edge protection + readiness gating.
