.PHONY: dev build typecheck lint docker-build docker-run docker-push docker-buildx

# Defaults (override: make docker-build IMAGE=zxoir/cleanrr TAG=local)
IMAGE ?= zxoir/cleanrr
TAG   ?= local    # avoid :latest locally; CI should publish :latest on tags

dev:        ; npm run dev
build:      ; npm ci && npm run build
typecheck:  ; npm run typecheck
lint:       ; npm run lint || npm run format:check

docker-build:
	docker build --pull -t $(IMAGE):$(TAG) .

docker-run:
	docker run --rm --name cleanrr \
	  --env-file .env \
	  -p 3000:3000 \
	  -v $(PWD)/session:/app/session \
	  -v $(PWD)/data:/app/data \
	  $(IMAGE):$(TAG)

docker-push:
	docker push $(IMAGE):$(TAG)

# Multi-arch release (requires buildx + Docker Hub login)
docker-buildx:
	docker buildx build \
	  --platform linux/amd64,linux/arm64 \
	  -t $(IMAGE):$(TAG) \
	  --push .
