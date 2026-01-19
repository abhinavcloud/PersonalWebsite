---
title: GitHub Actions Deep Dive
subtitle: A Complete CI/CD Workflow Explained End-to-End
date: 2026-01-19
readingTime: 8 min read
tags: [GitHubActions]
icon: ⚡
---


# GitHub Actions Deep Dive
---
## A Complete CI/CD Workflow Explained End-to-End
---

GitHub Actions is often introduced using small, isolated examples—checking out code, running a build, or deploying an application. While these examples are useful, they rarely demonstrate how **real-world CI/CD pipelines** are designed.

This article explains **GitHub Actions in its entirety** using **one production-grade workflow**. Instead of fragmented snippets, we will analyze a **single complete pipeline** and extract **every core GitHub Actions concept** from it.

By the end of this article, you will understand not only *how* GitHub Actions works, but *why* it is designed the way it is.

---

## Mental Model of GitHub Actions

Before diving into YAML, it is essential to understand the execution hierarchy:

```

Event → Workflow → Jobs → Steps → Actions / Commands

````

Key principles:

- Workflows are **event-driven**
- Jobs run on **isolated runners**
- Jobs do **not share files**
- Artifacts are used to **share files**
- Outputs are used to **share values**
- `if` conditions control **execution flow**
- Secrets and variables are **scoped**

This workflow intentionally demonstrates **all of these concepts**.

---

## Complete Reference Workflow 

The following workflow is the **canonical reference** for this article. All explanations below refer to this file. This is a sample workflow example which lints, test, build and deploy an application.

```yaml
name: Trigger workflow on push event on main, project2 and dummy branches

on:
  push:
    branches:
      - main
      - project2
      - dummy

jobs:
  lint:
    runs-on: ubuntu-latest
    env:
      ENV_OWNER: ${{ secrets.ENV_OWNER_NAME }}

    steps:
      - name: Print job level secret
        run: echo $ENV_OWNER

      - name: Checkout the code
        uses: actions/checkout@v3

      - name: Setup node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Caching Dependencies
        uses: actions/cache@v3
        with:
          path: ~/.npm
          key: node-module-dependencies-${{ hashFiles('**/package-lock.json') }}

      - name: Install dependencies
        run: npm ci

      - name: lint
        run: npm run lint

  test:
    runs-on: ubuntu-latest
    needs: lint

    steps:
      - name: Print step level secret
        env:
          STEP_NAME: ${{ secrets.STEP }}
        run: echo $STEP_NAME

      - name: Checkout the code
        uses: actions/checkout@v3

      - name: Setup node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Caching Dependencies
        uses: actions/cache@v3
        with:
          path: ~/.npm
          key: node-module-dependencies-${{ hashFiles('**/package-lock.json') }}

      - name: Install dependencies
        run: npm ci

      - name: Test code
        id: test-code-step
        run: npm run test

      - name: upload test reports to workflow
        if: failure() && steps.test-code-step.outcome == 'failure'
        uses: actions/upload-artifact@v4
        with:
          name: test-report
          path: test.json

  build:
    runs-on: ubuntu-latest
    needs: test
    if: always() && needs.test.result == 'failure'

    outputs:
      script-file: ${{ steps.publish-js-filenames.outputs.js-file }}

    steps:
      - name: Checkout the code
        uses: actions/checkout@v3

      - name: Setup node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Caching Dependencies
        uses: actions/cache@v3
        with:
          path: ~/.npm
          key: node-module-dependencies-${{ hashFiles('**/package-lock.json') }}

      - name: Install dependencies
        run: npm ci

      - name: build the code
        run: npm run build

      - name: upload build artifacts
        uses: actions/upload-artifact@v4
        with:
          name: build-files
          path: dist
          if-no-files-found: ignore

      - name: Publish JS filenames
        id: publish-js-filenames
        run: |
          find dist/assets/*.js -type f -execdir echo 'js-file={}' >> $GITHUB_OUTPUT ';'

  deploy:
    runs-on: ubuntu-latest
    needs: build
    if: always() && needs.build.result == 'success'
    environment: dummy

    env:
      BRANCH: ${{ secrets.ENVIRONMENT_SECRET }}
      OWNER: ${{ vars.NAME }}
      MSG: ${{ vars.MESSAGE }}

    steps:
      - name: Checkout the code
        uses: actions/checkout@v3

      - name: Setup node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Caching Dependencies
        uses: actions/cache@v3
        with:
          path: ~/.npm
          key: node-module-dependencies-${{ hashFiles('**/package-lock.json') }}

      - name: Install dependencies
        run: npm ci

      - name: Download Build Artifacts
        uses: actions/download-artifact@v4
        with:
          name: build-files
          path: dist

      - name: Check artifact contents
        run: ls dist > dist_file_contents.txt

      - name: Upload artifact content list
        uses: actions/upload-artifact@v4
        with:
          name: dist_file_contents
          path: dist_file_contents.txt

      - name: Use build job output
        run: echo "${{ needs.build.outputs.script-file }}" > JS_FILE.txt

      - name: Upload build output artifact
        uses: actions/upload-artifact@v4
        with:
          name: build_JS_Filenames
          path: JS_FILE.txt

      - name: Deploy code
        run: echo "Deploying (simulated)..."

      - name: Environment validation
        run: echo "Deploying"
