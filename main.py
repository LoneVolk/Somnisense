from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Optional
from datetime import date
import json
import csv
import io

import sys
from pathlib import Path

# Добавляем текущую папку в путь для импортов
sys.path.insert(0, str(Path(__file__).parent))

from models import (
    SleepRecord, SleepRecordCreate, SleepAnomaly,
    Recommendation, UserContextCreate, SleepSummary, SleepPhases
)
from database import (
    init_db, save_sleep_record, get_sleep_records,
    save_anomaly, get_anomalies,
    save_user_context, get_user_context
)
from analyzer import analyze_sleep, calculate_sleep_score
from recommendations import generate_recommendations

# Импортируем симулятор
import importlib.util
spec = importlib.util.spec_from_file_location("simulator", Path(__file__).parent / "connectors" / "simulator.py")
simulator_module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(simulator_module)
SimulatorConnector = simulator_module.SimulatorConnector

# ─────────────────────────────────────────
#  ИНИЦИАЛИЗАЦИЯ
# ─────────────────────────────────────────

app = FastAPI(
    title="Sleep Analyzer API",
    description="Анализ сна и выявление аномалий с носимых устройств",
    version="1.0.0"
)

# CORS — разрешаем запросы от React Native / веб
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup():
    init_db()
    print("🚀 Sleep Analyzer API запущен")


# ─────────────────────────────────────────
#  SLEEP RECORDS
# ─────────────────────────────────────────

@app.get("/api/sleep", response_model=List[dict])
async def get_sleep(user_id: str = "default", days: int = 30):
    """Возвращает записи сна за последние N дней"""
    records = get_sleep_records(user_id=user_id, limit=days)
    return records


@app.post("/api/sleep", response_model=dict)
async def create_sleep_record(record: SleepRecordCreate, user_id: str = "default"):
    """Создаёт новую запись сна"""
    data = {
        "date": str(record.date),
        "start_time": str(record.start_time),
        "end_time": str(record.end_time),
        "duration_minutes": record.duration_minutes,
        "phase_light": record.phases.light,
        "phase_deep": record.phases.deep,
        "phase_rem": record.phases.rem,
        "phase_awake": record.phases.awake,
        "heart_rate_avg": record.heart_rate_avg,
        "heart_rate_min": record.heart_rate_min,
        "heart_rate_max": record.heart_rate_max,
        "spo2_avg": record.spo2_avg,
        "spo2_min": record.spo2_min,
        "awakenings_count": record.awakenings_count,
        "source": record.source,
        "sleep_score": None
    }

    record_id = save_sleep_record(data, user_id)
    return {"id": record_id, "status": "created"}


@app.get("/api/sleep/summary", response_model=dict)
async def get_summary(user_id: str = "default"):
    """Сводная статистика для дашборда"""
    records = get_sleep_records(user_id=user_id, limit=30)

    if not records:
        return {
            "total_records": 0,
            "avg_duration_minutes": 0,
            "avg_sleep_score": None,
            "avg_deep_percent": 0,
            "avg_rem_percent": 0,
            "anomalies_last_30_days": 0,
            "last_night": None
        }

    durations = [r["duration_minutes"] for r in records]
    scores = [r["sleep_score"] for r in records if r["sleep_score"]]

    deep_percents = []
    rem_percents = []
    for r in records:
        total = r["duration_minutes"]
        if total > 0:
            deep_percents.append((r["phase_deep"] / total) * 100)
            rem_percents.append((r["phase_rem"] / total) * 100)

    anomalies = get_anomalies(user_id=user_id, days=30)

    return {
        "total_records": len(records),
        "avg_duration_minutes": round(sum(durations) / len(durations), 1),
        "avg_sleep_score": round(sum(scores) / len(scores), 1) if scores else None,
        "avg_deep_percent": round(sum(deep_percents) / len(deep_percents), 1) if deep_percents else 0,
        "avg_rem_percent": round(sum(rem_percents) / len(rem_percents), 1) if rem_percents else 0,
        "anomalies_last_30_days": len(anomalies),
        "last_night": records[0] if records else None
    }


# ─────────────────────────────────────────
#  GADGETBRIDGE — HTTP ХУКИ
# ─────────────────────────────────────────

