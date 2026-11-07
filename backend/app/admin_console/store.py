"""SQLite persistence for the admin console.

Uses the same learning database as learner data (``learner_db_path()``) so the
dashboard can aggregate real learner/progress/agent tables. All console tables
are prefixed ``admin_``.
"""
from __future__ import annotations

import json
import re
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

from ..learner_identity import learner_db_path

ROLES = ("admin", "editor", "viewer")
GUARD_LISTS = ("course", "off_topic", "injection", "unsafe", "pii")

DEFAULT_SETTINGS: Dict[str, Any] = {
    "site_name": "MakeFast 造物课堂",
    "registration_open": True,
    "agent_enabled": True,
    "agent_offline_only": False,
    "agent_daily_message_limit": 60,
    "agent_max_reply_chars": 120,
    "log_retention_days": 30,
    "default_course": "first-lesson",
    "maintenance_banner": "",
}


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def repo_root() -> Path:
    return Path(__file__).resolve().parents[3]


# ---------------------------------------------------------------------------
# privacy redaction
# ---------------------------------------------------------------------------
_REDACTIONS = [
    (re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}"), "[邮箱已隐藏]"),
    (re.compile(r"\d{17}[\dXx]|\d{15}"), "[证件号已隐藏]"),
    (re.compile(r"(?<!\d)1[3-9]\d{9}(?!\d)"), "[手机号已隐藏]"),
    (re.compile(r"(?<!\d)\d{7,}(?!\d)"), "[数字已隐藏]"),
    (re.compile(r"(我叫|我的名字是|我是)([\u4e00-\u9fa5]{2,4})"), r"\1[姓名已隐藏]"),
    (re.compile(r"(我家|住址|家住|地址)(在|是)?[^，。,.!！?？\s]{0,30}"), r"\1[地址已隐藏]"),
    (re.compile(r"(我的学校是|我在)([\u4e00-\u9fa5]{2,20}(小学|中学|学校))"), r"\1[学校已隐藏]"),
]


def redact(text: Optional[str]) -> str:
    out = text or ""
    for pattern, repl in _REDACTIONS:
        out = pattern.sub(repl, out)
    return out


def learner_alias(user_id: str) -> str:
    import hashlib

    return "学习者#" + hashlib.sha256((user_id or "").encode()).hexdigest()[:6]


# ---------------------------------------------------------------------------
# seed data
# ---------------------------------------------------------------------------
FIRST_LESSON_SEED = {
    "slug": "first-lesson",
    "title": "第一课：温湿度小管家",
    "level": "入门",
    "summary": "用 XIAO ESP32-S3 + DHT22 + 蜂鸣器做一个会感知温湿度的小管家。",
    "skills": ["电子与接线", "传感器", "编程逻辑", "调试排错", "原理理解"],
    "prerequisites": [],
    "cover": "/boards/xiao-esp32-s3/cover.webp",
    "duration_min": 45,
    "board_id": "xiao-esp32-s3",
    "steps": [
        {"id": "meet", "title": "认识今天的作品", "why": "先知道要做什么，动手更有方向。"},
        {"id": "board", "title": "确认开发板", "why": "板型决定编译方式。"},
        {"id": "wire-dht", "title": "接上温湿度传感器", "why": "DATA 线把读数送到 D0。"},
        {"id": "wire-buzzer", "title": "接上蜂鸣器", "why": "D1 控制蜂鸣器发声。"},
        {"id": "program", "title": "看看程序", "why": "了解程序每一段在做什么。"},
        {"id": "connect", "title": "连接设备", "why": "电脑要和小板说上话。"},
        {"id": "compile", "title": "编译程序", "why": "把程序翻译成小板能懂的语言。"},
        {"id": "flash", "title": "烧录到小板", "why": "把翻译好的程序放进小板。"},
        {"id": "observe", "title": "看见温度和湿度", "why": "串口读数证明作品在工作。"},
    ],
    "quiz": [
        {"id": "q-data-pin", "prompt": "第一课里，DHT22 的 DATA（数据）线接在 XIAO 的哪个引脚？",
         "choices": ["D0", "5V", "GND", "D6"], "answer_index": 0, "explain": "课程推荐接法把 DATA 接在 D0（GPIO1）。"},
        {"id": "q-why-compile", "prompt": "为什么烧录之前要先「编译」？",
         "choices": ["把程序翻译成芯片能执行的机器码", "给板子充电", "清空串口", "检查网络"], "answer_index": 0,
         "explain": "编译把我们写的程序翻译成芯片能执行的机器码。"},
        {"id": "q-serial-meaning", "prompt": "串口里每隔 2 秒出现一行「温度…湿度…」，说明了什么？",
         "choices": ["传感器正在工作，程序在循环读取", "板子坏了", "需要重新接线", "电脑中毒了"], "answer_index": 0,
         "explain": "说明程序在 loop 里循环读取传感器并打印。"},
    ],
}
OTHER_COURSE_SEEDS = [
    ("course-led-blink", "点亮第一盏 LED", "入门", ["电子与接线", "编程逻辑", "原理理解"], []),
    ("course-servo-wave", "舵机挥手小机器人", "进阶", ["电子与接线", "编程逻辑"], ["first-lesson"]),
    ("course-light-alarm", "光线感应小夜灯", "进阶", ["传感器", "编程逻辑"], ["first-lesson"]),
    ("course-debug-detective", "排错小侦探：读懂报错", "进阶", ["调试排错", "编程逻辑"], ["first-lesson"]),
    ("course-weather-station", "联网小气象站", "熟练", ["编程逻辑", "传感器", "调试排错"], ["course-light-alarm", "course-servo-wave"]),
]

