# Ubuntu deployment and GitHub Actions setup

The deployment path is `push to main` -> test -> Docker image -> Docker Hub -> SSH to Ubuntu -> replace the running container. Images are deployed with their immutable commit-SHA tag, not `latest`.

## 1. Prepare Ubuntu

Run once on the server as an administrator:

```bash
sudo adduser --disabled-password --gecos "" deploy
sudo usermod -aG docker deploy
sudo apt update
sudo apt install -y docker.io
sudo systemctl enable --now docker
```

Allow inbound TCP port `8080` in the firewall/security group (or publish through Nginx). Log in again after changing Docker group membership and confirm `deploy` can run `docker ps`.

## 2. Create and install an SSH deployment key

Create this key on a secure administrator computer, not on the server. Its private half goes to GitHub Secrets and must never be committed or shared.

```bash
ssh-keygen -t ed25519 -C "github-actions-ci-cd-docker" -f ~/.ssh/ci_cd_deploy
ssh-copy-id -i ~/.ssh/ci_cd_deploy.pub deploy@YOUR_SERVER_IP
```

If `ssh-copy-id` is not installed, paste `~/.ssh/ci_cd_deploy.pub` into `/home/deploy/.ssh/authorized_keys` on the Ubuntu server:

```bash
sudo install -d -m 700 -o deploy -g deploy /home/deploy/.ssh
sudo nano /home/deploy/.ssh/authorized_keys
sudo chown deploy:deploy /home/deploy/.ssh/authorized_keys
sudo chmod 600 /home/deploy/.ssh/authorized_keys
```

Test it before adding GitHub configuration:

```bash
ssh -i ~/.ssh/ci_cd_deploy deploy@YOUR_SERVER_IP 'docker ps'
```

Generating a private key on the server and then copying it out is not recommended: it creates a server-held credential and needlessly exposes the private key.

## 3. GitHub configuration

Go to **Repository Settings -> Secrets and variables -> Actions** and add these secrets:

| Secret | Value |
| --- | --- |
| `DOCKER_USERNAME` | Docker Hub username |
| `DOCKERHUB_TOKEN` | Docker Hub access token, not password |
| `SSH_PRIVATE_KEY` | Complete contents of `~/.ssh/ci_cd_deploy` |

Add these **variables**:

| Variable | Value |
| --- | --- |
| `SERVER_IP` | Ubuntu server public IP address or DNS name |
| `SSH_USER` | `deploy` |

The workflow creates its `known_hosts` file at deployment time with `ssh-keyscan -H "$SERVER_IP"`. This is simpler for a training environment, but it does not independently verify the host key against a cloud-console fingerprint. For production, prefer a verified `SSH_KNOWN_HOSTS` secret.

## 4. Deployment

Push to `main`. A successful CI pipeline pushes both a SHA-tagged image and `latest`; CD uses the SHA-tagged image and starts `cicd-pipeline-container` with `--restart unless-stopped` on port 8080.

Open `http://YOUR_SERVER_IP:8080/` to verify the service.
