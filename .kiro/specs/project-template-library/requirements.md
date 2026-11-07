# Requirements Document

## Introduction

项目模板库（Project Template Library）为 ESP 在线烧录平台提供可复用的代码模板管理功能。管理员可以创建、上传和管理项目模板，用户可以浏览模板库并将模板加载到现有编辑器中，复用已有的编译和烧录流程。模板存储源代码文件（.ino/.cpp/.h），支持 ZIP 上传和在线编辑器创建两种方式。

## Glossary

- **Template_Manager**: 后端模板管理服务，负责模板的 CRUD 操作、文件存储和元数据管理
- **Template_Library_Page**: 前端模板库浏览页面，展示模板列表并支持筛选和搜索
- **Editor_Page**: 现有的首页编辑器页面（HomePage），包含 EditorTabs 组件用于代码编辑
- **Admin_Template_Page**: 管理员模板管理页面，提供模板的创建、编辑和删除功能
- **Template_Metadata**: 模板元数据，包含名称、描述、分类、标签和支持的开发板列表
- **Source_File**: 模板中的源代码文件，格式为 .ino、.cpp 或 .h
- **Template_ID**: 模板的唯一标识符，由系统自动生成

## Requirements

### Requirement 1: 模板元数据管理

**User Story:** As an administrator, I want to define template metadata including name, description, category, tags, and supported boards, so that users can easily discover and filter templates.

#### Acceptance Criteria

1. THE Template_Manager SHALL store the following metadata fields for each template: name (3-100 characters), description (10-2000 characters), category (free-text string, 2-50 characters), tags (list of up to 10 free-text strings), and supported_board_ids (list of valid board identifiers).
2. THE Template_Manager SHALL generate a unique Template_ID for each template upon creation.
3. WHEN a template is created, THE Template_Manager SHALL record the creation timestamp.
4. WHEN a template is updated, THE Template_Manager SHALL record the update timestamp.
5. THE Template_Manager SHALL validate that supported_board_ids contains only board identifiers defined in the system board configuration.
6. THE Template_Manager SHALL validate that the template name is between 3 and 100 characters in length.
7. THE Template_Manager SHALL validate that the template description is between 10 and 2000 characters in length.

### Requirement 2: 模板源代码文件存储

**User Story:** As an administrator, I want to store source code files (.ino/.cpp/.h) within a template, so that users can load complete project code into the editor.

#### Acceptance Criteria

1. THE Template_Manager SHALL store one or more Source_File entries per template.
2. THE Template_Manager SHALL accept source files with extensions .ino, .cpp, .h, and .c.
3. THE Template_Manager SHALL enforce a maximum file size of 50KB per individual Source_File.
4. THE Template_Manager SHALL enforce a maximum of 20 Source_File entries per template.
5. THE Template_Manager SHALL validate that each Source_File has a non-empty file name and non-empty content.
6. THE Template_Manager SHALL store Source_File content as plain text with UTF-8 encoding.

### Requirement 3: ZIP 上传创建模板

**User Story:** As an administrator, I want to upload a ZIP file containing source code to create a template, so that I can batch-import existing projects as templates.

#### Acceptance Criteria

1. WHEN a ZIP file is uploaded, THE Template_Manager SHALL extract all files with extensions .ino, .cpp, .h, and .c from the archive.
2. WHEN a ZIP file is uploaded, THE Template_Manager SHALL reject the upload if the ZIP contains no valid source files.
3. WHEN a ZIP file is uploaded, THE Template_Manager SHALL reject the upload if the total uncompressed size exceeds 1MB.
4. WHEN a ZIP file is uploaded, THE Template_Manager SHALL reject the upload if the ZIP file format is invalid.
5. WHEN a ZIP file is uploaded, THE Template_Manager SHALL ignore non-source files (files without .ino, .cpp, .h, or .c extensions) in the archive.
6. WHEN a ZIP file is uploaded, THE Template_Manager SHALL flatten nested directory structures and use only the file basename for storage.

### Requirement 4: 在线编辑器创建模板

**User Story:** As an administrator, I want to create a template by writing code directly in the admin interface, so that I can quickly create simple templates without preparing a ZIP file.

#### Acceptance Criteria

