from datetime import datetime
from datetime import time as dt_time
from typing import Optional
import uuid

from fastapi import APIRouter, Depends, Header, HTTPException
from jose import JWTError, jwt
from pydantic import BaseModel
from psycopg2.extras import RealDictCursor
import requests

from database import get_db
from services.daily_service import create_daily_room
from settings import JWT_SECRET, MP_ACCESS_TOKEN, now_argentina


router = APIRouter(prefix="/teleconsultas", tags=["teleconsultas"])


class TeleconsultaCreateIn(BaseModel):
    consulta_id: Optional[int] = None
    paciente_uuid: str
    motivo: str
    direccion: Optional[str] = None
    provincia: str
    localidad: str
    necesita_certificado: bool = False
    consentimiento_teleconsulta: bool
    metodo_pago: str = "tarjeta"
    payment_id: Optional[str] = None


class TeleconsultaMedicoIn(BaseModel):
    medico_id: int


class TeleconsultaPacienteIn(BaseModel):
    paciente_uuid: str


def _require_auth(authorization: Optional[str] = Header(None)) -> dict:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Token requerido")
    token = authorization.split(" ", 1)[1].strip()
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
    except JWTError:
        raise HTTPException(status_code=401, detail="Token invalido")


def _assert_subject(payload: dict, expected_id: str | int) -> None:
    if str(payload.get("sub")) != str(expected_id):
        raise HTTPException(status_code=403, detail="No podes acceder a esta teleconsulta")


_schema_initialized = False


def _ensure_schema(db) -> None:
    global _schema_initialized
    if _schema_initialized:
        return
    # Marcar como inicializado de inmediato para evitar reintentos infinitos
    # si alguna ALTER TABLE falla (columnas ya existen o DB inestable)
    _schema_initialized = True
    try:
        cur = db.cursor()
        try:
            cur.execute("SELECT to_regtype('estado_consulta')")
            estado_enum = cur.fetchone()[0]
            if estado_enum:
                for estado in (
                    "buscando_medico",
                    "asignada",
                    "en_videollamada",
                    "cancelada_sin_medico",
                    "cancelada_paciente",
                    "expirada",
                ):
                    try:
                        cur.execute(
                            "ALTER TYPE estado_consulta ADD VALUE IF NOT EXISTS %s",
                            (estado,),
                        )
                    except Exception:
                        db.rollback()
        except Exception as exc:
            print(f"⚠️ _ensure_schema enum: {exc}")
            try:
                db.rollback()
            except Exception:
                pass
        columns = [
            "ALTER TABLE consultas ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP",
            "ALTER TABLE consultas ADD COLUMN IF NOT EXISTS daily_room_url TEXT",
            "ALTER TABLE consultas ADD COLUMN IF NOT EXISTS daily_room_name TEXT",
            "ALTER TABLE consultas ADD COLUMN IF NOT EXISTS daily_room_id TEXT",
            "ALTER TABLE consultas ADD COLUMN IF NOT EXISTS video_provider TEXT",
            "ALTER TABLE consultas ADD COLUMN IF NOT EXISTS necesita_certificado BOOLEAN DEFAULT FALSE",
            "ALTER TABLE consultas ADD COLUMN IF NOT EXISTS consentimiento_teleconsulta BOOLEAN DEFAULT FALSE",
            "ALTER TABLE consultas ADD COLUMN IF NOT EXISTS inicio_video_at TIMESTAMP",
            "ALTER TABLE consultas ADD COLUMN IF NOT EXISTS fin_video_at TIMESTAMP",
            "ALTER TABLE consultas ADD COLUMN IF NOT EXISTS aceptada_at TIMESTAMP",
            "ALTER TABLE consultas ADD COLUMN IF NOT EXISTS provincia TEXT",
            "ALTER TABLE consultas ADD COLUMN IF NOT EXISTS localidad TEXT",
            "ALTER TABLE consultas ADD COLUMN IF NOT EXISTS canal_atencion TEXT DEFAULT 'domicilio'",
            "ALTER TABLE consultas ADD COLUMN IF NOT EXISTS video_url TEXT",
            "ALTER TABLE consultas ADD COLUMN IF NOT EXISTS mp_preautorizado BOOLEAN DEFAULT FALSE",
            "ALTER TABLE consultas ADD COLUMN IF NOT EXISTS mp_capturado BOOLEAN DEFAULT FALSE",
            "ALTER TABLE consultas ADD COLUMN IF NOT EXISTS mp_payment_id TEXT",
            "ALTER TABLE consultas ADD COLUMN IF NOT EXISTS mp_status TEXT",
        ]
        for sql in columns:
            try:
                cur = db.cursor()
                cur.execute(sql)
                db.commit()
            except Exception:
                try:
                    db.rollback()
                except Exception:
                    pass
    except Exception as exc:
        print(f"⚠️ _ensure_schema error: {exc}")
        try:
            db.rollback()
        except Exception:
            pass


