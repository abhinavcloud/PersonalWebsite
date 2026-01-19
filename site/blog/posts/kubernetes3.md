---
title: Building Kubernetes the Real Way (Without Managed Services)
date: 2026-01-15
readingTime: 4 min read
tags: [Kubernetes, kubeadm, containerd, Networking, Labs]
subtitle: Building a reproducible Kubernetes cluster from scratch using Multipass and kubeadm
icon: 🧪
---

# Building a Kubernetes Cluster the “Real” Way (Without Managed Services)

---

## Building a reproducible Kubernetes cluster from scratch using Multipass and kubeadm

---

### Introduction

I recently built and published a small **Kubernetes lab** on GitHub that focuses on doing things the *“real” way* — without managed services or lightweight abstractions such as **Minikube**.

The goal was to create a **simple, repeatable setup** that demonstrates how a Kubernetes cluster is actually **bootstrapped from scratch**.

![Bootstrapping Kubernetes the Real Way (Without Managed Services)](/images/kubernetes3.jpeg)

---

### Design Goals

The lab was designed with a few clear objectives:

- Avoid managed Kubernetes services
- Avoid local abstractions like Minikube or kind
- Make the setup **fully reproducible**
- Keep the process **non-interactive and observable**

This approach forces a deeper understanding of what Kubernetes needs to run and why each step exists.

---

### What the Lab Does

Using a **single automation script**, the lab performs the following steps end to end:

 1. Provisions **two Multipass virtual machines**
 2. Prepares the VMs for Kubernetes prerequisites
 3. Installs **containerd** as the container runtime
 4. Installs required **Kubernetes components**
 5. Initializes the control plane using **kubeadm**
 6. Automatically joins a worker node to the cluster
 7. Sets up **Flannel** for pod networking
 8. Configures **kubectl access** on the host machine

The entire flow is **scripted**, **logged**, and **non-interactive**.

---

### Why This Approach

Automating the full lifecycle of a Kubernetes cluster forces you to understand:

- System prerequisites
- Correct ordering of setup steps
- Control plane initialization
- Node bootstrapping mechanics
- Networking requirements

Because nothing is abstracted away, each failure mode is visible and explainable.

---

### Use Cases

This lab is particularly useful for:

- Learning Kubernetes internals
- Hands-on experimentation
- Technical demos
- Interview preparation
- Understanding kubeadm-based cluster bootstrapping

The simplicity makes it easy to reason about, modify, and extend.

---

### Source Code

The project is available on GitHub:

👉 **https://github.com/abhinavcloud/Setting-Up-Kubernetes-From-scratch-in-Linux-Based-Machine-using-Multipass**

---

### Closing Thoughts

If you want to understand Kubernetes beyond managed services and local wrappers, building a cluster yourself is one of the most effective ways to do it.

This lab is intentionally minimal — focused on clarity, correctness, and learning.
