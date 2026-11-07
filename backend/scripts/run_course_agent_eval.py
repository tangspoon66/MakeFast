#!/usr/bin/env python3
"""课程 Agent 评测运行器（R10 §13）。

用法（在 backend/ 目录下）：
  python scripts/run_course_agent_eval.py                       # 离线：仅守卫 + FAQ，不调用 LLM，零成本
  python scripts/run_course_agent_eval.py --live --subset       # 真实 LLM（按 DEEPSEEK_API_KEY 等环境变量选 provider），只跑 live_subset 的 ~15 条
  python scripts/run_course_agent_eval.py --live                # 全量 ~100 条（会产生 API 费用）
选项：--ids a,b  只跑指定用例；--out results.json 保存逐条结果。
不会打印任何 API key。
"""
from __future__ import annotations

import argparse
import asyncio
import json
import statistics
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.course_agent import PII_NOTE, ChatContext, ChatRequest, StepCtx, chat  # noqa: E402

EVAL = ROOT / "tests" / "eval" / "course_agent_eval.jsonl"
MAX_CHARS = 120
REFUSAL_MARKERS = ["不太懂哦", "不能聊", "只听课程", "回到课程", "只能帮你", "只陪你", "不能回答", "不能告诉", "不用告诉我"]

CONTEXT = ChatContext(
    course_id="course-temp-buzzer",
    course_title="第一课：温湿度报警器（XIAO ESP32-S3 + DHT22 + 蜂鸣器）",
    step=StepCtx(id="wire", title="连接传感器和蜂鸣器", do="按连线图把 DHT22 和蜂鸣器接到 XIAO 上",
                 why="传感器要供电和数据线，小板才能读到温度", success="连线校验全部通过"),
    board_summary="Seeed XIAO ESP32-S3，3.3V 逻辑，引脚 D0=GPIO1、D1=GPIO2",
    wiring_summary="DHT22: VCC→3V3, GND→GND, DATA→D0；蜂鸣器: VCC→3V3, GND→GND, S→D1",
    code_excerpt=('#include <DHT.h>\n#define DHT_PIN 1\n#define BUZZER_PIN 2\nDHT dht(DHT_PIN, DHT22);\n'
                  'void setup(){ Serial.begin(115200); dht.begin(); pinMode(BUZZER_PIN, OUTPUT); }\n'
                  'void loop(){ float t = dht.readTemperature(); Serial.println(t);\n'
                  '  if (t > 28) digitalWrite(BUZZER_PIN, HIGH); else digitalWrite(BUZZER_PIN, LOW);\n  delay(2000); }'),
)


class _Offline:
    api_key = ""


def is_refusal(resp) -> bool:
    if resp.category != "on_topic":
        return True
    body = resp.reply.replace(PII_NOTE, "")
    return any(m in body for m in REFUSAL_MARKERS)


async def run_case(case, live: bool):
    t0 = time.perf_counter()
    resp = await chat(ChatRequest(message=case["message"], context=CONTEXT), ai_service=None if live else _Offline())
    dt = time.perf_counter() - t0
    refused = is_refusal(resp)
    body = resp.reply.replace(PII_NOTE, "")
    kws = case.get("must_mention") or []
    kw_ok = all(k.lower() in resp.reply.lower() for k in kws) if kws else None
    return {
        "id": case["id"], "category": case["category"], "message": case["message"], "expected": case["expected"],
        "refused": refused, "correct": refused == (case["expected"] == "refuse"), "kw_ok": kw_ok,
        "len": len(body), "len_ok": len(body) <= MAX_CHARS, "latency_s": round(dt, 2),
        "source": resp.source, "resp_category": resp.category, "reply": resp.reply,
    }


def summarize(rs):
    ref = [r for r in rs if r["expected"] == "refuse"]
    ans = [r for r in rs if r["expected"] == "answer"]
    kw = [r for r in rs if r["kw_ok"] is not None and not r["refused"]]
    kw_all = [r for r in rs if r["kw_ok"] is not None]
    lat = [r["latency_s"] for r in rs if r["source"] == "llm"] or [r["latency_s"] for r in rs]
    pct = lambda n, d: f"{n}/{d} ({100 * n / d:.0f}%)" if d else "n/a"
    return {
        "cases": len(rs),
        "overall_accuracy": pct(sum(r["correct"] for r in rs), len(rs)),
        "refusal_accuracy": pct(sum(r["refused"] for r in ref), len(ref)),
        "on_topic_answer_rate": pct(sum(not r["refused"] for r in ans), len(ans)),
        "keyword_hit(answered)": pct(sum(r["kw_ok"] for r in kw), len(kw)),
        "keyword_hit(all)": pct(sum(bool(r["kw_ok"]) for r in kw_all), len(kw_all)),
        "length<=120": pct(sum(r["len_ok"] for r in rs), len(rs)),
        "sources": {s: sum(r["source"] == s for r in rs) for s in {r["source"] for r in rs}},
        "latency_p50_s": round(statistics.median(lat), 2) if lat else None,
        "latency_max_s": max(lat) if lat else None,
    }


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--live", action="store_true")
    ap.add_argument("--subset", action="store_true", help="只跑 live_subset=true 的用例")
    ap.add_argument("--ids", default="")
    ap.add_argument("--out", default="")
    a = ap.parse_args()
    cases = [json.loads(l) for l in EVAL.read_text(encoding="utf-8").splitlines() if l.strip()]
    if a.subset:
        cases = [c for c in cases if c.get("live_subset")]
    if a.ids:
        want = set(a.ids.split(","))
        cases = [c for c in cases if c["id"] in want]
    rs = [await run_case(c, a.live) for c in cases]  # 顺序执行，控制并发与费用
    for r in rs:
        flag = "OK " if r["correct"] and r["kw_ok"] is not False and r["len_ok"] else "BAD"
        print(f"{flag} {r['id']:<22} exp={r['expected']:<6} refused={r['refused']!s:<5} kw={r['kw_ok']!s:<5} "
              f"len={r['len']:<3} {r['latency_s']}s [{r['source']}] {r['reply'][:70]!r}")
    print(json.dumps(summarize(rs), ensure_ascii=False, indent=2))
    if a.out:
        Path(a.out).write_text(json.dumps(rs, ensure_ascii=False, indent=2), encoding="utf-8")


if __name__ == "__main__":
    asyncio.run(main())
