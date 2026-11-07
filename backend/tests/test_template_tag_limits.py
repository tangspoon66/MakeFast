from app.template_manager import TemplateManager
from app.template_models import TemplateCreateRequest, TemplateSourceFile


def test_template_accepts_nine_tags_separate_from_category(tmp_path):
    manager = TemplateManager(storage_path=str(tmp_path))
    tags = [f"tag{i}" for i in range(1, 10)]

    metadata = manager.create_template(
        TemplateCreateRequest(
            name="Nine Tags Demo",
            description="A course with nine supplemental tags",
            category="物联网",
            tags=tags,
            supported_board_ids=["esp32"],
            published=False,
            files=[
                TemplateSourceFile(
                    name="sketch.ino",
                    content="void setup() {}\nvoid loop() {}",
                )
            ],
        )
    )

    assert metadata.category == "物联网"
    assert metadata.tags == tags
