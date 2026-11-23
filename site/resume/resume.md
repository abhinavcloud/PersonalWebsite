---
name: Abhinav Kumar
title: Solution Architect | AWS Cloud Architecture | AI/LLM Platforms | Distributed Systems
location: Noida, India
phone: "+91 7875757010"
email: [abhinavkumar1987@yahoo.com, abhinav01061987@gmail.com]
linkedin: https://linkedin.com/in/abhinavkumar1
github: https://github.com/abhinavcloud
website: https://abhinav-cloud.com
---

## Architect Profile

Solution Architect with 15+ years of experience designing, governing, and modernizing large-scale AWS-based enterprise platforms.

Own architecture decisions across application, integration, cloud, AI, and platform domains, delivering scalable, resilient, secure, and high-performing solutions through cloud-native, microservices, and event-driven architectures.

Led architecture initiatives supporting 310M+ subscribers and millions of billing transactions across mission-critical enterprise platforms.

Experienced in Generative AI (GenAI), Agentic AI, Retrieval-Augmented Generation (RAG), AI agent orchestration, multi-agent architectures, and enterprise AI governance using Amazon Bedrock and Bedrock AgentCore.

Focused on building secure, scalable, cost-efficient, and responsible AI-enabled platforms aligned with enterprise architecture standards.

## Skills

- **Architecture & Leadership:** Solution Architecture, Technical Strategy, Design Reviews, Technology Evaluation, Stakeholder Management
- **AWS & Cloud:** AWS Architecture, Serverless Architecture, Cloud-Native Design, Infrastructure as Code, Platform Engineering, CI/CD Architecture
- **Distributed Systems:** Microservices, Event-Driven Architecture, API Architecture, Integration Architecture, Domain Decomposition, Asynchronous Processing
- **Generative AI & Agentic Systems:** Generative AI (GenAI), Retrieval-Augmented Generation (RAG), Agentic AI, AI Agent Architecture, Multi-Agent Architectures, Agent Orchestration, Graph Workflows, Agent Swarms, Context Engineering, Conversation Management, Session Management, Memory Persistence, Agents as Tools, MCP (Model Context Protocol), Tool Use (Function Calling), Agent Evaluation, Agent Steering, Cloud-Deployed Agents
- **Non-Functional Architecture:** Scalability, High Availability, Resiliency, Fault Tolerance, Performance Engineering, Cost Optimization

## Technical Stack

- **AWS:** EC2, S3, Lambda, Aurora, RDS, ElastiCache, CloudFront, VPC, API Gateway, IAM, CloudWatch, SNS, SQS, EventBridge, Step Functions, RDS Proxy, EKS, ECS, Cognito, Secrets Manager, Systems Manager, AWS Budgets, Cost Explorer, Route 53, KMS, CloudFormation, CloudTrail
- **AI / GenAI:** Amazon Bedrock, Bedrock AgentCore, Knowledge Bases, Guardrails, Inference Profiles, Embedding Models, S3 Vectors (Vector Database), RAG, Agentic AI, AI Agents, Tool Use (Function Calling), MCP (Model Context Protocol), Context Engineering, Conversation Management, Session Management, Memory Management, Agent Orchestration, Multi-Agent Systems, Graph Workflows, Agent Swarms, Agent Evaluation, AWS Strands Agents
- **Containers:** Kubernetes, Docker
- **Infrastructure as Code:** Terraform
- **CI/CD:** GitHub Actions

## Open-Source Contributions

