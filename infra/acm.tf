resource "aws_acm_certificate" "cert" {

  provider = aws.use1

  domain_name = var.domain_name

  validation_method = "DNS"


  subject_alternative_names = [

    "www.${var.domain_name}"

  ]


  lifecycle {

    create_before_destroy = true

  }

}