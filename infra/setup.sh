#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${PROJECT_ID:?Set PROJECT_ID}"
REGION="${REGION:-asia-south1}"
ZONE="${ZONE:-asia-south1-a}"
ARTIFACT_REPO="${ARTIFACT_REPO:-athleteiq}"
VIDEOS_BUCKET="${VIDEOS_BUCKET:-${PROJECT_ID}-athleteiq-videos}"
REPORTS_BUCKET="${REPORTS_BUCKET:-${PROJECT_ID}-athleteiq-reports}"
REDIS_INSTANCE="${REDIS_INSTANCE:-athleteiq-redis}"
SQL_INSTANCE="${SQL_INSTANCE:-athleteiq-postgres}"
SQL_TIER="${SQL_TIER:-db-custom-2-7680}"
SQL_DB="${SQL_DB:-athleteiq}"
SQL_USER="${SQL_USER:-athleteiq_app}"
SQL_PASSWORD="${SQL_PASSWORD:?Set SQL_PASSWORD}"
SERVICE_ACCOUNT="${SERVICE_ACCOUNT:-athleteiq-runtime@${PROJECT_ID}.iam.gserviceaccount.com}"
GEMINI_API_KEY="${GEMINI_API_KEY:?Set GEMINI_API_KEY}"
FIREBASE_PROJECT_ID_SECRET="${FIREBASE_PROJECT_ID_SECRET:?Set FIREBASE_PROJECT_ID_SECRET}"
FIREBASE_SERVICE_ACCOUNT_KEY="${FIREBASE_SERVICE_ACCOUNT_KEY:?Set FIREBASE_SERVICE_ACCOUNT_KEY}"
CORS_ORIGIN="${CORS_ORIGIN:?Set CORS_ORIGIN}"
NEXT_PUBLIC_FIREBASE_API_KEY="${NEXT_PUBLIC_FIREBASE_API_KEY:?Set NEXT_PUBLIC_FIREBASE_API_KEY}"
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="${NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN:?Set NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN}"
NEXT_PUBLIC_FIREBASE_PROJECT_ID="${NEXT_PUBLIC_FIREBASE_PROJECT_ID:?Set NEXT_PUBLIC_FIREBASE_PROJECT_ID}"
NEXT_PUBLIC_FIREBASE_APP_ID="${NEXT_PUBLIC_FIREBASE_APP_ID:?Set NEXT_PUBLIC_FIREBASE_APP_ID}"

gcloud config set project "${PROJECT_ID}"
gcloud config set run/region "${REGION}"
gcloud config set compute/zone "${ZONE}"

echo "Enabling required APIs..."
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  storage.googleapis.com \
  pubsub.googleapis.com \
  secretmanager.googleapis.com \
  firebase.googleapis.com \
  sqladmin.googleapis.com \
  redis.googleapis.com \
  iam.googleapis.com \
  cloudresourcemanager.googleapis.com

echo "Creating Artifact Registry repository..."
gcloud artifacts repositories create "${ARTIFACT_REPO}" \
  --repository-format=docker \
  --location="${REGION}" \
  --description="AthleteIQ production images" || true

echo "Creating GCS buckets..."
gcloud storage buckets create "gs://${VIDEOS_BUCKET}" --location="${REGION}" --uniform-bucket-level-access || true
gcloud storage buckets create "gs://${REPORTS_BUCKET}" --location="${REGION}" --uniform-bucket-level-access || true

echo "Applying CORS policy to videos bucket..."
gcloud storage buckets update "gs://${VIDEOS_BUCKET}" --cors-file=infra/cors.json

echo "Creating Redis instance..."
gcloud redis instances create "${REDIS_INSTANCE}" \
  --region="${REGION}" \
  --tier=standard-ha \
  --size=4 \
  --redis-version=redis_7_0 || true

echo "Creating Cloud SQL Postgres 15 instance..."
gcloud sql instances create "${SQL_INSTANCE}" \
  --database-version=POSTGRES_15 \
  --region="${REGION}" \
  --tier="${SQL_TIER}" \
  --storage-size=100GB \
  --storage-auto-increase \
  --availability-type=regional \
  --backup-start-time=02:30 || true

gcloud sql databases create "${SQL_DB}" --instance="${SQL_INSTANCE}" || true
gcloud sql users create "${SQL_USER}" --instance="${SQL_INSTANCE}" --password="${SQL_PASSWORD}" || true

SQL_IP="$(gcloud sql instances describe "${SQL_INSTANCE}" --format='value(ipAddresses[0].ipAddress)')"
REDIS_HOST="$(gcloud redis instances describe "${REDIS_INSTANCE}" --region="${REGION}" --format='value(host)')"

DATABASE_URL="postgresql://${SQL_USER}:${SQL_PASSWORD}@${SQL_IP}:5432/${SQL_DB}?schema=public"
REDIS_URL="redis://${REDIS_HOST}:6379"

declare -A SECRETS
SECRETS=(
  [DATABASE_URL]="${DATABASE_URL}"
  [REDIS_URL]="${REDIS_URL}"
  [GCS_PROJECT_ID]="${PROJECT_ID}"
  [GCS_BUCKET_NAME]="${VIDEOS_BUCKET}"
  [REPORTS_BUCKET]="${REPORTS_BUCKET}"
  [JWT_SECRET]="$(openssl rand -base64 48)"
  [INTERNAL_SERVICE_TOKEN]="$(openssl rand -hex 32)"
  [BACKEND_INTERNAL_URL]="https://athleteiq-backend-${REGION}.a.run.app"
  [GEMINI_API_KEY]="${GEMINI_API_KEY}"
  [FIREBASE_PROJECT_ID]="${FIREBASE_PROJECT_ID_SECRET}"
  [FIREBASE_SERVICE_ACCOUNT_KEY]="${FIREBASE_SERVICE_ACCOUNT_KEY}"
  [CORS_ORIGIN]="${CORS_ORIGIN}"
  [NEXT_PUBLIC_FIREBASE_API_KEY]="${NEXT_PUBLIC_FIREBASE_API_KEY}"
  [NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN]="${NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN}"
  [NEXT_PUBLIC_FIREBASE_PROJECT_ID]="${NEXT_PUBLIC_FIREBASE_PROJECT_ID}"
  [NEXT_PUBLIC_FIREBASE_APP_ID]="${NEXT_PUBLIC_FIREBASE_APP_ID}"
)

for KEY in "${!SECRETS[@]}"; do
  if gcloud secrets describe "${KEY}" >/dev/null 2>&1; then
    printf "%s" "${SECRETS[$KEY]}" | gcloud secrets versions add "${KEY}" --data-file=-
  else
    printf "%s" "${SECRETS[$KEY]}" | gcloud secrets create "${KEY}" --replication-policy=automatic --data-file=-
  fi
done

echo "Creating runtime service account..."
gcloud iam service-accounts create athleteiq-runtime --display-name "AthleteIQ Runtime" || true

echo "Granting IAM roles..."
gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/run.invoker"
gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/secretmanager.secretAccessor"
gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/storage.objectAdmin"
gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/cloudsql.client"
gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/redis.editor"

echo "Setup complete."
echo "SQL instance: ${SQL_INSTANCE}"
echo "Redis host: ${REDIS_HOST}"
echo "Videos bucket: gs://${VIDEOS_BUCKET}"
echo "Reports bucket: gs://${REPORTS_BUCKET}"
