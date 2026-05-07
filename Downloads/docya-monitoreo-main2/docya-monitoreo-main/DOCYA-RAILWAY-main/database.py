"""
Helpers de acceso a PostgreSQL.

La idea es que cualquier router o módulo pueda reutilizar estas funciones
sin volver a declarar conexiones en cada archivo.
"""

import time
import psycopg2

from settings import DATABASE_URL

_MAX_RETRIES = 3


def _connect():
    """Abre una conexión PostgreSQL con keepalive TCP y timezone argentina."""
    conn = psycopg2.connect(
        DATABASE_URL,
        sslmode="require",
        connect_timeout=5,
        options="-c statement_timeout=60000 -c idle_in_transaction_session_timeout=30000",
        # TCP keepalive para evitar drops SSL por inactividad en Railway
        keepalives=1,
        keepalives_idle=10,
        keepalives_interval=5,
        keepalives_count=3,
    )
    with conn.cursor() as cur:
        cur.execute("SET TIME ZONE 'America/Argentina/Buenos_Aires'")
    return conn


def _connect_with_retry():
    """Intenta conectar, reintentando hasta _MAX_RETRIES veces en errores SSL/red."""
    last_exc = None
    for attempt in range(_MAX_RETRIES):
        try:
            return _connect()
        except psycopg2.OperationalError as e:
            last_exc = e
            if attempt < _MAX_RETRIES - 1:
                time.sleep(0.3 * (attempt + 1))
    raise last_exc


def get_db():
    """Dependency de FastAPI: abre una conexión por request y la cierra al final."""
    conn = _connect_with_retry()
    try:
        yield conn
    finally:
        try:
            conn.close()
        except Exception:
            pass


def get_db_worker():
    """Devuelve una conexión directa para workers o tareas fuera del request."""
    return _connect_with_retry()
