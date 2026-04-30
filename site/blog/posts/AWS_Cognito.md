---
title: Demystifying Cognito Authentication End To End
subtitle: Implementing Cognito Authentication with Google, Terraform, and a CloudFront hosted Website
date: 2026-04-30
readingTime: 10 min read
tags: [AWS, AWSCognito, Terraform]
icon: ☁️🔐
---

# Demystifying Cognito Authentication End To End

---

## Implementing Cognito Authentication with Google, Terraform, and a CloudFront hosted Website

---

This post walks through a complete, practical Cognito authentication setup for a static website hosted behind CloudFront, using Terraform end to end. I will start with what Cognito is and why it is useful, then break down the essential Cognito layers, how they depend on each other, how the OAuth surface is created, how CloudFront fits in, and finally how to wire Terraform outputs into website code through a CI/CD pipeline in a way that stays reliable over time. 

---

### What Amazon Cognito is, and why it is useful
Amazon Cognito is AWS’s managed identity service for applications. At a high level it gives you a user directory (User Pools), sign up/sign in flows, token issuance, and federation with external identity providers such as Google. It allows your application to act like a standards based identity consumer, instead of you building custom password storage, account recovery, and OAuth/OIDC token logic yourself.

What makes Cognito particularly helpful for web apps is that it can operate as an OAuth 2.0 / OpenID Connect provider. Once configured, it exposes well known endpoints (authorize, token, login, logout) that your application can use to authenticate users and obtain tokens. Those endpoints appear only after a domain is assigned to the user pool, which is one of the key resources we will cover. 

---

### Cognito building blocks: the essential layers

In a typical “Cognito + Hosted UI + Google login” setup, four resources form the core. Each has a distinct purpose.

#### aws_cognito_user_pool – the identity store and token issuer

A User Pool is the core directory. It holds local users (if you enable username/password) and also represents federated users (for example, when Google is used as the identity provider). It owns verification settings (like auto verifying email) and is the root object that everything else attaches to. 

#### aws_cognito_identity_provider – the trust relationship to Google
An identity provider resource configures how Cognito federates with an external provider. For Google, this is where you provide Google’s OAuth client ID and secret, request scopes, and map Google claims (like email and sub) into Cognito user attributes. Without this, Cognito cannot redirect users to Google or validate Google’s response. 

#### aws_cognito_user_pool_client – your application registration
A user pool client represents your application (your website). This is where you enable OAuth flows, define allowed scopes, and most importantly define callback URLs and logout URLs. Cognito enforces that the redirect_uri supplied at runtime must exactly match one of the configured callback URLs. This exact matching is what protects against redirect hijacking and is also the most common cause of redirect_mismatch errors. 

#### aws_cognito_user_pool_domain – the OAuth and Hosted UI surface
Assigning a domain to the user pool activates Cognito’s public web endpoints (Hosted UI login, logout, /oauth2/authorize, /oauth2/token, and federation endpoints). This domain is the “public face” of your user pool for browser based flows and third party IdP federation. Without a domain, you do not have a stable OAuth surface to integrate with your web app or Google. 

---

### How these resources depend on each other
A simple way to think about dependencies is: User Pool first, everything else hangs off it.

- aws_cognito_identity_provider depends on aws_cognito_user_pool because the IdP is attached to a specific pool. 
- aws_cognito_user_pool_client depends on the User Pool, and functionally depends on the IdP if you want the client to allow Google sign in (supported_identity_providers = ["Google"]). 
- aws_cognito_user_pool_domain depends on the User Pool because the domain is assigned to that pool, and it is what activates the OAuth endpoints. 

From a Terraform standpoint, explicit depends_on is not always required if you reference attributes correctly, but conceptually this dependency chain is important because it mirrors the real “assembly” of the authentication system. 

---

### How the OAuth API surface is “generated” (what actually appears)

When you create the user pool domain, Cognito activates a set of public endpoints on that domain. These include:

- Login endpoint (Hosted UI)
- Logout endpoint
- /oauth2/authorize (authorization endpoint)
- /oauth2/token (token endpoint)
- Federation related endpoints used for third party IdPs

This is not something you code. It is a managed surface that comes alive when the domain exists and is tied to your user pool. 
The authorization endpoint is where your browser is sent to begin authentication. The request includes parameters like client_id, response_type (code or token), scope, and redirect_uri. Cognito uses that information to pick the client configuration and validate the redirect. 

---

### Google federation: two redirect URIs that people confuse

Google federation with Cognito introduces two different redirect concepts, and mixing them up leads to wasted time.

