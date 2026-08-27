import os
import json
from typing import Any, Optional

APP_ENV = os.getenv("APP_ENV", "development")
REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
REDIS_PORT = int(os.getenv("REDIS_PORT", "6379"))

# In-memory dictionary cache for development
_MEMORY_CACHE = {}

redis_client = None
if APP_ENV == "production":
    try:
        import redis
        redis_client = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, db=0, decode_responses=True)
        # Test connection
        redis_client.ping()
    except Exception as e:
        print(f"Warning: Failed to connect to Redis. Falling back to Memory Cache. Error: {e}")
        redis_client = None


def get_cache(key: str) -> Optional[Any]:
    """Retrieve an item from the cache."""
    try:
        if redis_client:
            val = redis_client.get(key)
            if val:
                return json.loads(val)
            return None
        else:
            return _MEMORY_CACHE.get(key)
    except Exception:
        # Fail gracefully on cache errors
        return None


def set_cache(key: str, value: Any, expire_seconds: int = 300) -> bool:
    """Set an item in the cache."""
    try:
        if redis_client:
            redis_client.setex(key, expire_seconds, json.dumps(value))
            return True
        else:
            # Memory cache doesn't implement strict TTL, but saves the data
            # In a full app you'd store (value, expiry_timestamp)
            _MEMORY_CACHE[key] = value
            return True
    except Exception:
        return False


def invalidate_cache(key: str) -> bool:
    """Invalidate a specific cache key."""
    try:
        if redis_client:
            redis_client.delete(key)
            return True
        else:
            if key in _MEMORY_CACHE:
                del _MEMORY_CACHE[key]
            return True
    except Exception:
        return False

def clear_prefix(prefix: str):
    """Clear all keys starting with a prefix."""
    try:
        if redis_client:
            keys = redis_client.keys(f"{prefix}*")
            if keys:
                redis_client.delete(*keys)
        else:
            keys_to_delete = [k for k in _MEMORY_CACHE.keys() if k.startswith(prefix)]
            for k in keys_to_delete:
                del _MEMORY_CACHE[k]
    except Exception:
        pass
