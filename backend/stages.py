"""
Генератор синтетических stages когда нет реальной хронологии (CSV, симулятор).
Создаёт правдоподобную последовательность фаз сна на основе суммарных минут.
"""
import json
import random
from datetime import datetime, timedelta
from typing import Optional


def generate_stages_json(
    start_time_iso: str,
    duration_minutes: int,
    phase_deep: int,
    phase_light: int,
    phase_rem: int,
    phase_awake: int,
) -> Optional[str]:
    """
    Возвращает JSON-строку с массивом stages: [{start, end, type}, ...].
    type: 'deep', 'light', 'rem', 'awake'.

    Алгоритм: разбиваем сон на циклы по 90 мин, в каждом распределяем фазы
    с учётом того что глубокий сон преобладает в начале, REM — в конце.
    """
    if not duration_minutes or duration_minutes <= 0:
        return None

    try:
        start_dt = datetime.fromisoformat(start_time_iso.replace("Z", "+00:00"))
    except Exception:
        return None

    total = duration_minutes
    cycles = max(1, round(total / 90))
    cycle_len = total / cycles

    # Распределяем фазы по циклам
    # Глубокий: 60-80% в первой половине ночи
    # REM: 60-80% во второй половине ночи
    # Лёгкий: равномерно
    # Awake: распределяем редкими короткими пиками

    cycle_data = []
    for c in range(cycles):
        weight_deep = 1.5 - c * (1.0 / max(1, cycles - 1))  # убывает
        weight_rem = 0.5 + c * (1.0 / max(1, cycles - 1))   # возрастает
        cycle_data.append({
            "deep_w": max(0.1, weight_deep),
            "rem_w": max(0.1, weight_rem),
        })

    sum_deep_w = sum(c["deep_w"] for c in cycle_data)
    sum_rem_w = sum(c["rem_w"] for c in cycle_data)

    for c in cycle_data:
        c["deep"] = (c["deep_w"] / sum_deep_w) * phase_deep
        c["rem"] = (c["rem_w"] / sum_rem_w) * phase_rem
        c["light"] = phase_light / cycles
        c["awake"] = phase_awake / cycles

    # Строим последовательность: в каждом цикле порядок light → deep → light → rem → awake
    stages = []
    t = start_dt
    for c in cycle_data:
        segments = []
        if c["light"] > 0:
            segments.append(("light", c["light"] * 0.4))
        if c["deep"] > 0:
            segments.append(("deep", c["deep"]))
        if c["light"] > 0:
            segments.append(("light", c["light"] * 0.4))
        if c["rem"] > 0:
            segments.append(("rem", c["rem"]))
        if c["awake"] > 0.5:
            segments.append(("awake", c["awake"]))
        if c["light"] > 0:
            segments.append(("light", c["light"] * 0.2))

        for stage_type, mins in segments:
            if mins < 0.5:
                continue
            end = t + timedelta(minutes=mins)
            stages.append({
                "start": t.isoformat(),
                "end": end.isoformat(),
                "type": stage_type,
            })
            t = end

    return json.dumps(stages, ensure_ascii=False)
