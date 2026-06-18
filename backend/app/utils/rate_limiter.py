import asyncio
import time
from typing import Callable, Any
from functools import wraps
import logging

logger = logging.getLogger(__name__)


class RateLimiter:
    """Token bucket rate limiter for Gmail API quota management."""

    def __init__(self, calls_per_second: float = 10.0):
        self.min_interval = 1.0 / calls_per_second
        self.last_call = 0.0
        self._lock = asyncio.Lock()

    async def acquire(self):
        async with self._lock:
            now = time.monotonic()
            elapsed = now - self.last_call
            if elapsed < self.min_interval:
                await asyncio.sleep(self.min_interval - elapsed)
            self.last_call = time.monotonic()


gmail_rate_limiter = RateLimiter(calls_per_second=8.0)


def with_exponential_backoff(max_retries: int = 5, base_delay: float = 1.0):
    """Decorator for retrying API calls with exponential backoff on 429/5xx errors."""

    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def wrapper(*args, **kwargs) -> Any:
            last_exception = None
            for attempt in range(max_retries):
                try:
                    await gmail_rate_limiter.acquire()
                    return await func(*args, **kwargs)
                except Exception as e:
                    error_str = str(e).lower()
                    is_rate_limit = "429" in error_str or "rate" in error_str or "quota" in error_str
                    is_server_error = any(code in error_str for code in ["500", "502", "503", "504"])

                    if is_rate_limit or is_server_error:
                        delay = base_delay * (2 ** attempt)
                        logger.warning(
                            f"Rate limit/server error on attempt {attempt + 1}/{max_retries}, "
                            f"retrying in {delay:.1f}s: {e}"
                        )
                        await asyncio.sleep(delay)
                        last_exception = e
                    else:
                        raise

            raise last_exception or Exception("Max retries exceeded")

        return wrapper

    return decorator
