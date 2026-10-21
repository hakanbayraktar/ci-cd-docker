# Docker ile Ubuntu CI/CD Eğitimi

Bu küçük Express uygulaması, `main` dalına gönderilen kodu test eder, Docker Hub'da `devops-app` imajını oluşturur ve Ubuntu sunucuda Docker container olarak çalıştırır.

## 1. Ubuntu sunucusunu hazırla

Sunucuda bir kez çalıştırın:

```bash
sudo adduser --disabled-password --gecos "" deploy
sudo usermod -aG docker deploy
sudo apt update && sudo apt install -y docker.io
sudo systemctl enable --now docker
```

Güvenlik grubu/firewall üzerinde uygulama için TCP `8080`, SSH için TCP `22` açık olmalıdır.

## 2. SSH anahtarını oluştur ve yükle

Anahtarı kendi güvenli bilgisayarında oluşturun:

```bash
ssh-keygen -t ed25519 -C "ci-cd-deploy" -f ~/.ssh/ci_cd_deploy
ssh-copy-id -i ~/.ssh/ci_cd_deploy.pub deploy@SUNUCU_IP
ssh -i ~/.ssh/ci_cd_deploy deploy@SUNUCU_IP 'docker ps'
```

## 3. CI/CD değişkenlerini ekle

Docker Hub'da private `devops-app` reposu olmalı. Token kullanın; Docker Hub parola kullanmayın.

### GitHub Actions

Repository **Settings → Secrets and variables → Actions** bölümüne ekleyin:

| Tür | Ad | Değer |
| --- | --- | --- |
| Secret | `DOCKER_USERNAME` | Docker Hub kullanıcı adı |
| Secret | `DOCKERHUB_TOKEN` | Docker Hub access token |
| Secret | `SSH_PRIVATE_KEY` | `~/.ssh/ci_cd_deploy` private key içeriği |
| Variable | `SERVER_IP` | Ubuntu public IP/DNS |
| Variable | `SSH_USER` | `deploy` |

### GitLab CI/CD

GitLab projesinde **Settings → CI/CD → Variables** bölümüne aynı değerleri ekleyin: `DOCKER_USERNAME`, `DOCKERHUB_TOKEN`, `SSH_PRIVATE_KEY`, `SERVER_IP`, `SSH_USER`. `SSH_PRIVATE_KEY` değişkenini **File** türünde ekleyin; diğer hassas değerleri **Masked** yapın.

## 4. Dağıtım

- GitHub: `main` dalına push yapılınca CI test/build/push işlemini, ardından CD Ubuntu dağıtımını yapar.
- GitLab: `main` dalına push yapılınca `.gitlab-ci.yml` aynı sırayı uygular.

Her dağıtım commit SHA etiketi kullanır ve sunucuda eski `cicd-pipeline-container` kaldırılır.

- GitHub Actions dağıtımı: `http://SUNUCU_IP:8080/`
- GitLab CI/CD dağıtımı: `http://SUNUCU_IP:19003/` (container içindeki uygulama portu yine `8080`dir)