def _cancel_payment_authorization(db, consulta_id: int, payment_id: Optional[str]) -> None:
    if not payment_id or not MP_ACCESS_TOKEN:
        return

    try:
        response = requests.put(
            f"https://api.mercadopago.com/v1/payments/{payment_id}",
            headers={
                "Authorization": f"Bearer {MP_ACCESS_TOKEN}",
                "X-Idempotency-Key": str(uuid.uuid4()),
                "Content-Type": "application/json",
            },
            json={"status": "cancelled"},
            timeout=20,
        )
        print(f"Teleconsulta {consulta_id}: cancelacion MP {response.status_code}")
        if response.ok:
            cur = db.cursor()
            cur.execute(
                """
                UPDATE consultas
                SET mp_status = 'cancelled',
                    mp_preautorizado = FALSE
                WHERE id = %s
                """,
                (consulta_id,),
            )
            db.commit()
    except Exception as exc:
        print(f"Error cancelando preautorizacion teleconsulta {consulta_id}: {exc}")


def _capture_payment_authorization(db, consulta_id: int, payment_id: Optional[str]) -> None:
    if not payment_id or not MP_ACCESS_TOKEN:
        return

    try:
        response = requests.post(
            f"https://api.mercadopago.com/v1/payments/{payment_id}/capture",
            headers={
                "Authorization": f"Bearer {MP_ACCESS_TOKEN}",
                "Content-Type": "application/json",
            },
            json={},
            timeout=20,
        )
        print(f"Teleconsulta {consulta_id}: captura MP {response.status_code}")
        if response.ok:
            cur = db.cursor()
            cur.execute(
                """
                UPDATE consultas
                SET mp_status = 'capturado',
                    mp_preautorizado = FALSE,
                    mp_capturado = TRUE
                WHERE id = %s
                """,
                (consulta_id,),
            )
            db.commit()
    except Exception as exc:
        print(f"Error capturando preautorizacion teleconsulta {consulta_id}: {exc}")


def _refund_payment(db, consulta_id: int, payment_id: Optional[str]) -> None:
    """Reembolsa un pago ya capturado (saldo MP). Casi instantáneo para account_money."""
    if not payment_id or not MP_ACCESS_TOKEN:
        return
    try:
        response = requests.post(
            f"https://api.mercadopago.com/v1/payments/{payment_id}/refunds",
            headers={
                "Authorization": f"Bearer {MP_ACCESS_TOKEN}",
                "X-Idempotency-Key": str(uuid.uuid4()),
                "Content-Type": "application/json",
            },
            json={},
            timeout=20,
        )
        print(f"Teleconsulta {consulta_id}: reembolso saldo MP {response.status_code}")
        if response.ok:
            cur = db.cursor()
            cur.execute(
                "UPDATE consultas SET mp_status = 'refunded', mp_capturado = FALSE WHERE id = %s",
                (consulta_id,),
            )
            db.commit()
    except Exception as exc:
        print(f"Error reembolsando saldo MP teleconsulta {consulta_id}: {exc}")