#### Google Console “Authorized redirect URI” (Google → Cognito)
This redirect URI is where Google sends the browser back after the user authenticates with Google. When Cognito is brokering the login, that destination must be Cognito’s federation response endpoint:

```json
https://<cognito-domain-prefix>.auth.<region>.amazoncognito.com/oauth2/idpresponse
```

AWS explicitly documents this pattern for Cognito + Google federation

#### Cognito App Client “Callback URL” (Cognito → Your app)
This is where Cognito sends the browser back after Cognito completes the flow and issues tokens (or an auth code). These are the callback_urls on the user pool client, and they must match the runtime redirect_uri exactly. 
This separation is fundamental: Google redirects to Cognito, and Cognito redirects to your website. 

---

### Where CloudFront fits in (static website hosting)

In this setup the website is served via CloudFront (with S3 as origin). CloudFront provides the public domain your users visit. Cognito’s callback_urls should allow that domain, because Cognito needs a safe list of places it can return a user after authentication. 

A key detail for static sites is that the callback URL must be a path CloudFront can actually serve. If you configure a callback like /auth/callback but you do not have a route handler or rewrite rule, CloudFront will ask the origin for /auth/callback and may return 403/404. One practical approach is to use the site root as the callback URL for early stages, because / maps cleanly to index.html without any SPA routing configuration. 

---

### End to end authentication flow (what happens at runtime)

Here is the flow that ties all resources together.

- User clicks “Sign in” on your CloudFront website. Your frontend constructs an authorization request against Cognito’s /oauth2/authorize endpoint on the user pool domain. 

![Cognito_Landing_Page](/images/Cognito_Landing_Page.png)
 
- Cognito validates the request using the user pool client configuration. It checks client_id, verifies the redirect_uri against callback_urls, and ensures the requested scopes are allowed. 

- Cognito federates to Google if your request includes identity_provider=Google or if the Hosted UI is configured to show Google and the user selects it. This is driven by the configured aws_cognito_identity_provider. 

![Cognito_Google_Auth](/images/Cognito_Google_Auth.png)
 
- Google authenticates the user and then redirects the browser back to Cognito at /oauth2/idpresponse. This URI must be listed in Google Cloud Console as an authorized redirect URI. 

- Cognito consumes Google’s response, maps attributes (like email), creates/updates the user record in the user pool, then completes the OAuth flow and redirects the browser to your website callback URL, including either tokens (response_type=token) or an auth code (response_type=code). 

- Your frontend reads the token/code, stores what it needs (for example in localStorage for a prototype), updates UI state, and uses the token later to call protected APIs. 

![Cognito_Auth_User](/images/Cognito_Auth_User.png)
 
---

### End to End Architecture Flow

![Cognito_Architecture](/images/Cognito_Architecture.png)

---

### Terraform implementation (resources, key parameters, and why they matter)

Below is a clean Terraform layout for the four core resources. I am focusing on the parameters that materially affect how the system behaves.

#### User Pool

```yaml
resource "aws_cognito_user_pool" "main" {
name = "${var.app_name}-pool"
auto_verified_attributes = ["email
```

auto_verified_attributes = ["email"] is a common baseline for email based identity. 

#### User Pool Domain (Hosted UI + OAuth endpoints)

```yaml
resource "aws_cognito_user_pool_domain" "main" {
domain = "${var.app_name}-${var.env}-auth" # must be globally unique
```

This domain activates Cognito’s managed login pages and OAuth endpoints. Without this, there is no stable /oauth2/authorize or /oauth2/token endpoint for your browser flow. 

#### Google Identity Provider


```yaml
resource "aws_cognito_identity_provider" "google" {
user_pool_id = aws_cognito_user_pool.main.id
provider_name = "Google"
provider_type = "Google"

provider_details = {
client_id = var.google_client_id
client_secret = var.google_client_secret
authorize_scopes = "openid email"
    }
attribute_mapping = {
email = "email"
username = "sub"
    }
    }
```

•	provider_details holds the Google OAuth credentials and requested scopes. 
•	attribute_mapping controls which Google claims become Cognito attributes. 

### User Pool Client (your website’s OAuth client)

```yaml
resource "aws_cognito_user_pool_client" "web" {
name = "${var.app_name}-web-client"
user_pool_id = aws_cognito_user_pool.main.id
generate_secret = false
allowed_oauth_flows_user_pool_client = true
allowed_oauth_flows = ["implicit"] # or ["code"] when you move to code+PKCE
allowed_oauth_scopes = ["openid", "email"]
callback_urls = [
"https://${var.cloudfront_domain_name}",
"http://localhost:3000"
    ]
logout_urls = [
"https://${var.cloudfront_domain_name}",
"http://localhost:3000"
    ]
supported_identity_providers = ["Google"]
depends_on = [aws_cognito_identity_provider.google]
}
```