- Reported and helped scope a multi-agent session persistence gap in the AWS Strands Agents SDK. The Strands team opened [feature request #4105](https://github.com/strands-agents/harness-sdk/issues/4105) to track it.

## Professional Experience

### Senior Technical Architect (Cloud & AI) – EXL (October 2026 – Present)

- Lead AWS solution architecture for a UK energy and gas client.
- Lead solution design, high-level design, and implementation on Amazon Bedrock AgentCore for back-office dispute resolution, complaints handling, and ticketing.
- Designed and implemented an end-to-end agent harness with multi-agent orchestration, AgentCore Identity, AgentCore Memory, RAG, and observability through model telemetry and model invocation logs.
- Lead a team of 10+ DevOps engineers, solution architects, and platform engineers.

### Solution Architect – Telstra Global Services (March 2024 – October 2026)

- Governed large-scale AWS compute, networking, and database platforms with auditability through CloudWatch, CloudTrail, IAM, and AWS Config.
- Defined cloud-native target architectures using CloudFormation, Terraform, and API, security, and observability patterns to improve scalability and resilience.
- Architected event-driven, multi-AZ systems using SNS, SQS, EventBridge, Step Functions, and RDS Proxy to improve availability and reduce cascading failures.
- Led microservices modernization using Kubernetes, Docker, API Gateway, and Cognito, enabling domain-driven decomposition of high-volume telecom workloads.
- Established TMF-aligned API standards with rate limiting, fault tolerance, distributed tracing, and structured logging.
- Performed architecture reviews and risk assessments using AWS audit signals, IAM analysis, and VPC networking evaluations.

### Solution Architect – CRM Platforms – Netcracker Technology (December 2022 – March 2024)

- Architected large-scale CRM and Telecom BSS platforms supporting high-volume customer operations and transaction workloads across multiple integrated systems.
- Defined service boundaries, domain ownership models, and integration architecture to improve scalability, maintainability, and independent deployment.

### Earlier Professional Experience (2011–2022)

- Solution Architect – Amdocs (January 2022 – November 2022)
- Subject Matter Expert – Amdocs (March 2015 – December 2021)
- Quality Analyst – Netcracker (January 2014 – February 2015)
- Test Engineer – Tech Mahindra (January 2011 – December 2013)

## Portfolio Projects

### Personal Profile and Scheduling Assistant

[GitHub repository](https://github.com/abhinavcloud/personal-assistant)

- Designed and built the agent harness on Amazon Bedrock AgentCore Runtime and Strands Agents. The main agent routes requests to a specialist profile agent and structured workflows for email and scheduling. Added context summarization and a separate steering model to check selected answers against retrieved GitHub content.
- Implemented Google federation through Amazon Cognito, OAuth 2.0 with PKCE, and JWT validation. Used the authenticated user ID to scope state and the verified email to populate Reply-To and meeting attendee details in backend code.
- Integrated AgentCore Memory to store semantic facts per user and conversation summaries per user and session, allowing returning users to resume conversations without resending chat history.
- Built an IAM-authorized MCP Gateway exposing 18 tools across five Python Lambda functions.
- Signed runtime-to-gateway calls with AWS SigV4 and used DynamoDB conditional writes and deterministic event IDs to prevent duplicate Amazon SES sends and Google Calendar bookings on retries.
- Codified the AWS backend in nine Terraform modules covering runtime, gateway, memory, Cognito, IAM, Lambda, DynamoDB, SES, and Secrets Manager. Packaged the runtime as a Linux ARM64 container for Amazon ECR and stored Google Calendar OAuth credentials in Secrets Manager.
- Identified a session persistence limitation in the Strands multi-agent Swarm and proposed an architecture for multi-turn context persistence in [feature request #4105](https://github.com/strands-agents/harness-sdk/issues/4105).

### Online Ticketing System

[GitHub repository](https://github.com/abhinavcloud/Online_Ticketing_System)

- Designed and implemented a Terraform-driven AWS ticketing platform with modular networking, database, caching, compute, authentication, API Gateway, and notification layers, private VPC connectivity, and service-to-service IAM.
- Built a serverless booking architecture using API Gateway, Lambda, Cognito, Aurora PostgreSQL Serverless v2, RDS Proxy, ElastiCache Serverless (Valkey), KMS, and SNS.
- Designed a high-contention booking flow with queue-based admission control, cache-backed seat locking, and all-or-nothing multi-seat reservations to prevent partial allocations and overselling under concurrency.
- Implemented Cognito authentication with Google OAuth and protected booking APIs with API Gateway authorizers while keeping browsing APIs public.

## Certifications

[Credly credentials](https://www.credly.com/users/abhinav-kumar.9c24f238/badges/credly)

- **Cloud:** AWS Solutions Architect – Associate, AWS Developer – Associate, AWS SysOps Administrator – Associate
- **Infrastructure as Code:** HashiCorp Terraform Associate
- **Microservices and Container Orchestration:** Certified Kubernetes Administrator (CKA), Kubernetes and Cloud Native Associate (KCNA)
- **CI/CD:** Microsoft GitHub Actions Associate
- **AI:** AWS AI Practitioner

## Education

Bachelor of Technology in Electronics and Computers, ICFAI University, Dehradun (2006–2010).
