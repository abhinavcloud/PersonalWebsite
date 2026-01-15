# Personal Portfolio & Blog Website on AWS 🚀

This repository contains my **personal portfolio and technical blog website**, hosted on **AWS using S3 + CloudFront** and **fully automated using GitHub Actions and Terraform**.

⚠️ **No manual AWS CLI actions are required.**  
All infrastructure provisioning and website deployments are handled via **CI/CD workflows**.

---

## 🌐 Features

- Static portfolio website
- Technical blog with individual posts
- Resume download (PDF hosted on S3)
- Dark theme UI
- Responsive design
- Global CDN via CloudFront
- Infrastructure as Code (Terraform)
- Fully automated deployments via GitHub Actions

---

## 🧱 Architecture Overview

```

User
│
▼
CloudFront (HTTPS + CDN)
│
▼
S3 Bucket (Static Website)

```

---

## 📂 Repository Structure

```

MY_WEBSITE/
├── infra/                     # Terraform infrastructure
│   ├── acm.tf
│   ├── cloudfront.tf
│   ├── s3.tf
│   ├── providers.tf
│   ├── variables.tf
│   └── outputs.tf
│   
│
├── site/                      # Static website source
│   ├── index.html
│   ├── blog/
│   │   ├── index.html
│   │   ├── post.html
│   │   └── posts/
│   ├── css/
│   │   ├── style.css
│   │   └── blog.css
│   ├── js/
│   │   ├── blog.js
│   │   └── theme.js
│   ├── images/
│   └── resume/
│       └── resume.pdf
│
├── .github/
│   └── workflows/
│       ├── infra-deploy.yml
│       └── site-deploy.yml
│
├── README.md
├── LICENSE.txt
└── .gitignore

## 🛠️ Tech Stack

### Frontend
- HTML5
- CSS3
- JavaScript (Vanilla)

### AWS
- Amazon S3
- Amazon CloudFront
- AWS Certificate Manager (ACM)

### Automation
- Terraform
- GitHub Actions

---

## 🔁 CI/CD Workflow Design

### 1️⃣ Infrastructure Deployment Workflow

**Trigger:**  
Runs automatically when changes are pushed to:

```

infra/**

```

**Responsibilities:**
- Terraform init
- Terraform plan
- Terraform apply
- Provision or update:
  - S3 bucket
  - CloudFront distribution
  - ACM certificate
  - Related AWS resources

**Workflow file:**
```

.github/workflows/infra-deploy.yml

```

---

### 2️⃣ Website Deployment Workflow

**Trigger:**  
Runs automatically when changes are pushed to:

```

site/**

```

**Responsibilities:**
- Sync static website files to S3
- Upload resume and assets
- Invalidate CloudFront cache

**Workflow file:**
```

.github/workflows/site-deploy.yml

```

---

## 📄 Resume Download

The resume is stored inside the website bundle:

```

site/resume/resume.pdf

````

Linked in the homepage as:

```html
<a href="resume/resume.pdf" target="_blank" download>
  Download Resume (PDF)
</a>
````

---

## 🔐 Secrets & Permissions

The workflows use **GitHub Secrets** for AWS authentication:

Required secrets:

* `AWS_ACCESS_KEY_ID`
* `AWS_SECRET_ACCESS_KEY`
* `AWS_REGION`

IAM permissions follow **least privilege**:

* Terraform workflow → infra resources only
* Site workflow → S3 + CloudFront invalidation

---

## ✍️ Adding Content

### Add / Update Website Content

* Modify files under `site/`
* Push changes
* Site workflow deploys automatically

### Add / Update Infrastructure

* Modify files under `infra/`
* Push changes
* Infra workflow applies Terraform automatically

---

## 📌 Future Improvements

* Remote Terraform state (S3 + DynamoDB)
* Terraform plan approval step
* Multi-environment support (dev/prod)
* CI validation (HTML/CSS linting)
* Automated blog index generation

---

## 👤 Author

**Abhinav Kumar**
Solution Architect | Cloud & DevOps

* 🌐 Website: [https://abhinav-cloud.com](https://abhinav-cloud.com)
* 💼 LinkedIn: [https://www.linkedin.com/in/abhinavkumar1](https://www.linkedin.com/in/abhinavkumar1)
* 🧑‍💻 GitHub: [https://github.com/abhinavcloud](https://github.com/abhinavcloud)

## 📜 License

This project is licensed under the **MIT License**.
---

⭐ If you find this project useful, consider starring the repository!!

