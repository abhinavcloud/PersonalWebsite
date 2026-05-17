---
title: Aurora Serverless End to End Architecture
subtitle: Implementing AWS Aurora Serverless End to End with RDS Proxy and IAM Auth
date: 2026-05-17
readingTime: 10 min read
tags: [AWS, Aurora, RDS]
icon: ☁️🛢️
---

# Aurora Serverless End to End Architecture

---

## Setting Up Aurora Serverless v2 with RDS Proxy and End-to-End IAM Authentication Using Terraform

---

### Introduction 

Most tutorials on Aurora Serverless v2 stop at the cluster. They show you how to spin up the database, maybe add an instance, and call it done. What they skip is everything that actually makes it production-worthy: how traffic reaches the database, how connections are managed, and how you avoid hardcoding credentials anywhere in your codebase.

This post covers the full setup. Aurora Serverless v2 cluster, writer and reader instances across multiple availability zones, RDS Proxy with end-to-end IAM authentication, and the IAM roles and security groups that wire it all together. Every decision has a reason behind it. By the end you will know not just what to write but why.

The stack is PostgreSQL on Aurora Serverless v2, RDS Proxy for connection pooling, Lambda functions inside a VPC as the only clients, and Terraform for all infrastructure.

![Aurora_Architecture](/images/Aurora_Architecture.png)

---

### The Architecture Before Writing Any Code

Understanding the flow matters before touching Terraform. Here is what we are building:

```
Lambda (inside VPC)
  → RDS Proxy (connection pooling, IAM auth enforcement)
    → Aurora Serverless v2 (private subnet, no public access)
```

Lambda never talks to Aurora directly. Every connection goes through the proxy. This is intentional and the reason will become clear when we get to the proxy section.

-----

### DB Subnet Group

The first resource is the subnet group. Aurora needs to know which subnets it is allowed to place instances in.

```hcl
resource "aws_db_subnet_group" "aurora_db_subnet_group" {
  name       = "main"
  subnet_ids = var.subnet_group
}
```

This looks simple but there is an important concept here. You define all subnets at the cluster level, not the instance level. When you later create instances and specify an availability zone on each one, Aurora internally maps that AZ to the matching subnet from this group. You never explicitly say “this instance goes in this subnet.” Aurora handles that mapping.

All subnets passed here should be private subnets. No internet gateway route, no inbound from the internet. That is your first and strongest layer of network security, stronger than any security group rule.

-----

### Aurora Security Group

```hcl
resource "aws_security_group" "aurora_sg" {
  name        = "aurora_sg"
  description = "Allow TLS inbound traffic and all outbound traffic"
  vpc_id      = var.vpc_id

  tags = {
    Application = "Aurora"
    Type        = "Security_Group"
  }
}

resource "aws_vpc_security_group_ingress_rule" "aurora_sg_ingress_rule" {
  security_group_id             = aws_security_group.aurora_sg.id
  referenced_security_group_id  = aws_security_group.rds_proxy_sg.id
  from_port                     = 5432
  ip_protocol                   = "tcp"
  to_port                       = 5432
}
```

The security group is defined separately from its rules. This is intentional in Terraform when you have circular dependencies. The Aurora SG references the proxy SG in its ingress rule, and the proxy SG references the Aurora SG in its egress rule. Defining the SGs first and rules separately breaks the circular dependency.

The ingress rule allows port 5432 traffic only from the RDS Proxy security group. Nothing else can reach Aurora. Not other Lambda functions, not EC2 instances, not anything else running in the VPC.

There is no egress rule. Aurora is a database. It receives connections, it does not initiate them. AWS allows all outbound by default and since Aurora has no reason to call anything externally, there is nothing to restrict.

-----

### Aurora Serverless v2 Cluster

