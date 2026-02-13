---
title: Building a Production-Grade CI/CD Pipeline
subtitle: Reusable Multi Stage Workflows, Custom Actions
date: 2026-02-13
readingTime: 5 min read
tags: [GitHubActions]
icon: ▶️
---

# Building a Production-Grade CI/CD Pipeline with GitHub Actions and AWS S3

---
## A Deep Dive into Multi-Stage Workflows, Reusable Deployments, and Custom GitHub Actions

---


Modern software development isn’t just about writing code — it’s about **automating everything around it**.

In this blog post, we’ll walk through building a **complete CI/CD pipeline** that:

- Lints code
- Runs automated tests
- Builds production artifacts
- Uploads and shares artifacts across jobs
- Uses a reusable workflow
- Deploys to **Amazon S3**
- Publishes a live static website URL

This isn’t just deployment automation. This is **real-world DevOps engineering**.

Repo Link: [GitHub Actions Learning Repo](https://github.com/abhinavcloud/GiHub-Actions-Learning-Repo)

---

### High-Level Architecture

Here’s the full CI/CD flow:

Push to main branch -> Lint -> Test -> Build -> Reusable Deploy Workflow ->Upload to AWS S3 ->   
Print Static Website URL  

We implement **strict quality gates**, modular workflows, reusable components, and secure cloud authentication.

![GitHub Actions Reusable Workflows](/images/GitHubActions6.png)

---

### Triggering the Pipeline

The workflow is triggered on:

```yaml
on:
  push:
    branches:
      - main
      
```

This teaches us:

- How to scope deployments to specific branches
- How to support environment-like branching strategies
- How to isolate production and test flows

---

### Stage 1: Lint — Enforcing Code Quality

The first job in the pipeline is **linting**.

#### Why Lint First?

Fail fast.  
If the code doesn’t meet quality standards, we stop immediately.

#### What Happens?

- Print a job-level secret **(ENV_OWNER)**
- Checkout code
- Restore cached dependencies
- Run **npm run lint**

#### Concepts Learned

- Job-level secrets
- Using **actions/checkout**
- Local composite actions
- Dependency caching via hashFiles('**/package-lock.json')
- Build optimization strategies

Caching **~/.npm** dramatically reduces CI time and cost.

---

### Stage 2: Test — Quality Gate Enforcement

The **test** job depends on **lint**:

```yaml
needs: lint
```

This ensures we only test clean code.

#### What Happens?

- Checkout repository
- Install dependencies
- Run npm run test
- Upload test.json if tests fail

#### Conditional Artifact Upload

```yaml
if: failure() && steps.test-code-step.outcome == 'failure'
```

This ensures:

- Test reports are uploaded only when needed
- We save storage space
- We improve debugging workflows

#### Concepts Learned

- Job dependencies (needs)
- Conditional execution
- Step IDs
- Artifact uploading
- Failure-aware pipelines

---

### Stage 3: Build — Producing Production Assets

The build job runs after test.

```yaml
if: always() && (failure() || needs.test.result == 'success')
```

This advanced condition means:

- Build runs even if test fails (useful for debugging)
- But still respects job dependency structure

#### What Happens?

- Checkout
- Restore cache
- Run npm run build
- Upload dist/* as `ist-files

```yaml
if-no-files-found: error
```

This guarantees:

- Build failures are not silently ignored
- Production artifacts always exist

#### Concepts Learned

- Artifact persistence
- Advanced conditionals
- Debug-friendly pipelines
- Production asset validation

---

### Stage 4: Reusable Deployment Workflow

Instead of placing deployment logic directly in the main workflow, we use:

```yaml
uses: ./.github/workflows/reusable_workflow.yml
```

This leverages reusable workflows.

#### Why Reusable Workflows?

- DRY principle
- Cleaner architecture
- Shareable deployment logic
- Easier maintenance
- Enterprise scalability

#### Inputs Passed

- Cache path
- Cache key
- Artifact name
- Artifact path
- AWS region
- S3 bucket

#### Secrets

```yaml
secrets: inherit
```

Securely passes:

- AWS_ACCESS_KEY_ID
- AWS_SECRET_ACCESS_KEY

No hardcoded credentials. Ever.

---

### Reusable Workflow: Deployment to AWS

The reusable workflow is triggered via:

```yaml
on:
  workflow_call:
```

It:

- Accepts inputs
- Exposes outputs
- Runs deployment steps
- Returns the static website URL

---

### AWS Authentication

We configure credentials using:

```yaml
uses: aws-actions/configure-aws-credentials@v4
```

This enables:

- AWS CLI access
- S3 commands
- Infrastructure operations

Secure authentication is one of the most critical DevOps skills.

---

### Building a Custom JavaScript GitHub Action

Instead of writing aws s3 sync directly in YAML, we created a **custom Node.js GitHub Action**.

#### Why?

- Encapsulation
- Reusability
- Clean workflow files
- Professional DevOps design

---

#### action.yml

```yaml
runs:
  using: node20
  main: dist/index.js
```

This tells GitHub:

- Use Node 20 runtime
- Execute compiled JavaScript

---

#### main.js

```javascript
const core = require('@actions/core');
const exec = require('@actions/exec');

async function run() {
  try {
    const bucket = core.getInput('bucket', { required: true });
    const region = core.getInput('region', { required: true });
    const dist_folder = core.getInput('dist_folder', { required: true });

    const s3url = `s3://${bucket}`;

    await exec.exec(
      `aws s3 sync ${dist_folder} ${s3url} --region ${region}`
    );

    core.notice('S3 sync completed successfully');
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
```

#### What This Teaches

- Writing JavaScript-based GitHub Actions
- Using @actions/core
- Using @actions/exec
- Programmatically executing shell commands
- Error handling with core.setFailed()
- Creating reusable DevOps tooling

This is how professional-grade CI/CD tooling is built.

---

### Deploying to Amazon S3 Static Hosting

Deployment target:

http://<bucket>.s3-website.ap-south-1.amazonaws.com

S3 acts as:

- Object storage
- Static web hosting service
- Highly scalable distribution layer

#### Why S3?

- Virtually unlimited scalability
- Extremely cost-effective
- High durability (11 9’s)
- Perfect for static websites

---

### Cross-Workflow Outputs

Reusable workflow exposes:

```yaml
outputs:
  site-url:
```

Main workflow prints:

```yaml
${{needs.deploy.outputs.site-url}}
```

This teaches:

- Workflow outputs
- Cross-job communication
- Pipeline orchestration patterns
- Enterprise-level CI design

---

### Advanced DevOps Concepts Demonstrated

| Capability | Implemented |
|------------|-------------|
| Multi-job workflow | ✅ |
| Job dependencies | ✅ |
| Conditional logic | ✅ |
| Artifact sharing | ✅ |
| Secret inheritance | ✅ |
| Reusable workflows | ✅ |
| Custom GitHub Actions | ✅ |
| Cloud deployment | ✅ |
| Output propagation | ✅ |

This is not beginner-level CI.

This is production-ready automation.

---

### Why This Architecture Matters

This pipeline mirrors what platforms like:

- Vercel  
- Netlify  
- AWS Amplify  
  

This gives:

- Full control
- Full transparency
- Full customization
- Real DevOps experience

---

### End-to-End Flow Summary

- Developer pushes code  
- Lint validates code quality  
- Tests verify correctness  
- Build generates production bundle  
- Artifacts are uploaded  
- Reusable workflow is triggered  
- AWS credentials are configured  
- Custom JS action syncs files to S3  
- Static site becomes publicly accessible  
- URL is printed automatically  

Fully automated.  
Fully reproducible.  
Fully scalable.  

---

### Possible Enhancements

To elevate this pipeline even further:

- Add CloudFront CDN  
- Add automatic cache invalidation  
- Add environment-based deployments  
- Integrate Terraform  
- Add Slack/Teams notifications  
- Implement PR preview deployments  
- Add Infrastructure as Code  

---

### Final Thoughts

This project demonstrates the **complete DevOps lifecycle**:

From:

```
git push
```

To:

```
Live production website
```

By building this system, you learn:

- CI/CD fundamentals  
- Workflow orchestration  
- Reusable automation patterns  
- Custom GitHub Action development  
- Secure AWS deployments  
- Artifact management  
- Advanced conditional execution  

This is not just automation.

This is real-world DevOps engineering.

And now — you can build it yourself.
