# Self-Hosting Guide (Community Edition)

> **Strategy Note:** This guide is for deploying the **Open Source Core**.
> For the full experience with Enterprise features (Advanced AI, Admin Dashboard, Priority Support), we recommend using our managed **Cloud SaaS** (Coming Soon).
>
> *Self-hosting is provided "as-is" for the community.*

## Purpose

This guide helps developers and early adopters run their own instance of the DevOci Core.

## Prerequisites

- Production MongoDB instance (Atlas recommended)
- Production Redis instance (Redis Cloud recommended)
- Stripe live keys
- Resend email service
- Gemini API key
- Sentry account

## Deployment Options

### Option 1: Docker + Docker Compose (Simplest)

1. **Build image**:

   ```bash
   docker build -t devoci-api .
   ```

2. **Run with compose**:

   ```bash
   docker-compose -f docker-compose.example.yml up -d
   ```

   *Make sure to inject environment variables!*

### Option 2: AWS EC2 + PM2

1. **SSH into server**:

   ```bash
   ssh ubuntu@your-server-ip
   ```

2. **Clone repo & Install**:

   ```bash
   git clone https://github.com/yourusername/devoci.git
   cd devoci
   pnpm install
   ```

3. **Setup environment**:
   Create `.env` with production values.

4. **Start with PM2**:

   ```bash
   pnpm install -g pm2
   pm2 start ecosystem.config.js --env production
   pm2 save
   ```

## Monitoring

- **Sentry**: Verify DSN is set in `.env`
- **Logs**: Check `logs/err.log` and `logs/out.log`
- **Uptime**: Use uptime monitoring services like Pingdom
