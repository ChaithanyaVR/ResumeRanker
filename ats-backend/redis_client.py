# redis_client.py
import redis
import os

# If your Flask app runs locally on the host, connect via localhost:6380
REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
REDIS_PORT = int(os.getenv("REDIS_PORT", 6481))

# Create Redis client
redis_client = redis.StrictRedis(
    host=REDIS_HOST,
    port=REDIS_PORT,
    db=0,
    decode_responses=True  # automatically decode bytes → str
)
