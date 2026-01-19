---
title: GitHub Actions with Event Fiters and Action Types
subtitle: How GitHub Actions Triggers Actually Work
date: 2026-01-14
readingTime: 4 min read
tags: [GitHubActions]
icon: ⚡
---

# How GitHub Actions Triggers Actually Work

---
### How GitHub Actions Triggers Actually Work
---
GitHub Actions is **event-driven**.  
A workflow runs **only when an event occurs** and the workflow configuration allows it.

Most confusion comes from mixing up **events**, **event types**, and **filters**.

![GitHub Actions](/images/githubactions1.jpeg)


---

## 1. Events

An **event** is something that happens in a repository, such as:

- `push`
- `pull_request`
- `issues`
- `release`

### Example

```yaml
on: push
````

This runs on **every push**, with **no restrictions**.

---

## 2. Event Types

Some events have **sub-actions** (event types), such as:

* `opened`
* `closed`
* `synchronize`
* `labeled`

### Example

```yaml
on:
  issues:
    types: [opened, closed]
```

If an event occurs but its **type is not listed**, the workflow **does not run**.

> Event types control **when a workflow is allowed to start**.

---

## 3. Filters

Filters restrict **where** or **how** an event applies.

### Example

```yaml
on:
  push:
    branches: [main]
```

This runs **only** on pushes to `main`.

> Filters **never enable** workflows — they only **exclude** cases.

---

## 4. How They Combine

A workflow runs **only if all conditions match**:

* ✅ the event occurs
* ✅ the event type matches (if defined)
* ✅ the filters match (if defined)

If **any condition fails**, **nothing runs**.

### Example

```yaml
name: Issue Label Validation

on:
  issues:
    types:
      - opened
      - labeled
    # Filter: only run if the issue has this label
    labels:
      - bug

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - name: Run validation
        run: echo "Issue opened or labeled with 'bug'"
```

---

## 5. Filters vs `if`

* **Filters** decide **whether a workflow starts**
* **`if` conditions** decide whether **jobs or steps run after it starts**

---

## Conclusion

GitHub Actions is **strict and deterministic**.

Most trigger issues come from:

* Over-filtering
* Misunderstanding event timing
* Confusing filters with `if` conditions