```hcl
resource "aws_rds_cluster" "online-ticketing-system" {
  cluster_identifier                  = "online-ticketing-system"
  engine                              = "aurora-postgresql"
  engine_mode                         = "provisioned"
  engine_version                      = "17.7"
  database_name                       = "online-ticketing-system"
  master_username                     = var.master_username
  master_password                     = var.master_password
  storage_encrypted                   = true
  db_subnet_group_name                = aws_db_subnet_group.aurora_db_subnet_group.name
  enable_http_endpoint                = false
  vpc_security_group_ids              = [aws_security_group.aurora_sg.id]
  iam_database_authentication_enabled = true

  serverlessv2_scaling_configuration {
    max_capacity             = 1.0
    min_capacity             = 0.0
    seconds_until_auto_pause = 600
  }
}
```

Several things here deserve explanation.

**`engine_mode = "provisioned"`** is the most counterintuitive part of Aurora Serverless v2. You would expect it to be `"serverless"` but that is the old Serverless v1. Serverless v2 runs on the provisioned engine with a scaling configuration block on top. AWS manages the compute scaling internally. You just define the boundaries.

**`serverlessv2_scaling_configuration`** is what actually makes it serverless. `min_capacity = 0.0` means the cluster scales to zero when idle. For a production system this is a problem because cold starts take 15 to 30 seconds. For a portfolio project it is the right call. It costs nothing when not in use. `max_capacity = 1.0` means 1 ACU, roughly 2GB of RAM. Enough for a demo workload. `seconds_until_auto_pause = 600` pauses the cluster after 10 minutes of inactivity.

**`enable_http_endpoint = false`** because Lambda functions are inside the VPC. The HTTP endpoint is the RDS Data API, which lets you query Aurora over HTTPS without a persistent connection. It is useful for Lambda functions outside a VPC or for third party tools that cannot use a native Postgres driver. Since our Lambdas are inside the VPC and connecting through RDS Proxy using psycopg2, there is no need for the Data API. Enabling it unnecessarily is just extra surface area.

**`iam_database_authentication_enabled = true`** is required for end-to-end IAM authentication with RDS Proxy. Without this, the proxy cannot authenticate to Aurora using IAM.

**`master_username` and `master_password`** are passed as variables and injected at runtime via GitHub Actions using `TF_VAR_master_username` and `TF_VAR_master_password` environment variables sourced from repository secrets. They never appear in code, never appear in tfvars files, never touch git history.

-----

### Writer and Reader Instances

The cluster alone does nothing. Aurora Serverless v2 requires explicit instances. This is different from traditional RDS where the instance and cluster are the same thing. In Aurora they are separate resources.

```hcl
resource "aws_rds_cluster_instance" "writer_instance" {
  cluster_identifier   = aws_rds_cluster.online-ticketing-system.id
  instance_class       = "db.serverless"
  engine               = aws_rds_cluster.online-ticketing-system.engine
  engine_version       = aws_rds_cluster.online-ticketing-system.engine_version
  availability_zone    = var.availability_zones[0]
  db_subnet_group_name = aws_db_subnet_group.aurora_db_subnet_group.name
  publicly_accessible  = false
  promotion_tier       = 0
}

resource "aws_rds_cluster_instance" "reader_instance_01" {
  cluster_identifier   = aws_rds_cluster.online-ticketing-system.id
  instance_class       = "db.serverless"
  engine               = aws_rds_cluster.online-ticketing-system.engine
  engine_version       = aws_rds_cluster.online-ticketing-system.engine_version
  availability_zone    = var.availability_zones[1]
  db_subnet_group_name = aws_db_subnet_group.aurora_db_subnet_group.name
  publicly_accessible  = false
  promotion_tier       = 1
  depends_on           = [aws_rds_cluster_instance.writer_instance]
}

resource "aws_rds_cluster_instance" "reader_instance_02" {
  cluster_identifier   = aws_rds_cluster.online-ticketing-system.id
  instance_class       = "db.serverless"
  engine               = aws_rds_cluster.online-ticketing-system.engine
  engine_version       = aws_rds_cluster.online-ticketing-system.engine_version
  availability_zone    = var.availability_zones[2]
  db_subnet_group_name = aws_db_subnet_group.aurora_db_subnet_group.name
  publicly_accessible  = false
  promotion_tier       = 1
  depends_on           = [aws_rds_cluster_instance.writer_instance]
}
```

