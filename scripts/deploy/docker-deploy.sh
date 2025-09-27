#!/bin/bash

# YouTube MCP Extended - Docker Deployment Script
# Automates Docker build and deployment process

set -e

# Configuration
IMAGE_NAME="youtube-mcp-extended"
REGISTRY="${DOCKER_REGISTRY:-ghcr.io}"
NAMESPACE="${DOCKER_NAMESPACE:-$USER}"
TAG="${DOCKER_TAG:-latest}"
PLATFORM="${DOCKER_PLATFORM:-linux/amd64,linux/arm64}"
BUILD_TARGET="${BUILD_TARGET:-production}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Help function
show_help() {
    cat << EOF
YouTube MCP Extended - Docker Deployment Script

Usage: $0 [OPTIONS] COMMAND

Commands:
    build           Build Docker image
    push            Push image to registry
    deploy          Build and push image
    run             Run container locally
    stop            Stop running container
    logs            Show container logs
    clean           Clean up old images
    help            Show this help

Options:
    -t, --tag TAG           Set image tag (default: latest)
    -r, --registry REG      Set registry (default: ghcr.io)
    -n, --namespace NS      Set namespace (default: \$USER)
    -p, --platform PLAT     Set platform(s) (default: linux/amd64,linux/arm64)
    --target TARGET         Set build target (default: production)
    --no-cache             Build without cache
    --push                 Push after build
    --dry-run              Show commands without executing

Examples:
    $0 build                                    # Build image
    $0 build --tag v1.0.0                     # Build with specific tag
    $0 deploy --registry my-registry.com      # Build and push to custom registry
    $0 run                                     # Run container locally
    $0 clean                                   # Clean up old images

Environment Variables:
    DOCKER_REGISTRY         Default registry
    DOCKER_NAMESPACE        Default namespace
    DOCKER_TAG             Default tag
    DOCKER_PLATFORM        Default platform(s)
    BUILD_TARGET           Build target (development|production)
EOF
}

# Parse command line arguments
parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            -t|--tag)
                TAG="$2"
                shift 2
                ;;
            -r|--registry)
                REGISTRY="$2"
                shift 2
                ;;
            -n|--namespace)
                NAMESPACE="$2"
                shift 2
                ;;
            -p|--platform)
                PLATFORM="$2"
                shift 2
                ;;
            --target)
                BUILD_TARGET="$2"
                shift 2
                ;;
            --no-cache)
                NO_CACHE="--no-cache"
                shift
                ;;
            --push)
                PUSH_AFTER_BUILD=true
                shift
                ;;
            --dry-run)
                DRY_RUN=true
                shift
                ;;
            -h|--help|help)
                show_help
                exit 0
                ;;
            build|push|deploy|run|stop|logs|clean)
                COMMAND="$1"
                shift
                ;;
            *)
                log_error "Unknown option: $1"
                show_help
                exit 1
                ;;
        esac
    done
}

# Validate prerequisites
validate_prerequisites() {
    log_info "Validating prerequisites..."

    # Check Docker
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed or not in PATH"
        exit 1
    fi

    # Check Docker daemon
    if ! docker info &> /dev/null; then
        log_error "Docker daemon is not running"
        exit 1
    fi

    # Check if we're in the right directory
    if [[ ! -f "package.json" ]]; then
        log_error "package.json not found. Are you in the project root?"
        exit 1
    fi

    # Check if Dockerfile exists
    if [[ ! -f "Dockerfile" ]]; then
        log_error "Dockerfile not found"
        exit 1
    fi

    log_success "Prerequisites validated"
}

# Get full image name
get_image_name() {
    if [[ -n "$NAMESPACE" ]]; then
        echo "$REGISTRY/$NAMESPACE/$IMAGE_NAME"
    else
        echo "$REGISTRY/$IMAGE_NAME"
    fi
}

# Execute command (with dry-run support)
execute() {
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "[DRY RUN] $*"
    else
        log_info "Executing: $*"
        "$@"
    fi
}

# Build Docker image
build_image() {
    local full_image_name
    full_image_name=$(get_image_name)

    log_info "Building Docker image..."
    log_info "Image: $full_image_name:$TAG"
    log_info "Platform: $PLATFORM"
    log_info "Build target: $BUILD_TARGET"

    # Prepare build command
    local build_cmd=(
        docker buildx build
        --platform "$PLATFORM"
        --target "$BUILD_TARGET"
        --tag "$full_image_name:$TAG"
        --tag "$full_image_name:latest"
    )

    # Add optional flags
    if [[ -n "$NO_CACHE" ]]; then
        build_cmd+=(--no-cache)
    fi

    if [[ "$PUSH_AFTER_BUILD" == "true" || "$COMMAND" == "deploy" ]]; then
        build_cmd+=(--push)
    else
        build_cmd+=(--load)
    fi

    # Add context
    build_cmd+=(.)

    # Execute build
    execute "${build_cmd[@]}"

    if [[ "$DRY_RUN" != "true" ]]; then
        log_success "Image built successfully: $full_image_name:$TAG"
    fi
}

