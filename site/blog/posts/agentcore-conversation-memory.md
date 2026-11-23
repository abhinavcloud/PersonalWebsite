---
title: "Conversation Memory in a Bedrock AgentCore Assistant"
subtitle: "What follows a visitor across chats, what belongs to one session, and where a request ID fits"
date: 2026-11-23
readingTime: 4 min read
tags: [AWS, Bedrock AgentCore, Strands Agents, DynamoDB]
icon: 🧠
---

# Conversation Memory in a Bedrock AgentCore Assistant

---

## What follows a visitor across chats, what belongs to one session, and where a request ID fits

## GitHub Project: https://github.com/abhinavcloud/personal-assistant
---

### Introduction

Memory is easy to demonstrate in one chat. Tell the assistant something and ask it to repeat it a few turns later. The design gets more interesting when the visitor starts a new chat, resumes an older one, or asks what happened after an email send timed out. All three require continuity, but each has a different lifetime.

---

### What the Runtime Uses to Recover Context

The terminal client sends the latest prompt and a stable session ID. The runtime derives the actor from the verified Cognito subject and builds a Strands agent with an AgentCore Memory session manager. The session ID lets the visitor resume a conversation without sending the whole transcript on each turn.

The Terraform module organizes semantic facts under `/users/{actorId}/facts/` and summaries under `/users/{actorId}/sessions/{sessionId}/summaries/`. A later conversation for the same actor can retrieve relevant facts. A session summary stays scoped to a specific actor and session. The runtime asks for up to five facts and three summaries, with separate relevance thresholds. [AWS memory namespaces](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/specify-long-term-memory-organization.html)

There is also a separate context-window decision inside the agent. The main agent summarizes at 85 percent utilization and preserves four recent messages. The profile agent can truncate selected large tool results and retrieve omitted material. Retrieval decides which stored context to bring back. Context management decides what the active agent can fit on the turn.

---

### Why Operational State Lives Elsewhere

If the visitor asks about “the project we discussed last time,” memory can help resolve the reference. The published write-up establishes how that project actually works. The same distinction applies to actions. A recap can tell the assistant that a draft existed, while the mail table needs to preserve the exact text the visitor reviewed. A meeting operation needs a durable record of whether an insert was attempted and which event ID to check. Both action workflows use DynamoDB.

The project’s 30-day memory event expiry applies to conversation events. A public frontend would need separate retention and deletion decisions for derived memory, drafts, and operation records. The storage boundaries already tell me where to look when defining those behaviors.

---

### How Terraform and Strands Agree on the Scope

```hcl
resource "aws_bedrockagentcore_memory" "memory" {
  name                  = "agent_memory"
  event_expiry_duration = 30
}
```

Terraform attaches a semantic strategy and a summarization strategy. Each strategy defines what it extracts and where those derived records go. The runtime reads using the same namespace layout. Changing a namespace is effectively a data layout change. Existing records may still be under the old prefix, so I would decide what previous chats need to recall before moving reads to a new one.

```python
retrieval_config = {
    f"/users/{actor_id}/facts/": RetrievalConfig(
        top_k=5, relevance_score=0.3,
    ),
    f"/users/{actor_id}/sessions/{session_id}/summaries/":
        RetrievalConfig(top_k=3, relevance_score=0.5),
}
```

The actor comes from the Cognito subject. The session comes from the Runtime request context and is validated independently. Two people who enter the same session ID still map to different actor paths. Two sessions under one account can retrieve relevant common facts, while summaries use the additional session dimension. This is the application’s scoping convention. Its correctness depends on consistently deriving the actor at both read and write time.

---

### What Survives a Terminal or Runtime Restart

The terminal keeps access tokens in process memory and does not currently refresh them automatically. Restarting the client can therefore require a new sign-in even if the conversation still exists. The client accepts a saved session ID for resuming. The server builds the agent and its session manager again, so the previous runtime process is not required to recover the scoped conversation.

The runtime also takes a process-wide lock around invocation. That protects shared application state within a single process. Conditional DynamoDB records still matter for side effects because another process can be handling a retry concurrently. Memory namespace design, local process synchronization, and operation idempotency each control a different lifetime.

---

### What I Would Test Before Adding a Browser

I would save a fact in one session, check recall from another session under the same login, then present the original session string under a second account. I would separately check that the first session can resolve a reference to an earlier turn. Those tests tell me whether a failure is about user recall, session continuity, or actor isolation. Only after that would I tune retrieval settings. Adding more recalled facts can improve continuity while also bringing more unrelated or stale material into the turn.

---

### Closing Thoughts

Facts follow the authenticated actor. A recap follows the actor and session. A write outcome follows its logical request and durable record. Those identities explain what a new chat can recall and what a retry can recover.

---

### Project Files Referenced

- `agentcore_chat.py`
- `code/agentcore-runtime/main-v2.py`
- `infra/agentcore-memory/main.tf`
- `infra/dynamodb/main.tf`