@app.post("/api/gadgetbridge/webhook")
async def gadgetbridge_webhook(payload: dict):
    """
    Принимает данные напрямую от Gadgetbridge.
    Настройте URL в Gadgetbridge: http://ВАШ_IP:8000/api/gadgetbridge/webhook
    """
    try:
        # Gadgetbridge шлёт данные активности — парсим сон
        sleep_data = _parse_gadgetbridge_payload(payload)
        if sleep_data:
            save_sleep_record(sleep_data)
            return {"status": "ok", "message": "Данные сна сохранены"}
        return {"status": "ok", "message": "Данные активности получены (не сон)"}

    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


def _parse_gadgetbridge_payload(payload: dict) -> Optional[dict]:
    """Парсит webhook от Gadgetbridge в универсальный формат"""
    # Gadgetbridge шлёт данные в формате activity samples
    # Фильтруем только ночные данные (raw_kind = 112 для Huami/Amazfit)
    if "sleep" not in payload and "activity" not in payload:
        return None

    sleep = payload.get("sleep", {})
    if not sleep:
        return None

    return {
        "date": sleep.get("date", str(date.today())),
        "start_time": sleep.get("start", ""),
        "end_time": sleep.get("end", ""),
        "duration_minutes": sleep.get("duration", 0),
        "phase_light": sleep.get("lightSleepDuration", 0),
        "phase_deep": sleep.get("deepSleepDuration", 0),
        "phase_rem": sleep.get("remSleepDuration", 0),
        "phase_awake": sleep.get("awakeDuration", 0),
        "heart_rate_avg": sleep.get("heartRateAverage"),
        "heart_rate_min": sleep.get("heartRateMin"),
        "heart_rate_max": sleep.get("heartRateMax"),
        "spo2_avg": sleep.get("spo2Average"),
        "spo2_min": sleep.get("spo2Min"),
        "awakenings_count": sleep.get("wakeupCount", 0),
        "source": "gadgetbridge",
        "sleep_score": None
    }


# ─────────────────────────────────────────
#  CSV ЗАГРУЗКА
# ─────────────────────────────────────────

@app.post("/api/upload/csv")
async def upload_csv(file: UploadFile = File(...), user_id: str = "default"):
    """
    Загружает данные сна из CSV файла.
    Поддерживает два формата:
    1. Стандартный датасет (smartwatch_sleep_dataset.csv)
    2. Простой формат (date, duration_minutes, phase_deep, ...)
    """
    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Файл должен быть в формате CSV")

    raw = await file.read()
    try:
        text = raw.decode("utf-8")
    except:
        text = raw.decode("latin-1")

    reader = csv.DictReader(io.StringIO(text))
    headers = reader.fieldnames or []

    saved_count = 0
    errors = []

    # Определяем формат по заголовкам
    is_rich_format = "sleep_start_timestamp" in headers or "date_recorded" in headers

    for i, row in enumerate(reader):
        # Лимит 500 записей на загрузку
        if saved_count >= 500:
            break
        try:
            if is_rich_format:
                # Богатый формат (smartwatch_sleep_dataset.csv)
                date_str = row.get("date_recorded", row.get("date", ""))[:10]
                start_time = row.get("sleep_start_timestamp", row.get("start_time", ""))
                end_time = row.get("sleep_end_timestamp", row.get("end_time", ""))
                duration = int(float(row.get("duration_minutes", 0)))
                total = duration if duration > 0 else 1

                deep_pct  = float(row.get("sleep_stage_deep_pct", 0)) / 100
                light_pct = float(row.get("sleep_stage_light_pct", 0)) / 100
                rem_pct   = float(row.get("sleep_stage_rem_pct", 0)) / 100
                awake_pct = float(row.get("sleep_stage_awake_pct", 0)) / 100

                hr_avg  = float(row["heart_rate_mean_bpm"]) if row.get("heart_rate_mean_bpm") else None
                hr_min  = float(row["heart_rate_min_bpm"])  if row.get("heart_rate_min_bpm")  else None
                hr_max  = float(row["heart_rate_max_bpm"])  if row.get("heart_rate_max_bpm")  else None
                spo2    = float(row["spo2_mean_pct"])        if row.get("spo2_mean_pct")        else None
                spo2min = float(row["spo2_min_pct"])         if row.get("spo2_min_pct")         else None
                score   = int(float(row["sleep_score"]))     if row.get("sleep_score")          else None
                awake_c = int(float(row.get("wake_after_sleep_onset_minutes", 0)))

                # Если дат повторяются - добавляем индекс
                unique_date = date_str
                if not date_str:
                    continue

                data = {
                    "date": unique_date,
                    "start_time": start_time or date_str + " 23:00:00",
                    "end_time": end_time or date_str + " 07:00:00",
                    "duration_minutes": duration,
                    "phase_deep":  int(total * deep_pct),
                    "phase_light": int(total * light_pct),
                    "phase_rem":   int(total * rem_pct),
                    "phase_awake": int(total * awake_pct),
                    "heart_rate_avg": hr_avg,
                    "heart_rate_min": hr_min,
                    "heart_rate_max": hr_max,
                    "spo2_avg": spo2,
                    "spo2_min": spo2min,
                    "awakenings_count": awake_c,
                    "sleep_score": score,
                    "source": "csv",
                }
            else:
                # Простой формат
                data = {
                    "date": row.get("date", ""),
                    "start_time": row.get("start_time", ""),
                    "end_time": row.get("end_time", ""),
                    "duration_minutes": int(float(row.get("duration_minutes", 0))),
                    "phase_light": int(float(row.get("phase_light", 0))),
                    "phase_deep":  int(float(row.get("phase_deep", 0))),
                    "phase_rem":   int(float(row.get("phase_rem", 0))),
                    "phase_awake": int(float(row.get("phase_awake", 0))),
                    "heart_rate_avg": float(row["heart_rate_avg"]) if row.get("heart_rate_avg") else None,
                    "heart_rate_min": None,
                    "heart_rate_max": None,
                    "spo2_avg": float(row["spo2_avg"]) if row.get("spo2_avg") else None,
                    "spo2_min": None,
                    "awakenings_count": int(float(row.get("awakenings_count", 0))),
                    "sleep_score": None,
                    "source": "csv",
                }

            if not data["date"]:
                continue

            # Используем user_id из CSV если есть, иначе дефолтный
            csv_user = row.get("user_id", user_id) or user_id
            save_sleep_record(data, csv_user)
            saved_count += 1

        except Exception as e:
            errors.append(f"Строка {i+2}: {str(e)}")
            if len(errors) > 10:
                break

    return {
        "saved": saved_count,
        "errors": errors[:10],
        "message": f"Загружено {saved_count} записей"
    }