# Push image to registry
push_image() {
    local full_image_name
    full_image_name=$(get_image_name)

    log_info "Pushing image to registry..."

    execute docker push "$full_image_name:$TAG"
    execute docker push "$full_image_name:latest"

    if [[ "$DRY_RUN" != "true" ]]; then
        log_success "Image pushed successfully: $full_image_name:$TAG"
    fi
}

# Run container locally
run_container() {
    local full_image_name
    full_image_name=$(get_image_name)

    log_info "Running container locally..."

    # Stop existing container if running
    if docker ps -q -f name="$IMAGE_NAME" | grep -q .; then
        log_warn "Stopping existing container..."
        execute docker stop "$IMAGE_NAME"
        execute docker rm "$IMAGE_NAME"
    fi

    # Prepare run command
    local run_cmd=(
        docker run
        --name "$IMAGE_NAME"
        --detach
        --restart unless-stopped
        --publish 3000:3000
    )

    # Add environment file if exists
    if [[ -f ".env" ]]; then
        run_cmd+=(--env-file .env)
    fi

    # Add volumes for persistent data
    run_cmd+=(
        --volume "$(pwd)/tokens:/app/tokens"
        --volume "$(pwd)/backups:/app/backups"
        --volume "$(pwd)/storage:/app/storage"
        --volume "$(pwd)/logs:/app/logs"
    )

    # Add image
    run_cmd+=("$full_image_name:$TAG")

    # Execute run command
    execute "${run_cmd[@]}"

    if [[ "$DRY_RUN" != "true" ]]; then
        log_success "Container started successfully"
        log_info "Container name: $IMAGE_NAME"
        log_info "Access URL: http://localhost:3000"
        log_info "View logs: docker logs $IMAGE_NAME"
    fi
}

# Stop container
stop_container() {
    log_info "Stopping container..."

    if docker ps -q -f name="$IMAGE_NAME" | grep -q .; then
        execute docker stop "$IMAGE_NAME"
        execute docker rm "$IMAGE_NAME"
        log_success "Container stopped and removed"
    else
        log_warn "No running container found"
    fi
}

# Show container logs
show_logs() {
    log_info "Showing container logs..."

    if docker ps -a -q -f name="$IMAGE_NAME" | grep -q .; then
        execute docker logs --follow --tail 100 "$IMAGE_NAME"
    else
        log_error "Container '$IMAGE_NAME' not found"
        exit 1
    fi
}

# Clean up old images
clean_images() {
    local full_image_name
    full_image_name=$(get_image_name)

    log_info "Cleaning up old images..."

    # Remove dangling images
    if docker images -f "dangling=true" -q | grep -q .; then
        execute docker rmi $(docker images -f "dangling=true" -q)
        log_success "Removed dangling images"
    else
        log_info "No dangling images found"
    fi

    # Remove old versions (keep last 5)
    local old_images
    old_images=$(docker images "$full_image_name" --format "{{.ID}}" | tail -n +6)

    if [[ -n "$old_images" ]]; then
        execute docker rmi $old_images
        log_success "Removed old image versions"
    else
        log_info "No old images to remove"
    fi
}

# Main execution
main() {
    # Parse arguments
    parse_args "$@"

    # Show configuration
    log_info "Configuration:"
    log_info "  Command: ${COMMAND:-none}"
    log_info "  Image: $(get_image_name):$TAG"
    log_info "  Platform: $PLATFORM"
    log_info "  Build target: $BUILD_TARGET"
    log_info "  Registry: $REGISTRY"

    if [[ "$DRY_RUN" == "true" ]]; then
        log_warn "DRY RUN MODE - No commands will be executed"
    fi

    echo ""

    # Validate prerequisites
    validate_prerequisites

    # Execute command
    case "${COMMAND:-help}" in
        build)
            build_image
            ;;
        push)
            push_image
            ;;
        deploy)
            build_image
            ;;
        run)
            run_container
            ;;
        stop)
            stop_container
            ;;
        logs)
            show_logs
            ;;
        clean)
            clean_images
            ;;
        help|*)
            show_help
            ;;
    esac

    log_success "Operation completed successfully!"
}

# Run main function
main "$@"