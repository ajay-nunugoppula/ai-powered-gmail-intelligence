import time
from collections.abc import Callable
from typing import TypeVar

from googleapiclient.errors import HttpError

T = TypeVar("T")


class GmailRateLimiter:
    def __init__(self, requests_per_second: float = 10.0) -> None:
        self._min_interval = 1.0 / requests_per_second
        self._last_call = 0.0

    def _wait(self) -> None:
        elapsed = time.monotonic() - self._last_call
        if elapsed < self._min_interval:
            time.sleep(self._min_interval - elapsed)
        self._last_call = time.monotonic()

    def execute(self, request: object) -> T:
        retries = 0
        max_retries = 5

        while True:
            self._wait()
            try:
                return request.execute()  # type: ignore[attr-defined]
            except HttpError as exc:
                status = exc.resp.status if exc.resp else None
                if status == 429 and retries < max_retries:
                    time.sleep(2**retries)
                    retries += 1
                    continue
                raise


def with_rate_limit(
    limiter: GmailRateLimiter,
    fn: Callable[[], T],
) -> T:
    retries = 0
    max_retries = 5

    while True:
        limiter._wait()
        try:
            return fn()
        except HttpError as exc:
            status = exc.resp.status if exc.resp else None
            if status == 429 and retries < max_retries:
                time.sleep(2**retries)
                retries += 1
                continue
            raise
