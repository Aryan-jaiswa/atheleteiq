# AthleteIQ Production Checklist

## 1) Environment Variables and Secret Manager Mapping

Set these in Google Secret Manager and bind with `--set-secrets` in Cloud Run:

- `DATABASE_URL`: Postgres connection string for Cloud SQL.
- `REDIS_URL`: Memorystore endpoint (`redis://<host>:6379`).
- `JWT_SECRET`: backend JWT signing secret.
- `GEMINI_API_KEY`: Gemini API key for motion AI calls.
- `GCS_PROJECT_ID`: GCP project id.
- `GCS_BUCKET_NAME`: raw video + frame bucket.
- `REPORTS_BUCKET`: generated report PDF bucket.
- `INTERNAL_SERVICE_TOKEN`: shared backend↔motion/worker internal token.
- `BACKEND_INTERNAL_URL`: backend private URL for worker callbacks.
- `FIREBASE_PROJECT_ID`: Firebase project id.
- `FIREBASE_SERVICE_ACCOUNT_KEY`: Firebase admin service account JSON string.
- `CORS_ORIGIN`: frontend origin(s), comma-separated.
- `NEXT_PUBLIC_FIREBASE_API_KEY`: frontend Firebase API key.
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`: frontend Firebase auth domain.
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`: frontend Firebase project id.
- `NEXT_PUBLIC_FIREBASE_APP_ID`: frontend Firebase app id.

## 2) GCS Bucket Permissions

Assign `roles/storage.objectAdmin` to the runtime service account on:

- `gs://<project>-athleteiq-videos`
- `gs://<project>-athleteiq-reports`

Apply CORS policy:

```bash
gcloud storage buckets update gs://<videos-bucket> --cors-file=infra/cors.json
```

## 3) Firebase Auth Whitelist

In Firebase Console → Authentication → Settings → Authorized Domains:

- `athleteiq.app`
- `www.athleteiq.app`
- `<frontend-cloud-run-url>.a.run.app`
- `localhost`

## 4) Cloud Run Service-to-Service Auth

Backend should call motion-service using internal ingress:

1. Deploy motion-service with `--no-allow-unauthenticated`.
2. Grant backend runtime SA `roles/run.invoker` on `athleteiq-motion`.
3. Set `BACKEND_INTERNAL_URL` secret for worker callbacks.
4. Include `x-internal-token: $INTERNAL_SERVICE_TOKEN` for internal endpoints.

## 5) MediaPipe Model Download on Startup

MediaPipe downloads model assets on first invocation; keep `athleteiq-motion` warm:

- Deploy with `--min-instances=1`.
- Use startup probe hitting `/health`.
- For cold-start prewarm after deploy:

```bash
curl -s https://<motion-service-url>/health
```

## 6) First Migration (Prisma)

Run once after backend deploy using Cloud Run Job:

```bash
gcloud run jobs create athleteiq-migrate \
  --image=<backend-image> \
  --region=<region> \
  --command=npx \
  --args=prisma,migrate,deploy \
  --set-secrets=DATABASE_URL=DATABASE_URL:latest

gcloud run jobs execute athleteiq-migrate --region=<region> --wait
```

## 7) Load Testing Baseline (100 Concurrent Uploads)

Target expectations with 100 concurrent client uploads (2-3 minute clips):

- Signed URL generation (`/api/videos/upload-url`): p95 < 250ms.
- Upload completion callback (`/api/videos/:id/confirm`): p95 < 400ms.
- Backend CPU < 70% at 20 max instances.
- Motion queue wait time < 3 min with `athleteiq-motion` max 10 instances.
- PDF generation queue drain < 90 sec/report average.

Recommended tooling:

- k6 for API saturation.
- Locust for mixed upload + polling workflow.
- Cloud Monitoring dashboards on:
  - Cloud Run request count/latency
  - Redis memory + blocked clients
  - Cloud SQL CPU + connections
  - GCS egress + request rate

## 8) Final Pre-Go-Live Verification

- [ ] `infra/setup.sh` completed successfully.
- [ ] Cloud Build deploys all 4 services/images.
- [ ] Login works with Firebase phone auth on production domain.
- [ ] Upload + full analysis pipeline reaches `Video.status=COMPLETE`.
- [ ] Selection report generation creates PDF and `reportPdfUrl`.
- [ ] Coach and Scout dashboards show live data.
- [ ] Internal endpoints reject invalid `x-internal-token`.
- [ ] Error budget alerts configured in Cloud Monitoring.
