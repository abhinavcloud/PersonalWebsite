---
title: Kubernetes Autoscaling Beyond CPU-Based HPA
date: 2026-01-15
readingTime: 7 min read
tags: [Kubernetes, Autoscaling, HPA, Prometheus, ServiceMesh]
subtitle: Designing load-aware autoscaling using request and concurrency metrics
icon: 🚀
---

# Kubernetes Autoscaling: Moving Beyond CPU-Based HPA

### Designing load-aware autoscaling using request and concurrency metrics

## Problem

Horizontal Pod Autoscaler (HPA) is most commonly configured using **CPU utilization**.

In production systems, CPU-based scaling often results in:

- Scaling decisions made **after** user traffic has already increased
- **Latency spikes** during sudden load changes
- No mitigation for **pod startup and readiness delays**

CPU utilization increases **only after requests are processed**, making it a **lagging signal** for autoscaling.

Lowering CPU thresholds improves reaction time but:

- Increases cost and node pressure
- Still does **not** address cold start behavior

---
![Kubernetes Autoscaling Beyond CPU-Based HPA](/images/kubernetes1.jpeg)


## High-Level Direction

Autoscaling should react to **service load**, not **resource exhaustion**.

More effective signals include:

- **Requests per second per pod**
- **In-flight (concurrent) requests per pod**

These metrics change **immediately** as traffic arrives, enabling earlier scaling decisions compared to CPU-based triggers.

---

## Metric Placement

Load should be measured at the **service boundary**, not at the node level.

Node-level metrics aggregate multiple workloads and are therefore unsuitable for **service-specific autoscaling**.

### Practical Sources of Load Metrics

- Application-level HTTP metrics
- Service mesh sidecar metrics (for example, **Envoy**)

Sidecar proxies observe **all inbound traffic** and expose:

- Request rate
- Concurrency
- Latency

This is achieved **without application code changes**.

---

## Metric Flow to HPA

The autoscaling control path is as follows:

1. Sidecar proxy records request and concurrency metrics at the **pod level**
2. Prometheus scrapes metrics from pod endpoints
3. Prometheus Adapter converts PromQL queries into **Kubernetes custom metrics**
4. HPA periodically pulls these metrics and recalculates desired replicas

> Metrics are **pulled** by HPA; they are **not pushed**.

---

## Cold Start Considerations

Even with accurate load-based metrics, autoscaling has **inherent latency**:

- Pod scheduling
- Image pull and container startup
- Application initialization
- Readiness probe delay

During this window, **existing pods must absorb the increased load**.

Autoscaling reacts to load — it does **not** eliminate cold start gaps.

---

## Practical Scaling Model

A production-grade autoscaling setup typically includes:

- Load-based metrics as the **primary scaling signal**
- CPU utilization as a **secondary safety guardrail**
- Minimum replica counts sized to absorb short traffic spikes
- Cluster Autoscaler alignment to avoid **pending pods**

---

## Summary

CPU-based HPA is **not incorrect**, but it is **incomplete**.

More reliable autoscaling is achieved when:

- Scaling reacts to **incoming traffic**, not CPU saturation
- Metrics are collected at the **pod or service boundary**
- Cold start behavior is explicitly addressed through **warm capacity**
