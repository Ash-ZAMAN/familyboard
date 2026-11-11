import json
import re
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any

import httpx
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from database import (
    get_connection,
    init_db,
    apply_goal_rollover,
    get_iso_week,
    get_iso_month,
)

app = FastAPI(
    title="Family Board Local API",
    description="API locale isolée pour Family Board (Kiosk / Smart Display)",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup():
    init_db()


# ---------------------------------------------------------
# Pydantic Models
# ---------------------------------------------------------
class PinVerifyRequest(BaseModel):
    pin: str


class SettingsUpdate(BaseModel):
    theme: Optional[str] = None
    wallpaper_url: Optional[str] = None
    card_opacity: Optional[float] = None
    parent_pin: Optional[str] = None
    city: Optional[str] = None
    country: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    prayer_method: Optional[int] = None
    ical_url: Optional[str] = None


class MemberCreate(BaseModel):
    name: str
    role: str = "Enfant"
    color: str = "#3B82F6"
    avatar: str = ""
    points: int = 0
    goal_points: int = 50


class MemberUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    color: Optional[str] = None
    avatar: Optional[str] = None
    points: Optional[int] = None
    goal_points: Optional[int] = None


class PointsDeltaRequest(BaseModel):
    delta: int
    pin: str


class DailyTaskCreate(BaseModel):
    title: str
    member_id: Optional[int] = None
    days_of_week: List[int] = [0, 1, 2, 3, 4, 5, 6]
    points_reward: int = 5
    icon: str = "check-circle"


class DailyTaskUpdate(BaseModel):
    title: Optional[str] = None
    member_id: Optional[int] = None
    days_of_week: Optional[List[int]] = None
    points_reward: Optional[int] = None
    icon: Optional[str] = None


class TaskToggleRequest(BaseModel):
    is_admin: bool = False
    pin: Optional[str] = None
    date: Optional[str] = None


class EventCreate(BaseModel):
    title: str
    member_id: Optional[int] = None
    category_color: str = "#10B981"
    event_date: str
    start_time: str
    end_time: str
    location: str = ""
    description: str = ""


class EventUpdate(BaseModel):
    title: Optional[str] = None
    member_id: Optional[int] = None
    category_color: Optional[str] = None
    event_date: Optional[str] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    location: Optional[str] = None
    description: Optional[str] = None


class IcsImportRequest(BaseModel):
    ical_url: Optional[str] = None
    ics_text: Optional[str] = None
    member_id: Optional[int] = None
    category_color: str = "#10B981"


class GoalCreate(BaseModel):
    title: str
    period_type: str  # 'weekly' or 'monthly'
    member_id: Optional[int] = None
    points_reward: int = 10


class RecipeCreate(BaseModel):
    title: str
    category: str = "Plat principal"
    prep_time: int = 15
    cook_time: int = 20
    servings: int = 4
    image_url: str = ""
    ingredients: List[str] = []
    steps: List[str] = []
    tags: List[str] = []


class RecipeUpdate(BaseModel):
    title: Optional[str] = None
    category: Optional[str] = None
    prep_time: Optional[int] = None
    cook_time: Optional[int] = None
    servings: Optional[int] = None
    image_url: Optional[str] = None
    ingredients: Optional[List[str]] = None
    steps: Optional[List[str]] = None
    tags: Optional[List[str]] = None


# ---------------------------------------------------------
# Helper Functions
# ---------------------------------------------------------
def verify_parent_pin(conn, pin: str) -> bool:
    cur = conn.cursor()
    cur.execute("SELECT parent_pin FROM settings WHERE id = 1")
    row = cur.fetchone()
    if not row:
        return pin == "1234"
    return str(row["parent_pin"]).strip() == str(pin).strip()


def save_cache(conn, key: str, payload: dict):
    cur = conn.cursor()
    cur.execute(
        """
        INSERT INTO api_cache (cache_key, payload_json, updated_at)
        VALUES (?, ?, ?)
        ON CONFLICT(cache_key) DO UPDATE SET
            payload_json = excluded.payload_json,
            updated_at = excluded.updated_at
        """,
        (key, json.dumps(payload, ensure_ascii=False), datetime.now().isoformat()),
    )
    conn.commit()


def load_cache(conn, key: str) -> Optional[dict]:
    cur = conn.cursor()
    cur.execute("SELECT payload_json, updated_at FROM api_cache WHERE cache_key = ?", (key,))
    row = cur.fetchone()
    if not row:
        return None
    try:
        data = json.loads(row["payload_json"])
        data["_cached_at"] = row["updated_at"]
        return data
    except Exception:
        return None


# ---------------------------------------------------------
# Settings & Auth Endpoints
# ---------------------------------------------------------
@app.get("/api/settings")
def get_settings():
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT * FROM settings WHERE id = 1")
    row = dict(cur.fetchone())
    conn.close()
    # Do not expose parent_pin in plain GET, or mask it except length
    row["has_pin"] = bool(row.get("parent_pin"))
    return row


@app.post("/api/verify-pin")
def check_pin(req: PinVerifyRequest):
    conn = get_connection()
    valid = verify_parent_pin(conn, req.pin)
    conn.close()
    if not valid:
        raise HTTPException(status_code=403, detail="Code PIN Parent incorrect")
    return {"valid": True}


@app.put("/api/settings")
async def update_settings(payload: SettingsUpdate):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT * FROM settings WHERE id = 1")
    current = dict(cur.fetchone())

    updates = payload.dict(exclude_unset=True)

    # If city changed and lat/lon weren't explicitly provided, try geocoding via Open-Meteo
    if ("city" in updates or "country" in updates) and "latitude" not in updates:
        city_name = updates.get("city", current["city"])
        country_name = updates.get("country", current["country"])
        try:
            async with httpx.AsyncClient(timeout=4.0) as client:
                resp = await client.get(
                    "https://geocoding-api.open-meteo.com/v1/search",
                    params={"name": city_name, "count": 5, "language": "fr", "format": "json"},
                )
                if resp.status_code == 200:
                    results = resp.json().get("results") or []
                    if results:
                        best = results[0]
                        for r in results:
                            if country_name.lower() in (r.get("country") or "").lower():
                                best = r
                                break
                        updates["latitude"] = best["latitude"]
                        updates["longitude"] = best["longitude"]
        except Exception:
            pass

    for k, v in updates.items():
        if k in current and v is not None:
            current[k] = v

    cur.execute(
        """
        UPDATE settings SET
            theme = ?,
            wallpaper_url = ?,
            card_opacity = ?,
            parent_pin = ?,
            city = ?,
            country = ?,
            latitude = ?,
            longitude = ?,
            prayer_method = ?,
            ical_url = ?
        WHERE id = 1
        """,
        (
            current["theme"],
            current["wallpaper_url"],
            current["card_opacity"],
            current["parent_pin"],
            current["city"],
            current["country"],
            current["latitude"],
            current["longitude"],
            current["prayer_method"],
            current["ical_url"],
        ),
    )
    conn.commit()
    conn.close()
    return current


# ---------------------------------------------------------
# Members & Points Progression Endpoints
# ---------------------------------------------------------
@app.get("/api/members")
def list_members():
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT * FROM members ORDER BY display_order ASC, id ASC")
    rows = [dict(r) for r in cur.fetchall()]
    conn.close()
    return rows


@app.post("/api/members")
def create_member(member: MemberCreate):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT COALESCE(MAX(display_order), 0) + 1 as next_order FROM members")
    next_order = cur.fetchone()["next_order"]
    cur.execute(
        """
        INSERT INTO members (name, role, color, avatar, points, goal_points, display_order)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        (member.name, member.role, member.color, member.avatar, member.points, member.goal_points, next_order),
    )
    new_id = cur.lastrowid
    conn.commit()
    cur.execute("SELECT * FROM members WHERE id = ?", (new_id,))
    row = dict(cur.fetchone())
    conn.close()
    return row


@app.put("/api/members/{member_id}")
def update_member(member_id: int, payload: MemberUpdate):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT * FROM members WHERE id = ?", (member_id,))
    existing = cur.fetchone()
    if not existing:
        conn.close()
        raise HTTPException(status_code=404, detail="Membre introuvable")
    current = dict(existing)
    for k, v in payload.dict(exclude_unset=True).items():
        if v is not None:
            current[k] = v

    cur.execute(
        """
        UPDATE members
        SET name = ?, role = ?, color = ?, avatar = ?, points = ?, goal_points = ?
        WHERE id = ?
        """,
        (
            current["name"],
            current["role"],
            current["color"],
            current["avatar"],
            max(0, current["points"]),
            max(1, current["goal_points"]),
            member_id,
        ),
    )
    conn.commit()
    conn.close()
    return current


@app.post("/api/members/{member_id}/points")
def adjust_member_points(member_id: int, req: PointsDeltaRequest):
    conn = get_connection()
    if not verify_parent_pin(conn, req.pin):
        conn.close()
        raise HTTPException(status_code=403, detail="Code PIN Parent invalide")

    cur = conn.cursor()
    cur.execute("SELECT * FROM members WHERE id = ?", (member_id,))
    existing = cur.fetchone()
    if not existing:
        conn.close()
        raise HTTPException(status_code=404, detail="Membre introuvable")

    new_points = max(0, existing["points"] + req.delta)
    cur.execute("UPDATE members SET points = ? WHERE id = ?", (new_points, member_id))
    conn.commit()
    cur.execute("SELECT * FROM members WHERE id = ?", (member_id,))
    updated = dict(cur.fetchone())
    conn.close()
    return updated


@app.delete("/api/members/{member_id}")
def delete_member(member_id: int):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("DELETE FROM members WHERE id = ?", (member_id,))
    conn.commit()
    conn.close()
    return {"deleted": True}


# ---------------------------------------------------------
# Daily Tasks ("La liste du jour") Endpoints
# ---------------------------------------------------------
@app.get("/api/tasks")
def list_daily_tasks(date: Optional[str] = None):
    target_date = date or datetime.now().strftime("%Y-%m-%d")
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        """
        SELECT t.*, m.name as member_name, m.color as member_color, m.avatar as member_avatar,
               COALESCE(tc.status, 'todo') as status,
               CASE WHEN tc.status = 'validated' THEN 1 ELSE 0 END as completed
        FROM daily_tasks t
        LEFT JOIN members m ON t.member_id = m.id
        LEFT JOIN task_completions tc ON t.id = tc.task_id AND tc.completion_date = ?
        ORDER BY t.display_order ASC, t.id ASC
        """,
        (target_date,),
    )
    tasks = []
    for row in cur.fetchall():
        d = dict(row)
        try:
            d["days_of_week"] = json.loads(d["days_of_week"])
        except Exception:
            d["days_of_week"] = [0, 1, 2, 3, 4, 5, 6]
        d["completed"] = bool(d["completed"])
        tasks.append(d)
    conn.close()
    return tasks


@app.post("/api/tasks")
def create_daily_task(task: DailyTaskCreate):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT COALESCE(MAX(display_order), 0) + 1 as next_order FROM daily_tasks")
    next_order = cur.fetchone()["next_order"]
    cur.execute(
        """
        INSERT INTO daily_tasks (title, member_id, days_of_week, points_reward, icon, display_order)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (
            task.title,
            task.member_id,
            json.dumps(task.days_of_week),
            task.points_reward,
            task.icon,
            next_order,
        ),
    )
    new_id = cur.lastrowid
    conn.commit()
    conn.close()
    return {"id": new_id, **task.dict()}


@app.put("/api/tasks/{task_id}")
def update_daily_task(task_id: int, payload: DailyTaskUpdate):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT * FROM daily_tasks WHERE id = ?", (task_id,))
    existing = cur.fetchone()
    if not existing:
        conn.close()
        raise HTTPException(status_code=404, detail="Tâche introuvable")
    current = dict(existing)
    updates = payload.dict(exclude_unset=True)
    if "days_of_week" in updates and updates["days_of_week"] is not None:
        updates["days_of_week"] = json.dumps(updates["days_of_week"])
    for k, v in updates.items():
        current[k] = v

    cur.execute(
        """
        UPDATE daily_tasks
        SET title = ?, member_id = ?, days_of_week = ?, points_reward = ?, icon = ?
        WHERE id = ?
        """,
        (
            current["title"],
            current["member_id"],
            current["days_of_week"],
            current["points_reward"],
            current["icon"],
            task_id,
        ),
    )
    conn.commit()
    conn.close()
    return {"updated": True}


@app.post("/api/tasks/{task_id}/toggle")
def toggle_daily_task(
    task_id: int,
    req: Optional[TaskToggleRequest] = None,
    date: Optional[str] = None,
):
    target_date = (req.date if req and req.date else date) or datetime.now().strftime("%Y-%m-%d")
    conn = get_connection()
    cur = conn.cursor()

    cur.execute("SELECT * FROM daily_tasks WHERE id = ?", (task_id,))
    task = cur.fetchone()
    if not task:
        conn.close()
        raise HTTPException(status_code=404, detail="Tâche introuvable")

    is_admin = bool(req and req.is_admin)
    if is_admin and req and req.pin:
        if not verify_parent_pin(conn, req.pin):
            conn.close()
            raise HTTPException(status_code=403, detail="Code PIN Parent invalide")

    cur.execute(
        "SELECT * FROM task_completions WHERE task_id = ? AND completion_date = ?",
        (task_id, target_date),
    )
    existing = cur.fetchone()

    member_id = task["member_id"]
    reward = task["points_reward"] or 5
    current_status = existing["status"] if existing else "todo"

    if not is_admin:
        # Mode Enfant / Public (Non-Admin) :
        # - Si 'todo' -> passe à 'pending' (En attente de validation parentale, aucun point crédité)
        # - Si 'pending' -> repasse à 'todo' (Annulation par l'enfant)
        # - Si 'validated' -> verrouillé (seul un parent admin peut décocher une tâche déjà validée)
        if current_status == "todo":
            cur.execute(
                "INSERT INTO task_completions (task_id, completion_date, completed_at, status) VALUES (?, ?, ?, 'pending')",
                (task_id, target_date, datetime.now().isoformat()),
            )
            new_status = "pending"
        elif current_status == "pending":
            cur.execute(
                "DELETE FROM task_completions WHERE task_id = ? AND completion_date = ?",
                (task_id, target_date),
            )
            new_status = "todo"
        else:
            conn.close()
            raise HTTPException(
                status_code=403,
                detail="Seul un parent connecté en mode Admin peut modifier une tâche déjà validée.",
            )
    else:
        # Mode Administrateur (Parent) :
        # - Si 'pending' ou 'todo' -> valide définitivement ('validated') et crédite les points !
        # - Si 'validated' -> annule la validation ('todo') et retire les points crédités.
        if current_status in ("todo", "pending"):
            cur.execute(
                """
                INSERT INTO task_completions (task_id, completion_date, completed_at, status)
                VALUES (?, ?, ?, 'validated')
                ON CONFLICT(task_id, completion_date) DO UPDATE SET
                    status = 'validated',
                    completed_at = excluded.completed_at
                """,
                (task_id, target_date, datetime.now().isoformat()),
            )
            new_status = "validated"
            if member_id:
                cur.execute(
                    "UPDATE members SET points = points + ? WHERE id = ?",
                    (reward, member_id),
                )
        else:
            cur.execute(
                "DELETE FROM task_completions WHERE task_id = ? AND completion_date = ?",
                (task_id, target_date),
            )
            new_status = "todo"
            if member_id:
                cur.execute(
                    "UPDATE members SET points = MAX(0, points - ?) WHERE id = ?",
                    (reward, member_id),
                )

    conn.commit()
    conn.close()
    return {
        "task_id": task_id,
        "date": target_date,
        "status": new_status,
        "completed": new_status == "validated",
    }


@app.delete("/api/tasks/{task_id}")
def delete_daily_task(task_id: int):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("DELETE FROM daily_tasks WHERE id = ?", (task_id,))
    conn.commit()
    conn.close()
    return {"deleted": True}


# ---------------------------------------------------------
# Weekly Events & iCal Sync ("L'agenda de la semaine")
# ---------------------------------------------------------
@app.get("/api/events")
def list_events(start_date: Optional[str] = None, end_date: Optional[str] = None):
    conn = get_connection()
    cur = conn.cursor()
    query = """
        SELECT e.*, m.name as member_name, m.color as member_color, m.avatar as member_avatar
        FROM events e
        LEFT JOIN members m ON e.member_id = m.id
    """
    params = []
    if start_date and end_date:
        query += " WHERE e.event_date >= ? AND e.event_date <= ?"
        params.extend([start_date, end_date])
    query += " ORDER BY e.event_date ASC, e.start_time ASC"
    cur.execute(query, params)
    rows = [dict(r) for r in cur.fetchall()]
    conn.close()
    return rows


@app.post("/api/events")
def create_event(ev: EventCreate):
    conn = get_connection()
    cur = conn.cursor()
    color = ev.category_color
    if ev.member_id:
        cur.execute("SELECT color FROM members WHERE id = ?", (ev.member_id,))
        mrow = cur.fetchone()
        if mrow:
            color = mrow["color"]

    cur.execute(
        """
        INSERT INTO events (title, member_id, category_color, event_date, start_time, end_time, location, description, source)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'local')
        """,
        (
            ev.title,
            ev.member_id,
            color,
            ev.event_date,
            ev.start_time,
            ev.end_time,
            ev.location,
            ev.description,
        ),
    )
    new_id = cur.lastrowid
    conn.commit()
    cur.execute(
        """
        SELECT e.*, m.name as member_name, m.color as member_color, m.avatar as member_avatar
        FROM events e
        LEFT JOIN members m ON e.member_id = m.id
        WHERE e.id = ?
        """,
        (new_id,),
    )
    row = dict(cur.fetchone())
    conn.close()
    return row


@app.put("/api/events/{event_id}")
def update_event(event_id: int, payload: EventUpdate):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT * FROM events WHERE id = ?", (event_id,))
    existing = cur.fetchone()
    if not existing:
        conn.close()
        raise HTTPException(status_code=404, detail="Événement introuvable")
    current = dict(existing)
    for k, v in payload.dict(exclude_unset=True).items():
        current[k] = v

    if current.get("member_id"):
        cur.execute("SELECT color FROM members WHERE id = ?", (current["member_id"],))
        mrow = cur.fetchone()
        if mrow:
            current["category_color"] = mrow["color"]

    cur.execute(
        """
        UPDATE events
        SET title = ?, member_id = ?, category_color = ?, event_date = ?, start_time = ?, end_time = ?, location = ?, description = ?
        WHERE id = ?
        """,
        (
            current["title"],
            current["member_id"],
            current["category_color"],
            current["event_date"],
            current["start_time"],
            current["end_time"],
            current["location"],
            current["description"],
            event_id,
        ),
    )
    conn.commit()
    conn.close()
    return current


@app.delete("/api/events/{event_id}")
def delete_event(event_id: int):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("DELETE FROM events WHERE id = ?", (event_id,))
    conn.commit()
    conn.close()
    return {"deleted": True}


def parse_ics_content(raw_ics: str) -> List[Dict[str, str]]:
    """Lightweight RFC 5545 VEVENT parser for Google Calendar / Outlook ICS feeds."""
    # Unfold multi-line values
    unfolded = re.sub(r"\r?\n[ \t]", "", raw_ics)
    blocks = re.findall(r"BEGIN:VEVENT(.*?)END:VEVENT", unfolded, flags=re.DOTALL)
    parsed_events = []

    def parse_dt(val: str):
        val = val.strip()
        if ":" in val:
            val = val.split(":", 1)[1]
        val = val.replace("Z", "")
        if len(val) >= 15 and "T" in val:
            dt = datetime.strptime(val[:15], "%Y%m%dT%H%M%S")
            return dt.strftime("%Y-%m-%d"), dt.strftime("%H:%M")
        elif len(val) >= 8:
            dt = datetime.strptime(val[:8], "%Y%m%d")
            return dt.strftime("%Y-%m-%d"), "09:00"
        return datetime.now().strftime("%Y-%m-%d"), "09:00"

    for block in blocks:
        summary = "Événement"
        location = ""
        description = ""
        uid = ""
        dtstart_raw = ""
        dtend_raw = ""
        for line in block.splitlines():
            line = line.strip()
            if line.startswith("SUMMARY"):
                summary = line.split(":", 1)[-1].replace("\\,", ",").replace("\\n", " ")
            elif line.startswith("LOCATION"):
                location = line.split(":", 1)[-1].replace("\\,", ",")
            elif line.startswith("DESCRIPTION"):
                description = line.split(":", 1)[-1].replace("\\n", " ").replace("\\,", ",")
            elif line.startswith("UID"):
                uid = line.split(":", 1)[-1]
            elif line.startswith("DTSTART"):
                dtstart_raw = line
            elif line.startswith("DTEND"):
                dtend_raw = line

        if dtstart_raw:
            ev_date, start_t = parse_dt(dtstart_raw)
            _, end_t = parse_dt(dtend_raw) if dtend_raw else (ev_date, "10:00")
            parsed_events.append(
                {
                    "title": summary[:120],
                    "event_date": ev_date,
                    "start_time": start_t,
                    "end_time": end_t,
                    "location": location[:120],
                    "description": description[:250],
                    "external_uid": uid or f"{summary}-{ev_date}-{start_t}",
                }
            )
    return parsed_events


@app.post("/api/events/import-ics")
async def import_ics_events(req: IcsImportRequest):
    raw_ics = req.ics_text or ""
    if not raw_ics and req.ical_url:
        try:
            async with httpx.AsyncClient(timeout=8.0, follow_redirects=True) as client:
                resp = await client.get(req.ical_url)
                resp.raise_for_status()
                raw_ics = resp.text
        except Exception as exc:
            raise HTTPException(status_code=400, detail=f"Impossible de récupérer le flux iCal : {exc}")

    if not raw_ics:
        raise HTTPException(status_code=400, detail="Veuillez fournir une URL iCal ou le contenu d'un fichier .ics")

    parsed = parse_ics_content(raw_ics)
    conn = get_connection()
    cur = conn.cursor()

    color = req.category_color
    if req.member_id:
        cur.execute("SELECT color FROM members WHERE id = ?", (req.member_id,))
        mrow = cur.fetchone()
        if mrow:
            color = mrow["color"]

    imported_count = 0
    for item in parsed:
        cur.execute("SELECT id FROM events WHERE external_uid = ?", (item["external_uid"],))
        if cur.fetchone():
            continue
        cur.execute(
            """
            INSERT INTO events (title, member_id, category_color, event_date, start_time, end_time, location, description, source, external_uid)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ical', ?)
            """,
            (
                item["title"],
                req.member_id,
                color,
                item["event_date"],
                item["start_time"],
                item["end_time"],
                item["location"],
                item["description"],
                item["external_uid"],
            ),
        )
        imported_count += 1

    if req.ical_url:
        cur.execute("UPDATE settings SET ical_url = ? WHERE id = 1", (req.ical_url,))

    conn.commit()
    conn.close()
    return {"imported": imported_count, "total_parsed": len(parsed)}


# ---------------------------------------------------------
# Weekly & Monthly Goals ("Objectifs") with Auto Roll-Over
# ---------------------------------------------------------
@app.get("/api/goals")
def list_goals():
    conn = get_connection()
    # Ensure automatic roll-over runs every time goals are queried
    apply_goal_rollover(conn)
    now = datetime.now()
    w_key = get_iso_week(now)
    m_key = get_iso_month(now)

    cur = conn.cursor()
    cur.execute(
        """
        SELECT g.*, m.name as member_name, m.color as member_color, m.avatar as member_avatar
        FROM goals g
        LEFT JOIN members m ON g.member_id = m.id
        WHERE (g.period_type = 'weekly' AND g.period_key = ?)
           OR (g.period_type = 'monthly' AND g.period_key = ?)
        ORDER BY g.completed ASC, g.rolled_over_count DESC, g.id ASC
        """,
        (w_key, m_key),
    )
    rows = []
    for r in cur.fetchall():
        d = dict(r)
        d["completed"] = bool(d["completed"])
        rows.append(d)
    conn.close()
    return {
        "current_week": w_key,
        "current_month": m_key,
        "weekly": [g for g in rows if g["period_type"] == "weekly"],
        "monthly": [g for g in rows if g["period_type"] == "monthly"],
    }


@app.post("/api/goals")
def create_goal(goal: GoalCreate):
    conn = get_connection()
    now = datetime.now()
    p_key = get_iso_week(now) if goal.period_type == "weekly" else get_iso_month(now)
    cur = conn.cursor()
    cur.execute(
        """
        INSERT INTO goals (title, period_type, period_key, completed, member_id, points_reward, rolled_over_count, created_at)
        VALUES (?, ?, ?, 0, ?, ?, 0, ?)
        """,
        (goal.title, goal.period_type, p_key, goal.member_id, goal.points_reward, now.isoformat()),
    )
    new_id = cur.lastrowid
    conn.commit()
    conn.close()
    return {"id": new_id, **goal.dict(), "period_key": p_key, "completed": False, "rolled_over_count": 0}


@app.post("/api/goals/{goal_id}/toggle")
def toggle_goal(goal_id: int):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT * FROM goals WHERE id = ?", (goal_id,))
    row = cur.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Objectif introuvable")

    new_status = 0 if row["completed"] else 1
    cur.execute("UPDATE goals SET completed = ? WHERE id = ?", (new_status, goal_id))

    if row["member_id"]:
        delta = row["points_reward"] if new_status == 1 else -row["points_reward"]
        cur.execute(
            "UPDATE members SET points = MAX(0, points + ?) WHERE id = ?",
            (delta, row["member_id"]),
        )

    conn.commit()
    conn.close()
    return {"id": goal_id, "completed": bool(new_status)}


@app.post("/api/goals/simulate-rollover")
def simulate_rollover():
    """Helper endpoint to demonstrate automatic roll-over of uncompleted goals from a previous period."""
    conn = get_connection()
    cur = conn.cursor()
    # Mark uncompleted goals as belonging to an older period then trigger apply_goal_rollover
    cur.execute("UPDATE goals SET period_key = '2025-W01' WHERE completed = 0 AND period_type = 'weekly'")
    cur.execute("UPDATE goals SET period_key = '2025-01' WHERE completed = 0 AND period_type = 'monthly'")
    conn.commit()
    apply_goal_rollover(conn)
    conn.close()
    return {"status": "ok"}


@app.delete("/api/goals/{goal_id}")
def delete_goal(goal_id: int):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("DELETE FROM goals WHERE id = ?", (goal_id,))
    conn.commit()
    conn.close()
    return {"deleted": True}


# ---------------------------------------------------------
# Recipes ("Recettes") Endpoints
# ---------------------------------------------------------
def format_recipe_row(row) -> dict:
    d = dict(row)
    try:
        d["ingredients"] = json.loads(d.pop("ingredients_json", "[]"))
    except Exception:
        d["ingredients"] = []
    try:
        d["steps"] = json.loads(d.pop("steps_json", "[]"))
    except Exception:
        d["steps"] = []
    try:
        d["tags"] = json.loads(d.pop("tags_json", "[]"))
    except Exception:
        d["tags"] = []
    return d


@app.get("/api/recipes")
def list_recipes():
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT * FROM recipes ORDER BY id ASC")
    rows = [format_recipe_row(r) for r in cur.fetchall()]
    conn.close()
    return rows


@app.post("/api/recipes")
def create_recipe(rec: RecipeCreate):
    conn = get_connection()
    cur = conn.cursor()
    img = rec.image_url
    if not img:
        from database import make_recipe_svg_data_uri
        img = make_recipe_svg_data_uri(rec.title[:22], "#1E293B", "#475569", "🍲")

    cur.execute(
        """
        INSERT INTO recipes (title, category, prep_time, cook_time, servings, image_url, ingredients_json, steps_json, tags_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            rec.title,
            rec.category,
            rec.prep_time,
            rec.cook_time,
            rec.servings,
            img,
            json.dumps(rec.ingredients, ensure_ascii=False),
            json.dumps(rec.steps, ensure_ascii=False),
            json.dumps(rec.tags, ensure_ascii=False),
        ),
    )
    new_id = cur.lastrowid
    conn.commit()
    cur.execute("SELECT * FROM recipes WHERE id = ?", (new_id,))
    row = format_recipe_row(cur.fetchone())
    conn.close()
    return row


@app.put("/api/recipes/{recipe_id}")
def update_recipe(recipe_id: int, payload: RecipeUpdate):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT * FROM recipes WHERE id = ?", (recipe_id,))
    existing = cur.fetchone()
    if not existing:
        conn.close()
        raise HTTPException(status_code=404, detail="Recette introuvable")
    current = format_recipe_row(existing)
    for k, v in payload.dict(exclude_unset=True).items():
        if v is not None:
            current[k] = v

    cur.execute(
        """
        UPDATE recipes
        SET title = ?, category = ?, prep_time = ?, cook_time = ?, servings = ?, image_url = ?,
            ingredients_json = ?, steps_json = ?, tags_json = ?
        WHERE id = ?
        """,
        (
            current["title"],
            current["category"],
            current["prep_time"],
            current["cook_time"],
            current["servings"],
            current["image_url"],
            json.dumps(current["ingredients"], ensure_ascii=False),
            json.dumps(current["steps"], ensure_ascii=False),
            json.dumps(current["tags"], ensure_ascii=False),
            recipe_id,
        ),
    )
    conn.commit()
    conn.close()
    return current


@app.delete("/api/recipes/{recipe_id}")
def delete_recipe(recipe_id: int):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("DELETE FROM recipes WHERE id = ?", (recipe_id,))
    conn.commit()
    conn.close()
    return {"deleted": True}


# ---------------------------------------------------------
# External APIs with SQLite Offline Fallback:
# 1. Weather via Open-Meteo (Current + Next 5 Hours)
# 2. Prayer Times via Aladhan API (Fajr, Dhuhr, Asr, Maghrib, Isha)
# ---------------------------------------------------------
WMO_DESCRIPTIONS_FR = {
    0: ("Ciel dégagé", "sun"),
    1: ("Principalement dégagé", "sun"),
    2: ("Partiellement nuageux", "cloud-sun"),
    3: ("Couvert", "cloud"),
    45: ("Brouillard", "cloud-fog"),
    48: ("Brouillard givrant", "cloud-fog"),
    51: ("Bruine légère", "cloud-drizzle"),
    53: ("Bruine modérée", "cloud-drizzle"),
    55: ("Bruine dense", "cloud-drizzle"),
    61: ("Pluie faible", "cloud-rain"),
    63: ("Pluie modérée", "cloud-rain"),
    65: ("Pluie forte", "cloud-rain"),
    71: ("Neige faible", "snowflake"),
    73: ("Neige modérée", "snowflake"),
    75: ("Neige forte", "snowflake"),
    80: ("Averses de pluie", "cloud-Sun-rain"),
    81: ("Averses modérées", "cloud-rain"),
    82: ("Averses violentes", "cloud-lightning"),
    95: ("Orage", "cloud-lightning"),
}


@app.get("/api/weather")
async def get_weather():
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT city, country, latitude, longitude FROM settings WHERE id = 1")
    s = dict(cur.fetchone())
    lat = s["latitude"]
    lon = s["longitude"]
    city = s["city"]
    cache_key = f"weather:{city}:{lat:.2f}:{lon:.2f}"

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(
                "https://api.open-meteo.com/v1/forecast",
                params={
                    "latitude": lat,
                    "longitude": lon,
                    "current": "temperature_2m,weather_code,apparent_temperature,wind_speed_10m",
                    "hourly": "temperature_2m,weather_code",
                    "timezone": "auto",
                    "forecast_days": 2,
                },
            )
            resp.raise_for_status()
            raw = resp.json()

            curr = raw.get("current", {})
            c_code = int(curr.get("weather_code", 1))
            desc, icon = WMO_DESCRIPTIONS_FR.get(c_code, ("Nuageux", "cloud-sun"))

            hourly_times = raw.get("hourly", {}).get("time", [])
            hourly_temps = raw.get("hourly", {}).get("temperature_2m", [])
            hourly_codes = raw.get("hourly", {}).get("weather_code", [])

            now_hour_prefix = datetime.now().strftime("%Y-%m-%dT%H")
            start_idx = 0
            for idx, t_str in enumerate(hourly_times):
                if t_str.startswith(now_hour_prefix):
                    start_idx = idx + 1
                    break

            next_5_hours = []
            for i in range(start_idx, min(start_idx + 5, len(hourly_times))):
                t_label = hourly_times[i].split("T")[-1][:5]
                h_code = int(hourly_codes[i]) if i < len(hourly_codes) else 1
                h_desc, h_icon = WMO_DESCRIPTIONS_FR.get(h_code, ("Nuageux", "cloud-sun"))
                next_5_hours.append(
                    {
                        "time": t_label,
                        "temp": round(hourly_temps[i]),
                        "code": h_code,
                        "description": h_desc,
                        "icon": h_icon,
                    }
                )

            result = {
                "city": city,
                "country": s["country"],
                "current": {
                    "temp": round(curr.get("temperature_2m", 16)),
                    "feels_like": round(curr.get("apparent_temperature", 15)),
                    "code": c_code,
                    "description": desc,
                    "icon": icon,
                    "wind_kmh": round(curr.get("wind_speed_10m", 12)),
                },
                "hourly": next_5_hours,
                "offline": False,
            }
            save_cache(conn, cache_key, result)
            conn.close()
            return result
    except Exception:
        cached = load_cache(conn, cache_key)
        conn.close()
        if cached:
            cached["offline"] = True
            return cached

        # Fallback realistic data if completely offline on first run
        now_h = datetime.now().hour
        fallback_hours = []
        for offset in range(1, 6):
            h = (now_h + offset) % 24
            fallback_hours.append(
                {
                    "time": f"{h:02d}:00",
                    "temp": 14 - (offset // 2),
                    "code": 2 if offset < 3 else 3,
                    "description": "Partiellement nuageux",
                    "icon": "cloud-sun" if 7 <= h <= 18 else "cloud",
                }
            )
        return {
            "city": city,
            "country": s["country"],
            "current": {
                "temp": 15,
                "feels_like": 14,
                "code": 2,
                "description": "Éclaircies",
                "icon": "cloud-sun",
                "wind_kmh": 11,
            },
            "hourly": fallback_hours,
            "offline": True,
        }


@app.get("/api/prayers")
async def get_prayer_times():
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT city, country, prayer_method FROM settings WHERE id = 1")
    s = dict(cur.fetchone())
    city = s["city"]
    country = s["country"]
    method = s["prayer_method"]
    today_key = datetime.now().strftime("%Y-%m-%d")
    cache_key = f"prayers:{city}:{country}:{method}:{today_key}"

    cached = load_cache(conn, cache_key)
    if cached:
        conn.close()
        return cached

    try:
        async with httpx.AsyncClient(timeout=6.0, follow_redirects=True) as client:
            resp = await client.get(
                "https://api.aladhan.com/v1/timingsByCity",
                params={
                    "city": city,
                    "country": country,
                    "method": method,
                },
            )
            resp.raise_for_status()
            data = resp.json().get("data", {})
            timings = data.get("timings", {})
            hijri = data.get("date", {}).get("hijri", {})

            def clean_t(val: str) -> str:
                return val.split(" ")[0].strip()[:5]

            result = {
                "city": city,
                "country": country,
                "method": method,
                "date": today_key,
                "hijri_label": f"{hijri.get('day', '')} {hijri.get('month', {}).get('en', '')} {hijri.get('year', '')}".strip(),
                "timings": {
                    "Fajr": clean_t(timings.get("Fajr", "06:18")),
                    "Dhuhr": clean_t(timings.get("Dhuhr", "12:52")),
                    "Asr": clean_t(timings.get("Asr", "15:14")),
                    "Maghrib": clean_t(timings.get("Maghrib", "17:25")),
                    "Isha": clean_t(timings.get("Isha", "19:15")),
                },
                "offline": False,
            }
            save_cache(conn, cache_key, result)
            conn.close()
            return result
    except Exception:
        # Check any recent cache for this city
        cur.execute(
            "SELECT payload_json FROM api_cache WHERE cache_key LIKE ? ORDER BY updated_at DESC LIMIT 1",
            (f"prayers:{city}:{country}:%",),
        )
        row = cur.fetchone()
        conn.close()
        if row:
            try:
                fallback = json.loads(row["payload_json"])
                fallback["offline"] = True
                return fallback
            except Exception:
                pass

        return {
            "city": city,
            "country": country,
            "method": method,
            "date": today_key,
            "hijri_label": "Jumada al-Awwal 1448",
            "timings": {
                "Fajr": "06:18",
                "Dhuhr": "12:52",
                "Asr": "15:14",
                "Maghrib": "17:25",
                "Isha": "19:15",
            },
            "offline": True,
        }
