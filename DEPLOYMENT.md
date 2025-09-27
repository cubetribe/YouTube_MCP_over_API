# YouTube MCP Extended - Deployment Guide

## Quick Start

### Prerequisites
- Node.js 20+
- Docker (optional but recommended)
- Git

### Local Development
```bash
# Clone repository
git clone <repository-url>
cd youtube-mcp-extended

# Install dependencies
npm install

# Validate environment
npm run validate:env

# Create environment file
npm run generate:env
# Edit .env with your YouTube API credentials

# Start development server
npm run dev
```

### Docker Development
```bash
# Start with Docker Compose
npm run docker:dev

# Or build and run manually
npm run docker:build
npm run docker:run
```

### Production Deployment
```bash
# Build for production
npm run build:deploy

# Deploy with Docker
npm run deploy
```

## Environment Configuration

### Required Environment Variables
```bash
YOUTUBE_CLIENT_ID=your_youtube_client_id_here
YOUTUBE_CLIENT_SECRET=your_youtube_client_secret_here
```

### Optional Environment Variables
```bash
YOUTUBE_REDIRECT_URI=http://localhost:3000/callback
OAUTH_ENCRYPTION_SECRET=your_32_character_encryption_key
NODE_ENV=production
PORT=3000
LOG_LEVEL=info
```

## Build System

### Available Build Commands
- `npm run build` - Standard production build
- `npm run build:dev` - Development build with source maps
- `npm run build:prod` - Optimized production build
- `npm run build:watch` - Watch mode for development
- `npm run build:analyze` - Bundle size analysis
- `npm run build:deploy` - Full deployment build

### Build Optimization
The build system automatically:
- Minifies JavaScript for production
- Generates source maps for debugging
- Removes development-only code
- Optimizes dependencies
- Creates build manifests

## Docker Deployment

### Development Environment
```bash
# Start development stack
docker-compose up --build

# With specific services
docker-compose up youtube-mcp-extended redis-cache
```

### Production Environment
```bash
# Start production stack
docker-compose -f docker-compose.prod.yml up --build

# With monitoring (optional)
docker-compose -f docker-compose.prod.yml --profile monitoring up
```

### Docker Commands
```bash
# Build image
npm run docker:build

# Run container
npm run docker:run

# View logs
docker logs youtube-mcp-extended

# Stop container
docker stop youtube-mcp-extended
```

## CI/CD Pipeline

### GitHub Actions
The project includes automated CI/CD with:
- Code quality checks (linting, formatting, type checking)
- Security vulnerability scanning
- Multi-version Node.js testing
- Docker image building and publishing
- Automated deployments to staging and production

### Release Process
```bash
# Create release
npm run version:minor
git push --tags

# This triggers:
# 1. Automated testing
# 2. Docker image build
# 3. Security scanning
# 4. Production deployment
```

## Health Monitoring

### Health Check
```bash
# Run comprehensive health check
npm run health-check

# Or use TypeScript directly
tsx scripts/validate/health-check.ts
```

### Monitoring Endpoints
- Health: `GET /health`
- Metrics: `GET /metrics` (if enabled)
- Version: `GET /version`

### Health Check Results
The health check validates:
- Node.js version compatibility
- Memory and disk usage
- Environment variables
- Dependencies
- Build status
- Network connectivity
- Security configuration

## Security

### Container Security
- Non-root user execution
- Minimal Alpine Linux base image
- Regular security updates
- Vulnerability scanning with Trivy

### Application Security
- OAuth token encryption (optional)
- Environment variable validation
- Dependency vulnerability scanning
- HTTPS enforcement in production

### Best Practices
1. Use environment variables for secrets
2. Enable OAuth token encryption
3. Regularly update dependencies
4. Monitor security advisories
5. Use strong, unique passwords

## Troubleshooting

### Common Issues

#### Build Failures
```bash
# Check TypeScript errors
npm run type-check

# Validate environment
npm run validate:env

# Clean and rebuild
npm run clean && npm run build
```

#### Docker Issues
```bash
# Check container logs
docker logs youtube-mcp-extended

# Restart container
docker restart youtube-mcp-extended

# Rebuild without cache
docker build --no-cache -t youtube-mcp-extended .
```

#### Environment Issues
```bash
# Generate new .env template
npm run generate:env

# Validate current environment
npm run validate:env

# Check system health
npm run health-check
```

### Performance Issues
```bash
# Analyze bundle size
npm run build:analyze

# Monitor system resources
npm run health-check

# Check memory usage
docker stats youtube-mcp-extended
```

## Advanced Configuration

### Custom Build Configuration
Edit `agents/buildops/build-scripts.ts` to customize:
- Build targets
- Optimization settings
- Environment variable handling
- Source map generation

### Docker Customization
Modify `Dockerfile` for:
- Custom base images
- Additional dependencies
- Security hardening
- Performance tuning

### CI/CD Customization
Update `.github/workflows/ci.yml` for:
- Additional test environments
- Custom deployment targets
- Security scanning configuration
- Notification settings

## Scaling and Performance

### Horizontal Scaling
```bash
# Scale with Docker Compose
docker-compose up --scale youtube-mcp-extended=3

# Use load balancer (nginx example)
docker-compose --profile proxy up
```

### Performance Optimization
1. Enable Redis caching
2. Use CDN for static assets
3. Optimize database queries
4. Monitor and tune JVM settings
5. Implement connection pooling

### Monitoring Setup
```bash
# Start with monitoring stack
docker-compose -f docker-compose.prod.yml --profile monitoring up

# Access dashboards
# Prometheus: http://localhost:9090
# Grafana: http://localhost:3001 (admin/admin)
```

## Backup and Recovery

### Data Backup
```bash
# Backup application data
docker exec youtube-mcp-extended tar -czf /tmp/backup.tar.gz /app/tokens /app/backups /app/storage

# Copy backup
docker cp youtube-mcp-extended:/tmp/backup.tar.gz ./backup-$(date +%Y%m%d).tar.gz
```

### Database Backup (if applicable)
```bash
# Redis backup
docker exec youtube-mcp-redis redis-cli BGSAVE

# Copy backup
docker cp youtube-mcp-redis:/data/dump.rdb ./redis-backup-$(date +%Y%m%d).rdb
```

### Recovery Process
1. Stop application containers
2. Restore data volumes
3. Restart containers
4. Verify application health

## Production Checklist

### Pre-deployment
- [ ] Environment variables configured
- [ ] SSL certificates installed
- [ ] Database backups created
- [ ] Health checks passing
- [ ] Security scan completed

### Post-deployment
- [ ] Health endpoints responding
- [ ] Logs showing normal operation
- [ ] Monitoring alerts configured
- [ ] Backup procedures tested
- [ ] Rollback plan documented

### Maintenance
- [ ] Regular security updates
- [ ] Dependency updates
- [ ] Log rotation configured
- [ ] Monitoring dashboards reviewed
- [ ] Performance metrics tracked

## Support and Resources

### Documentation
- [Build System Details](agents/deployment/reports/implementation.md)
- [API Documentation](docs/api.md)
- [Architecture Overview](docs/architecture.md)

### Monitoring
- Application logs: `docker logs youtube-mcp-extended`
- System metrics: `npm run health-check`
- Performance analysis: `npm run build:analyze`

### Getting Help
1. Check this deployment guide
2. Review health check output
3. Examine application logs
4. Consult troubleshooting section
5. Check GitHub issues

---

For detailed technical implementation details, see [Implementation Report](agents/deployment/reports/implementation.md).