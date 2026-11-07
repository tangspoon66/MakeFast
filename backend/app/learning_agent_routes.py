"""Course/project-bound learning Agent conversations."""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from .ai_service import get_ai_service
from .learner_auth_routes import require_csrf, require_learner_request
from .learning_agent_store import agent_store
from .learning_course_store import course_store
from .learning_project_store import ProjectRevisionConflict, project_store

router = APIRouter(tags=["learning-agent"])


class ConversationCreate(BaseModel):
    title: str = Field(default="新对话", max_length=100)


class ConversationRename(BaseModel):
    title: str = Field(min_length=1, max_length=100)


class AgentAsk(BaseModel):
    question: str = Field(min_length=1, max_length=4000)
    current_step_id: Optional[str] = Field(default=None, max_length=120)


class ProposalCreate(BaseModel):
    question: str = Field(min_length=3, max_length=2000)
    conversation_id: Optional[str] = Field(default=None, max_length=120)
    current_step_id: Optional[str] = Field(default=None, max_length=120)


def _parse_proposal(raw: str) -> dict:
    import json

    text = raw.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[-1].rsplit("```", 1)[0].strip()
    value = json.loads(text)
    if not isinstance(value, dict):
        raise ValueError("proposal must be an object")
    code = value.get("code")
    summary = value.get("summary")
    if not isinstance(code, str) or not code.strip() or len(code) > 100_000:
        raise ValueError("proposal code is invalid")
    if not isinstance(summary, str) or not summary.strip() or len(summary) > 500:
        raise ValueError("proposal summary is invalid")
    dependencies = value.get("dependencies", [])
    assumptions = value.get("hardware_assumptions", [])
    if not isinstance(dependencies, list) or not all(isinstance(item, str) for item in dependencies):
        raise ValueError("proposal dependencies are invalid")
    if not isinstance(assumptions, list) or not all(isinstance(item, str) for item in assumptions):
        raise ValueError("proposal assumptions are invalid")
    return {
        "proposed_code": code,
        "summary": summary.strip(),
        "dependencies": dependencies[:20],
        "hardware_assumptions": assumptions[:20],
    }


def _not_found() -> HTTPException:
    return HTTPException(status_code=404, detail={"code": "conversation_not_found", "message": "对话不存在或不属于这个项目。"})


@router.get("/api/learning/projects/{project_id}/agent/conversations")
def list_conversations(project_id: str, session: tuple[dict, str] = Depends(require_learner_request)):
    if project_store.get(session[0]["id"], project_id) is None:
        raise _not_found()
    return {"items": agent_store.list(session[0]["id"], project_id)}


@router.post("/api/learning/projects/{project_id}/agent/conversations", status_code=201)
def create_conversation(project_id: str, payload: ConversationCreate, session: tuple[dict, str] = Depends(require_csrf)):
    project = project_store.get(session[0]["id"], project_id)
    if project is None:
        raise _not_found()
    if not project.get("course_slug") or not project.get("course_version"):
        raise HTTPException(status_code=409, detail={"code": "course_not_bound", "message": "Agent 对话需要绑定已发布课程的项目。"})
    conversation = agent_store.create(session[0]["id"], project_id, payload.title)
    if conversation is None:
        raise HTTPException(status_code=409, detail={"code": "course_not_bound", "message": "Agent 对话需要绑定已发布课程的项目。"})
    return conversation


@router.get("/api/learning/projects/{project_id}/agent/conversations/{conversation_id}")
def get_conversation(project_id: str, conversation_id: str, session: tuple[dict, str] = Depends(require_learner_request)):
    conversation = agent_store.get(session[0]["id"], project_id, conversation_id)
    if conversation is None:
        raise _not_found()
    return conversation


@router.patch("/api/learning/projects/{project_id}/agent/conversations/{conversation_id}")
def rename_conversation(project_id: str, conversation_id: str, payload: ConversationRename, session: tuple[dict, str] = Depends(require_csrf)):
    conversation = agent_store.rename(session[0]["id"], project_id, conversation_id, payload.title)
    if conversation is None:
        raise _not_found()
    return conversation


@router.delete("/api/learning/projects/{project_id}/agent/conversations/{conversation_id}", status_code=204)
def archive_conversation(project_id: str, conversation_id: str, session: tuple[dict, str] = Depends(require_csrf)):
    if not agent_store.archive(session[0]["id"], project_id, conversation_id):
        raise _not_found()


