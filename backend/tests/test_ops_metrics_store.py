from app.ops_metrics import OpsMetricsStore


def test_sqlite_metrics_records_compile_and_flash(tmp_path):
    store = OpsMetricsStore(data_dir=str(tmp_path))

    store.record_compile(True)
    store.record_compile(False)
    store.record_flash(False)

    metrics = store.get_metrics()
    assert metrics["compile"]["total"] == 2
    assert metrics["compile"]["success"] == 1
    assert metrics["compile"]["failure"] == 1
    assert metrics["compile"]["failure_rate"] == 50.0
    assert metrics["flash"]["total"] == 1
    assert metrics["flash"]["failure"] == 1


def test_sqlite_feedback_is_trimmed_and_listed_newest_first(tmp_path):
    store = OpsMetricsStore(data_dir=str(tmp_path))

    first = store.add_feedback("故障反馈", "first message", logs=["a"] * 40)
    second = store.add_feedback("建议", "second message")

    items = store.list_feedback(limit=10)
    assert [item["id"] for item in items[:2]] == [second["id"], first["id"]]
    assert len(items[1]["logs"]) == 30


def test_sqlite_feedback_keeps_latest_500(tmp_path):
    store = OpsMetricsStore(data_dir=str(tmp_path))

    for index in range(505):
        store.add_feedback("故障反馈", f"message {index}")

    items = store.list_feedback(limit=600)
    assert len(items) == 500
    assert items[0]["message"] == "message 504"
    assert items[-1]["message"] == "message 5"
