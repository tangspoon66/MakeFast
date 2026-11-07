from app.course_qa import CourseQAAdminUpdate, CourseQAQuestionCreate, CourseQAStore


def test_course_qa_pending_not_public_until_approved(tmp_path):
    store = CourseQAStore(db_path=str(tmp_path / "qa.sqlite3"))
    item = store.add_question(
        "tpl1",
        CourseQAQuestionCreate(nickname="小明", email="student@example.com", content="这里为什么需要先连接开发板呢？"),
        client_ip="127.0.0.1",
        user_agent="pytest",
    )

    assert item["status"] == "pending"
    assert store.list_public("tpl1") == []

    approved = store.update(item["id"], CourseQAAdminUpdate(status="approved", is_public=True))
    assert approved is not None
    assert approved["status"] == "approved"
    assert approved["is_public"] is True

    public_items = store.list_public("tpl1")
    assert len(public_items) == 1
    assert "email" not in public_items[0]


def test_course_qa_reply_marks_replied_and_public(tmp_path):
    store = CourseQAStore(db_path=str(tmp_path / "qa.sqlite3"))
    item = store.add_question(
        "tpl1",
        CourseQAQuestionCreate(nickname="小红", content="上传失败时应该先检查什么地方？"),
        client_ip="127.0.0.1",
        user_agent="pytest",
    )

    replied = store.update(item["id"], CourseQAAdminUpdate(status="replied", admin_reply="先检查串口和开发板型号。"))

    assert replied is not None
    assert replied["status"] == "replied"
    assert replied["is_public"] is True
    assert replied["admin_reply"] == "先检查串口和开发板型号。"
    assert replied["replied_at"]
    assert store.list_public("tpl1")[0]["admin_reply"] == "先检查串口和开发板型号。"


def test_course_qa_hidden_not_public(tmp_path):
    store = CourseQAStore(db_path=str(tmp_path / "qa.sqlite3"))
    item = store.add_question(
        "tpl1",
        CourseQAQuestionCreate(nickname="游客", content="这是一条需要隐藏的测试留言。"),
        client_ip="127.0.0.1",
        user_agent="pytest",
    )
    store.update(item["id"], CourseQAAdminUpdate(status="approved", is_public=True))
    store.update(item["id"], CourseQAAdminUpdate(status="hidden"))

    assert store.list_public("tpl1") == []