def _cancel_expired(db) -> None:
    cur = db.cursor()
    cur.execute(
        """
        UPDATE consultas
        SET estado = 'cancelada_sin_medico'
        WHERE tipo = 'teleconsulta'
          AND estado = 'buscando_medico'
          AND medico_id IS NULL
          AND expires_at <= NOW()
        RETURNING id, mp_payment_id, metodo_pago, mp_capturado
        """
    )
    expired = cur.fetchall()
    db.commit()
    for row in expired:
        consulta_id, payment_id, metodo_pago, mp_capturado = row
        print(
            f"[CANCEL_TRACE:TELECONSULTA_TIMEOUT_SIN_MEDICO] consulta={consulta_id} "
            f"metodo_pago={metodo_pago} mp_payment_id={payment_id} mp_capturado={mp_capturado}"
        )
        if metodo_pago == 'saldo_mp' or mp_capturado:
            _refund_payment(db, consulta_id, payment_id)
        else:
            _cancel_payment_authorization(db, consulta_id, payment_id)


def _serialize(row: dict) -> dict:
    data = dict(row)
    for key in ("creado_en", "expires_at", "aceptada_at", "inicio_video_at", "fin_video_at"):
        value = data.get(key)
        if isinstance(value, datetime):
            data[key] = value.isoformat()
    return data


def _fetch_detail(db, consulta_id: int) -> Optional[dict]:
    cur = db.cursor(cursor_factory=RealDictCursor)
    cur.execute(
        """
        SELECT
            c.id, c.paciente_uuid, c.medico_id, c.estado, c.motivo,
            c.direccion, c.provincia, c.localidad, c.necesita_certificado,
            c.consentimiento_teleconsulta, c.creado_en, c.expires_at,
            c.aceptada_at, c.inicio_video_at, c.fin_video_at,
            c.daily_room_url, c.daily_room_name, c.daily_room_id,
            c.video_provider, c.video_url,
            COALESCE(u.full_name, 'Paciente') AS paciente_nombre,
            COALESCE(m.full_name, '') AS medico_nombre,
            COALESCE(m.matricula, '') AS medico_matricula
        FROM consultas c
        LEFT JOIN users u ON u.id = c.paciente_uuid
        LEFT JOIN medicos m ON m.id = c.medico_id
        WHERE c.id = %s
          AND c.tipo = 'teleconsulta'
        """,
        (consulta_id,),
    )
    row = cur.fetchone()
    return _serialize(row) if row else None


def _notificar_teleconsulta_disponible(db, consulta: dict) -> int:
    try:
        from main import enviar_push
    except Exception as exc:
        print(f"⚠️ No se pudo importar enviar_push para teleconsulta: {exc}")
        return 0

    cur = db.cursor(cursor_factory=RealDictCursor)
    cur.execute(
        """
        SELECT id, fcm_token
        FROM medicos
        WHERE fcm_token IS NOT NULL
          AND fcm_token <> ''
          AND COALESCE(validado, FALSE) = TRUE
          AND COALESCE(matricula_validada, FALSE) = TRUE
          AND COALESCE(matricula, '') <> ''
          AND (
              tipo IS NULL
              OR LOWER(tipo) LIKE '%med%'
              OR LOWER(tipo) LIKE '%doctor%'
              OR LOWER(tipo) = 'dr'
          )
        """
    )
    enviados = 0
    for medico in cur.fetchall():
        try:
            enviar_push(
                medico["fcm_token"],
                "Teleconsulta disponible",
                "Un paciente solicitó atención online. Entrá a DocYa Pro y aceptala si podés atender ahora.",
                {
                    "tipo": "teleconsulta_disponible",
                    "consulta_id": consulta["id"],
                    "mensaje": "Un paciente solicitó atención online. Entrá a DocYa Pro y aceptala.",
                    "canal_atencion": "teleconsulta",
                    "estado": consulta.get("estado", "buscando_medico"),
                    "expires_at": consulta.get("expires_at", ""),
                },
                time_sensitive=True,
                app_kind="pro",
            )
            enviados += 1
        except Exception as exc:
            print(f"⚠️ Error push teleconsulta médico {medico['id']}: {exc}")

    if enviados:
        print(f"📹 Push teleconsulta disponible enviado a {enviados} médicos")
    else:
        print("📹 Teleconsulta creada sin médicos con FCM disponible")
    return enviados


