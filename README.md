# GitHub Actions ile Ubuntu'ya Docker dağıtımı

Bu küçük Express uygulaması GitHub Actions ile test edilir, Docker Hub'daki private `devops-app` deposuna imaj olarak yollanır ve SSH üzerinden Ubuntu sunucuda container olarak çalıştırılır. İki workflow vardır:

- `.github/workflows/ci.yml` (**CI**): test, build ve Docker Hub push.
- `.github/workflows/cd.yml` (**CD - Deploy to Ubuntu**): CI başarıyla bitince otomatik başlar ve sunucuda container'ı günceller.

```mermaid
flowchart LR
    C["CI<br/>test + build + push"] --> H["Docker Hub<br/>devops-app"]
    C -- "başarılı bitince" --> D["CD<br/>SSH (student)"]
    D --> S["Ubuntu sunucu"]
    S -- "docker pull" --> H
    S --> K["cicd-pipeline-container<br/>19001 → 8080"]
```

## 0. Projeyi kendi hesabınıza alın

Workflow'ları kendi GitHub hesabınızda çalıştırmak için projeyi fork veya import ile kendi hesabınıza alın.

**Fork:**

1. `https://github.com/hakanbayraktar/ci-cd-docker` adresini açın.
2. Sağ üstteki **Fork** düğmesine basın.
3. **Owner** olarak kendi hesabınızı seçip **Create fork** düğmesine basın.
4. Kendi fork'unuzda **Actions** sekmesini açın ve **I understand my workflows, go ahead and enable them** düğmesine basın. GitHub fork'larda workflow'ları kapalı getirir; bu düğmeye basılmazsa CI ve CD hiç çalışmaz.

**Import:**

1. GitHub'da sağ üstteki **+** menüsünden **Import repository** seçin.
2. **The URL for your source repository** alanına `https://github.com/hakanbayraktar/ci-cd-docker.git` yazın.
3. **Owner** ve **Repository name** seçip **Begin import** düğmesine basın. Import edilen repoda workflow'lar açık gelir.

Bundan sonraki bütün adımlar kendi reponuzda yapılır. Secret ve variable'lar fork veya import ile gelmez; 3. adımda kendi değerlerinizle eklersiniz.

## 1. Sunucuyu kontrol et

Aşağıdaki komutları sunucuda `student` kullanıcısıyla çalıştırın. Docker çalışmalı ve `student` kullanıcısı `docker` grubunda olmalıdır:

```bash
docker ps
```

Uygulama host'un `19001` portunu kullanır. Port boş olmalıdır; çıktıda container görünmemelidir:

```bash
docker ps --filter publish=19001
```

`k8s-labs` Kind cluster'ı da `19001` portunu tutar. Çıktıda `k8s-labs-control-plane` görünüyorsa bu lab sırasında cluster çalışmamalıdır.

<details>
<summary><strong>Docker kurulu olmayan boş bir Ubuntu sunucu</strong></summary>

Docker yoksa kurun ve kullanıcıyı `docker` grubuna ekleyin. Docker CE kurulu bir sunucuda `docker.io` kurmayın; paketler çakışır.

```bash
sudo apt update && sudo apt install -y docker.io
sudo systemctl enable --now docker
sudo usermod -aG docker student
```

Grup değişikliği için oturumu kapatıp yeniden açın.

</details>

## 2. SSH anahtarını oluştur ve yükle

CD workflow'u sunucuya `student` kullanıcısıyla, yalnızca bu iş için oluşturulan bir anahtarla bağlanır. Anahtarı sunucuda oluşturun. Workflow parola giremeyeceği için anahtara parola konmaz (`-N ""`):

```bash
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/github_actions_deploy -N ""
```

Public anahtarı `student` kullanıcısının yetkili anahtarlarına ekleyin:

```bash
cat ~/.ssh/github_actions_deploy.pub >> ~/.ssh/authorized_keys
```

```bash
chmod 600 ~/.ssh/authorized_keys
```

Anahtarla bağlanılabildiğini deneyin. Çıktı `docker ps` listesidir:

```bash
ssh -i ~/.ssh/github_actions_deploy -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new student@localhost 'docker ps'
```

Private anahtarı ekrana yazdırın; 3. adımda `SSH_PRIVATE_KEY` değeri olarak bunu kopyalayacaksınız:

```bash
cat ~/.ssh/github_actions_deploy
```

Sunucunun public IP adresi (`SERVER_IP`):

```bash
curl -s ifconfig.me; echo
```

## 3. Secret ve variable'ları ekle

Docker Hub'da private `devops-app` reposu olmalı. Token kullanın; Docker Hub parola kullanmayın.

Reponuzda **Settings → Secrets and variables → Actions** sayfasını açın. Secret'ları **Secrets** sekmesinde **New repository secret**, variable'ları **Variables** sekmesinde **New repository variable** ile ekleyin:

| Tür | Ad | Değer |
| --- | --- | --- |
| Secret | `DOCKER_USERNAME` | Docker Hub kullanıcı adı |
| Secret | `DOCKERHUB_TOKEN` | Docker Hub access token |
| Secret | `SSH_PRIVATE_KEY` | `cat ~/.ssh/github_actions_deploy` çıktısının tamamı (`-----BEGIN` ve `-----END` satırları dahil) |
| Variable | `SERVER_IP` | Sunucunun public IP adresi |
| Variable | `SSH_USER` | `student` |

## 4. Dağıtım

İlk çalıştırmayı elle başlatın: **Actions → CI → Run workflow** yolunu açın, `main` dalını seçip **Run workflow** düğmesine basın. Sonraki her `main` push'u CI'ı kendiliğinden başlatır.

CI başarıyla bitince **CD - Deploy to Ubuntu** otomatik başlar. CI başarısız olursa (örneğin test kırılırsa) CD çalışmaz ve sunucudaki container değişmez. GitHub-hosted `ubuntu-latest` runner kullanılır; ayrıca runner kurmanız gerekmez.

Her dağıtım commit SHA etiketi kullanır ve sunucuda eski `cicd-pipeline-container` kaldırılır.

CD bitince sunucuda container'ı görün. `PORTS` sütununda `0.0.0.0:19001->8080/tcp` yazar:

```bash
docker ps --filter name=cicd-pipeline-container
```

```bash
curl -s http://localhost:19001/; echo
```

Sunucuda port `19001`, container içinde ise uygulama portu `8080` kullanılır. Tarayıcıdan açılacak adresler:

```bash
echo "https://$(hostname)-app1.devopsatolyesi.com"
```

```bash
echo "http://$(curl -s ifconfig.me):19001"
```

## Temizlik

Container'ı silin:

```bash
docker rm -f cicd-pipeline-container
```

Workflow'un anahtarını `authorized_keys` dosyasından çıkarın ve anahtar dosyalarını silin:

```bash
sed -i '/github-actions-deploy/d' ~/.ssh/authorized_keys
```

```bash
rm -f ~/.ssh/github_actions_deploy ~/.ssh/github_actions_deploy.pub
```
