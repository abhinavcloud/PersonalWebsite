---
title: "Building an Agent Harness Around a Personal Assistant"
subtitle: "Where the main agent delegates, how answers get their evidence, and why the runtime owns the write path"
date: 2026-11-23
readingTime: 5 min read
tags: [AWS, Bedrock AgentCore, Strands Agents, MCP]
icon: 🤖
---

# Building an Agent Harness Around a Personal Assistant

---

## Where the main agent delegates, how answers get their evidence, and why the runtime owns the write path

## GitHub Project: https://github.com/abhinavcloud/personal-assistant
---

### Introduction

A personal assistant looks finished when it can answer “What does Abhinav do?” and “Can you book a meeting with him?” in the same chat. Those requests feel equally lightweight to the visitor. Behind the interface, one asks for an explanation based on published material. The other can put an event on my calendar and send invitations. Once both requests worked through the same interface, the interesting design question was how much authority each path actually needed.

---

### What the Main Agent Delegates

The main Strands agent routes a turn to the profile, mail, or calendar workflow. The runtime connects to AgentCore Gateway over MCP, where five Lambda targets expose eighteen tools. The profile agent gets the subset for resume, blog, and project retrieval, along with skills that describe how to use those tools. For email, a model produces a structured subject and body. For scheduling, a model produces a structured plan or asks for clarification. Backend code fills in the authenticated identity and other trusted arguments before it invokes a write operation.

Tool selection and IAM operate at different levels. The filtered catalog shapes what the profile agent can call during a turn. IAM governs what the runtime and Gateway can invoke as AWS principals. A single Gateway simplifies integration while leaving the application in charge of which capabilities belong in each workflow.

---

### Why Finding a Project and Reading It Are Two Different Steps

“Explain Abhinav’s latest project” requires two pieces of work. The agent first needs to find the newest entry. Then it needs to open it. A listing response can establish the title and date, but it cannot carry a detailed explanation of the project’s authentication or deployment model. If the assistant starts explaining the architecture from a subtitle, the gap is already there before the final answer is written.

The Lambda targets read from a configured public GitHub repository. Blog and project listings expose metadata, while the full-read tools retrieve Markdown or MDX bodies using jsDelivr with a GitHub fallback. The runtime tracks the calls that actually ran. A separate steering model evaluates selected final blog and project answers against retrieved material. If the response is thin, I would check for a full read before tuning the evaluator.

---

### From the Entrypoint to the Lambda Handler

```text
Terminal → AgentCore Runtime → Strands main agent
             ├─ profile → signed MCP → content Lambdas
             ├─ mail → DynamoDB draft → signed MCP → SES Lambda
             └─ calendar → structured plan → signed MCP → Calendar Lambda
```

The Dockerfile starts `main-v2.py`. Its invocation handler validates the prompt and identifiers, derives the actor from the access token, and builds the main agent with a session manager. A profile question creates a fresh profile agent. The model gets explicit tool objects, while the runtime retains ownership of the shared MCP connection. That means discarding a short-lived profile agent does not close the transport that the next turn expects to use.

Tool discovery follows the MCP pagination token until there are no additional pages. If discovery fails on the existing connection, the runtime closes it and reconnects. Each Gateway name carries its target prefix. For example, `ResumeTarget___read_resume` routes to the resume target, and the handler dispatches using the tool name in Lambda client context. A signed call can reach the Gateway successfully and still fail at schema validation or handler dispatch. I would check the actual target-prefixed name before changing the model prompt.

---

### What the Content Store Needs to Look Like

Resume Markdown can put public contact details in YAML front matter, leaving the body for experience and skills. Blog and project directory listing goes one level deep. The handlers compare date strings, so a consistent ISO format is important. Lists are cached for 300 seconds in a warm Lambda environment. A newly published entry can therefore appear at different times across warm environments, and forcing a fresh model turn does not necessarily refresh the Lambda cache.

Long articles introduce a different problem. The profile agent can preserve a 750-token preview of selected oversized results and retrieve the omitted context if needed. A runtime hook prevents an identical successful offloaded-context retrieval from repeating. If an explanation skips a crucial implementation detail, I would inspect whether it opened the article, whether that result was offloaded, and whether the omitted portion was retrieved. The steering model evaluates selected final responses. It does not block tool execution.

---

### How I Would Verify the Architecture

I would start with a resume fact, then ask for the latest project and its architecture, then request several blog titles. The expected tool patterns are a resume read, a list or selection followed by a full read, and a metadata listing. They test a useful difference between routing, finding a document, and grounding a response in its body.

Changes also need to reach the serving endpoint. Runtime changes are built as a Linux ARM64 image, pushed to ECR and referenced through Terraform. Handler changes require rebuilt ZIPs. If the terminal still produces the old behavior after a fix, I would check which image version and package are actually deployed before changing agent logic again.

---

### Closing Thoughts

Direct reads fit a small, organized portfolio. A question that spans years of posts may eventually justify adding an index for discovery while retaining full reads for evidence. The part I would keep is the division of responsibility. The profile agent reads and explains, the interpreters give the backend structured intent, and the backend executes operations that have real consequences.

---

### Project Files Referenced

- `README.md`
- `code/agentcore-runtime/main-v2.py`
- `code/agentcore-runtime/Dockerfile`
- `code/agentcore-runtime/skills/`
- `infra/agentcore-gateway/main.tf`
- `code/lambda/resume_lambda.zip`
- `code/lambda/blog_lambda.zip`
- `code/lambda/projects_lambda.zip`

