# Deployment reference

**Deployment is an external write, not a routine verification step.** Obtain
explicit approval for the target and revision before deploying, restarting, or
stopping shared services. Push and merge require their own authorization. Follow
the [employee-data and external-action boundaries](AGENTS.md#safety-boundaries).

## Checked-in configuration

- Repository: `tinkertanker/hr-onboarding-talenox`.
- [deploy.sh](deploy.sh) connects to `tinkertanker@dev.tk.sg`, enters
  `Docker/hr-onboarder-talenox`, pulls the remote checkout's current tracking branch,
  then rebuilds/restarts with Docker Compose. It does not select or pin a revision.
- [docker-compose.yml](docker-compose.yml) configures `hr-onboarding.tk.sg`, internal
  port 3000, the external `devtksg` network, and nginx-proxy / Let's Encrypt routing.
  It loads `.env` and sets `NODE_ENV=production`; it is not a local mock environment.
- [Dockerfile](Dockerfile) defines the runtime image. The health check is a read-only
  GET to `/api/health`; it does not validate Talenox integration or email delivery.

These are repository-configured targets, not confirmation of live server state.
Older migration documents may name different repositories, branches, or paths.

## Before an authorized deployment

Confirm the live checkout path, remote, branch, exact revision, working-tree state,
and rollback plan. Do not run `deploy.sh` blindly: its unpinned pull may deploy more
than the reviewed change. Confirm the shared network/proxy and TLS configuration.

Confirm the intended Talenox account/API endpoint and Resend sender/recipients
without printing credentials or employee data. See [configuration](README.md#configuration)
and [.env.example](.env.example); production also requires `ALLOWED_ORIGINS`, which
the template does not currently include. Keep `.env` out of version control.

Update-particulars OTP/session storage is in memory: retain a single app process
unless shared storage is implemented; a restart invalidates active sessions.

After an authorized rollout, check health and inspect logs without copying employee
data or secrets. Deployment approval does not authorize test employee creation,
updates, invitations, OTPs, or other real email. Never submit fixtures to production.
Update the infrastructure's Active Containers documentation when applicable.