**`instance_class = "db.serverless"`** is the second piece of the Serverless v2 puzzle. The cluster has the scaling configuration. The instance has this class. Both are required. Without `db.serverless` on the instance, the scaling configuration on the cluster is ignored and you end up with a regular provisioned instance.

**Writer vs reader is determined by creation order, not by any explicit flag.** The first instance created in the cluster becomes the writer. `promotion_tier` is about failover priority, not role assignment. Tier 0 means Aurora promotes this instance first during a failover. It does not mean write traffic goes here. That is already determined by creation order.

**`depends_on`** on both reader instances ensures the writer is fully created before readers are provisioned. Terraform does not guarantee resource creation order unless you tell it to. Without this, all three instances might be created simultaneously and Aurora might not correctly assign the writer role to the intended instance.

**Three AZs** means each instance sits in a different availability zone. If one AZ goes down, two instances remain. The subnet group tells Aurora which subnets are available and Aurora maps each instance to the correct subnet based on the `availability_zone` argument. You never manually link instance to subnet.

---

### IAM Policy for RDS Proxy

```hcl
resource "aws_iam_policy" "rds_proxy_allow_aurora_db_connection" {
  name        = "rds-proxy-allow-aurora-db-connection"
  path        = "/"
  description = "Allow Policy for RDS Proxy to connect to Aurora DB Cluster via end-to-end IAM authentication"

  policy = jsonencode({
    "Version" : "2012-10-17",
    "Statement" : [
      {
        "Effect" : "Allow",
        "Action" : [
          "rds-db:connect"
        ],
        "Resource" : [
          "arn:aws:rds-db:${var.region}:${var.account_id}:dbuser:${aws_rds_cluster.online-ticketing-system.cluster_resource_id}/*"
        ]
      }
    ]
  })
}
```

The `rds-db:connect` action is specific to IAM database authentication. It is not a standard RDS action. It is what allows a principal to authenticate to an RDS or Aurora database using an IAM token instead of a username and password.

The ARN format here is important. It uses `rds-db` as the service prefix, not `rds`. It includes `dbuser` in the path. And it uses `cluster_resource_id`, not the cluster name or the cluster ARN. These are three distinct values and only `cluster_resource_id` works here. The `/*` at the end means any database user on this cluster can be authenticated via this policy.

The region and account ID are passed as variables sourced from the root module using `data "aws_region"` and `data "aws_caller_identity"` data sources. This avoids hardcoding environment-specific values in module code.

---

### IAM Assume Role Policy and Role

```hcl
data "aws_iam_policy_document" "rds_proxy_assume_role" {
  statement {
    effect = "Allow"

    principals {
      type        = "Service"
      identifiers = ["rds.amazonaws.com"]
    }

    actions = ["sts:AssumeRole"]
  }
}

resource "aws_iam_role" "rds_proxy_role" {
  name               = "rds-proxy-role"
  assume_role_policy = data.aws_iam_policy_document.rds_proxy_assume_role.json
}

resource "aws_iam_role_policy_attachment" "attach_rds_proxy_allow_aurora_db_connection" {
  role       = aws_iam_role.rds_proxy_role.name
  policy_arn = aws_iam_policy.rds_proxy_allow_aurora_db_connection.arn
}
```

IAM roles have two distinct parts that are easy to confuse. The assume role policy defines who can assume the role. The attached policies define what that role can do once assumed.

The assume role policy here allows `rds.amazonaws.com` to assume this role. That is the RDS service principal. When the proxy needs to authenticate to Aurora, it assumes this role and uses the attached `rds-db:connect` policy to generate an IAM token for the database connection.

The policy is created as a standalone `aws_iam_policy` resource and attached via `aws_iam_role_policy_attachment`. This is the correct pattern compared to inline `aws_iam_role_policy`. Standalone policies are reusable, auditable, and show up cleanly in the IAM console. Inline policies are scoped to one role and harder to track.

