---
title: "SQS vs SNS vs EventBridge "
date: "2026-03-26"
readingtime: 8 min read
tags:
  - software-architecture
  - distributed-systems
  - event-driven-architecture
  - system-design
subtitle: "Real Architecture Thinking"
---
# SQS vs SNS vs EventBridge 

---

## It's Not About The Tools But Real Architecture Thinking

---

This started as a simple question.

Which one should I use. SQS or SNS or EventBridge.

On paper it looks like a feature comparison. Queue vs pub-sub vs event bus. But the moment you start asking “what happens under load” or “what happens when things break”, the whole discussion goes somewhere else.

This is that journey.

![System Design Patterns](/images/systemdesign5.png)

---

### Step 1: The Simple View (Where Everyone Starts)

At the beginning it looks like this:

- SQS → queue, consumers pull, messages processed one by one 
- SNS → pub-sub, fan out to multiple subscribers 
- EventBridge → event bus, routing based on rules 

Simple enough.

So if I have multiple subscribers and different event types, SNS or EventBridge seems like the answer. SQS looks like just a queue.

But then a question comes.

---

### Step 2: Can I filter events based on type?

Say I have events like:

```json

    {
      "type": "receipt"
    }
```

Some consumers want only receipts. Some want invoices.

SNS can do this using message attributes. 
EventBridge can also do this using rules on the event body.

So far both work.

Then comes the next question.

---

### Step 3: What about more complex logic?

Now the event is not just type. It becomes:

```json
    {
      "type": "receipt",
      "amount": 0,
      "subType": "advance"
    }
```

Now the question is:

Should I generate a PDF or suppress it?

This is where things get interesting.

My first instinct was:

Let EventBridge handle this. It has powerful filtering. It can check amount, subtype, all that.

But then you realize something important.

This is not routing anymore. This is business logic.

EventBridge is good at saying “where should this go”.

It should not decide “what should be done”.

So the right approach becomes:

- Upstream service decides pdfRequired = true/false 
- EventBridge routes based on that 

Now the event becomes:

```json
    {
      "type": "receipt",
      "pdfRequired": false
    }
```

Clean. Simple. Explicit.

But then another question hits.

---

### Step 4: Can SNS handle this as well?

Yes it can.

But SNS does not look at the body. It looks at metadata.

So you have:

Body:
```json
    {
      "type": "receipt",
      "pdfRequired": false
    }
```

Metadata:
```json
    {
      "pdfRequired": "false"
    }
```
And SNS filters using metadata.

Now this creates a weird situation.

What if body says false and metadata says true?

Now wrong service consumes the event.

At first this feels like a bug.

But it is not.

It is a design tradeoff.

SNS is optimized for speed and throughput. It does not inspect payload. It just looks at labels.

EventBridge inspects the event itself.

So now the problem is not SNS vs EventBridge.

It becomes:

How do I ensure consistency between body and metadata?

And that leads to the next realization.

---

### Step 5: This is a producer problem, not a service problem

Yes, code should ensure:

```json
    body.pdfRequired == metadata.pdfRequired
```
But real systems are messy.

Multiple teams, multiple services, different languages.

Eventually something will drift.

So the question becomes:

What happens when it drifts?

---

### Step 6: Failure modes matter more than features

SNS failure mode:
- Wrong service processes the event 
- Silent corruption 

EventBridge failure mode:
- Event not routed 
- Nothing happens 

Which one is worse?

In most systems:
Silent corruption is worse than missed processing.

So now the decision is not:

Which service is better.

It is:

Which failure can I tolerate.

And then comes the biggest realization of the whole discussion.

---

### Step 7: What happens during traffic spikes?

Till now everything was logical.

Now think operationally.

Say there is an event explosion.

10k events suddenly.

If I do this:

```json
    EventBridge → Service (EKS / EC2)
```

All events hit the service directly.

What happens?

- CPU spikes 
- Pods get overwhelmed 
- Requests start failing 
- Retries add more pressure 

System collapses.

Autoscaling?

It reacts after the spike. Too late.

This is where things become very real.

---

### Step 8: This is not about routing. This is about control

The real problem is:

Uncontrolled concurrency.

Too many events hitting at once.

So the solution is not just routing correctly.

The solution is:

Control the rate at which the service consumes events.

And that is where SQS changes everything.

---

### Step 9: Introduce SQS and everything changes

Now architecture becomes:

    EventBridge → SQS → Service

Now what happens?

- Events go into queue 
- Service pulls at its own pace 
- Queue absorbs spikes 

System does not crash.

It slows down.

This is a huge difference.

---

### Step 10: Push vs Pull (the real distinction)

Without SQS:
- Push model 
- Producer controls load 

With SQS:
- Pull model 
- Consumer controls load 

This is the core shift.

SQS is not just a queue.

It is a control boundary.

---

### Step 11: Backpressure (this is the real concept)

What SQS is really doing:

It decouples:

- Ingestion rate (how fast events come) 
- Processing rate (how fast service can handle) 

If ingestion > processing:
- Queue grows 

If processing catches up:
- Queue drains 

System stays stable.

Without this:
System collapses.

---

### Step 12: Lambda vs EKS vs EC2

Lambda behaves differently.

- It scales quickly 
- No fixed capacity upfront 

But still:
- Downstream systems can fail 
- DB connections can saturate 

For EKS and EC2:

- Fixed capacity 
- Slower scaling 
- Much higher risk 

So for EKS/EC2:

Queue is not optional.

It is protection.

---

### Step 13: So what is the final architecture?

For most real systems:

    Producer → EventBridge → SQS → Service → DLQ

- EventBridge → routing 
- SQS → buffering, retry, backpressure 
- Service → processing 
- DLQ → failure handling 

Clean separation.

---

### Step 14: What did we actually learn?

We started with service comparison.

We ended with system behavior.

That is the real shift.

---

### Final Mental Models (Use these while designing)

#### 1. Routing vs Processing vs Control
- Routing → EventBridge / SNS 
- Processing → your service 
- Control → SQS 

Never mix these.


#### 2. Push vs Pull
Push systems break under burst. 
Pull systems degrade gracefully.



#### 3. Scaling is not enough
Scaling handles average load. 
Queues handle burst. 
You need both.



#### 4. Always think in failure modes
Ask:
- What happens if wrong service gets event 
- What happens if event is dropped 
- What happens if system is overloaded 



#### 5. Backpressure is mandatory at scale
If you don’t control rate, system will control it for you. 
By failing.



#### 6. Optimize for blast radius
Small system → simple solution 
Large system → safer failure modes 



#### 7. Design for failure, not correctness
Even if code is perfect, system will fail. 
Design so that failure is contained.

---

### One line summary

EventBridge decides where events go. 
SQS decides when they are processed. 
Your service decides what to do.

If you mix these, system breaks.


That’s the whole journey.

From “which service to use” 
to 
“how does my system behave under stress”

That’s where real architecture starts.