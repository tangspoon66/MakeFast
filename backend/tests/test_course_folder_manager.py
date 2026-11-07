from app.course_folder_manager import CourseFolderManager
from app.course_folder_models import CourseFolderCreateRequest, CourseFolderUpdateRequest


def test_course_folder_create_pin_publish_and_reorder(tmp_path):
    manager = CourseFolderManager(data_path=str(tmp_path / "folders.json"))

    first = manager.create_folder(
        CourseFolderCreateRequest(
            name="入门合集",
            category="入门",
            template_ids=["tpl_a", "tpl_b"],
            published=True,
        )
    )
    second = manager.create_folder(
        CourseFolderCreateRequest(
            name="置顶合集",
            category="进阶",
            pinned=True,
            published=True,
            template_ids=["tpl_c"],
        )
    )

    public_folders = manager.list_folders(published_only=True)
    assert [folder.folder_id for folder in public_folders] == [second.folder_id, first.folder_id]

    updated = manager.update_folder(
        first.folder_id,
        CourseFolderUpdateRequest(template_ids=["tpl_b", "tpl_a"], pinned=True),
    )
    assert updated is not None
    assert [item.template_id for item in updated.items] == ["tpl_b", "tpl_a"]

    reordered = manager.reorder_folders([first.folder_id, second.folder_id])
    assert reordered[0].folder_id == first.folder_id

    assert manager.delete_folder(second.folder_id) is True
    assert [folder.folder_id for folder in manager.list_folders()] == [first.folder_id]