The `data "aws_iam_policy_document"` block for the assume role is more idiomatic Terraform than `jsonencode`. It is type-checked, easier to read, and produces valid JSON that Terraform validates at plan time rather than at apply time.

---

### RDS Proxy Security Group

```hcl
resource "aws_security_group" "rds_proxy_sg" {
  name        = "rds-proxy-sg"
  description = "Allow TLS inbound traffic from lambda and outbound traffic to aurora cluster"
  vpc_id      = var.vpc_id

  tags = {
    Application = "RDS_Proxy"
    Type        = "Security_Group"
  }
}

resource "aws_vpc_security_group_egress_rule" "rds_proxy_sg_egress_rule" {
  security_group_id             = aws_security_group.rds_proxy_sg.id
  referenced_security_group_id  = aws_security_group.aurora_sg.id
  from_port                     = 5432
  ip_protocol                   = "tcp"
  to_port                       = 5432
}
```

The proxy SG has two rules total. An egress rule to Aurora on port 5432 and an ingress rule from the Lambda SG on port 5432. The ingress rule is added when the Lambda module is built since it references the Lambda security group which does not exist yet.

The egress rule scoped to the Aurora SG rather than `0.0.0.0/0` means the proxy can only send traffic to Aurora. Not to the internet, not to other resources in the VPC. Just Aurora. This is defence in depth even if it is not the primary security control.

---

### RDS Proxy

```hcl
resource "aws_db_proxy" "rds_proxy" {
  name                = "rds-proxy"
  debug_logging       = false
  engine_family       = "POSTGRESQL"
  idle_client_timeout = 1200
  require_tls         = true
  role_arn            = aws_iam_role.rds_proxy_role.arn
  vpc_security_group_ids = [aws_security_group.rds_proxy_sg.id]
  vpc_subnet_ids         = var.subnet_group
  default_auth_scheme    = "IAM_AUTH"

  auth {
    description = "End to End IAM Authentication"
    iam_auth    = "REQUIRED"
  }

  tags = {
    Name = "RDS_Proxy"
    Key  = "RDS_Proxy"
  }
}
```

RDS Proxy exists to solve a specific problem with Lambda and databases. Lambda scales aggressively. A traffic spike can spawn hundreds of concurrent executions. Each execution opens a database connection. Aurora has a connection limit. At 1 ACU that limit is low. Without a proxy, a traffic spike does not just slow down Aurora. It crashes it.

The proxy maintains a warm connection pool to Aurora and multiplexes hundreds of Lambda connections through a small number of actual database connections. Aurora stays healthy regardless of how many Lambda instances are running.

**`default_auth_scheme = "IAM_AUTH"`** and **`iam_auth = "REQUIRED"`** together enforce end-to-end IAM authentication. This is a relatively new feature. Previously RDS Proxy required Secrets Manager to store database credentials for the proxy-to-Aurora connection. With end-to-end IAM auth, no credentials are stored anywhere. The proxy authenticates to Aurora using the IAM role. Lambda authenticates to the proxy using an IAM token. No secrets in Secrets Manager, no credentials in environment variables, no rotation to manage.

**`require_tls = true`** is mandatory when using IAM authentication. IAM tokens are transmitted as passwords and must be encrypted in transit.

**`idle_client_timeout = 1200`** closes idle client connections after 20 minutes. This prevents Lambda connections from accumulating in the proxy pool after function instances are recycled.

The proxy creates a default endpoint automatically. You do not need `aws_db_proxy_endpoint` unless you need a custom endpoint for a different VPC or a separate read-only endpoint. Lambda connects to `aws_db_proxy.rds_proxy.endpoint` which is available as an output.

---

### Proxy Target Group and Target