# ─────────────────────────────────────────
#  СИМУЛЯТОР
# ─────────────────────────────────────────

@app.post("/api/simulate")
async def load_simulation(user_id: str = "default", days: int = 30):
    """Загружает симулированные данные для демонстрации"""
    connector = SimulatorConnector(days=days)
    records = connector.fetch()

    saved = 0
    for record in records:
        score = calculate_sleep_score(record)
        data = {
            "date": str(record.date),
            "start_time": str(record.start_time),
            "end_time": str(record.end_time),
            "duration_minutes": record.duration_minutes,
            "phase_light": record.phases.light,
            "phase_deep": record.phases.deep,
            "phase_rem": record.phases.rem,
            "phase_awake": record.phases.awake,
            "heart_rate_avg": record.heart_rate_avg,
            "heart_rate_min": record.heart_rate_min,
            "heart_rate_max": record.heart_rate_max,
            "spo2_avg": record.spo2_avg,
            "spo2_min": record.spo2_min,
            "awakenings_count": record.awakenings_count,
            "source": "simulator",
            "sleep_score": score
        }
        save_sleep_record(data, user_id)
        saved += 1

    return {"saved": saved, "message": f"Загружено {saved} симулированных записей"}


# ─────────────────────────────────────────
#  АНАЛИЗ
# ─────────────────────────────────────────

