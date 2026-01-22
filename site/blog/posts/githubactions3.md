---
title: GitHub Actions Internals Explained 
subtitle: Failure Semantics, Matrix Expansion, and Reusable Workflows
date: 2026-01-22
readingTime: 5 min read
tags: [GitHubActions]
icon: 🧪
---

# GitHub Actions Internals Explained 

---

## Failure Semantics, Matrix Expansion, and Reusable Workflows

---

GitHub Actions is often described as “YAML-based CI/CD”. 
That description is misleading.

GitHub Actions is actually:
- A directed acyclic job graph
- With explicit evaluation phases
- And strict scoping rules

Most production pipeline issues come from misunderstanding when values are resolved, where data exists, and how failures propagate.

This post breaks down three commonly misunderstood areas:

1. continue-on-error 
2. Matrix strategies 
3. Reusable workflows (with a deep dive into inputs and outputs)

The focus is not syntax, but runtime behavior.

![GitHub Actions Internals Explained](/images/GItHubActions3.jpg)

---

### 1. continue-on-error: What Really Happens When Something Fails

#### The Common Mental Model (Incorrect)

Most engineers assume:

"continue-on-error makes a failing step pass."

That is not how GitHub Actions evaluates execution.

---

#### The Real Execution Model

Every step has three independent concepts:

1. Exit code – returned by the command 
2. Outcome – success or failure of execution 
3. Conclusion – how GitHub records the result for job control 

Example:

```yaml
- name: Static analysis
  run: exit 1
  continue-on-error: true
```

Runtime evaluation:

Property | Value
-------- | -----
Exit code | non-zero
Step outcome | failure
Step conclusion | success
Job stops | No
Next steps run | Yes

Outcome and conclusion are intentionally different.

---

#### Why This Design Exists

This allows pipelines to:
- Observe failures without aborting
- Run diagnostics and cleanup
- Apply conditional logic after a failure

---

#### if Conditions Still See the Failure

```yaml
- name: Tests
  run: npm test
  continue-on-error: true

- name: Upload reports
  if: failure()
  run: echo "Tests failed"
```

Even though the job continues:
- failure() evaluates to true 
- Because a step failed internally

---

#### Job-Level continue-on-error

```yaml
jobs:
  security-scan:
    continue-on-error: true
```

Effect:
- Job may fail internally
- Downstream jobs still run
- needs.security-scan.result == success

Use this deliberately. It hides failures from the dependency graph.

---

#### Key Rule

continue-on-error changes control flow, not truth.

---

### 2. Matrix Strategy: How Jobs Multiply

#### What a Matrix Actually Does

A matrix:
- Expands a single job definition into multiple independent jobs
- Each job gets its own matrix context
- Each job runs on a separate runner

---

#### Single Parameter Matrix

```yaml
strategy:
  matrix:
    node: [16, 18, 20]
```

Creates three parallel jobs.

---

#### Multi-Parameter Matrix (Cartesian Product)

```yaml
strategy:
  matrix:
    os: [ubuntu-latest, windows-latest]
    node: [18, 20]
```

Creates four jobs:

OS | Node
-- | ----
ubuntu | 18
ubuntu | 20
windows | 18
windows | 20

---

#### Excluding Combinations

```yaml
exclude:
  - os: windows-latest
    node: 20
```

Exclusions:
- Must match exactly
- Are applied after expansion

---

#### include: Adding Behavior, Not Just Rows

```yaml
include:
  - os: ubuntu-latest
    node: 18
    experimental: true
```

This:
- Creates an additional job
- Injects custom matrix variables
- Enables conditional logic

```yaml
if: matrix.experimental == true
```

---

#### Failure Behavior in Matrices

By default:
- One failure fails the workflow

```yaml
strategy:
  fail-fast: false
```

Now:
- All matrix jobs run to completion
- Failures are reported together

---

### 3. Reusable Workflows: True CI/CD Abstraction

Reusable workflows are not templates. 
They are callable workflows with strict contracts.

Think of them as functions, not includes.

---

### 4. Defining a Reusable Workflow

A workflow becomes reusable only if it declares workflow_call.

```yaml
on:
  workflow_call:
```

Without this, it cannot be invoked.

---

#### Defining Inputs (Contract Definition)

Inputs are defined only under workflow_call.

```yaml
on:
  workflow_call:
    inputs:
      environment:
        description: Target environment
        required: true
        type: string
      run-tests:
        required: false
        type: boolean
        default: true
```

Rules:
- Inputs are strongly typed
- Defaults apply only if the caller omits the input
- Inputs are immutable once resolved

---

### 5. Feeding Inputs from the Calling Workflow

Inputs are fed from the calling workflow job, using with.

```yaml
jobs:
  build:
    uses: ./.github/workflows/build-reusable.yml
    with:
      environment: prod
      run-tests: false
```

This is the only valid way to pass inputs.

---

#### Where Input Values Come From

Inputs can be sourced from:

Hardcoded values 
workflow_dispatch inputs 
Environment variables 
GitHub context 
Outputs of previous jobs 

Inputs are resolved before the reusable workflow starts.

---

#### Input Resolution Order

1. Calling workflow expressions are evaluated 
2. with values are resolved 
3. Defaults are applied if needed 
4. Inputs become read-only constants 

Inputs cannot be overridden or mutated.

---

### 6. Using Inputs Inside the Reusable Workflow

Inputs are accessed via the inputs context.

```yaml
- run: echo "Deploying to ${{ inputs.environment }}"
```

Inputs:
- Are available to all jobs and steps
- Are not environment variables by default

---

### 7. Inputs vs Secrets

Inputs:
- Passed via with
- Visible if echoed
- Not masked

Secrets:
- Passed via secrets
- Masked in logs
- Must be explicitly forwarded

```yaml
secrets: inherit
```

Never pass sensitive data as inputs.

---

### 8. Reusable Workflow Outputs

Outputs must be:
1. Produced by a job 
2. Explicitly exposed at workflow_call 

```yaml
on:
  workflow_call:
    outputs:
      image-tag:
        value: ${{ jobs.build.outputs.image-tag }}
```

---

### 9. Calling Workflow Perspective on Outputs

From the caller:

```yaml
needs.build.outputs.image-tag
```

You cannot reference:
- Internal jobs
- Internal steps
- Internal variables

Reusable workflows expose only what they choose.

---

### 10. The Correct Mental Model

- Steps produce outcomes 
- Jobs evaluate conclusions 
- Matrices multiply jobs 
- Reusable workflows expose contracts 

GitHub Actions is about execution semantics, not YAML.

---

### Final Thought

GitHub Actions rewards engineers who understand:
- Evaluation timing
- Data scope
- Contract boundaries

If you internalize this model, pipelines become predictable, scalable, and maintainable.