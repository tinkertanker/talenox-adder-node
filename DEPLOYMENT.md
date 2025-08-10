# Deployment Instructions for dev.tk.sg

This application is configured to run on the Tinkertanker Docker hosting infrastructure at dev.tk.sg.

## Quick Deploy

1. **SSH into the server:**
   ```bash
   ssh tinkertanker@dev.tk.sg
   ```

2. **Navigate to Docker directory:**
   ```bash
   cd ~/Docker
   ```

3. **Clone or pull the repository:**
   ```bash
   # If first time:
   git clone https://github.com/tinkertanker/talenox-adder-node.git talenox-onboarding
   
   # If updating:
   cd talenox-onboarding
   git pull origin docker-express-migration
   ```

4. **Set up environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env with actual API keys
   nano .env
   ```

5. **Build and run the container:**
   ```bash
   docker compose up -d --build
   ```

6. **Verify deployment:**
   - Check health: `curl https://hr-onboarding.tk.sg/api/health`
   - Visit: https://hr-onboarding.tk.sg

## Configuration Details

- **URL**: https://hr-onboarding.tk.sg
- **Network**: Uses the shared `devtksg` network for nginx-proxy integration
- **SSL**: Automatic Let's Encrypt certificates via nginx-proxy companion
- **Port**: Internal port 3000 (exposed via nginx-proxy)

## Maintenance

### View logs:
```bash
docker compose logs -f
```

### Restart container:
```bash
docker compose restart
```

### Stop container:
```bash
docker compose down
```

### Update and redeploy:
```bash
git pull
docker compose up -d --build
```

## Important Notes

- The container runs on the shared `devtksg` network
- No need to expose ports directly - nginx-proxy handles routing
- SSL certificates are automatic via Let's Encrypt
- Remember to update the Active Containers list in the main Docker documentation