@app.post("/api/analyze")
async def run_analysis(user_id: str = "default"):
    """
    Запускает полный анализ сна:
    - Пересчитывает Sleep Score
    - Выявляет аномалии (правила + ML)
    - Генерирует рекомендации
    """
    raw_records = get_sleep_records(user_id=user_id, limit=90)

    if not raw_records:
        raise HTTPException(status_code=404, detail="Нет данных для анализа")

    # Конвертируем в SleepRecord (приводим типы — SQLite возвращает строки)
    def _int(v): return int(v) if v is not None else 0
    def _float(v): return float(v) if v is not None else None

    records = []
    for r in raw_records:
        record = SleepRecord(
            id=r["id"],
            user_id=user_id,
            date=r["date"],
            start_time=r["start_time"],
            end_time=r["end_time"],
            duration_minutes=_int(r["duration_minutes"]),
            phases=SleepPhases(
                light=_int(r["phase_light"]),
                deep=_int(r["phase_deep"]),
                rem=_int(r["phase_rem"]),
                awake=_int(r["phase_awake"])
            ),
            heart_rate_avg=_float(r["heart_rate_avg"]),
            heart_rate_min=_float(r["heart_rate_min"]),
            heart_rate_max=_float(r["heart_rate_max"]),
            spo2_avg=_float(r["spo2_avg"]),
            spo2_min=_float(r["spo2_min"]),
            sleep_score=_int(r["sleep_score"]) if r["sleep_score"] is not None else None,
            awakenings_count=_int(r["awakenings_count"]),
            source=r["source"]
        )
        records.append(record)

    # Анализ
    analyzed_records, anomalies = analyze_sleep(records)

    # Сохраняем аномалии
    for anomaly in anomalies:
        save_anomaly({
            "sleep_record_id": anomaly.sleep_record_id,
            "date": str(anomaly.date),
            "anomaly_type": anomaly.anomaly_type,
            "title": anomaly.title,
            "description": anomaly.description,
            "severity": anomaly.severity,
            "value": anomaly.value,
            "threshold": anomaly.threshold,
            "is_ml_detected": bool(anomaly.is_ml_detected)
        }, user_id)

    # Рекомендации
    context = get_user_context(user_id=user_id, days=30)
    recommendations = generate_recommendations(anomalies, context, analyzed_records)

    return {
        "analyzed": len(analyzed_records),
        "anomalies_found": len(anomalies),
        "recommendations": len(recommendations),
        "anomalies": [
            {
                "date": str(a.date),
                "type": a.anomaly_type,
                "title": a.title,
                "severity": a.severity,
                "is_ml": a.is_ml_detected
            }
            for a in anomalies
        ],
        "recommendations": [
            {
                "category": r.category,
                "title": r.title,
                "text": r.text,
                "priority": r.priority
            }
            for r in recommendations
        ]
    }


# ─────────────────────────────────────────
#  АНОМАЛИИ И РЕКОМЕНДАЦИИ
# ─────────────────────────────────────────

@app.get("/api/anomalies")
async def get_anomalies_endpoint(user_id: str = "default", days: int = 30):
    """Возвращает аномалии за последние N дней"""
    return get_anomalies(user_id=user_id, days=days)


# ─────────────────────────────────────────
#  ДНЕВНИК (USER CONTEXT)
# ─────────────────────────────────────────

