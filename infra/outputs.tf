output "cloudfront_domain" {

  value = aws_cloudfront_distribution.cdn.domain_name

}


output "acm_dns_validation" {

  value = aws_acm_certificate.cert.domain_validation_options

}