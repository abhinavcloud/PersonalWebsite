---
title: "Booking Meetings Through a Personal Assistant"
subtitle: "How a chat request becomes a Google Calendar event, when a retry can recover, and why two visitors can still book the same slot"
date: 2026-11-23
readingTime: 5 min read
tags: [AWS, Google Calendar, OAuth, DynamoDB]
icon: 📅
---

# Booking Meetings Through a Personal Assistant

---

## How a chat request becomes a Google Calendar event, when a retry can recover, and why two visitors can still book the same slot

## GitHub Project: https://github.com/abhinavcloud/personal-assistant
---

### Introduction

“Book thirty minutes next Friday at two” sounds like a date-parsing feature. The backend also needs the exact time window, the verified requester, access to the right calendar, and a way to recover when Google creates the event but the response never comes back. A public booking interface adds another question. What happens when someone else asks for that same slot?

---

### From a Calendar Plan to an Event

The interpreter gets the current UTC time, defaults interpretation to Asia/Kolkata, and produces a structured CalendarPlan or asks for clarification. Backend code adds the verified requester and operation attributes. The Lambda validates explicitly offset timestamps and requires a future start for a new booking. It obtains a temporary Google access token using the owner’s grant, checks availability, and inserts an event on the configured calendar. The owner and verified requester are included as attendees, and the handler requests updates with `sendUpdates=all`. [Google Calendar event insertion API](https://developers.google.com/workspace/calendar/api/v3/reference/events/insert)

---

### What Happens When Creation Times Out

The handler persists an operation and conditionally moves it from pending to submitting before the insert. It uses a deterministic Google event ID. If a retry finds the operation already submitting, it looks up that event ID. Finding and verifying the event lets the handler finish the original operation without making another insert. Google documents caller-supplied IDs for exactly this case, where the Calendar backend succeeds but the caller sees a failure. [Google Calendar guide to creating events](https://developers.google.com/workspace/calendar/api/guides/create-events)

Cancellation also depends on a concrete event ID. The workflow requires that ID from retained tool evidence. The Lambda compares the event’s private creator property with the current visitor’s subject and admits a configured administrator as a second authorized path. Resolving which meeting the visitor means is part of the operation.

---

### Where a Free/Busy Check Leaves a Gap

Two visitors asking for Friday at two have different request IDs and distinct operation records. Both free/busy calls can return a free slot before either insert reaches Google. Both inserts can then succeed. The deterministic ID helps recover one operation. Preventing overlaps across different operations needs coordination across the availability check and reservation.

For a public interface with fixed appointment slots, I would introduce a conditional hold per slot. Flexible windows would need a way to detect overlaps and handle expiry or events added directly to Google Calendar. The choice depends on how much of the actual calendar the assistant controls.

---

### What Each Calendar Tool Actually Needs

| Operation | Required evidence or inputs |
| --- | --- |
| Check availability | An explicitly offset, bounded interval |
| List events | An interval and a prior page token when continuing |
| Create meeting | A future interval, title, verified requester, and operation ID |
| Cancel event | An exact event ID and creator or administrator authority |

The handler limits time windows to 31 days and returns at most 50 events per listing page. The runtime checks pagination tokens against retained tool evidence. That avoids passing through a fabricated token that only looks plausible. Cancellation uses a similar check for event IDs. A title like “Architecture discussion” can help identify a meeting, but the operation needs the actual event resource.

Creation includes private operation and actor properties on the event. They let the backend check whether an event recovered by deterministic ID belongs to the original operation and who created it. Those are two distinct uses of the same event metadata, and both matter when the assistant is acting under the owner’s grant.

---

### The Operation Record Before the External Call

```text
pending → free/busy check
        → conditional transition to submitting
        → insert with deterministic event ID
        → complete with saved result

retry while submitting → look up the original event ID → verify or report unknown
```

The phase change coordinates attempts for the same operation. If two executions both see a pending request, the conditional update controls which one may submit. If the caller times out after the submission, recovery depends on Google’s event resource and the saved operation data. An absent or unverifiable event after an ambiguous attempt still leaves uncertainty. The backend can report that outcome without creating a second booking.

---

### How I Would Test This Against a Real Calendar

First I would test relative and explicit time requests against a dedicated calendar. The interpretation layer receives current UTC time and a default timezone. The Lambda sees the resulting timestamps. If “next Friday at two” selects an unexpected time, I would compare the structured plan with the validated request before touching the Google integration.

Then I would compare an exact retry with two independent requests for the same interval. The first exercises operation recovery. The second tests whether the selected reservation strategy can coordinate separate requests. Finally I would check cancellations as the creator, an unrelated visitor, and the configured administrator. I would also exercise listing separately from free/busy, since the current implementation returns event titles and times to authenticated visitors. A public demo can offer useful availability while making detailed events owner-only.

---

### Closing Thoughts

Interpreting a date, recovering a timed-out booking, and reserving a slot against competing requests are three different jobs. The current project implements the first two. Public scheduling is the point where I would invest in the third, because that is where a successful free/busy check stops being enough.

---

### Project Files Referenced

- `code/agentcore-runtime/main-v2.py`
- `code/agentcore-runtime/skills/calendar-abhinav/SKILL.md`
- `infra/agentcore-gateway/main.tf`
- `infra/secrets-manager/main.tf`
- `code/lambda/calendar_lambda.zip`

