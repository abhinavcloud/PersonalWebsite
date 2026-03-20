---
title: Drift-Aware Terraform CI/CD for AWS Three-Tier Architecture
date: 2026-03-20
readingTime: 8 min read
tags: [Terraform, GitHubActions, Cloud, AWS, Amazon Web Services]
subtitle: CI/CD pipeline with GitHub Actions for Terraform Infra of AWS Cloud
icon: 🏗️ ▶️
---


# Drift-Aware Terraform CI/CD for AWS Three-Tier Architecture
---

## How I Designed a Production Ready CI/CD pipeline with GitHub Actions for Terraform Infra of AWS Cloud
---

## Introduction

This post describes a Terraform-based CI/CD pipeline designed to deploy and manage an AWS three-tier architecture across multiple environments.

The focus is not just on automation, but on **control, consistency, and correctness of infrastructure state over time**.

Traditional pipelines optimize for speed. This design prioritizes **state awareness and deployment safety**, especially in the presence of infrastructure drift.

![GitHub Action Pipleine for Terraform Multi Environment Infa Structure](/images/terraform-githubactions2.png)

---

### Problem Statement

A typical Terraform pipeline follows this flow:

Code Change → terraform plan → terraform apply

This approach assumes:
- Terraform state accurately reflects real infrastructure
- No manual or external changes exist
- Plan output is reliable

In real-world systems, these assumptions often break due to:
- Manual changes in cloud consoles
- Emergency fixes applied directly in environments
- Partial or failed deployments
- State drift over time

Running `terraform apply` in such conditions can:
- Overwrite unintended changes
- Introduce unpredictable behavior
- Mask underlying issues

---

### Design Principles

The pipeline is built on the following principles:

- Always validate real infrastructure state before applying changes
- Treat drift as an incident, not a routine correction
- Enforce consistent deployments across environments
- Restrict direct access to higher environments
- Maintain full traceability of all actions

---

### Environment Strategy

#### Promotion Flow

Dev → Test → Staging → Production

#### Behavior

- **Dev**
  - Triggered via push to `master` (excluding other environment paths)
  - Also supports manual execution
  - Used for active development and validation

- **Test, Staging, Production**
  - Triggered via `workflow_run` from previous environment
  - Execute only on successful completion of prior stage
  - Use the same commit SHA for consistency

#### Outcome

- Identical infrastructure definitions across environments
- No hidden differences between stages
- Deterministic and reproducible deployments

---

### Pipeline Structure

Each environment pipeline consists of three stages:

- Drift Detection 
- Conditional Plan and Apply 
- State Verification 

These stages are implemented as reusable workflows.

---

### Drift Detection

#### Command Used

terraform plan -refresh-only -detailed-exitcode

#### Exit Code Handling

- 0 → No drift detected → proceed 
- 2 → Drift detected → block deployment and raise issue 
- 1 → Execution error → fail pipeline 

#### Behavior

When drift is detected:
- Deployment is stopped
- Drift details are captured as artifacts
- A GitHub issue is created automatically

#### Rationale

Drift indicates that infrastructure has diverged from its declared state. Automatically applying changes can overwrite critical modifications or hide operational issues. Blocking deployment ensures that drift is investigated before proceeding.

---

### Conditional Apply

Terraform apply is executed only when:
- Drift check returns no drift (exit code 0)
- Execution context is valid

#### Dev Environment Behavior

- Push events trigger only drift detection
- Apply requires manual execution (`workflow_dispatch`)

#### Outcome

- Infrastructure changes are always intentional
- Accidental modifications are prevented

---

### Promotion Mechanism

Higher environments are triggered using GitHub Actions `workflow_run`.

Each stage uses the commit SHA from the previous stage:

github.event.workflow_run.head_sha

#### Benefits

- Ensures identical code is deployed across environments
- Prevents introduction of new changes during promotion
- Simplifies debugging and traceability

---

### Reusable Workflow Design

Core operations are modularized into reusable workflows:

#### Drift Check
- Initializes Terraform
- Executes drift detection
- Publishes drift output
- Creates issue if drift exists

#### Plan and Apply
- Generates Terraform plan
- Publishes plan artifact
- Applies approved plan

#### State List
- Extracts current Terraform state
- Publishes state snapshot

#### Destroy
- Safely destroys infrastructure when required

#### Benefits

- Consistent execution across environments
- Reduced duplication
- Easier maintenance and extensibility

---

### Observability and Auditability

Each pipeline execution generates artifacts:

- drift-tfplan.md → Drift details 
- tfplan.txt → Planned changes 
- state-file.txt → Current state snapshot 

#### Additional Behavior

- Drift automatically creates a GitHub issue with full details

#### Outcome

- Complete audit trail of infrastructure changes
- Ability to analyze failures without rerunning pipelines

---

### Manual Operations

#### Manual Destroy

- Requires explicit confirmation ("DESTROY")
- Scoped to selected environment
- Captures state before execution

#### Manual State Inspection

- Allows safe inspection of infrastructure state
- Does not modify resources

#### Purpose

- Prevent accidental destructive operations
- Enable controlled debugging and validation

---

### Security Model

- Uses OIDC-based authentication with AWS
- Eliminates need for static credentials
- Access controlled via GitHub environments and secrets

### Benefits

- Short-lived credentials
- Reduced risk exposure
- Alignment with least privilege principles

---

### Environment Isolation

Each environment is isolated using:
- Separate backend configurations
- Environment-specific variables
- Independent state management

### Outcome

- Clear separation between environments
- Reduced risk of cross-environment impact

---

### Concurrency Control

Each environment defines its own concurrency group:

terraform-dev 
terraform-test 
terraform-staging 
terraform-production 

### Behavior

- Only one pipeline execution per environment at a time
- Prevents race conditions and state conflicts

---

### Key Design Decisions

#### Drift Blocking Instead of Auto-Fix

- Prevents silent overwrites
- Forces visibility into unexpected changes

#### Promotion-Based Deployment

- Ensures consistent infrastructure across environments
- Eliminates discrepancies caused by new commits

#### Controlled Entry Point

- Only Dev accepts direct changes
- Higher environments enforce strict promotion flow

#### Artifact-Driven Debugging

- Every execution produces artifacts
- Enables full traceability and analysis

---

#### Failure Handling

- Drift detected → Deployment blocked and issue created 
- Plan failure → Pipeline fails 
- Apply failure → Requires manual investigation 

---

### Summary

This pipeline is designed as a **controlled infrastructure delivery system** rather than simple automation.

It prioritizes:
- Correctness over speed 
- Visibility over convenience 
- Control over implicit behavior 

### Key Characteristics

- Drift-aware 
- Promotion-based 
- Immutable deployments 
- Fully auditable 
- Secure by design 

---

#### Closing Thought

Infrastructure issues are rarely caused by Terraform code alone.

They are typically the result of:
- Untracked changes 
- Lack of visibility 
- Uncontrolled deployment processes 

This pipeline is designed to eliminate those gaps by enforcing discipline and state awareness at every stage.