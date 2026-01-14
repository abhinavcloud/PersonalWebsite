data "aws_cloudfront_cache_policy" "caching_optimized" {
    name = "Managed-CachingOptimized"
}

resource "aws_cloudfront_origin_access_control" "oac" {

  name = "abhinav-oac"

  origin_access_control_origin_type = "s3"

  signing_behavior = "always"

  signing_protocol = "sigv4"

}


resource "aws_cloudfront_distribution" "cdn" {

  enabled = true


  default_root_object = "index.html"


  aliases = [

    var.domain_name,

    "www.${var.domain_name}"

  ]


  origin {

    domain_name = aws_s3_bucket.site.bucket_regional_domain_name

    origin_id = "s3-site"


    origin_access_control_id = aws_cloudfront_origin_access_control.oac.id

  }


  default_cache_behavior {

    target_origin_id = "s3-site"

    viewer_protocol_policy = "redirect-to-https"

    allowed_methods = ["GET", "HEAD"]

    cached_methods = ["GET", "HEAD"]

    cache_policy_id = data.aws_cloudfront_cache_policy.caching_optimized.id

  }


  viewer_certificate {

    acm_certificate_arn = aws_acm_certificate.cert.arn

    ssl_support_method = "sni-only"

  }


  restrictions {

    geo_restriction {

      restriction_type = "none"

    }

  }

}