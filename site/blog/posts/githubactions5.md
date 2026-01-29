---
title: GitHub Actions as Layered Architecture
subtitle: Reusable Workflows, Composite Actions
date: 2026-01-29
readingTime: 5 min read
tags: [GitHubActions]
icon: ▶️
---

# GitHub Actions as Layered Architecture:
---

## A Real Story of Reusable Workflows, Composite Actions, and Why I Chose Strict Inputs

---

I went into a GitHub Action workflow refactor thinking I was just cleaning up some GitHub Actions YAML.

I came out realizing that GitHub Actions is **not configuration glue** — it’s a **layered abstraction system** with strict boundaries, silent failure modes, and real architectural trade-offs.

This post is the story of:
- what I built initially
- what I *assumed* GitHub Actions was doing
- why that assumption was wrong
- the options I considered
- and why I deliberately chose **strict required inputs** over defaults

If you’re using:
- reusable workflows
- custom composite actions
- or both together

this will save you hours of confusion.

![GitHub Actions Reusable Workflows](/images/GitHubActions5.png)

---

### The Initial Setup

I had three layers:

workflow1.yml
   ↓
reusable_workflow.yml
   ↓
custom composite action

---

### The main workflow (workflow1.yml)
```yaml
    jobs:
      build:
        uses: ./.github/workflows/reusable_workflow.yml
        with:
          path: ~/.npm
          key: node-modules-${{ hashFiles('**/package-lock.json') }}
```

This workflow clearly passes `path` and `key`.

At this point, I *believed* these values would ultimately control caching behavior.

---

### The reusable workflow (reusable_workflow.yml)
```yaml
    on:
      workflow_call:
        inputs:
          path:
            required: true
          key:
            required: true

    jobs:
      cache:
        runs-on: ubuntu-latest
        steps:
          - uses: ./.github/actions/cache-install-deps
            with:
              path: ${{ inputs.path }}
              key:  ${{ inputs.key }}
```
Inputs are defined. 
Inputs are forwarded.

Everything *looked* correct.

---

### The custom composite action (action.yml)

This is where the problem started.
```yaml
    runs:
      using: composite
      steps:
        - uses: actions/cache@v3
          with:
            path: ~/.npm
            key: node-modules-${{ hashFiles('**/package-lock.json') }}
```

There is **no inputs: block**. 
The values are **hardcoded**.

---

### The Wrong Assumption

I assumed:

> “The reusable workflow will somehow inject its inputs into the composite action.”

I believed GitHub Actions would:
- inspect the **with:** block
- override internal values
- or at least warn me if something was wrong

**None of that happens.**

---

### What Was Actually Happening (The Reality)

Here is the *real* execution flow:

    workflow1.yml
      └─ passes inputs
           ↓
    reusable_workflow.yml
      └─ forwards inputs
           ↓
    composite action
      └─ ignores everything
      └─ uses hardcoded values

---
### The brutal truth

**Every input I passed from workflow1.yml was silently ignored.**

GitHub Actions:
- does NOT validate **with:** against action inputs
- does NOT warn
- does NOT fail

It simply drops the values.

This is a **configuration illusion** — the most dangerous kind of bug.

---

### The Core Realization

At this point, I understood something critical:

**Reusable workflows do not “take inputs from” composite actions. 
Inputs only flow downward, and only if explicitly consumed.**

There is:
- no inheritance
- no auto-wiring
- no implicit defaults

Each layer is a **hard boundary**.

---

### The Options I Considered


####  Option 1: Keep everything hardcoded

- Remove inputs from reusable workflow
- Accept fixed behavior
- Stop pretending it’s configurable

This works — but it’s dishonest.



#### Option 2: Composite action inputs with defaults

This is a common recommendation:

```yaml
    inputs:
      path:
        default: ~/.npm
      key:
        default: node-modules-${{ hashFiles('**/package-lock.json') }}

```

Tempting — but I rejected it.

Why?

Because **defaults hide intent**.

---

### The Final Decision: Strict Required Inputs

I chose to make inputs **required** in the composite action and pass them **everywhere it is used**.

### Composite action (action.yml)
```yaml
    inputs:
      path:
        required: true
      key:
        required: true

    runs:
      using: composite
      steps:
        - uses: actions/cache@v3
          with:
            path: ${{ inputs.path }}
            key:  ${{ inputs.key }}
```

Now:
- missing inputs → immediate failure
- no silent behavior
- no guessing

---

### Reusable workflow (pass-through contract)

```yaml
    on:
      workflow_call:
        inputs:
          path:
            required: true
          key:
            required: true

    jobs:
      cache:
        runs-on: ubuntu-latest
        steps:
          - uses: ./.github/actions/cache-install-deps
            with:
              path: ${{ inputs.path }}
              key:  ${{ inputs.key }}
```
---

### Direct usage elsewhere (explicit)
```yaml
    - uses: ./.github/actions/cache-install-deps
      with:
        path: ~/.npm
        key: node-modules-${{ hashFiles('**/package-lock.json') }}
```
Every caller is honest. 
Every value is explicit. 
Nothing is assumed.

---

### Why I Rejected Defaults (This Matters)

Defaults seem convenient — but they introduce **implicit behavior**.

Here’s why I rejected them deliberately:

- **Defaults hide configuration mistakes: ** 
   A missing input silently falls back instead of failing.

- **Caching is infrastructure, not a convenience: ** 
   Cache keys are **strategy**, not decoration.

- **Explicit > magical: ** 
   I want readers to *see* what controls behavior.

- **Fail fast beats silent success: **
   CI should scream when something is wrong.

- **If a value matters, it should be required.**

---

### The Mental Model That Finally Clicked

Once I stopped thinking of this as YAML and started thinking in architecture, everything made sense.

| Layer | Role |
|------|------|
| workflow1.yml | Application |
| Reusable workflow |  Facade |
| Composite action | Implementation |

Rules:
- inputs flow **down**
- nothing bubbles **up**
- no layer guesses for another

---

### Internal Guideline (What I’d Share with My Team)


1. Reusable workflows own the public contract 
2. Composite actions must explicitly declare all inputs 
3. If an input affects behavior, make it required 
4. Never pass **with:** values into actions that don’t declare inputs 
5. Prefer failing fast over hidden defaults 

This prevents 90% of CI confusion.

---

### Final Takeaway

I started by refactoring workflows.

I ended up learning that GitHub Actions enforces **real abstraction boundaries**, whether you notice them or not.

The moment you treat:
- reusable workflows as APIs
- composite actions as libraries

the system stops being confusing — and starts being predictable.

And honestly?

That’s a very good trade.