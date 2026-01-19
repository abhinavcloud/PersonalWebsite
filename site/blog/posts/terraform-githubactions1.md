---
title: Terraform + GitHub Actions Multi-Environment Pipeline
date: 2026-01-12
readingTime: 6 min read
tags: [Terraform, GitHubActions]
subtitle: How I would create a Terraform CI/CD pipeline with GitHub Actions
icon: ⚡
---


# Terraform + GitHub Actions Multi-Environment Pipeline
---
### How I would create a Terraform CI/CD pipeline with GitHub Actions
---
I spent the last few days designing a Terraform and GitHub Actions pipeline for managing multi-environment infrastructure. Sharing the final approach with real technical examples.

---

![GitHub Action Pipleine for Terraform Multi Environment Infa Structure](/images/terraform-githubactions1.jpeg)

## 📁 Repo Structure

```
/modules
/dev
/prod
```

---

## ⚡ Core Decisions and Reasoning

---

### Single Main Branch

No separate dev or prod branches. This avoids merge conflicts and environment drift.

---

### Environment Isolation Using Folders and Workflows

Each environment has its own workflow triggered by path filters.

**Dev workflow trigger example:**

```yaml
on:
  push:
    paths:
      - "dev/**"
      - "modules/**"
```

---

### Secrets and Credentials

No `tfvars` committed to the repo. All secrets live in GitHub Environments. Each job explicitly declares the environment.

```yaml
environment: dev
```

Terraform variables are injected using `TF_VAR_*` and AWS credentials are provided as environment variables:

```bash
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
AWS_REGION
```

The AWS provider automatically picks these up at runtime. No profiles or hardcoded values.

---

### Terraform Backend

Remote S3 backend is configured via `backend.hcl` and initialized like this:

```bash
terraform init -backend-config=backend.hcl -migrate-state
```

---

### Dev is Fully Automated

Any change in `dev` or `modules` runs:

```bash
terraform plan -refresh=true
terraform apply -refresh=true -auto-approve
```

This gives fast feedback and safe iteration.

---

### Prod is Controlled

Prod runs only via `workflow_dispatch`. Plan and apply are clearly separated:

```bash
terraform plan -refresh=true -out=plan.tfplan
terraform apply -refresh=true plan.tfplan
```

---

### Module Promotion

Modules are merged once, validated automatically in dev, and reused in prod with a different state and secret scope. No cherry picking or rebasing.

---

## ✅ Result

- Clear environment isolation  
- Strong security boundaries  
- Predictable promotion flow  
- Minimal operational overhead  
- Easy to extend to more environments  

**Summary:** Automate where it is safe. Control where it matters.