@router.post("")
def crear_teleconsulta(
    data: TeleconsultaCreateIn,
    db=Depends(get_db),
    payload: dict = Depends(_require_auth),
):
    _ensure_schema(db)
    _assert_subject(payload, data.paciente_uuid)
    motivo = data.motivo.strip()
    provincia = data.provincia.strip()
    localidad = data.localidad.strip()

    if not motivo:
        raise HTTPException(status_code=400, detail="El motivo es obligatorio")
    if not provincia or not localidad:
        raise HTTPException(status_code=400, detail="Provincia y localidad son obligatorias")
    if not data.consentimiento_teleconsulta:
        raise HTTPException(status_code=400, detail="El consentimiento de teleconsulta es obligatorio")

    cur = db.cursor(cursor_factory=RealDictCursor)
    cur.execute("SELECT id FROM users WHERE id = %s", (data.paciente_uuid,))
    if not cur.fetchone():
        raise HTTPException(status_code=404, detail="Paciente no encontrado")

    direccion = (data.direccion or "").strip() or f"{localidad}, {provincia}"
    if data.consulta_id:
        cur.execute(
            """
            SELECT id, paciente_uuid, mp_payment_id, mp_preautorizado
            FROM consultas
            WHERE id = %s
            FOR UPDATE
            """,
            (data.consulta_id,),
        )
        previa = cur.fetchone()
        if not previa:
            raise HTTPException(status_code=404, detail="Consulta previa no encontrada")
        if str(previa["paciente_uuid"]) != str(data.paciente_uuid):
            raise HTTPException(status_code=403, detail="La consulta previa no pertenece al paciente")

        payment_id = (data.payment_id or previa["mp_payment_id"] or "").strip()
        if data.metodo_pago == "tarjeta" and not payment_id:
            raise HTTPException(status_code=400, detail="La preautorizacion de pago es obligatoria")

        cur.execute(
            """
            UPDATE consultas
            SET medico_id = NULL,
                estado = 'buscando_medico',
                motivo = %s,
                direccion = %s,
                lat = 0,
                lng = 0,
                tipo = 'teleconsulta',
                canal_atencion = 'teleconsulta',
                provincia = %s,
                localidad = %s,
                necesita_certificado = %s,
                consentimiento_teleconsulta = %s,
                expires_at = NOW() + INTERVAL '5 minutes',
                metodo_pago = %s,
                mp_payment_id = COALESCE(NULLIF(%s, ''), mp_payment_id),
                mp_status = CASE WHEN %s = 'tarjeta' THEN COALESCE(mp_status, 'preautorizado') ELSE mp_status END
            WHERE id = %s
            RETURNING id
            """,
            (
                motivo,
                direccion,
                provincia,
                localidad,
                data.necesita_certificado,
                data.consentimiento_teleconsulta,
                data.metodo_pago,
                payment_id,
                data.metodo_pago,
                data.consulta_id,
            ),
        )
        consulta_id = cur.fetchone()["id"]
    else:
        cur.execute(
            """
            INSERT INTO consultas (
                paciente_uuid, medico_id, estado, motivo, direccion, lat, lng,
                tipo, canal_atencion, provincia, localidad, necesita_certificado,
                consentimiento_teleconsulta, expires_at, metodo_pago
            )
            VALUES (
                %s, NULL, 'buscando_medico', %s, %s, 0, 0,
                'teleconsulta', 'teleconsulta', %s, %s, %s,
                %s, NOW() + INTERVAL '5 minutes', 'pendiente'
            )
            RETURNING id
            """,
            (
                data.paciente_uuid,
                motivo,
                direccion,
                provincia,
                localidad,
                data.necesita_certificado,
                data.consentimiento_teleconsulta,
            ),
        )
        consulta_id = cur.fetchone()["id"]
    db.commit()
    detail = _fetch_detail(db, consulta_id)
    if detail:
        _notificar_teleconsulta_disponible(db, detail)
    return detail


