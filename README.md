# 🌐 Personal Portfolio & Technical Blog on AWS

This repository contains my **personal portfolio website and technical blog**, designed and built as a **fully static, cloud-native solution** using **AWS**, **GitHub Actions**, and **Terraform principles**.

The site is intentionally built **without frameworks or backend services**, focusing instead on:

* clean static architecture
* automation-first workflows
* infrastructure-aware design
* long-term maintainability

Live site: **[https://www.abhinav-cloud.com](https://www.abhinav-cloud.com)**

---

## 🧠 High-Level Architecture

```
GitHub Repo
   │
   │ (push)
   ▼
GitHub Actions
   │
   ├─ Generate index.html from template (secrets-driven)
   ├─ Generate blog metadata (posts.json)
   ├─ Sync static assets to S3
   └─ Invalidate CloudFront cache
        │
        ▼
AWS CloudFront
        │
        ▼
S3 Static Website Origin
```

### Key Characteristics

* **100% static hosting**
* **Zero runtime servers**
* **Immutable deployments**
* **Edge caching via CloudFront**
* **CI-driven content generation**

---

## 📁 Repository Structure

```
.
├── site/
│   ├── index.template.html   # Homepage template (variables replaced in CI)
│   ├── index.html            # Generated homepage (not committed)
│
│   ├── blog/
│   │   ├── index.html        # Blog listing shell
│   │   ├── post.html         # Blog post renderer
│   │   ├── posts/            # Markdown blog posts
│   │   │   └── *.md
│   │   └── posts.json        # Auto-generated blog index
│
│   ├── css/
│   │   ├── style.css
│   │   └── blog.css
│
│   ├── js/
│   │   ├── theme.js
│   │   └── blog.js
│
│   ├── images/
│   └── resume/
│
├── infra/                   # Terraform infrastructure code
│   ├── main.tf
│   ├── variables.tf
│   ├── outputs.tf
│   └── backend.hcl          # Local file ignored in git for secrets
│
├── .github/workflows/
│   ├── site-deploy.yml
│   └── infra-drift-aware.yml
│
├── README.md
└── LICENSE.txt
```

---

## 🏠 Homepage Design (index.template.html)

The homepage is built as a **template**, not a static file.

### Why a Template?

* Personal data should **not be hardcoded**
* Enables **secure secret injection**
* Allows reuse across environments
* Prevents accidental exposure of personal links

### How It Works

* `index.template.html` contains placeholders:

  ```html
  {{NAME}}, {{EMAIL}}, {{LINKEDIN}}, {{PROFILE_PIC}}, ...
  ```
* During deployment, GitHub Actions:

  * injects values from **GitHub Secrets**
  * generates a final `index.html`
  * syncs it to S3

### Result

* No secrets in git
* One-click personalization
* Deterministic builds

---

## ✍️ Blog System (Static but Dynamic)

The blog is implemented as a **static blog engine** powered by:

* Markdown files
* YAML front-matter
* CI-generated metadata
* Client-side rendering

### Goals

* Add a blog post by adding **one file**
* No manual HTML edits
* No heavy static-site generators
* No backend services

---

## 📝 Writing a Blog Post

To add a new post:

### 1️⃣ Create a Markdown file

```
site/blog/posts/my-new-post.md
```

### 2️⃣ Add YAML front-matter (required)

```md
---
title: Terraform + GitHub Actions Multi-Environment Pipeline
date: 2026-01-12
readingTime: 6 min read
subtitle: How I would design a Terraform CI/CD pipeline
tags:
  - Terraform
  - GitHubActions
icon: ⚡
---

## Introduction

Markdown content starts here...
```

That’s it. No other file needs editing.

---

## 🧩 Blog Rendering Flow

### Blog List (`blog/index.html`)

* Static shell only
* Loads `posts.json`
* Renders:

  * cards
  * tags
  * search
  * metadata

### Blog Post (`blog/post.html`)

* Reads `?post=slug`
* Fetches corresponding `.md`
* Strips YAML front-matter
* Renders Markdown using `marked.js`
* Highlights code using `Prism.js`

### Why This Approach?

* Keeps HTML tiny
* Keeps Markdown clean
* No server-side rendering
* Extremely fast via CDN

---

## ⚙️ Blog Index Generation (CI)

During deployment, GitHub Actions:

1. Reads all Markdown files
2. Parses YAML front-matter using `js-yaml`
3. Generates `posts.json`

Example output:

```json
{
  "slug": "terraform-githubactions1",
  "title": "Terraform + GitHub Actions Multi-Environment Pipeline",
  "date": "Jan 12, 2026",
  "readingTime": "6 min read",
  "subtitle": "How I would create a Terraform CI/CD pipeline",
  "tags": ["Terraform", "GitHubActions"],
  "icon": "⚡"
}
```

This makes the blog **fully automated**.

---

## 🚀 CI/CD Pipeline (site-deploy.yml)

### Trigger

```yaml
on:
  push:
    paths:
      - "site/**"
```

Only site changes trigger deployment.

---

### Pipeline Stages

#### 1️⃣ Checkout Code

```yaml
uses: actions/checkout@v4
```

#### 2️⃣ Configure AWS Credentials

Uses GitHub Secrets and IAM best practices.

#### 3️⃣ Generate Homepage

Uses `sed` to inject secrets into `index.template.html`.

#### 4️⃣ Generate Blog Index

* Installs `js-yaml`
* Parses Markdown front-matter
* Generates `posts.json`

#### 5️⃣ Sync to S3

```bash
aws s3 sync site/ s3://bucket --delete
```

Selective exclusions protect static assets.

#### 6️⃣ Invalidate CloudFront

Ensures users always receive the latest version.

---

## 🏗️ Terraform Infrastructure Workflow (infra-drift-aware.yml)

This repository uses **Terraform** for infrastructure provisioning and **GitHub Actions for drift-aware automation**.

### Key Concepts

* **Remote backend** (S3 + DynamoDB) for centralized state and locking
* **Drift detection** using `terraform plan -refresh-only`
* **PR-based manual gates** to accept or reject drift
* **Secrets-driven backend config** to avoid exposing S3/DynamoDB details in git

### Backend Security

* `backend.hcl` contains sensitive info (S3 bucket, DynamoDB table, region) and is **ignored in git**
* GitHub Actions passes backend info via **Secrets**:

```yaml
- backend-config="bucket=${{ secrets.TF_BACKEND_BUCKET }}"
- backend-config="key=${{ secrets.TF_BACKEND_KEY }}"
- backend-config="region=${{ secrets.TF_BACKEND_REGION }}"
- backend-config="use_lockfile=true"
```

### Terraform Variables Injection (Runtime)

**Variables domain_name and bucket_name are stored as GitHub Secrets:**

* DOMAIN_NAME
* BUCKET_NAME


They are injected into Terraform jobs at runtime using **TF_VAR_* environment variables.**

```
- name: Set Terraform Variables
  run: |
    echo "TF_VAR_bucket_name=${{ secrets.BUCKET_NAME }}" >> $GITHUB_ENV
    echo "TF_VAR_domain_name=${{ secrets.DOMAIN_NAME }}" >> $GITHUB_ENV
```

Placement: After terraform init but before terraform plan or terraform apply.

Terraform automatically reads these variables during execution, keeping secrets out of git.

### Workflow Summary

1. **Drift Detection**

   * Runs `terraform plan -refresh-only`
   * Uploads `drift.tfplan` artifact
   * Outputs `drift=true/false` to next jobs

2. **Human Decision Gate**

   * PR labels `accept-drift` / `reject-drift`
   * Validates decision before applying

3. **Accept Drift**

   * Applies refresh-only plan to update remote state from reality

4. **Reject Drift**

   * Applies Terraform code to restore reality to match code


### Initial Remote Backend Migration

**One-time manual step**:

```bash
terraform init -input=false -reconfigure -backend-config=backend.hcl
```

* Terraform will detect local state and ask to migrate
* Choose **Yes** to move state to S3 + DynamoDB
* After this, CI/CD workflow runs fully non-interactively

---

## ☁️ AWS Infrastructure (Conceptual)

* **S3**

  * Static website origin
  * Immutable deployments

* **CloudFront**

  * Global CDN
  * HTTPS
  * Cache invalidation on deploy

* **IAM**

  * Least-privilege credentials
  * CI-only access

---

## 🎨 Frontend Features

* Dark / Light mode toggle
* Responsive layout
* Markdown syntax highlighting
* Tag-based filtering
* Search
* CDN-optimized assets

---

## 🔐 Security & Best Practices

* No secrets committed to git
* Secrets injected at runtime
* CDN fronting origin
* Immutable static deployments
* No backend attack surface
* Terraform remote backend secrets kept out of repo
* CI/CD handles non-interactive init and drift safely

---

## 📈 Why This Design?

This project intentionally avoids:

* React / Next / Gatsby
* Heavy static-site generators
* Backend APIs

Instead, it demonstrates:

* deep understanding of **static architectures**
* **CI-driven content generation**
* **cloud-native thinking**
* pragmatic engineering trade-offs

---

## 🧭 Future Enhancements (Optional)

* RSS feed
* sitemap.xml
* SEO meta auto-generation
* Reading progress bar
* Pagination
* Content versioning

---

## 📜 License

MIT License — see `LICENSE.txt`

---

## 👤 Author

**Abhinav Kumar**
Solution Architect | Cloud & Platform Architecture
AWS · Kubernetes · Terraform · GitHub Actions

---

This README now fully documents:

* **Terraform infra workflow**
* **Remote backend setup and secrets handling**
* **Drift detection / PR gates**
* **CI/CD integration with static site generation**