````

---

## Workflow Triggers and Event Filters

```yaml
on:
  push:
    branches:
      - main
      - project2
      - dummy
```

This workflow is triggered by a **push event**, but only when the push occurs on specific branches.

### Why event filters matter

Without filters:

* Every branch triggers CI
* Experimental work consumes CI minutes
* Deployments become unsafe

Event filters enable:

* Branch-based workflows
* Environment isolation
* Controlled releases

---

## Jobs and Runners

Each job defines its execution environment:

```yaml
runs-on: ubuntu-latest
```

Key characteristics:

| Property    | Description                        |
| ----------- | ---------------------------------- |
| Isolation   | Each job runs on a fresh VM        |
| Persistence | Runner is destroyed after job      |
| Sharing     | No filesystem sharing between jobs |

This isolation is the reason artifacts and outputs exist.

---

## Job Dependencies with `needs`

```yaml
needs: lint
```

`needs` enforces execution order and enables data access.

Capabilities unlocked by `needs`:

* Sequential execution
* Access to job results
* Access to job outputs

Execution graph:

```
lint → test → build → deploy
```

---

## Job-Level `if` Conditions

### Build Job Condition

```yaml
if: always() && needs.test.result == 'failure'
```

This condition controls whether the **entire job** executes.

| Expression          | Meaning                                  |
| ------------------- | ---------------------------------------- |
| `always()`          | Evaluate job even if dependencies failed |
| `needs.test.result` | Final result of `test` job               |
| `== 'failure'`      | Run only if test failed                  |

### Why `always()` is required

If a dependent job fails, GitHub skips downstream jobs **unless `always()` is used**.

Rule:

> Any job that depends on a failed job must include `always()` to be evaluated.

---

## Step-Level `if` Conditions

```yaml
if: failure() && steps.test-code-step.outcome == 'failure'
```

This condition controls **individual step execution**.

| Function             | Purpose                            |
| -------------------- | ---------------------------------- |
| `failure()`          | Checks if any previous step failed |
| `steps.<id>.outcome` | Checks a specific step result      |

This pattern is ideal for:

* Uploading failure logs
* Running diagnostics
* Avoiding noise on success

---

## Environment Variables and Secrets

### Job-Level Environment Variables

```yaml
env:
  ENV_OWNER: ${{ secrets.ENV_OWNER_NAME }}
```

Scope: All steps in the job
Not accessible by other jobs.

---

### Step-Level Environment Variables

```yaml
env:
  STEP_NAME: ${{ secrets.STEP }}
```

Scope: Single step only.

---

### Environment-Scoped Secrets

```yaml
environment: dummy
```

This enables:

* Environment-specific secrets
* Environment-specific variables
* Branch protection and approvals

Deployment only succeeds when the workflow runs on a branch mapped to the environment.

---

## Dependency Caching

```yaml
uses: actions/cache@v3
```

Cache configuration:

| Field  | Purpose        |
| ------ | -------------- |
| `path` | Files to cache |
| `key`  | Cache identity |

Using `hashFiles('package-lock.json')` ensures:

* Cache invalidation on dependency change
* No stale dependencies

---

## Artifacts: Sharing Files Between Jobs

### Upload

```yaml
uses: actions/upload-artifact@v4
```

### Download

```yaml
uses: actions/download-artifact@v4
```

Artifacts:

* Are zipped and stored in GitHub
* Persist across jobs
* Must be explicitly downloaded
* Are the **only way to share files across runners**

---

## Outputs: Sharing Values Between Jobs

### Setting Step Output

```bash
echo "js-file=value" >> $GITHUB_OUTPUT
```

### Exposing Job Output

```yaml
outputs:
  script-file: ${{ steps.publish-js-filenames.outputs.js-file }}
```

### Using Output in Another Job

```yaml
${{ needs.build.outputs.script-file }}
```

Comparison:

| Feature  | Artifacts    | Outputs       |
| -------- | ------------ | ------------- |
| Type     | Files        | Values        |
| Storage  | GitHub zip   | Metadata      |
| Use case | Build assets | IDs, versions |

---

## Deployment Gating

```yaml
if: always() && needs.build.result == 'success'
```

Deployment is gated by:

* Successful build
* Explicit evaluation
* Environment-level controls

This pattern prevents:

* Accidental deployments
* Partial failures reaching production

---

## Final Takeaways

This single workflow demonstrates:

* Event filtering
* Job orchestration
* Job and step conditions
* Failure-aware pipelines
* Caching strategies
* Artifact handling
* Output propagation
* Secret scoping
* Environment-based deployments

Understanding this workflow means you understand **GitHub Actions as a system**, not just YAML syntax.


