---
title: "Identity Wiring in a Bedrock AgentCore Assistant : Bedrock AgentCore Series - Part 2"
subtitle: "How a Google login reaches the runtime, where IAM takes over, and whose calendar the assistant can use"
date: 2026-11-19
readingTime: 4 min read
tags: [AWS, Cognito, IAM, OAuth]
icon: 🔐
---

# Identity Wiring in a Bedrock AgentCore Assistant : Bedrock AgentCore Series - Part 2

---

## How a Google login reaches the runtime, where IAM takes over, and whose calendar the assistant can use

### [Visit the GitHub repository: Bedrock AgentCore Personal Assistant](https://github.com/abhinavcloud/personal-assistant)
---

### Introduction

A visitor signs in with Google, asks for a meeting, and receives an invitation. From the outside, it looks like one authorization decision. The implementation uses a visitor token, AWS execution roles, and an owner OAuth grant. Following those credentials hop by hop explains why a valid sign-in can coexist with a failed tool call or a rejected calendar operation.

---

### What the Visitor Actually Presents

The terminal client opens Cognito’s browser sign-in flow, receives the callback locally, and exchanges the authorization code using PKCE. Google is the federated identity provider. The bearer token the client sends to AgentCore Runtime is a Cognito access token. The runtime authorizer checks the configured issuer and client. Application code also validates the token and derives the actor from its subject. When it needs an email address, it calls Cognito UserInfo, matches the subject, and requires a verified email. [AWS inbound JWT authorization](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/inbound-jwt-authorizer.html)

The subject scopes memory and saved drafts. The verified address supplies Reply-To for contact mail and the requester’s attendee address for meetings. That is the point where an authenticated identity becomes useful to the actual workflows.

---

### Where IAM Takes Over

The terminal client needs no AWS credentials for chat. Inside the service, the runtime signs MCP calls to the Gateway using SigV4. The Gateway assumes a role that can invoke its Lambda targets. The targets have their own execution roles. Email can access SES and mail storage. The calendar Lambda can access its configured secret and operation table. A failure at each hop points to a different place to check, from JWT validation to Gateway invocation to the downstream permissions of a particular Lambda.

![GitHub Actions](/images/agentcore-identity-architecture.png)

---

### Why Calendar Access Has a Separate Grant

The calendar Lambda reads the owner’s OAuth configuration from Secrets Manager and exchanges the refresh token for a temporary Google access token. That lets it act on the configured owner calendar. The visitor’s Cognito identity tells the application who asked for the meeting. The owner’s Google grant tells Google which calendar the Lambda can access.

The distinction matters because the backend still has to decide what the visitor can do. Cancellation checks the recorded creator or configured administrator. Calendar listing currently exposes titles and times to authenticated visitors. If I were opening this to the public, I would expose free/busy to visitors and put full listings behind an owner-only check. That would preserve booking while reducing the amount of calendar data a visitor gets.

---

### What the Terminal Sends to Runtime

```http
Authorization: Bearer <cognito-access-token>
X-Amzn-Bedrock-AgentCore-Runtime-Session-Id: <stable-session-id>
Content-Type: application/json
```

```json
{
  "prompt": "Check whether Friday at 2 pm is available",
  "request_id": "calendar_lookup_001"
}
```

The invocation URL uses the runtime ARN and an endpoint qualifier. The client derives the qualifier from the endpoint ARN unless it is overridden. Terraform links the named endpoint to the runtime version. A client pointed at another qualifier can therefore see behavior that differs from the version I just configured.

---

### Why the Runtime Needs Both JWT Configuration and Header Forwarding

```hcl
authorizer_configuration {
  custom_jwt_authorizer {
    discovery_url   = var.cognito_discovery_url
    allowed_clients = [var.cognito_app_client_id]
  }
}

request_header_configuration {
  request_header_allowlist = ["Authorization"]
}
```

The service authorizer validates at the boundary. Header forwarding supplies the application with the token it needs to derive an actor and retrieve verified email. The runtime checks the RS256 signature, issuer, expiry, token type, client ID, and subject. It scopes state using the validated subject even though the client chooses the session ID. The Google federation redirect goes back to Cognito’s identity-provider response URL. The Cognito client callback goes back to the terminal’s localhost listener. A mismatch on either leg can stop a sign-in before any prompt reaches the runtime.

---

### How the Calendar Secret Gets to the Right Principal

The Calendar credentials are passed through an ephemeral Terraform input and a write-only Secrets Manager field. The module sets `secret_string_wo_version = 2`. Rotating that value through this path requires deliberately incrementing the version marker. The separate Google federation client secret does not use the same write-only configuration. That makes plan and state access part of the review for federation credentials even though the Calendar secret has a different write path.

The Lambda gets the secret ARN through configuration and reads the value with its execution role. The calendar interpreter only needs the user’s request and time context. Its output does not determine the OAuth grant or the creator identity used for cancellation. If sign-in works and content tools work but Calendar fails, I would move down to the Calendar Lambda role, secret reference, Google token exchange, and scopes. Opening up the Runtime or Gateway role would address a different hop.

---

### Closing Thoughts

Cognito establishes who the visitor is. IAM authorizes the AWS service calls. The Calendar OAuth grant authorizes access to the configured calendar. The application ties those together through rules about drafts, replies, invitations, and cancellations. That final layer determines what a signed-in visitor can actually do.

---

### Project Files Referenced

- `agentcore_chat.py`
- `code/agentcore-runtime/main-v2.py`
- `infra/cognito/main.tf`
- `infra/agentcore-runtime/main.tf`
- `infra/agentcore-gateway/main.tf`
- `infra/iam/main.tf`
- `infra/secrets-manager/main.tf`

