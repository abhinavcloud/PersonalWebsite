---
title: "What “Send” Really Means in an Agentic Email Workflow"
subtitle: "How drafts stay stable, where the addresses come from, and what the assistant can prove after a timeout"
date: 2026-11-21
readingTime: 4 min read
tags: [AWS, SES, DynamoDB, Idempotency]
icon: ✉️
---

# What “Send” Really Means in an Agentic Email Workflow : Bedrock AgentCore Series - Part 4

---

## How drafts stay stable, where the addresses come from, and what the assistant can prove after a timeout

### [Visit the GitHub repository: Bedrock AgentCore Personal Assistant](https://github.com/abhinavcloud/personal-assistant)

---

### Introduction

“Draft a note about a collaboration” is easy to show in a chat demo. “Send the draft I just approved” makes the application accountable for a specific message. The body has to stay the same, the recipient has to be predictable, and a lost response cannot automatically become another send. Once I added SES, the question became what the assistant could honestly report after each stage.

---

### What Gets Saved Before a Send

The assistant supports drafting, composing and sending on request, and sending the latest saved draft. A structured-output model produces the subject and body. Backend code adds the signature and stores the operation and latest-draft pointer in DynamoDB. The authenticated user and session scope the draft. The send-draft path uses the stored text, so the assistant can send what the visitor reviewed without regenerating the message.

The SES sender and owner recipient come from configuration. The visitor’s verified Cognito email becomes Reply-To. An email address mentioned in the body stays in the body. The model composes the message, and the backend supplies the addresses that govern delivery and replies.

![GitHub Actions](/images/ses-email-architecture.png)

---

### Where the Retry Gets Complicated

Before calling SES, the Lambda conditionally writes a record keyed by the request ID. A fingerprint binds the sender, recipient, reply-to address, subject, and body. A matching retry can return the recorded outcome. Changed content under the same ID is rejected. The terminal client creates a fresh ID for each prompt, so typing the same instruction again creates a new send request. A transport retry needs to preserve the original ID and payload.

There is still a gap between the conditional write and the provider response. SES might receive the request while the Lambda loses the response before recording the outcome. The handler limits submission to one attempt and treats an ambiguous result as unknown. Sending again could duplicate the message. Execution could also stop before SES receives the call, leaving the application with incomplete evidence in the other direction.

---

### How the Draft Becomes a Provider Request

```text
Structured subject and body → saved draft and latest-draft pointer
Verified Cognito email → Reply-To
Saved operation → MCP Gateway → Email Lambda → SES
```

The runtime and Lambda share the mail table, with separate responsibilities. The runtime persists the composed draft and handles lookup by authenticated actor and session. The Lambda records the provider submission. Terraform supplies the table and fixed sender and recipient, and the Lambda role is the one authorized to call SES. The packaged handler expects the environment variable `RECEIPIENT_EMAIL` with that exact spelling. Terraform’s input is `recipient_email`. Renaming only one side of that contract would break delivery even if the workflow and role were correct.

---

### What the Conditional Put Protects

The handler writes `send#<request_id>` with an initial unknown result and an `attribute_not_exists(id)` condition. If two matching requests arrive together, at most one creates the record and proceeds through that path to SES. A matching retry can see unknown while the first execution is still waiting for SES. The initial value is useful for recovery, but reading it does not establish whether anything went out.

Gateway validation is one layer. The Lambda still rejects empty content, bounds the subject to 200 characters and body to 10,000 characters, and rejects subject line breaks. The fingerprint includes fields used for submission, including sender, destination, Reply-To, subject, and body. That lets the backend distinguish a duplicate attempt from a different email that happened to arrive under the same key.

---

### What I Would Test Before Launching a Web Client

I would draft a message, send the saved version to the configured test inbox, and inspect the text and Reply-To. I would verify the SES configuration in the deployment region and whether the account’s sandbox restrictions apply. Terraform can provision SES identity resources, but the verification flow also depends on the corresponding DNS records and service status.

Then I would exercise a retry with the same ID and a deliberate second send with a fresh ID. The first could happen when the browser loses the response. The second needs to represent a visitor intentionally creating another operation. When the outcome is unknown, I would preserve the operation reference in the UI and expose that state instead of silently turning it into another send. The server can coordinate retries only when the client preserves the operation’s identity.

---

### Closing Thoughts

SES returns a message ID when it accepts a request. Final delivery is another milestone, and the current implementation has no delivery or bounce notification workflow. The assistant reports submission to SES when it has evidence for that milestone. If I needed to report delivery, I would correlate provider events with the original send record. That would give the workflow a basis for making a stronger claim. [Amazon SES SendEmail API](https://docs.aws.amazon.com/ses/latest/APIReference-V2/API_SendEmail.html)

---

### Project Files Referenced

- `code/agentcore-runtime/main-v2.py`
- `code/agentcore-runtime/skills/email-abhinav/SKILL.md`
- `infra/agentcore-gateway/main.tf`
- `infra/lambda/main.tf`
- `infra/ses/main.tf`
- `code/lambda/send_email.zip`

