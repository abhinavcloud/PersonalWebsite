---
title: Managing Terraform Drift the Right Way
date: 2026-01-19
readingTime: 4 min read
tags: 
  - terraform
  - IaC
subtitle: "Detecting and managing Terraform drift by refreshing state"
icon: ⚡
---

Working with Terraform, I’ve often seen teams struggle with drift between the **code**, the **state**, and the **actual resources**.  

The state is what Terraform *believes* exists, but when resources are changed manually, reality can diverge. A normal `terraform apply` only compares the **state** with the **code**, so without refreshing, drift can go completely unnoticed.

![Managing Terraform Drift the Right Way](/images/terraform1.jpeg)

## Refreshing State First

The key is refreshing the state before making any decisions.

Running:

```bash
terraform plan -refresh-only
````

or

```bash
terraform apply -refresh-only
```

gives a true picture of what has changed **without modifying any resources**. Once you see the drift, you can either:

* Update your code to accept the changes, or
* Let Terraform reconcile the resources back to the desired state

## A Subtle but Costly Trap

There’s a subtle trap I’ve seen teams fall into:

If you detect drift, update the code to match it, **but don’t refresh the state before applying**, Terraform will still try to “update” the resource unnecessarily.

Why? Because Terraform compares the updated code with a **stale state**, not with reality.

This leads to:

* Unnecessary updates
* Confusing plans
* Reduced confidence in what Terraform is actually doing

## The Workflow That Works

The workflow I’ve settled on is simple but effective:

1. **Refresh the state** to capture reality
2. **Update the code** if needed
3. **Apply** the changes

It may feel like an extra step, but it:

* Keeps Terraform’s view accurate
* Prevents unnecessary updates
* Ensures infrastructure remains reliable

## Final Thoughts

Understanding the interplay between **state**, **code**, and **actual resources** has completely changed how I manage Terraform environments.

It’s a small step that makes a huge difference in avoiding surprises—and in maintaining confidence in your infrastructure.
