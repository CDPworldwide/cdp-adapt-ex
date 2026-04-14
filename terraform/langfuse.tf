provider "google" {
  project = "project-bb4fd058-24e7-4ccb-b06"
  region  = "us-central1"
}

module "langfuse" {
  source = "github.com/langfuse/langfuse-terraform-gcp?ref=0.3.3"

  domain = "langfuse-host.com"

  # Optional use a different name for your installation
  # e.g. when using the module multiple times on the same GCP project
  name   = "langfuse"

  # Optional: Configure the VPC
  subnetwork_cidr = "10.0.0.0/16"

  # Optional: Configure the Langfuse Helm chart version
  langfuse_chart_version = "1.5.14"

  additional_env = [
    {
      name  = "AUTH_DISABLE_SIGNUP"
      value = "true"
    },
    {
      name  = "LANGFUSE_INIT_ORG_ID"
      value = "default"
    },
    {
      name  = "LANGFUSE_INIT_PROJECT_ID"
      value = "default"
    },
    {
      name  = "LANGFUSE_INIT_USER_EMAIL"
      value = "admin@example.com"
    },
    {
      name  = "LANGFUSE_INIT_USER_NAME"
      value = "Admin"
    },
    {
      name  = "LANGFUSE_INIT_USER_PASSWORD"
      value = "<see_secret_manager>"
    }
  ]
}

provider "kubernetes" {
  host                   = module.langfuse.cluster_host
  cluster_ca_certificate = module.langfuse.cluster_ca_certificate
  token                  = module.langfuse.cluster_token
}

provider "helm" {
  kubernetes {
    host                   = module.langfuse.cluster_host
    cluster_ca_certificate = module.langfuse.cluster_ca_certificate
    token                  = module.langfuse.cluster_token
  }
}