@app.post("/api/context")
async def create_context(context: UserContextCreate, user_id: str = "default"):
    """Сохраняет запись вечернего дневника"""
    try:
        data = {
            "date": str(context.date),
            "caffeine_after_15": bool(context.caffeine_after_15),
            "alcohol": bool(context.alcohol),
            "stress_level": int(context.stress_level),
            "physical_activity": bool(context.physical_activity),
            "screen_before_bed": bool(context.screen_before_bed),
            "late_meal": bool(context.late_meal),
            "notes": context.notes or None,
        }
        save_user_context(data, user_id)
        return {"status": "saved"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка сохранения: {str(e)}")


@app.get("/api/context")
async def get_context(user_id: str = "default", days: int = 30):
    """Возвращает записи дневника"""
    return get_user_context(user_id=user_id, days=days)


# ─────────────────────────────────────────
#  HEALTHCHECK
# ─────────────────────────────────────────

@app.get("/")
async def root():
    return {
        "name": "Sleep Analyzer API",
        "version": "1.0.0",
        "status": "running"
    }


# ─────────────────────────────────────────
#  HEALTH CONNECT
# ─────────────────────────────────────────

@app.post("/api/health-connect")
async def receive_health_connect(payload: dict, user_id: str = "default"):
    """
    Принимает данные сна из Health Connect (Android).
    Вызывается из React Native через fetch после чтения Health Connect API.

    Формат payload:
    {
      "sleepSessions": [
        {
          "startTime": "2024-04-03T22:36:00",
          "endTime": "2024-04-04T06:01:00",
          "stages": [
            {"stage": 4, "startTime": "...", "endTime": "..."},  // 4=deep, 3=light, 5=rem, 2=awake
          ]
        }
      ]
    }
    """
    sessions = payload.get("sleepSessions", [])
    saved = 0

    for session in sessions:
        try:
            from datetime import datetime
            start = session.get("startTime", "")
            end   = session.get("endTime", "")

            start_dt = datetime.fromisoformat(start.replace("Z", ""))
            end_dt   = datetime.fromisoformat(end.replace("Z", ""))
            duration = int((end_dt - start_dt).total_seconds() / 60)
            date_str = start_dt.strftime("%Y-%m-%d")

            # Подсчёт фаз из stages
            stages = session.get("stages", [])
            deep = light = rem = awake = 0
            for s in stages:
                stage_type = s.get("stage", 0)
                s_start = datetime.fromisoformat(s["startTime"].replace("Z", ""))
                s_end   = datetime.fromisoformat(s["endTime"].replace("Z", ""))
                mins = int((s_end - s_start).total_seconds() / 60)
                if stage_type == 4:   deep  += mins
                elif stage_type == 3: light += mins
                elif stage_type == 5: rem   += mins
                elif stage_type == 2: awake += mins

            data = {
                "date": date_str,
                "start_time": start,
                "end_time": end,
                "duration_minutes": duration,
                "phase_deep":  deep,
                "phase_light": light,
                "phase_rem":   rem,
                "phase_awake": awake,
                "heart_rate_avg": session.get("heartRateAvg"),
                "heart_rate_min": session.get("heartRateMin"),
                "heart_rate_max": session.get("heartRateMax"),
                "spo2_avg": session.get("spo2Avg"),
                "spo2_min": session.get("spo2Min"),
                "awakenings_count": session.get("awakeningsCount", 0),
                "sleep_score": None,
                "source": "health_connect",
            }

            save_sleep_record(data, user_id)
            saved += 1

        except Exception as e:
            print(f"Health Connect parse error: {e}")

    return {"saved": saved, "message": f"Сохранено {saved} сессий сна из Health Connect"}


# ─────────────────────────────────────────
#  GADGETBRIDGE — улучшенный webhook
# ─────────────────────────────────────────

@app.post("/api/gadgetbridge/webhook")
async def gadgetbridge_webhook(payload: dict, user_id: str = "default"):
    """
    Принимает данные от Gadgetbridge через HTTP.
    Настройка в Gadgetbridge:
    Настройки → Управление устройством → HTTP Reporter → URL сервера:
    https://ВАШ-ПРОЕКТ.up.railway.app/api/gadgetbridge/webhook
    """
    try:
        from datetime import datetime, date as date_type

        # Gadgetbridge может слать разные форматы
        sleep = payload.get("sleep") or payload.get("Sleep") or {}
        activity = payload.get("activity") or []

        if not sleep and not activity:
            return {"status": "ok", "message": "Нет данных сна в payload"}

        if sleep:
            start_ts = sleep.get("start", sleep.get("startTime", 0))
            end_ts   = sleep.get("end",   sleep.get("endTime", 0))

            if isinstance(start_ts, (int, float)) and start_ts > 1000000000:
                start_dt = datetime.fromtimestamp(start_ts)
                end_dt   = datetime.fromtimestamp(end_ts)
            else:
                start_dt = datetime.fromisoformat(str(start_ts))
                end_dt   = datetime.fromisoformat(str(end_ts))

            duration = int((end_dt - start_dt).total_seconds() / 60)

            data = {
                "date": start_dt.strftime("%Y-%m-%d"),
                "start_time": start_dt.isoformat(),
                "end_time": end_dt.isoformat(),
                "duration_minutes": duration,
                "phase_deep":  int(sleep.get("deepSleepDuration", sleep.get("lightSleepDuration", 0))),
                "phase_light": int(sleep.get("lightSleepDuration", 0)),
                "phase_rem":   int(sleep.get("remSleepDuration", 0)),
                "phase_awake": int(sleep.get("awakeDuration", 0)),
                "heart_rate_avg": sleep.get("heartRateAverage", sleep.get("heartRate")),
                "heart_rate_min": sleep.get("heartRateMin"),
                "heart_rate_max": sleep.get("heartRateMax"),
                "spo2_avg": sleep.get("spo2Average", sleep.get("spo2")),
                "spo2_min": sleep.get("spo2Min"),
                "awakenings_count": int(sleep.get("wakeupCount", 0)),
                "sleep_score": None,
                "source": "gadgetbridge",
            }

            save_sleep_record(data, user_id)
            return {"status": "ok", "message": "Данные сна сохранены", "date": data["date"]}

        return {"status": "ok", "message": "Данные получены"}

    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Ошибка парсинга: {str(e)}")