- callback_urls is the allow list Cognito uses to validate redirect_uri. If the runtime URL does not match, you get redirect_mismatch. 
- allowed_oauth_flows controls whether response_type=token (implicit) or response_type=code (authorization code) is allowed. Cognito documents that response_type must be code or token
- upported_identity_providers = ["Google"] enables Google for this app client; otherwise the client cannot use that IdP

---

### Outputs you need for Google Console and for your website

Your website needs values that it can use to form the authorization request. Google Console needs the Cognito federation callback.

#### Cognito domain and endpoints for the website

```yaml
data "aws_region" "current" {}

output "cognito_domain" {
value = "https://${aws_cognito_user_pool_domain.main.domain}.auth.${data.aws_region.current.name}.amazoncognito.com"
}

output "cognito_client_id" {
value = aws_cognito_user_pool_client.web.id
}

output "redirect_uri" {
value = "https://${var.cloudfront_domain_name}"
}
```

- The domain format and endpoint availability are tied to assigning a domain to the pool. 
- The redirect_uri must match a callback_urls entry. 9.2 Google Authorized Redirect URI (Google Console)

```yaml
output "google_authorized_redirect_uri" {
value = "https://${aws_cognito_user_pool_domain.main.domain}.auth.${data.aws_region.current.name}.amazoncognito.com/oauth2/idpresponse"
}
```

This is the value you paste into Google Cloud Console. AWS’s guidance for Cognito Google federation uses /oauth2/idpresponse on the Cognito domain. 

---

### Feeding Terraform outputs into website code (without hardcoding)
A static app.js cannot “read Terraform outputs” at runtime. The reliable pattern is to generate a small config file during deployment, then let app.js read it.

#### Generate config.js during CI/CD
Your GitHub Actions workflow runs Terraform, extracts outputs using terraform output -json, and writes a config.js into the website folder before syncing to S3. This keeps your repo clean and avoids hardcoding environment values.

Example generation (bash in the workflow):
```yaml
TF_OUT=$(terraform output -json)

COGNITO_DOMAIN=$(echo "$TF_OUT" | jq -r '.cognito_domain.value')
CLIENT_ID=$(echo "$TF_OUT" | jq -r '.cognito_client_id.value')
REDIRECT_URI=$(echo "$TF_OUT" | jq -r '.redirect_uri.value')

cat > ../Code/frontend_website/config.js <<EOF
window.APP_CONFIG = {
API_URL: "DUMMY_NOT_IMPLEMENTED_YET",
COGNITO_DOMAIN: "${COGNITO_DOMAIN}",
CLIENT_ID: "${CLIENT_ID}",
REDIRECT_URI: "${REDIRECT_URI}",
SCOPES: "openid email"
};
EOF
```

The keys in the JSON output map directly to your Terraform output blocks. 

#### Use config.js in your website
In index.html, load config first:

```html
<src = config.js>
<src = app.jss>
```

In app.js, consume it:

```js
const CONFIG = window.APP_CONFIG;
```

Now app.js stays static, and environment specific values come from the generated config.

---

#### CloudFront cache invalidation: why it mattered, and where to place it

When you update config.js, CloudFront can continue serving an older cached copy, which means the browser might keep using stale CLIENT_ID or REDIRECT_URI. That leads to redirect_mismatch even though Terraform and S3 have the correct values.
The operational fix is to invalidate CloudFront after uploading the new website artifacts to S3, so CloudFront fetches the latest objects on the next request. AWS’s CLI supports create-invalidation with distribution ID and paths

Example invalidation:
```yaml
aws cloudfront create-invalidation \
--distribution-id "$DISTRIBUTION_ID" \
--paths "/config.js" "/index.html" "/app.js"
```

The key is sequencing: sync first, invalidate second. That ensures CloudFront does not repopulate its cache with pre deployment content. 

---

### Closing notes on stability and common failure modes

Two issues show up repeatedly in Cognito Hosted UI integrations:

- redirect_mismatch – Almost always caused by the runtime redirect_uri not matching the configured callback_urls exactly, including scheme, host, and trailing slash. Cognito enforces this at the authorization endpoint. 

- Stale frontend config due to caching – CloudFront serving old config.js after a successful Terraform apply. The visible symptom is “it worked yesterday, same code, but login fails today.” Invalidation fixes it quickly; long term you can tune cache policies. 

Once those two are handled, the overall solution becomes very predictable: Cognito owns identity, Google is just an upstream identity provider, your app client defines what is allowed, and the user pool domain exposes the OAuth surface your browser talks to. 