1. THE Admin_Template_Page SHALL provide a code editor interface for creating and editing Source_File content.
2. THE Admin_Template_Page SHALL allow the administrator to add, rename, and remove Source_File entries within a template.
3. WHEN the administrator saves a template created via the editor, THE Template_Manager SHALL validate and store all Source_File entries.
4. THE Admin_Template_Page SHALL provide a preview of the template metadata before saving.

### Requirement 5: 模板浏览与筛选

**User Story:** As a user, I want to browse and filter templates by category, tags, and supported boards, so that I can find relevant templates for my project.

#### Acceptance Criteria

1. THE Template_Library_Page SHALL display a paginated list of published templates with name, description, category, tags, and supported boards.
2. WHEN a category filter is selected, THE Template_Library_Page SHALL display only templates matching the selected category.
3. WHEN a tag filter is selected, THE Template_Library_Page SHALL display only templates containing the selected tag.
4. WHEN a board filter is selected, THE Template_Library_Page SHALL display only templates that support the selected board.
5. WHEN a search keyword is entered, THE Template_Library_Page SHALL display templates whose name or description contains the keyword (case-insensitive).
6. THE Template_Library_Page SHALL display the total count of templates matching the current filter criteria.
7. THE Template_Manager SHALL return only published templates to unauthenticated users.

### Requirement 6: 模板加载到编辑器

**User Story:** As a user, I want to load a template into the existing editor, so that I can use the template code as a starting point and compile/flash it directly.

#### Acceptance Criteria

1. WHEN a user selects a template to use, THE Template_Library_Page SHALL navigate to the Editor_Page.
2. WHEN a template is loaded, THE Editor_Page SHALL populate the EditorTabs component with all Source_File entries from the selected template.
3. WHEN a template is loaded, THE Editor_Page SHALL set the first .ino file as the active tab.
4. IF the Editor_Page already contains unsaved code, THEN THE Template_Library_Page SHALL display a confirmation dialog before loading the template.
5. WHEN a template is loaded, THE Editor_Page SHALL retain the user's board selection from the template's supported_board_ids or default to the first supported board.

### Requirement 7: 管理员模板 CRUD 操作

**User Story:** As an administrator, I want to create, read, update, and delete templates, so that I can maintain the template library content.

#### Acceptance Criteria

1. THE Admin_Template_Page SHALL require valid administrator JWT authentication for all operations.
2. WHEN an administrator creates a template, THE Template_Manager SHALL validate all metadata and source files before storing.
3. WHEN an administrator updates a template, THE Template_Manager SHALL preserve the Template_ID and creation timestamp.
4. WHEN an administrator deletes a template, THE Template_Manager SHALL remove all associated source files and metadata from storage.
5. THE Admin_Template_Page SHALL display a list of all templates (published and unpublished) with edit and delete actions.
6. THE Admin_Template_Page SHALL allow the administrator to toggle the published status of a template.

### Requirement 8: 模板发布状态管理

**User Story:** As an administrator, I want to control template visibility through a publish/unpublish mechanism, so that I can prepare templates before making them available to users.

#### Acceptance Criteria

1. THE Template_Manager SHALL store a published status (boolean) for each template, defaulting to unpublished.
2. WHEN a template is unpublished, THE Template_Manager SHALL exclude the template from public listing API responses.
3. WHEN a template is published, THE Template_Manager SHALL include the template in public listing API responses.
4. THE Admin_Template_Page SHALL display the current published status of each template.

### Requirement 9: 模板 API 端点

**User Story:** As a developer, I want well-defined REST API endpoints for template operations, so that the frontend can interact with the template system reliably.

#### Acceptance Criteria

1. THE Template_Manager SHALL expose a GET endpoint for listing published templates with optional query parameters for category, tags, board_id, search, page, and page_size.
2. THE Template_Manager SHALL expose a GET endpoint for retrieving a single template's full details including all source files by Template_ID.
3. THE Template_Manager SHALL expose POST, PUT, and DELETE endpoints for template CRUD operations, protected by administrator authentication.
4. THE Template_Manager SHALL expose a POST endpoint for ZIP file upload that creates a template from the uploaded archive.
5. WHEN an API request contains invalid parameters, THE Template_Manager SHALL return a structured error response with an appropriate HTTP status code and error message.
6. THE Template_Manager SHALL return paginated responses with page number, page size, total count, and total pages metadata.
