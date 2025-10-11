# db.py
import os
import psycopg2
from psycopg2 import pool
from dotenv import load_dotenv

load_dotenv()

_pool = pool.SimpleConnectionPool(
    minconn=1,
    maxconn=5,
    dsn=os.getenv("DATABASE_URL")
)

def get_db():
    return _pool.getconn()

def put_db(conn):
    _pool.putconn(conn)