FAQ_SEED = [
    ("串口读数是 nan 怎么办？", "多半是 DATA 线没接好或接错引脚。按连线图检查 DHT22 的 DATA → D0、VCC → 3V3、GND → GND。", ["接线", "串口"]),
    ("编译报错找不到 DHT.h？", "说明编译环境没有安装 DHT sensor library，请老师在管理端安装后再试。", ["编译", "库"]),
    ("连接时找不到端口？", "换一根能传数据的 USB 线，用 Chrome/Edge 浏览器，必要时按住 BOOT 键再插上。", ["连接"]),
    ("蜂鸣器不响？", "检查蜂鸣器 S 线是否接在 D1，确认程序里 BUZZER_PIN 与连线图一致。", ["接线", "蜂鸣器"]),
]


def _course_agent_lists() -> Dict[str, List[str]]:
    try:
        from .. import course_agent as ca  # read-only reuse of the live guard rules
    except Exception:  # pragma: no cover - defensive
        ca = None
    get = lambda name: list(getattr(ca, name, []) or []) if ca else []
    return {
        "course": get("COURSE_KEYWORDS"),
        "off_topic": get("OFF_TOPIC_HINTS"),
        "injection": get("INJECTION_PATTERNS"),
        "unsafe": get("UNSAFE_PATTERNS"),
        "pii": get("PII_PATTERNS"),
    }


# ---------------------------------------------------------------------------
# hardware validation
# ---------------------------------------------------------------------------
def validate_hardware(kind: str, data: Dict[str, Any], pinmap: Optional[Dict[str, Any]]) -> List[str]:
    """Return a list of human readable validation errors (empty = ok)."""
    errors: List[str] = []
    if not isinstance(data, dict):
        return ["数据必须是 JSON 对象"]
    for field in ("id", "name"):
        if not isinstance(data.get(field), str) or not data.get(field).strip():
            errors.append(f"缺少字段 {field}")
    if kind == "board":
        lv = data.get("logicVoltage")
        if not isinstance(lv, (int, float)) or not (1 <= lv <= 12):
            errors.append("logicVoltage 必须是 1–12 之间的数字")
        tc = data.get("toolchain")
        if not isinstance(tc, dict) or not tc.get("backendBoardId"):
            errors.append("toolchain.backendBoardId 必填")
    if pinmap is not None:
        if not isinstance(pinmap, dict) or not isinstance(pinmap.get("pins"), list) or not pinmap["pins"]:
            errors.append("pinmap.pins 必须是非空数组")
        else:
            ids = []
            for idx, pin in enumerate(pinmap["pins"]):
                if not isinstance(pin, dict) or not isinstance(pin.get("id"), str):
                    errors.append(f"pinmap.pins[{idx}] 缺少 id")
                    continue
                ids.append(pin["id"])
                for axis in ("x", "y"):
                    if not isinstance(pin.get(axis), (int, float)):
                        errors.append(f"引脚 {pin['id']} 缺少坐标 {axis}")
                if "gpio" in pin and pin["gpio"] is not None and not isinstance(pin["gpio"], int):
                    errors.append(f"引脚 {pin['id']} 的 gpio 必须是整数")
            dupes = sorted({i for i in ids if ids.count(i) > 1})
            if dupes:
                errors.append("引脚 ID 重复：" + ", ".join(dupes))
            owner = pinmap.get("boardId") if kind == "board" else pinmap.get("componentId")
            if owner and data.get("id") and owner != data.get("id"):
                errors.append(f"pinmap 归属 {owner} 与 id {data.get('id')} 不一致")
            gpios = [p.get("gpio") for p in pinmap["pins"] if isinstance(p, dict) and isinstance(p.get("gpio"), int)]
            gdupes = sorted({g for g in gpios if gpios.count(g) > 1})
            if gdupes:
                errors.append("GPIO 重复：" + ", ".join(map(str, gdupes)))
    return errors