@router.post("/api/learning/projects/{project_id}/agent/conversations/{conversation_id}/ask")
async def ask_agent(project_id: str, conversation_id: str, payload: AgentAsk, session: tuple[dict, str] = Depends(require_csrf)):
    user_id = session[0]["id"]
    conversation = agent_store.get(user_id, project_id, conversation_id)
    if conversation is None:
        raise _not_found()
    project = project_store.get(user_id, project_id)
    published = course_store.get_published(conversation["course_slug"], conversation["course_version"])
    if project is None or not published or project["course_slug"] != conversation["course_slug"] or project["course_version"] != conversation["course_version"]:
        raise _not_found()

    steps = published["content"].get("steps", [])
    step = next((item for item in steps if item.get("id") == payload.current_step_id), None)
    messages = [{"role": item["role"], "content": item["content"]} for item in conversation["messages"][-20:]]
    messages.append({"role": "user", "content": payload.question.strip()})
    prompt = [
        {"role": "system", "content": (
            "你是 MakeFast 的儿童友好硬件课程 Agent。用简明、鼓励但不夸大的中文回答。"
            "只根据当前课程和步骤回答；不知道就明确说不知道。不要要求家庭信息，不执行代码、工具、编译或烧录。"
            "默认不接收用户源代码、串口日志或完整项目文件。"
        )},
        {"role": "system", "content": f"课程：{published['content'].get('title', conversation['course_slug'])}；版本：{conversation['course_version']}；当前步骤：{step.get('title', '未指定') if step else '未指定'}。步骤说明：{step.get('body', '') if step else ''}"},
        *messages,
    ]
    try:
        result = await get_ai_service()._call_ai_api(prompt)
        answer = str(result.get("message", "")).strip()
        if not answer:
            raise ValueError("AI 返回了空内容")
    except Exception as error:
        raise HTTPException(status_code=503, detail={"code": "agent_unavailable", "message": "Agent 暂时无法回答，请稍后重试；你的问题没有丢失。"}) from error

    updated = agent_store.add_exchange(user_id, project_id, conversation_id, payload.question.strip(), answer)
    if updated is None:
        raise _not_found()
    return {"conversation": updated, "answer": answer}


@router.post("/api/learning/projects/{project_id}/agent/proposals", status_code=201)
async def create_proposal(project_id: str, payload: ProposalCreate, session: tuple[dict, str] = Depends(require_csrf)):
    user_id = session[0]["id"]
    project = project_store.get(user_id, project_id)
    if project is None:
        raise HTTPException(status_code=404, detail={"code": "project_not_found", "message": "项目不存在。"})
    if not project.get("course_slug") or not project.get("course_version"):
        raise HTTPException(status_code=409, detail={"code": "course_not_bound", "message": "Agent 提案需要绑定课程的项目。"})
    course = course_store.get_published(project["course_slug"], project["course_version"])
    if not course:
        raise HTTPException(status_code=409, detail={"code": "course_unavailable", "message": "课程版本暂时不可用。"})
    conversation = None
    if payload.conversation_id:
        conversation = agent_store.get(user_id, project_id, payload.conversation_id)
        if conversation is None:
            raise _not_found()
    code = str((project.get("project_state") or {}).get("code") or "")
    if not code.strip():
        raise HTTPException(status_code=409, detail={"code": "empty_source", "message": "先保存一份代码，Agent 才能为它提出修改方案。"})
    steps = course["content"].get("steps", [])
    step = next((item for item in steps if item.get("id") == payload.current_step_id), None)
    messages = conversation.get("messages", [])[-8:] if conversation else []
    prompt = [
        {"role": "system", "content": (
            "你是 MakeFast 儿童友好硬件课程 Agent。为当前 Arduino/ESP32 项目提出代码修改方案。"
            "只返回 JSON 对象，不要 Markdown，结构为 {summary:string, code:string, dependencies:string[], hardware_assumptions:string[]}。"
            "保留不相关的原程序。不要声称代码已编译或硬件已验证；不要改 GPIO，除非课程明确给出已核验引脚。"
            "硬件假设要明确列出；不需要的依赖和假设使用空数组。"
        )},
        {"role": "system", "content": f"课程：{course['content'].get('title', project['course_slug'])}；当前步骤：{step.get('title', '未指定') if step else '未指定'}；步骤说明：{step.get('body', '') if step else ''}"},
        *[{"role": item["role"], "content": item["content"]} for item in messages[-8:]],
        {"role": "user", "content": f"用户希望：{payload.question.strip()}\n\n当前完整代码：\n```cpp\n{code}\n```"},
    ]
    try:
        response = await get_ai_service()._call_ai_api(prompt)
        proposal = _parse_proposal(str(response.get("message", "")))
    except Exception as error:
        raise HTTPException(status_code=503, detail={"code": "proposal_unavailable", "message": "暂时没有生成可靠的修改方案；项目没有被改动。"}) from error
    proposal["source_mode"] = "code"
    proposal["proposed_blocks_xml"] = None
    proposal["roundtrip_status"] = "code_only"
    proposal["conversation_id"] = payload.conversation_id
    proposal = agent_store.create_proposal(user_id, project_id, proposal)
    if proposal is None:
        raise _not_found()
    return {"proposal": proposal, "current_code": code}


