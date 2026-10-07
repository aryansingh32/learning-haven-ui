# Judge0 code-execution sandbox

Forge runs learner Java code in a self-hosted [Judge0 CE](https://github.com/judge0/judge0)
instead of on the API host. Judge0 is GPLv3; we run it **unmodified, as a separate
service** reached over HTTP, so Forge's own code is not affected by its licence.

## Host requirements

- A dedicated VM (not a PaaS container): Judge0 runs privileged containers.
- Docker + Docker Compose.
- **cgroup v1.** On Ubuntu 22.04+ add `systemd.unified_cgroup_hierarchy=0` to
  `GRUB_CMDLINE_LINUX` in `/etc/default/grub`, run `sudo update-grub`, reboot.
- Keep port 2358 private: only the API should reach it (VPC / firewall).

## Install (v1.13.1)

```bash
wget https://github.com/judge0/judge0/releases/download/v1.13.1/judge0-v1.13.1.zip
unzip judge0-v1.13.1.zip && cd judge0-v1.13.1
# In judge0.conf set REDIS_PASSWORD and POSTGRES_PASSWORD to long random values,
# and AUTHN_TOKEN to a long random value (sent by the API as X-Auth-Token).
docker-compose up -d db redis && sleep 10
docker-compose up -d && sleep 5
curl -s http://localhost:2358/about
```

## Wire up the API

```
JUDGE0_URL=http://<private-ip>:2358
JUDGE0_AUTH_TOKEN=<AUTHN_TOKEN from judge0.conf>
```

`GET /api/execute/health` reports `"backend": "judge0"` and `java: true` when it is reachable.
Java is language id 62 in Judge0 CE v1.13.1; override with `JUDGE0_JAVA_LANGUAGE_ID`
if your instance differs (`GET /languages`).

## Limits applied per run

CPU 5 s, wall clock 10 s, memory 256 MB, no network (Judge0 default).
