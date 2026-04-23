import json
import logging
import os
import time

import redis

from pdf_worker import generate_pdf_for_report

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s [athleteiq-worker] %(message)s",
)

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")
QUEUE_NAME = os.getenv("SELECTION_PDF_QUEUE", "selection-pdf-jobs")
DEAD_LETTER_QUEUE = os.getenv("SELECTION_PDF_DLQ", "selection-pdf-jobs-dead")


def run_worker() -> None:
    client = redis.from_url(REDIS_URL, decode_responses=True)
    logging.info("Connected to Redis at %s", REDIS_URL)
    logging.info("Listening for jobs on queue %s", QUEUE_NAME)

    while True:
        try:
            job = client.brpop(QUEUE_NAME, timeout=15)
            if not job:
                continue

            _, raw_payload = job
            payload = json.loads(raw_payload)
            report_id = payload.get("reportId")
            if not report_id:
                raise ValueError("Invalid payload: reportId missing")

            logging.info("Processing report job %s", report_id)
            result = generate_pdf_for_report(report_id)
            logging.info("Generated PDF for %s -> %s", report_id, result["reportPdfUrl"])
        except Exception as exc:
            logging.exception("Worker failed while processing job: %s", exc)
            try:
                if "raw_payload" in locals():
                    client.lpush(
                        DEAD_LETTER_QUEUE,
                        json.dumps(
                            {
                                "failedAt": int(time.time()),
                                "error": str(exc),
                                "payload": raw_payload,
                            }
                        ),
                    )
            except Exception:
                logging.exception("Failed to move message to DLQ")


if __name__ == "__main__":
    run_worker()