@router.get("/api/learning/projects/{project_id}/agent/proposals/{proposal_id}")
def get_proposal(project_id: str, proposal_id: str, session: tuple[dict, str] = Depends(require_learner_request)):
    proposal = agent_store.get_proposal(session[0]["id"], project_id, proposal_id)
    if proposal is None:
        raise _not_found()
    return proposal


@router.post("/api/learning/projects/{project_id}/agent/proposals/{proposal_id}/apply")
def apply_proposal(project_id: str, proposal_id: str, session: tuple[dict, str] = Depends(require_csrf)):
    user_id = session[0]["id"]
    proposal = agent_store.get_proposal(user_id, project_id, proposal_id)
    project = project_store.get(user_id, project_id)
    if not proposal or not project:
        raise _not_found()
    if proposal["status"] != "preview":
        raise HTTPException(status_code=409, detail={"code": "proposal_not_pending", "message": "这个提案已经处理过。"})
    if project["revision"] != proposal["base_revision"]:
        raise HTTPException(status_code=409, detail={"code": "proposal_stale", "message": "项目已变化，请重新生成提案后再应用。"})
    state = dict(project.get("project_state") or {})
    state["code"] = proposal["proposed_code"]
    values = {
        "title": project["title"], "learning_mode": project["learning_mode"],
        "editor_source": "code", "board_id": project.get("board_id"),
        "project_state": state, "current_step_id": project.get("current_step_id"),
        "completed_step_ids": project.get("completed_step_ids", []),
    }
    try:
        updated = project_store.save(user_id, project_id, proposal["base_revision"], values)
    except ProjectRevisionConflict as error:
        raise HTTPException(status_code=409, detail={"code": "proposal_stale", "message": "项目已变化，请重新生成提案后再应用。"}) from error
    applied = agent_store.mark_applied(user_id, project_id, proposal_id, updated["revision"])
    if applied is None:
        raise HTTPException(status_code=409, detail={"code": "proposal_not_pending", "message": "这个提案已经处理过。"})
    return {"proposal": applied, "project": updated}


@router.post("/api/learning/projects/{project_id}/agent/proposals/{proposal_id}/undo")
def undo_proposal(project_id: str, proposal_id: str, session: tuple[dict, str] = Depends(require_csrf)):
    user_id = session[0]["id"]
    proposal = agent_store.get_proposal(user_id, project_id, proposal_id)
    project = project_store.get(user_id, project_id)
    if not proposal or not project:
        raise _not_found()
    if proposal["status"] != "applied":
        raise HTTPException(status_code=409, detail={"code": "proposal_not_applied", "message": "这个提案当前不能撤销。"})
    if project["revision"] != proposal["applied_revision"]:
        raise HTTPException(status_code=409, detail={"code": "proposal_undo_stale", "message": "应用后项目又有新修改，为避免覆盖，请不要自动撤销。"})
    previous = agent_store.get_proposal_snapshot(user_id, project_id, proposal_id)
    if not previous:
        raise HTTPException(status_code=409, detail={"code": "proposal_snapshot_missing", "message": "撤销记录不可用，请保留当前代码并手动恢复。"})
    values = {
        "title": project["title"], "learning_mode": project["learning_mode"],
        "editor_source": previous["editor_source"], "board_id": previous["board_id"],
        "project_state": previous["project_state"], "current_step_id": project.get("current_step_id"),
        "completed_step_ids": project.get("completed_step_ids", []),
    }
    try:
        updated = project_store.save(user_id, project_id, project["revision"], values)
    except ProjectRevisionConflict as error:
        raise HTTPException(status_code=409, detail={"code": "proposal_undo_stale", "message": "项目已变化，请刷新后手动恢复。"}) from error
    undone = agent_store.mark_undone(user_id, project_id, proposal_id)
    return {"proposal": undone, "project": updated}