@router.get("/pendientes")
def listar_pendientes(db=Depends(get_db), payload: dict = Depends(_require_auth)):
    _ensure_schema(db)
    _cancel_expired(db)
    cur = db.cursor(cursor_factory=RealDictCursor)
    cur.execute(
        """
        SELECT id, paciente_uuid, estado, motivo, direccion, provincia, localidad,
               necesita_certificado, creado_en, expires_at
        FROM consultas
        WHERE tipo = 'teleconsulta'
          AND estado = 'buscando_medico'
          AND medico_id IS NULL
          AND expires_at > NOW()
        ORDER BY creado_en ASC
        """
    )
    return [_serialize(row) for row in cur.fetchall()]


@router.post("/{consulta_id}/aceptar")
async def aceptar_teleconsulta(
    consulta_id: int,
    data: TeleconsultaMedicoIn,
    db=Depends(get_db),
    payload: dict = Depends(_require_auth),
):
    _ensure_schema(db)
    _assert_subject(payload, data.medico_id)
    _cancel_expired(db)
    cur = db.cursor(cursor_factory=RealDictCursor)
    cur.execute(
        """
        SELECT id, full_name, matricula, validado,
               COALESCE(matricula_validada, FALSE) AS matricula_validada
        FROM medicos
        WHERE id = %s
        """,
        (data.medico_id,),
    )
    medico = cur.fetchone()
    if not medico:
        raise HTTPException(status_code=404, detail="Medico no encontrado")
    if not medico["validado"] or not medico["matricula"] or not medico["matricula_validada"]:
        raise HTTPException(status_code=403, detail="Solo medicos habilitados pueden aceptar teleconsultas")

    room = await create_daily_room(consulta_id)
    if not room["url"]:
        raise HTTPException(status_code=502, detail="Daily no devolvio URL de sala")

    cur.execute(
        """
        UPDATE consultas
        SET medico_id = %s,
            estado = 'asignada',
            aceptada_at = NOW(),
            daily_room_url = %s,
            daily_room_name = %s,
            daily_room_id = %s,
            video_provider = 'daily',
            video_url = %s
        WHERE id = %s
          AND tipo = 'teleconsulta'
          AND estado = 'buscando_medico'
          AND medico_id IS NULL
          AND expires_at > NOW()
        RETURNING id, mp_payment_id, metodo_pago
        """,
        (data.medico_id, room["url"], room["name"], room["id"], room["url"], consulta_id),
    )
    accepted = cur.fetchone()
    if not accepted:
        db.rollback()
        raise HTTPException(status_code=409, detail="Esta teleconsulta ya fue tomada por otro profesional.")

    db.commit()
    if accepted.get("metodo_pago") == "saldo_mp":
        cur = db.cursor()
        cur.execute(
            """
            UPDATE consultas
            SET mp_status = COALESCE(mp_status, 'capturado'),
                mp_capturado = TRUE,
                mp_preautorizado = FALSE
            WHERE id = %s
            """,
            (consulta_id,),
        )
        db.commit()
    else:
        _capture_payment_authorization(db, consulta_id, accepted["mp_payment_id"])
    return _fetch_detail(db, consulta_id)