```hcl
resource "aws_db_proxy_default_target_group" "rds_proxy_target_group" {
  db_proxy_name = aws_db_proxy.rds_proxy.name

  connection_pool_config {
    connection_borrow_timeout    = 120
    max_connections_percent      = 100
    max_idle_connections_percent = 50
    session_pinning_filters      = ["EXCLUDE_VARIABLE_SETS"]
  }

  lifecycle {
    replace_triggered_by = [aws_db_proxy.rds_proxy.id]
  }
}

resource "aws_db_proxy_target" "rds_proxy_target" {
  db_cluster_identifier = aws_rds_cluster.online-ticketing-system.id
  db_proxy_name         = aws_db_proxy.rds_proxy.name
  target_group_name     = aws_db_proxy_default_target_group.rds_proxy_target_group.name

  lifecycle {
    replace_triggered_by = [aws_db_proxy.rds_proxy.id]
  }
}
```

The proxy resource alone does not know where to send connections. The target group configures the connection pool behaviour. The target points the proxy at the Aurora cluster.

`aws_db_proxy` creates the proxy. `aws_db_proxy_default_target_group` configures how connections are pooled. `aws_db_proxy_target` tells the proxy which database cluster to forward connections to. All three are required.

**`max_connections_percent = 100`** allows the proxy to use up to 100 percent of Aurora’s max connection limit. At 1 ACU this is a small number. The proxy manages all of them.

**`max_idle_connections_percent = 50`** means the proxy keeps up to 50 percent of max connections open even when idle. This reduces connection establishment latency when traffic resumes after a quiet period.

**`session_pinning_filters = ["EXCLUDE_VARIABLE_SETS"]`** is specific to PostgreSQL. Session pinning happens when the proxy pins a client connection to a specific database connection, bypassing multiplexing. This kills connection pool efficiency. Setting variables in a session is one trigger for pinning. `EXCLUDE_VARIABLE_SETS` tells the proxy to not pin on variable sets, which preserves multiplexing for the vast majority of queries.

**`connection_borrow_timeout = 120`** means a client waits up to 120 seconds for a connection from the pool before timing out. For a ticketing system this is generous. In production you would tune this based on your p99 latency requirements.

The `lifecycle { replace_triggered_by }` blocks ensure the target group and target are recreated if the proxy is replaced. Without this, Terraform might leave orphaned target group resources pointing at a replaced proxy.

---

### How Lambda Connects

Lambda connects to the proxy endpoint, not to Aurora directly. It generates an IAM auth token and uses it as the database password.

```python
import boto3
import psycopg2
import os

def get_connection():
    client = boto3.client('rds', region_name=os.environ['AWS_REGION'])
    
    token = client.generate_db_auth_token(
        DBHostname=os.environ['PROXY_ENDPOINT'],
        Port=5432,
        DBUsername=os.environ['DB_USERNAME']
    )
    
    return psycopg2.connect(
        host=os.environ['PROXY_ENDPOINT'],
        port=5432,
        database=os.environ['DB_NAME'],
        user=os.environ['DB_USERNAME'],
        password=token,
        sslmode='require'
    )
```

The IAM token is valid for 15 minutes. It is generated fresh on each connection. No credential storage anywhere in the application layer.

---

### Security Summary

This setup has four distinct security layers:

**Private subnets** with no internet gateway route. There is no network path for external traffic to reach Aurora or the proxy regardless of any other configuration.

**Security groups** scoped to specific source security groups rather than CIDR ranges. Aurora only accepts traffic from the proxy SG. The proxy only sends traffic to the Aurora SG.

**IAM authentication** enforced end-to-end. Lambda authenticates to the proxy with an IAM token. The proxy authenticates to Aurora with an IAM role. No passwords in application code, environment variables, or secrets management systems.

**RDS Proxy as single entry point**. Lambda’s IAM policy grants `rds-db:connect` only on the proxy ARN, not on the cluster ARN directly. Even if something else in the VPC tried to connect to Aurora directly, it would not have the IAM permission to do so.

Each layer is independent. Removing any one of them does not collapse the entire security model. That is the point of defence in depth.