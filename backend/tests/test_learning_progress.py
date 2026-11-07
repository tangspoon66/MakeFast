import json
import sqlite3
from pathlib import Path

from fastapi.testclient import TestClient

import app.learner_auth_routes as auth_routes
import app.learning_progress_routes as progress_routes
import app.learning_project_routes as project_routes
import app.learning_progress_store as progress_store_module
from app.learner_identity import LearnerIdentityStore
from app.learning_progress_store import LearningProgressStore
from app.learning_project_store import LearnerProjectStore
from app.main import app


def test_progress_events_are_idempotent_and_repeat_practice_decays(tmp_path: Path):
    database = tmp_path / 'learning.sqlite3'
    identity = LearnerIdentityStore(database)
    learner, _, _ = identity.create_user('progress_user', 'password123', None, [])
    store = LearningProgressStore(database)
    first = store.record(learner['id'], 'compile_succeeded', 'project-1:compile:first', 'project-1')
    duplicate = store.record(learner['id'], 'compile_succeeded', 'project-1:compile:first', 'project-1')
    repeat = store.record(learner['id'], 'compile_succeeded', 'project-1:compile:repeat', 'project-1')
    assert first['recorded'] is True
    assert first['points_awarded'] == 50
    assert duplicate['recorded'] is False
    assert duplicate['points_awarded'] == 0
    assert repeat['recorded'] is True
    assert 0 < repeat['points_awarded'] < first['points_awarded']
    flash = store.record(learner['id'], 'flash_succeeded', 'project-1:flash:first', 'project-1')
    assert flash['points_awarded'] == 80

    summary = store.summary(learner['id'])
    assert summary['points_total'] == first['points_awarded'] + repeat['points_awarded'] + flash['points_awarded']
    assert summary['badges'] == [{'key': 'first-build', 'name': '第一次做出作品'}]


def test_progress_rejects_unknown_events(tmp_path: Path):
    database = tmp_path / 'learning.sqlite3'
    identity = LearnerIdentityStore(database)
    learner, _, _ = identity.create_user('invalid_progress', 'password123', None, [])
    store = LearningProgressStore(database)
    try:
        store.record(learner['id'], 'made_up', 'event')
    except ValueError as error:
        assert '未知学习事件' in str(error)
    else:
        raise AssertionError('未知学习事件必须拒绝')


def test_progress_api_requires_login_and_csrf(tmp_path: Path, monkeypatch):
    database = tmp_path / 'learning.sqlite3'
    identity = LearnerIdentityStore(database)
    progress = LearningProgressStore(database)
    monkeypatch.setattr(auth_routes, 'identity_store', identity)
    monkeypatch.setattr(progress_routes, 'progress_store', progress)
    monkeypatch.setattr(progress_store_module, 'progress_store', progress)
    monkeypatch.setattr(project_routes, 'project_store', LearnerProjectStore(database))
    monkeypatch.setattr(progress_routes, 'project_store', LearnerProjectStore(database))

    client = TestClient(app)
    payload = {'event_type': 'materials_confirmed', 'event_key': 'project-1:materials:first', 'project_id': 'project-1'}
    assert client.get('/api/learning/progress').status_code == 401
    assert client.post('/api/learning/progress/events', json=payload).status_code == 401

    registration = client.post('/api/auth/register', json={'username': 'progress_api', 'password': 'password123'})
    csrf = registration.json()['csrf_token']
    assert client.post('/api/learning/progress/events', json=payload).status_code == 403

    missing_project = client.post('/api/learning/progress/events', json=payload, headers={'X-CSRF-Token': csrf})
    assert missing_project.status_code == 404
    assert missing_project.json()['detail'] == '项目不存在或没有绑定课程'

    connection = sqlite3.connect(database)
    connection.execute("""CREATE TABLE learning_courses (
        slug TEXT PRIMARY KEY, draft_json TEXT NOT NULL, draft_revision INTEGER NOT NULL DEFAULT 1,
        published_version INTEGER, published_draft_revision INTEGER, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    )""")
    connection.execute("""CREATE TABLE learning_course_versions (
        slug TEXT NOT NULL, version INTEGER NOT NULL, content_json TEXT NOT NULL, published_at TEXT NOT NULL,
        PRIMARY KEY(slug, version)
    )""")
    course = {'slug': 'temperature-alert', 'title': '温湿度提醒器', 'steps': [{'id': 'materials', 'type': 'materials', 'material_ids': ['board', 'sensor']}]}
    connection.execute("INSERT INTO learning_courses VALUES (?, ?, 1, 1, 1, 'now', 'now')", (course['slug'], json.dumps(course)))
    connection.execute("INSERT INTO learning_course_versions VALUES (?, 1, ?, 'now')", (course['slug'], json.dumps(course)))
    connection.commit()
    connection.close()
    project = client.post('/api/learning/projects', json={'title': '课程项目', 'course_slug': 'temperature-alert'}, headers={'X-CSRF-Token': csrf}).json()
    project['project_state'] = {'materialsConfirmed': ['board', 'sensor']}
    monkeypatch.setattr(progress_routes, 'project_store', type('ProjectReader', (), {
        'get': lambda self, user_id, project_id: project if project_id == project['project_id'] else None,
        'project_progress_event': lambda self, user_id, project_id, event_type, step_id=None: {'project_id': project_id, 'step_id': step_id},
    })())
    monkeypatch.setattr(progress_routes.course_store, 'get_published', lambda slug, version: {'slug': slug, 'version': version, 'content': course})
    payload.update({'project_id': project['project_id'], 'event_key': f"{project['project_id']}:materials:first"})
    first = client.post('/api/learning/progress/events', json=payload, headers={'X-CSRF-Token': csrf})
    duplicate = client.post('/api/learning/progress/events', json=payload, headers={'X-CSRF-Token': csrf})
    assert first.status_code == 200
    assert first.json()['points_awarded'] == 20
    assert duplicate.json()['recorded'] is False
    assert client.get('/api/learning/progress').json()['points_total'] == 20


def test_dashboard_projects_progress_projection_includes_badges(tmp_path: Path, monkeypatch):
    database = tmp_path / 'learning.sqlite3'
    identity = LearnerIdentityStore(database)
    progress = LearningProgressStore(database)
    monkeypatch.setattr(auth_routes, 'identity_store', identity)
    monkeypatch.setattr(progress_routes, 'progress_store', progress)
    monkeypatch.setattr(progress_store_module, 'progress_store', progress)
    monkeypatch.setattr(project_routes, 'project_store', LearnerProjectStore(database))

    client = TestClient(app)
    session = client.post('/api/auth/register', json={'username': 'dashboard_progress', 'password': 'password123'}).json()
    learner_id = session['learner']['id']
    progress.record(learner_id, 'compile_succeeded', 'project-1:compile', 'project-1')
    progress.record(learner_id, 'flash_succeeded', 'project-1:flash', 'project-1')

    dashboard = client.get('/api/users/me/dashboard')
    assert dashboard.status_code == 200
    assert dashboard.json()['points_total'] == 130
    assert dashboard.json()['badges'] == [{'key': 'first-build', 'name': '第一次做出作品'}]
