---
title: Variable resolution in Terraform modules
date: 2026-01-19
readingTime: 4 min read
tags: 
  - Terraform
  - IaC
subtitle: How Terraform Really Resolves Variables — The Flow No One Explains Clearly
icon: 🚀
---

# Variable resolution in Terraform modules

---

## How Terraform Really Resolves Variables — The Flow No One Explains Clearly

---

I had a moment recently where something just *clicked* — I finally understood how Terraform actually finds and resolves variables through multiple layers of modules.

It’s one of those things you *use* every day… but only once you see the flow end-to-end do you realise how Terraform is quietly doing a lot of smart work behind the scenes.

Let me walk you through it 

![Variable resolution in Terraform modules](/images/terraform2.jpeg)
---

### Terraform’s Logic — Step by Step

### Resource references a variable

```hcl
# modules/ec2/main.tf
resource "aws_instance" "web" {
  ami           = var.ami_id
  instance_type = var.instance_type
}
````

Terraform sees `var.ami_id`.

It checks the module’s `variables.tf`. There’s no default, so Terraform knows this value **must be passed by the parent module**.

```hcl
# modules/ec2/variables.tf
variable "ami_id" {}

variable "instance_type" {
  default = "t3.micro"
}
```

Here, `instance_type` has a default, so Terraform resolves it immediately. No upward lookup is required.

---

### Parent module passes the variable

```hcl
# modules/app/main.tf
module "web_server" {
  source        = "../ec2"
  ami_id        = var.app_ami
  instance_type = var.server_type
}
```

And its variable definitions:

```hcl
# modules/app/variables.tf
variable "app_ami" {}

variable "server_type" {
  default = "t3.medium"
}
```

Terraform sees that `app_ami` has no default, so it moves **one level up** — to the root module.

---

### Root module is the source of truth

```hcl
# main.tf (root)
module "app" {
  source      = "./modules/app"
  app_ami     = module.base_ami.output_ami
  server_type = "t3.large"
}

module "base_ami" {
  source = "./modules/ami"
}
```

Here, `app_ami` is explicitly set to an output from another module:

```
module.base_ami.output_ami
```

---

### Another module provides the output

```hcl
# modules/ami/main.tf
resource "aws_ami" "latest" {
  name_prefix = "ubuntu-"
  description = "Latest Ubuntu image"
  # assume some data source logic here
}
```

```hcl
# modules/ami/outputs.tf
output "output_ami" {
  value = aws_ami.latest.id
}
```

Terraform now has the full chain and resolves the value to:

```
aws_ami.latest.id
```

---

### Key Learnings

* **Variables = inputs, Outputs = return values** — treat modules like functions
* If a variable has a **default**, Terraform stops searching upward
* The **root module** is always the final source for unresolved variables
  (via `.tfvars`, `-var`, or explicit values)
* **Avoid circular references** — Terraform cannot resolve dependency loops
* Use **clear naming conventions** to show the chain
  (`ami_id → app_ami → output_ami`)
* Use `terraform graph` to visualize and debug module relationships

---

### Visualize Your Dependency Graph

```bash
terraform graph | dot -Tpng > graph.png
```

This makes complex module interactions far easier to reason about.

---

Understanding this resolution flow turns Terraform from “magic” into a **predictable system** — and once you see it, debugging module behavior becomes dramatically easier.

```