class AdminConsoleStore:
    def __init__(self, path: Optional[Path] = None, seed_root: Optional[Path] = None) -> None:
        self.path = path
        self.seed_root = seed_root

    # -- connection -----------------------------------------------------
    def _connect(self) -> sqlite3.Connection:
        db = self.path or learner_db_path()
        db.parent.mkdir(parents=True, exist_ok=True)
        conn = sqlite3.connect(db, timeout=10)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA busy_timeout = 10000")
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS admin_users (
                username TEXT PRIMARY KEY COLLATE NOCASE,
                password_hash TEXT NOT NULL,
                role TEXT NOT NULL,
                display_name TEXT NOT NULL DEFAULT '',
                disabled INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL,
                last_login_at TEXT
            );
            CREATE TABLE IF NOT EXISTS admin_settings (
                key TEXT PRIMARY KEY, value_json TEXT NOT NULL, updated_at TEXT NOT NULL, updated_by TEXT
            );
            CREATE TABLE IF NOT EXISTS admin_course_packs (
                slug TEXT PRIMARY KEY,
                data_json TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'draft',
                revision INTEGER NOT NULL DEFAULT 1,
                updated_at TEXT NOT NULL,
                updated_by TEXT,
                published_at TEXT
            );
            CREATE TABLE IF NOT EXISTS admin_hardware (
                kind TEXT NOT NULL, item_id TEXT NOT NULL,
                data_json TEXT NOT NULL, pinmap_json TEXT,
                updated_at TEXT NOT NULL, updated_by TEXT,
                PRIMARY KEY (kind, item_id)
            );
            CREATE TABLE IF NOT EXISTS admin_agent_faq (
                faq_id INTEGER PRIMARY KEY AUTOINCREMENT,
                question TEXT NOT NULL, answer TEXT NOT NULL,
                tags_json TEXT NOT NULL DEFAULT '[]', course_slug TEXT NOT NULL DEFAULT 'first-lesson',
                enabled INTEGER NOT NULL DEFAULT 1, updated_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS admin_agent_guard (
                list_name TEXT NOT NULL, keyword TEXT NOT NULL, PRIMARY KEY (list_name, keyword)
            );
            CREATE TABLE IF NOT EXISTS admin_agent_events (
                event_id INTEGER PRIMARY KEY AUTOINCREMENT,
                created_at TEXT NOT NULL, user_ref TEXT, course_slug TEXT,
                kind TEXT NOT NULL, category TEXT, question TEXT, answer TEXT
            );
            CREATE TABLE IF NOT EXISTS admin_audit_log (
                audit_id INTEGER PRIMARY KEY AUTOINCREMENT,
                created_at TEXT NOT NULL, actor TEXT, action TEXT NOT NULL, target TEXT
            );
            CREATE TABLE IF NOT EXISTS admin_meta (key TEXT PRIMARY KEY, value TEXT);
            """
        )
        return conn

    def _table_exists(self, conn: sqlite3.Connection, name: str) -> bool:
        return conn.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?", (name,)).fetchone() is not None

    def audit(self, actor: Optional[str], action: str, target: str = "") -> None:
        with self._connect() as c:
            c.execute("INSERT INTO admin_audit_log(created_at, actor, action, target) VALUES (?,?,?,?)",
                      (now_iso(), actor, action, target))

    def audit_log(self, limit: int = 50) -> List[dict]:
        with self._connect() as c:
            rows = c.execute("SELECT * FROM admin_audit_log ORDER BY audit_id DESC LIMIT ?", (limit,)).fetchall()
        return [dict(r) for r in rows]

    def _seed_once(self, conn: sqlite3.Connection, key: str) -> bool:
        if conn.execute("SELECT 1 FROM admin_meta WHERE key=?", (key,)).fetchone():
            return False
        conn.execute("INSERT INTO admin_meta(key, value) VALUES (?, ?)", (key, now_iso()))
        return True

    # -- admin users ----------------------------------------------------
    @staticmethod
    def _user(row: sqlite3.Row) -> dict:
        return {"username": row["username"], "role": row["role"], "display_name": row["display_name"],
                "disabled": bool(row["disabled"]), "created_at": row["created_at"], "last_login_at": row["last_login_at"]}

    def list_users(self) -> List[dict]:
        with self._connect() as c:
            return [self._user(r) for r in c.execute("SELECT * FROM admin_users ORDER BY created_at")]

    def get_user_row(self, username: str) -> Optional[sqlite3.Row]:
        with self._connect() as c:
            return c.execute("SELECT * FROM admin_users WHERE username=?", (username,)).fetchone()

    def get_user(self, username: str) -> Optional[dict]:
        row = self.get_user_row(username)
        return self._user(row) if row else None

    def create_user(self, username: str, password_hash: str, role: str, display_name: str = "") -> Optional[dict]:
        if role not in ROLES:
            raise ValueError("未知角色")
        with self._connect() as c:
            try:
                c.execute("INSERT INTO admin_users(username, password_hash, role, display_name, created_at) VALUES (?,?,?,?,?)",
                          (username, password_hash, role, display_name or username, now_iso()))
            except sqlite3.IntegrityError:
                return None
        return self.get_user(username)

    def update_user(self, username: str, *, role: Optional[str] = None, display_name: Optional[str] = None,
                    disabled: Optional[bool] = None, password_hash: Optional[str] = None) -> Optional[dict]:
        sets, vals = [], []
        if role is not None:
            if role not in ROLES:
                raise ValueError("未知角色")
            sets.append("role=?"); vals.append(role)
        if display_name is not None:
            sets.append("display_name=?"); vals.append(display_name)
        if disabled is not None:
            sets.append("disabled=?"); vals.append(1 if disabled else 0)
        if password_hash is not None:
            sets.append("password_hash=?"); vals.append(password_hash)
        if not self.get_user_row(username):
            return None
        if sets:
            with self._connect() as c:
                c.execute(f"UPDATE admin_users SET {', '.join(sets)} WHERE username=?", (*vals, username))
        return self.get_user(username)

    def delete_user(self, username: str) -> bool:
        with self._connect() as c:
            return c.execute("DELETE FROM admin_users WHERE username=?", (username,)).rowcount > 0

    def count_active_admins(self, exclude: Optional[str] = None) -> int:
        with self._connect() as c:
            return c.execute("SELECT COUNT(*) FROM admin_users WHERE role='admin' AND disabled=0 AND username != ? COLLATE NOCASE",
                             (exclude or "",)).fetchone()[0]

    def touch_login(self, username: str) -> None:
        with self._connect() as c:
            c.execute("UPDATE admin_users SET last_login_at=? WHERE username=?", (now_iso(), username))

    # -- settings -------------------------------------------------------
    def get_settings(self) -> Dict[str, Any]:
        out = dict(DEFAULT_SETTINGS)
        with self._connect() as c:
            for r in c.execute("SELECT key, value_json FROM admin_settings"):
                if r["key"] in out:
                    out[r["key"]] = json.loads(r["value_json"])
        return out

    def save_settings(self, values: Dict[str, Any], actor: Optional[str]) -> Dict[str, Any]:
        with self._connect() as c:
            for k, v in values.items():
                if k not in DEFAULT_SETTINGS:
                    continue
                c.execute("INSERT INTO admin_settings(key, value_json, updated_at, updated_by) VALUES (?,?,?,?) "
                          "ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json, updated_at=excluded.updated_at, updated_by=excluded.updated_by",
                          (k, json.dumps(v, ensure_ascii=False), now_iso(), actor))
        return self.get_settings()

    # -- course packs ---------------------------------------------------
    def _ensure_courses(self, c: sqlite3.Connection) -> None:
        if not self._seed_once(c, "seed_courses_v1"):
            return
        seeds = [dict(FIRST_LESSON_SEED)]
        for slug, title, level, skills, prereq in OTHER_COURSE_SEEDS:
            seeds.append({"slug": slug, "title": title, "level": level, "summary": "", "skills": skills,
                          "prerequisites": prereq, "cover": "", "duration_min": 45, "board_id": "xiao-esp32-s3",
                          "steps": [], "quiz": []})
        for s in seeds:
            status = "published" if s["slug"] == "first-lesson" else "draft"
            c.execute("INSERT OR IGNORE INTO admin_course_packs(slug, data_json, status, updated_at, updated_by, published_at) VALUES (?,?,?,?,?,?)",
                      (s["slug"], json.dumps(s, ensure_ascii=False), status, now_iso(), "seed",
                       now_iso() if status == "published" else None))

    @staticmethod
    def _course(row: sqlite3.Row) -> dict:
        data = json.loads(row["data_json"])
        data.update({"slug": row["slug"], "status": row["status"], "revision": row["revision"],
                     "updated_at": row["updated_at"], "updated_by": row["updated_by"], "published_at": row["published_at"]})
        return data

    def list_courses(self) -> List[dict]:
        with self._connect() as c:
            self._ensure_courses(c)
            return [self._course(r) for r in c.execute("SELECT * FROM admin_course_packs ORDER BY updated_at DESC, slug")]

    def get_course(self, slug: str) -> Optional[dict]:
        with self._connect() as c:
            self._ensure_courses(c)
            r = c.execute("SELECT * FROM admin_course_packs WHERE slug=?", (slug,)).fetchone()
        return self._course(r) if r else None

    def create_course(self, data: dict, actor: Optional[str]) -> Optional[dict]:
        with self._connect() as c:
            self._ensure_courses(c)
            try:
                c.execute("INSERT INTO admin_course_packs(slug, data_json, status, updated_at, updated_by) VALUES (?,?, 'draft', ?, ?)",
                          (data["slug"], json.dumps(data, ensure_ascii=False), now_iso(), actor))
            except sqlite3.IntegrityError:
                return None
        return self.get_course(data["slug"])

    def update_course(self, slug: str, data: dict, revision: int, actor: Optional[str]) -> Optional[dict]:
        """Returns None when not found; raises ValueError on revision conflict."""
        cur = self.get_course(slug)
        if not cur:
            return None
        if cur["revision"] != revision:
            raise ValueError("课程已被其他人修改，请刷新后再保存")
        data = dict(data); data["slug"] = slug
        with self._connect() as c:
            c.execute("UPDATE admin_course_packs SET data_json=?, revision=revision+1, updated_at=?, updated_by=? WHERE slug=?",
                      (json.dumps(data, ensure_ascii=False), now_iso(), actor, slug))
        return self.get_course(slug)

    def update_course_article(self, slug: str, article: dict, actor: Optional[str]) -> Optional[dict]:
        """保存课文章节图文（不改 status）；revision +1。"""
        cur = self.get_course(slug)
        if not cur:
            return None
        meta = {"status", "revision", "updated_at", "updated_by", "published_at"}
        data = {k: v for k, v in cur.items() if k not in meta}
        data["slug"] = slug
        data["article"] = article
        with self._connect() as c:
            c.execute(
                "UPDATE admin_course_packs SET data_json=?, revision=revision+1, updated_at=?, updated_by=? WHERE slug=?",
                (json.dumps(data, ensure_ascii=False), now_iso(), actor, slug),
            )
        return self.get_course(slug)

    def update_course_resources(self, slug: str, resources: list, actor: Optional[str]) -> Optional[dict]:
        """挂载 / 更新课程资料（pdf/stl），revision +1。"""
        cur = self.get_course(slug)
        if not cur:
            return None
        meta = {"status", "revision", "updated_at", "updated_by", "published_at"}
        data = {k: v for k, v in cur.items() if k not in meta}
        data["slug"] = slug
        data["resources"] = resources
        with self._connect() as c:
            c.execute(
                "UPDATE admin_course_packs SET data_json=?, revision=revision+1, updated_at=?, updated_by=? WHERE slug=?",
                (json.dumps(data, ensure_ascii=False), now_iso(), actor, slug),
            )
        return self.get_course(slug)

    def set_course_status(self, slug: str, status: str, actor: Optional[str]) -> Optional[dict]:
        if not self.get_course(slug):
            return None
        with self._connect() as c:
            c.execute("UPDATE admin_course_packs SET status=?, updated_at=?, updated_by=?, published_at=CASE WHEN ?='published' THEN ? ELSE published_at END WHERE slug=?",
                      (status, now_iso(), actor, status, now_iso(), slug))
        return self.get_course(slug)

    def delete_course(self, slug: str) -> bool:
        with self._connect() as c:
            return c.execute("DELETE FROM admin_course_packs WHERE slug=? AND status='draft'", (slug,)).rowcount > 0

    # -- hardware -------------------------------------------------------
    def _ensure_hardware(self, c: sqlite3.Connection) -> None:
        if not self._seed_once(c, "seed_hardware_v1"):
            return
        root = (self.seed_root or repo_root()) / "frontend" / "public"
        sources = []
        for d in sorted((root / "boards").glob("*/board.json")):
            sources.append(("board", d, d.parent / "pinmap.json"))
        for d in sorted((root / "components").glob("*/component.json")):
            sources.append(("component", d, d.parent / "pinmap.json"))
        for kind, data_path, pin_path in sources:
            try:
                data = json.loads(data_path.read_text(encoding="utf-8"))
                pinmap = json.loads(pin_path.read_text(encoding="utf-8")) if pin_path.exists() else None
            except (OSError, ValueError):
                continue
            c.execute("INSERT OR IGNORE INTO admin_hardware(kind, item_id, data_json, pinmap_json, updated_at, updated_by) VALUES (?,?,?,?,?,?)",
                      (kind, data.get("id") or data_path.parent.name, json.dumps(data, ensure_ascii=False),
                       json.dumps(pinmap, ensure_ascii=False) if pinmap is not None else None, now_iso(), "seed"))

    @staticmethod
    def _hw(row: sqlite3.Row) -> dict:
        data = json.loads(row["data_json"])
        pinmap = json.loads(row["pinmap_json"]) if row["pinmap_json"] else None
        return {"kind": row["kind"], "id": row["item_id"], "name": data.get("name", row["item_id"]),
                "data": data, "pinmap": pinmap, "pin_count": len((pinmap or {}).get("pins", []) or []),
                "updated_at": row["updated_at"], "updated_by": row["updated_by"],
                "errors": validate_hardware(row["kind"], data, pinmap)}

    def list_hardware(self) -> List[dict]:
        with self._connect() as c:
            self._ensure_hardware(c)
            return [self._hw(r) for r in c.execute("SELECT * FROM admin_hardware ORDER BY kind, item_id")]

    def get_hardware(self, kind: str, item_id: str) -> Optional[dict]:
        with self._connect() as c:
            self._ensure_hardware(c)
            r = c.execute("SELECT * FROM admin_hardware WHERE kind=? AND item_id=?", (kind, item_id)).fetchone()
        return self._hw(r) if r else None

    def save_hardware(self, kind: str, item_id: str, data: dict, pinmap: Optional[dict], actor: Optional[str]) -> dict:
        with self._connect() as c:
            self._ensure_hardware(c)
            c.execute("INSERT INTO admin_hardware(kind, item_id, data_json, pinmap_json, updated_at, updated_by) VALUES (?,?,?,?,?,?) "
                      "ON CONFLICT(kind, item_id) DO UPDATE SET data_json=excluded.data_json, pinmap_json=excluded.pinmap_json, updated_at=excluded.updated_at, updated_by=excluded.updated_by",
                      (kind, item_id, json.dumps(data, ensure_ascii=False), json.dumps(pinmap, ensure_ascii=False) if pinmap is not None else None, now_iso(), actor))
        return self.get_hardware(kind, item_id)  # type: ignore[return-value]

    def delete_hardware(self, kind: str, item_id: str) -> bool:
        with self._connect() as c:
            return c.execute("DELETE FROM admin_hardware WHERE kind=? AND item_id=?", (kind, item_id)).rowcount > 0

    # -- agent: FAQ / guard / events ------------------------------------
    def _ensure_agent(self, c: sqlite3.Connection) -> None:
        if self._seed_once(c, "seed_faq_v1"):
            for q, a, tags in FAQ_SEED:
                c.execute("INSERT INTO admin_agent_faq(question, answer, tags_json, updated_at) VALUES (?,?,?,?)",
                          (q, a, json.dumps(tags, ensure_ascii=False), now_iso()))
        if self._seed_once(c, "seed_guard_v1"):
            for name, words in _course_agent_lists().items():
                for w in words:
                    c.execute("INSERT OR IGNORE INTO admin_agent_guard(list_name, keyword) VALUES (?,?)", (name, w))

    @staticmethod
    def _faq(r: sqlite3.Row) -> dict:
        return {"id": r["faq_id"], "question": r["question"], "answer": r["answer"], "tags": json.loads(r["tags_json"]),
                "course_slug": r["course_slug"], "enabled": bool(r["enabled"]), "updated_at": r["updated_at"]}

    def list_faq(self) -> List[dict]:
        with self._connect() as c:
            self._ensure_agent(c)
            return [self._faq(r) for r in c.execute("SELECT * FROM admin_agent_faq ORDER BY faq_id")]

    def create_faq(self, v: dict) -> dict:
        with self._connect() as c:
            self._ensure_agent(c)
            cur = c.execute("INSERT INTO admin_agent_faq(question, answer, tags_json, course_slug, enabled, updated_at) VALUES (?,?,?,?,?,?)",
                            (v["question"], v["answer"], json.dumps(v.get("tags", []), ensure_ascii=False), v.get("course_slug", "first-lesson"),
                             1 if v.get("enabled", True) else 0, now_iso()))
            fid = cur.lastrowid
            return self._faq(c.execute("SELECT * FROM admin_agent_faq WHERE faq_id=?", (fid,)).fetchone())

    def update_faq(self, faq_id: int, v: dict) -> Optional[dict]:
        with self._connect() as c:
            n = c.execute("UPDATE admin_agent_faq SET question=?, answer=?, tags_json=?, course_slug=?, enabled=?, updated_at=? WHERE faq_id=?",
                          (v["question"], v["answer"], json.dumps(v.get("tags", []), ensure_ascii=False), v.get("course_slug", "first-lesson"),
                           1 if v.get("enabled", True) else 0, now_iso(), faq_id)).rowcount
            if not n:
                return None
            return self._faq(c.execute("SELECT * FROM admin_agent_faq WHERE faq_id=?", (faq_id,)).fetchone())

    def delete_faq(self, faq_id: int) -> bool:
        with self._connect() as c:
            return c.execute("DELETE FROM admin_agent_faq WHERE faq_id=?", (faq_id,)).rowcount > 0

    def guard_lists(self) -> Dict[str, List[str]]:
        with self._connect() as c:
            self._ensure_agent(c)
            out: Dict[str, List[str]] = {n: [] for n in GUARD_LISTS}
            for r in c.execute("SELECT list_name, keyword FROM admin_agent_guard ORDER BY rowid"):
                out.setdefault(r["list_name"], []).append(r["keyword"])
            return out

    def replace_guard_list(self, name: str, words: List[str]) -> List[str]:
        with self._connect() as c:
            self._ensure_agent(c)
            c.execute("DELETE FROM admin_agent_guard WHERE list_name=?", (name,))
            for w in words:
                c.execute("INSERT OR IGNORE INTO admin_agent_guard(list_name, keyword) VALUES (?,?)", (name, w))
        return self.guard_lists()[name]

    def record_agent_event(self, kind: str, *, user_ref: str = "", course_slug: str = "", category: str = "",
                           question: str = "", answer: str = "") -> None:
        """Integration hook for the course agent: kind = chat | refusal. Text is redacted before storage."""
        with self._connect() as c:
            c.execute("INSERT INTO admin_agent_events(created_at, user_ref, course_slug, kind, category, question, answer) VALUES (?,?,?,?,?,?,?)",
                      (now_iso(), user_ref, course_slug, kind, category, redact(question)[:1000], redact(answer)[:2000]))

    def agent_events(self, kind: Optional[str] = None, limit: int = 100) -> List[dict]:
        with self._connect() as c:
            if kind:
                rows = c.execute("SELECT * FROM admin_agent_events WHERE kind=? ORDER BY event_id DESC LIMIT ?", (kind, limit)).fetchall()
            else:
                rows = c.execute("SELECT * FROM admin_agent_events ORDER BY event_id DESC LIMIT ?", (limit,)).fetchall()
        return [{**dict(r), "question": redact(r["question"]), "answer": redact(r["answer"])} for r in rows]

    def conversations(self, limit: int = 50) -> List[dict]:
        """Learner ↔ agent conversations (learning_agent_store) with redaction and pseudonymous learner refs."""
        with self._connect() as c:
            if not self._table_exists(c, "learner_agent_conversations"):
                return []
            convs = c.execute("SELECT * FROM learner_agent_conversations ORDER BY updated_at DESC LIMIT ?", (limit,)).fetchall()
            out = []
            for cv in convs:
                msgs = c.execute("SELECT role, content, created_at FROM learner_agent_messages WHERE conversation_id=? ORDER BY message_id",
                                 (cv["conversation_id"],)).fetchall()
                out.append({"id": cv["conversation_id"], "learner": learner_alias(cv["owner_user_id"]),
                            "course_slug": cv["course_slug"], "title": redact(cv["title"]), "updated_at": cv["updated_at"],
                            "archived": cv["archived_at"] is not None,
                            "messages": [{"role": m["role"], "content": redact(m["content"]), "created_at": m["created_at"]} for m in msgs]})
            return out

    # -- learners -------------------------------------------------------
    SKILL_EVENTS = {
        "电子与接线": ("materials_confirmed", "wiring_confirmed"),
        "编程逻辑": ("blocks_saved", "code_saved", "compile_succeeded"),
        "传感器": ("serial_verified",),
        "调试排错": ("compile_succeeded", "flash_succeeded", "challenge_completed"),
        "原理理解": ("quiz_passed", "course_completed"),
    }

    def _profile(self, events: List[str]) -> Dict[str, Any]:
        es = set(events)
        skills = {k: round(sum(1 for e in v if e in es) / len(v), 2) for k, v in self.SKILL_EVENTS.items()}
        avg = sum(skills.values()) / len(skills)
        stage = "高级" if avg >= 0.9 else "熟练" if avg >= 0.6 else "进阶" if avg >= 0.3 else "入门"
        return {"skills": skills, "stage": stage}

    def learners(self, q: str = "") -> List[dict]:
        with self._connect() as c:
            if not self._table_exists(c, "learner_users"):
                return []
            rows = c.execute("SELECT user_id, username, display_name, created_at FROM learner_users WHERE username LIKE ? OR display_name LIKE ? ORDER BY created_at DESC",
                             (f"%{q}%", f"%{q}%")).fetchall()
            has_ev = self._table_exists(c, "learner_progress_events")
            out = []
            for r in rows:
                evs: List[sqlite3.Row] = []
                if has_ev:
                    evs = c.execute("SELECT event_type, points, created_at FROM learner_progress_events WHERE user_id=?", (r["user_id"],)).fetchall()
                types = [e["event_type"] for e in evs]
                prof = self._profile(types)
                out.append({"id": r["user_id"], "username": r["username"], "display_name": r["display_name"],
                            "created_at": r["created_at"], "points": sum(e["points"] for e in evs),
                            "event_count": len(evs), "completed": "course_completed" in types,
                            "quiz_passed": "quiz_passed" in types, "stage": prof["stage"],
                            "last_active": max([e["created_at"] for e in evs] or [r["created_at"]])})
            return out

    def learner_detail(self, user_id: str) -> Optional[dict]:
        with self._connect() as c:
            if not self._table_exists(c, "learner_users"):
                return None
            r = c.execute("SELECT user_id, username, display_name, created_at FROM learner_users WHERE user_id=?", (user_id,)).fetchone()
            if not r:
                return None
            evs = []
            if self._table_exists(c, "learner_progress_events"):
                evs = [dict(e) for e in c.execute("SELECT event_type, event_key, project_id, points, created_at FROM learner_progress_events WHERE user_id=? ORDER BY created_at", (user_id,))]
            projects = []
            if self._table_exists(c, "learner_projects"):
                cols = {x["name"] for x in c.execute("PRAGMA table_info(learner_projects)")}
                owner = "owner_user_id" if "owner_user_id" in cols else ("user_id" if "user_id" in cols else None)
                if owner:
                    pick = [k for k in ("project_id", "title", "course_slug", "updated_at", "created_at") if k in cols]
                    projects = [dict(p) for p in c.execute(f"SELECT {', '.join(pick)} FROM learner_projects WHERE {owner}=?", (user_id,))]
        types = [e["event_type"] for e in evs]
        prof = self._profile(types)
        quiz = [e for e in evs if e["event_type"] == "quiz_passed"]
        return {"id": r["user_id"], "username": r["username"], "display_name": r["display_name"], "created_at": r["created_at"],
                "points": sum(e["points"] for e in evs), "events": evs, "projects": projects,
                "skills": prof["skills"], "stage": prof["stage"], "quiz_history": quiz,
                "quiz_timings": [t for t in self.telemetry(user_ref=user_id, limit=50) if t["kind"] == "quiz_attempt"],
                "compile_errors": [t for t in self.telemetry(user_ref=user_id, limit=50) if t["kind"] == "compile_error"],
                "lesson_profile": self.lesson_profile(user_id),
                "lesson_sessions": self.lesson_sessions(user_id),
                "completed": "course_completed" in types}

    # -- student-side telemetry (quiz timings / compile errors) ---------
    _TELEMETRY_SQL = """CREATE TABLE IF NOT EXISTS admin_lesson_telemetry (
        id INTEGER PRIMARY KEY AUTOINCREMENT, created_at TEXT NOT NULL, user_ref TEXT NOT NULL DEFAULT '',
        course_slug TEXT NOT NULL DEFAULT '', kind TEXT NOT NULL, payload_json TEXT NOT NULL)"""

    def record_telemetry(self, kind: str, payload: Dict[str, Any], *, user_ref: str = "", course_slug: str = "") -> None:
        """kind = quiz_attempt | compile_error. Free text is redacted; payload size is bounded by the API schema."""
        data = dict(payload)
        if "error_text" in data:
            data["error_text"] = redact(str(data["error_text"]))[:500]
        with self._connect() as c:
            c.execute(self._TELEMETRY_SQL)
            c.execute("INSERT INTO admin_lesson_telemetry(created_at, user_ref, course_slug, kind, payload_json) VALUES (?,?,?,?,?)",
                      (now_iso(), user_ref, course_slug, kind, json.dumps(data, ensure_ascii=False)))

    def telemetry(self, user_ref: Optional[str] = None, limit: int = 500) -> List[dict]:
        with self._connect() as c:
            c.execute(self._TELEMETRY_SQL)
            q = "SELECT * FROM admin_lesson_telemetry" + (" WHERE user_ref=?" if user_ref else "") + " ORDER BY id DESC LIMIT ?"
            rows = c.execute(q, ((user_ref, limit) if user_ref else (limit,))).fetchall()
        return [{"created_at": r["created_at"], "user_ref": r["user_ref"], "course_slug": r["course_slug"], "kind": r["kind"],
                 **json.loads(r["payload_json"])} for r in rows]

    @staticmethod
    def error_signature(text: str) -> str:
        t = re.sub(r"^.*?error:\s*", "", text or "")
        t = re.sub(r"'[^']*'", "'…'", t)
        return t.strip()[:80] or "未知错误"

    def telemetry_summary(self) -> Dict[str, Any]:
        rows = self.telemetry(limit=2000)
        errs: Dict[str, int] = {}
        qtime: Dict[str, List[int]] = {}
        qcorrect: Dict[str, List[int]] = {}
        for r in rows:
            if r["kind"] == "compile_error":
                sig = self.error_signature(r.get("error_text", ""))
                errs[sig] = errs.get(sig, 0) + 1
            elif r["kind"] == "quiz_attempt":
                for it in r.get("items", []):
                    qid = str(it.get("question_id", "?"))
                    qtime.setdefault(qid, []).append(int(it.get("ms", 0)))
                    qcorrect.setdefault(qid, []).append(1 if it.get("correct") else 0)
        quiz = [{"question_id": k, "attempts": len(v), "avg_sec": round(sum(v) / len(v) / 1000, 1),
                 "correct_rate": round(sum(qcorrect[k]) / len(qcorrect[k]), 2)} for k, v in sorted(qtime.items())]
        top = [{"label": k, "count": n} for k, n in sorted(errs.items(), key=lambda x: -x[1])[:10]]
        return {"compile_errors": top, "quiz_questions": quiz}

    def lesson_profile(self, owner_ref: str) -> Optional[dict]:
        with self._connect() as c:
            if not self._table_exists(c, "lesson_profiles"):
                return None
            r = c.execute("SELECT data_json, updated_at FROM lesson_profiles WHERE owner_ref=?", (owner_ref,)).fetchone()
        if not r:
            return None
        d = json.loads(r["data_json"])
        return {"profile": d.get("profile"), "age_tier": d.get("ageTier"), "difficulties": d.get("difficulties", {}), "event_count": len(d.get("events", [])),
                "quiz_attempts": len(d.get("quizAttempts", [])), "updated_at": r["updated_at"]}

    def lesson_sessions(self, owner_ref: str) -> List[dict]:
        with self._connect() as c:
            if not self._table_exists(c, "lesson_sessions"):
                return []
            rows = c.execute("SELECT session_id, course_id, step_index, mainline_completed, quiz_json, updated_at FROM lesson_sessions WHERE owner_ref=? ORDER BY updated_at DESC LIMIT 20", (owner_ref,)).fetchall()
        return [{"session_id": r["session_id"], "course_id": r["course_id"], "step_index": r["step_index"], "mainline_completed": bool(r["mainline_completed"]),
                 "quiz_passed": (json.loads(r["quiz_json"]) or {}).get("passed") if r["quiz_json"] else None, "updated_at": r["updated_at"]} for r in rows]

    def published_courses(self) -> List[dict]:
        return [c for c in self.list_courses() if c.get("status") == "published"]

    # -- dashboard ------------------------------------------------------
    def dashboard(self, ops: Optional[dict] = None) -> Dict[str, Any]:
        out: Dict[str, Any] = {"learner_count": 0, "active_sessions": 0, "started_learners": 0,
                               "completion_rate": None, "quiz_pass_rate": None,
                               "agent_messages": 0, "agent_conversations": 0, "agent_refusals": 0,
                               "refusal_categories": {}, "common_errors": [], "event_funnel": {}}
        with self._connect() as c:
            if self._table_exists(c, "learner_users"):
                out["learner_count"] = c.execute("SELECT COUNT(*) FROM learner_users").fetchone()[0]
            if self._table_exists(c, "learner_sessions"):
                out["active_sessions"] = c.execute("SELECT COUNT(*) FROM learner_sessions WHERE expires_at > ?", (now_iso(),)).fetchone()[0]
            if self._table_exists(c, "learner_progress_events"):
                started = c.execute("SELECT COUNT(DISTINCT user_id) FROM learner_progress_events").fetchone()[0]
                out["started_learners"] = started
                for r in c.execute("SELECT event_type, COUNT(DISTINCT user_id) n FROM learner_progress_events GROUP BY event_type"):
                    out["event_funnel"][r["event_type"]] = r["n"]
                if started:
                    out["completion_rate"] = round(out["event_funnel"].get("course_completed", 0) / started, 3)
                    attempted = max(out["event_funnel"].get("serial_verified", 0), out["event_funnel"].get("quiz_passed", 0))
                    if attempted:
                        out["quiz_pass_rate"] = round(out["event_funnel"].get("quiz_passed", 0) / attempted, 3)
            if self._table_exists(c, "learner_agent_messages"):
                out["agent_messages"] = c.execute("SELECT COUNT(*) FROM learner_agent_messages WHERE role='user'").fetchone()[0]
                out["agent_conversations"] = c.execute("SELECT COUNT(*) FROM learner_agent_conversations").fetchone()[0]
            out["agent_messages"] += c.execute("SELECT COUNT(*) FROM admin_agent_events WHERE kind='chat'").fetchone()[0]
            for r in c.execute("SELECT category, COUNT(*) n FROM admin_agent_events WHERE kind='refusal' GROUP BY category"):
                out["refusal_categories"][r["category"] or "other"] = r["n"]
                out["agent_refusals"] += r["n"]
        errors = []
        if ops:
            for key, label in (("compile", "编译失败"), ("flash", "烧录失败")):
                n = int((ops.get(key) or {}).get("failure", 0) or 0)
                if n:
                    errors.append({"label": label, "count": n, "rate": (ops.get(key) or {}).get("failure_rate", 0)})
        for cat, n in out["refusal_categories"].items():
            errors.append({"label": f"Agent 拒答：{cat}", "count": n, "rate": None})
        tel = self.telemetry_summary()
        for e in tel["compile_errors"]:
            errors.append({"label": f"编译报错：{e['label']}", "count": e["count"], "rate": None})
        out["common_errors"] = sorted(errors, key=lambda e: -e["count"])
        out["quiz_timings"] = tel["quiz_questions"]
        return out


console_store = AdminConsoleStore()
