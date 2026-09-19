import os
import time

from app.services.event_ai_processing import (
    run_next_processing_job,
)


IDLE_SECONDS = float(
    os.getenv(
        "EVENT_AI_WORKER_IDLE_SECONDS",
        "2",
    )
)

ERROR_SECONDS = float(
    os.getenv(
        "EVENT_AI_WORKER_ERROR_SECONDS",
        "5",
    )
)


def main() -> None:
    print(
        (
            "[AI Worker] "
            "EZFOTOO Event AI Worker started."
        ),
        flush=True,
    )

    print(
        (
            "[AI Worker] "
            f"Queue polling interval: "
            f"{IDLE_SECONDS}s."
        ),
        flush=True,
    )


    while True:
        try:
            worked = (
                run_next_processing_job()
            )


            if not worked:
                time.sleep(
                    IDLE_SECONDS
                )


        except KeyboardInterrupt:
            print(
                (
                    "\n[AI Worker] "
                    "Worker stopped."
                ),
                flush=True,
            )

            break


        except Exception as exc:
            print(
                (
                    "[AI Worker] "
                    "Unexpected worker-loop "
                    f"error: {exc}"
                ),
                flush=True,
            )

            time.sleep(
                ERROR_SECONDS
            )


if __name__ == "__main__":
    main()