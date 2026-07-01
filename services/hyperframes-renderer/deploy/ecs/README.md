# ECS (Fargate) — HyperFramesRenderer

## Notes

- Prefer **Fargate** for stateless API or worker processes.
- Attach a task role with least privilege (S3, SQS, DynamoDB, etc.) when you add integrations.
- Expose **3030** behind an Application Load Balancer or Service Connect as needed.

## Ephemeral rendering

Bind-mount or use Fargate ephemeral storage for `tmp/rendering` at runtime.