@router.get("/{consulta_id}")
def ver_teleconsulta(
    consulta_id: int,
    paciente_uuid: Optional[str] = None,
    medico_id: Optional[int] = None,
    db=Depends(get_db),
    payload: dict = Depends(_require_auth),
):
    _ensure_schema(db)
    _cancel_expired(db)
    detail = _fetch_detail(db, consulta_id)
    if not detail:
        raise HTTPException(status_code=404, detail="Teleconsulta no encontrada")
    if paciente_uuid and str(detail["paciente_uuid"]) != str(paciente_uuid):
        raise HTTPException(status_code=403, detail="No podes acceder a esta teleconsulta")
    if medico_id and detail["medico_id"] not in (None, medico_id):
        raise HTTPException(status_code=403, detail="No podes acceder a esta teleconsulta")
    if paciente_uuid:
        _assert_subject(payload, paciente_uuid)
    if medico_id:
        _assert_subject(payload, medico_id)
    return detail


@router.post("/{consulta_id}/iniciar-video")
def iniciar_video(
    consulta_id: int,
    data: TeleconsultaMedicoIn,
    db=Depends(get_db),
    payload: dict = Depends(_require_auth),
):
    _ensure_schema(db)
    _assert_subject(payload, data.medico_id)
    cur = db.cursor()
    cur.execute(
        """
        UPDATE consultas
        SET estado = 'en_videollamada',
            inicio_video_at = COALESCE(inicio_video_at, NOW())
        WHERE id = %s
          AND tipo = 'teleconsulta'
          AND medico_id = %s
          AND estado IN ('asignada', 'en_videollamada')
        RETURNING id
        """,
        (consulta_id, data.medico_id),
    )
    if not cur.fetchone():
        raise HTTPException(status_code=400, detail="No se pudo iniciar la videollamada")
    db.commit()
    return _fetch_detail(db, consulta_id)


def _get_precio_teleconsulta(cur, tipo: str, es_nocturno: bool) -> int:
    """Precio desde tarifas_consulta con fallback a hardcode."""
    if tipo == "medico":
        tarifa_key = "nocturna" if es_nocturno else "diurna"
        fallback = 40000 if es_nocturno else 30000
    else:
        tarifa_key = "nocturna_enfermero" if es_nocturno else "diurna_enfermero"
        fallback = 30000 if es_nocturno else 20000
    try:
        cur.execute(
            "SELECT monto FROM tarifas_consulta WHERE tipo = %s AND activa = TRUE LIMIT 1",
            (tarifa_key,),
        )
        row = cur.fetchone()
        if row and row[0]:
            return int(row[0])
    except Exception:
        pass
    return fallback


def _registrar_pago_teleconsulta(db, consulta_id: int, medico_id: int,
                                  paciente_uuid: str, metodo_pago: str,
                                  precio: int) -> None:
    """Inserta en pagos_consulta y actualiza saldo_medico para la teleconsulta."""
    docya_comision = int(precio * 0.20)
    if metodo_pago == "efectivo":
        medico_neto = precio
        saldo_delta = -docya_comision
    else:
        medico_neto = int(precio * 0.80)
        saldo_delta = medico_neto

    cur = db.cursor()
    cur.execute(
        """
        INSERT INTO pagos_consulta
            (consulta_id, medico_id, metodo_pago, monto_total, medico_neto, docya_comision)
        VALUES (%s, %s, %s, %s, %s, %s)
        """,
        (consulta_id, medico_id, metodo_pago, precio, medico_neto, docya_comision),
    )
    cur.execute("SELECT saldo FROM saldo_medico WHERE medico_id = %s", (medico_id,))
    row = cur.fetchone()
    if row:
        cur.execute(
            "UPDATE saldo_medico SET saldo = saldo + %s WHERE medico_id = %s",
            (saldo_delta, medico_id),
        )
    else:
        cur.execute(
            "INSERT INTO saldo_medico (medico_id, saldo) VALUES (%s, %s)",
            (medico_id, saldo_delta),
        )
    db.commit()


@router.post("/{consulta_id}/finalizar")
def finalizar_teleconsulta(
    consulta_id: int,
    data: TeleconsultaMedicoIn,
    db=Depends(get_db),
    payload: dict = Depends(_require_auth),
):
    _ensure_schema(db)
    _assert_subject(payload, data.medico_id)
    cur = db.cursor()

    # Obtener metodo_pago y tipo del profesional para calcular el pago
    cur.execute(
        """
        SELECT c.metodo_pago, c.paciente_uuid, m.tipo
        FROM consultas c
        JOIN medicos m ON m.id = c.medico_id
        WHERE c.id = %s AND c.medico_id = %s
        """,
        (consulta_id, data.medico_id),
    )
    info = cur.fetchone()

    cur.execute(
        """
        UPDATE consultas
        SET estado = 'finalizada',
            fin_video_at = NOW()
        WHERE id = %s
          AND tipo = 'teleconsulta'
          AND medico_id = %s
          AND estado IN ('asignada', 'en_videollamada')
        RETURNING id
        """,
        (consulta_id, data.medico_id),
    )
    if not cur.fetchone():
        raise HTTPException(status_code=400, detail="No se pudo finalizar la teleconsulta")
    db.commit()

    # Registrar pago si tenemos la info necesaria
    if info:
        metodo_pago = (info[0] or "tarjeta").lower().strip()
        paciente_uuid = str(info[1]) if info[1] else ""
        tipo = (info[2] or "medico").lower().strip()

        ahora = now_argentina()
        es_nocturno = ahora.hour >= 22 or ahora.hour < 6
        precio = _get_precio_teleconsulta(cur, tipo, es_nocturno)

        cur2 = db.cursor()
        cur2.execute(
            "UPDATE consultas SET precio_final = %s WHERE id = %s",
            (precio, consulta_id),
        )
        db.commit()

        try:
            _registrar_pago_teleconsulta(
                db, consulta_id, data.medico_id,
                paciente_uuid, metodo_pago, precio,
            )
        except Exception as e:
            print(f"⚠️ Error registrando pago teleconsulta {consulta_id}: {e}")

    return _fetch_detail(db, consulta_id)


@router.post("/{consulta_id}/cancelar")
def cancelar_teleconsulta(
    consulta_id: int,
    data: TeleconsultaPacienteIn,
    db=Depends(get_db),
    payload: dict = Depends(_require_auth),
):
    _ensure_schema(db)
    _assert_subject(payload, data.paciente_uuid)
    cur = db.cursor()
    cur.execute(
        """
        UPDATE consultas
        SET estado = 'cancelada_paciente'
        WHERE id = %s
          AND tipo = 'teleconsulta'
          AND paciente_uuid = %s
          AND estado = 'buscando_medico'
          AND medico_id IS NULL
        RETURNING id, mp_payment_id, metodo_pago, COALESCE(mp_capturado, FALSE)
        """,
        (consulta_id, data.paciente_uuid),
    )
    cancelled = cur.fetchone()
    if not cancelled:
        raise HTTPException(status_code=400, detail="La teleconsulta ya no puede cancelarse")
    db.commit()
    _, payment_id, metodo_pago, mp_capturado = cancelled
    print(
        f"[CANCEL_TRACE:TELECONSULTA_PACIENTE] consulta={consulta_id} "
        f"paciente={data.paciente_uuid} metodo_pago={metodo_pago} "
        f"mp_payment_id={payment_id} mp_capturado={mp_capturado}"
    )
    if metodo_pago == "saldo_mp" or mp_capturado:
        _refund_payment(db, consulta_id, payment_id)
    else:
        _cancel_payment_authorization(db, consulta_id, payment_id)
    return _fetch_detail(db, consulta_id)
