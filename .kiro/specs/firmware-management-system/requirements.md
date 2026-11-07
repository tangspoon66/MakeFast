# 需求文档 - 固件管理和分发系统

## 简介

固件管理和分发系统是 ESP 在线开发平台的扩展功能，允许管理员上传和管理预编译的 ESP32 项目固件，用户可以浏览、选择并直接烧录这些固件到开发板，无需编译过程。该系统包含管理员界面和用户固件选择界面两个主要部分。

## 术语表

- **System**: 固件管理和分发系统
- **Admin_Interface**: 管理员界面，用于上传和管理固件
- **User_Interface**: 用户固件选择界面，用于浏览和烧录固件
- **Firmware_Package**: 固件包，包含预编译的二进制文件和元数据
- **Project_Metadata**: 项目元数据，包含项目名称、描述、版本、支持的开发板等信息
- **Firmware_Storage**: 固件存储系统，用于存储固件文件
- **Metadata_Store**: 元数据存储系统，用于存储项目元数据
- **Authentication_Service**: 认证服务，用于验证管理员身份
- **Upload_Service**: 上传服务，处理固件文件上传
- **Flash_Service**: 烧录服务，将固件烧录到开发板
- **API_Config_Store**: AI API 配置存储，用于管理 AI 助手的 API 配置

## 需求

### 需求 1: 管理员认证

**用户故事:** 作为系统管理员，我希望通过安全的认证机制访问管理界面，以便保护固件管理功能不被未授权访问。

#### 验收标准

1. THE Admin_Interface SHALL require authentication before granting access to firmware management features
2. WHEN an administrator provides valid credentials consisting of a username of 3 to 50 characters and a password of 8 to 128 characters, THE Authentication_Service SHALL grant access to the Admin_Interface
3. WHEN an administrator provides valid credentials, THE Authentication_Service SHALL return an authentication token
4. WHEN an administrator provides invalid credentials, THE Authentication_Service SHALL deny access and return an error message indicating authentication failure
5. IF an administrator provides invalid credentials 5 times within 15 minutes, THEN THE Authentication_Service SHALL lock the account for 30 minutes
6. WHEN an account is locked, THE Authentication_Service SHALL return an error message indicating the account is temporarily locked and the remaining lockout duration
7. THE Authentication_Service SHALL issue authentication tokens with expiration time of 24 hours
8. IF an authentication token expires, THEN THE System SHALL reject subsequent requests and return an error message indicating the token has expired
9. WHEN a request is rejected due to token expiration, THE System SHALL require the administrator to re-authenticate
10. THE System SHALL store administrator credentials securely using cryptographic hashing with salt

### 需求 2: 固件包上传

**用户故事:** 作为管理员，我希望上传预编译的固件包，以便用户可以直接使用这些固件。

#### 验收标准

1. WHEN an administrator uploads a Firmware_Package, THE Upload_Service SHALL validate that the package is a ZIP archive containing exactly four files: bootloader.bin, partitions.bin, boot_app0.bin, and app.bin
2. WHEN an administrator uploads a valid Firmware_Package, THE Upload_Service SHALL accept the package and return a success response
3. WHEN a firmware package is missing one or more required files, THE Upload_Service SHALL reject the upload and return an error message indicating which required files are missing
4. WHEN an administrator uploads a Firmware_Package, THE Upload_Service SHALL validate that each binary file size is less than 10 MB
5. IF any binary file in the Firmware_Package exceeds 10 MB, THEN THE Upload_Service SHALL reject the upload and return an error message indicating which files exceed the size limit and their actual sizes
6. WHEN a firmware package upload is successful, THE System SHALL generate a unique firmware_id
7. WHEN a firmware package passes validation, THE System SHALL store all four firmware binary files in the Firmware_Storage
8. WHEN firmware files are stored, THE System SHALL preserve the original file names
9. WHEN firmware files are stored, THE System SHALL verify binary integrity by comparing the stored file size with the uploaded file size for each file
10. IF the upload process fails due to storage error or network interruption, THEN THE System SHALL remove any partially stored files and return an error message indicating the failure reason

### 需求 3: 项目元数据管理

**用户故事:** 作为管理员，我希望为每个固件包添加和编辑元数据，以便用户了解项目的详细信息。

#### 验收标准

1. WHEN an administrator uploads a Firmware_Package, THE System SHALL require Project_Metadata input containing project name, description, version, and supported board IDs
2. THE System SHALL validate that project name is between 3 and 100 characters
3. THE System SHALL validate that description is between 10 and 2000 characters
4. THE System SHALL validate that version follows semantic versioning format matching the pattern major.minor.patch where each component is a non-negative integer
5. IF version validation fails, THEN THE System SHALL reject the metadata and return an error message indicating invalid version format
6. THE System SHALL validate that supported board IDs is a non-empty array containing at least one board ID
7. THE System SHALL validate that each board ID in supported board IDs exists in the system board configuration database
8. IF any board ID does not exist in the system board configuration, THEN THE System SHALL reject the metadata and return an error message indicating which board IDs are invalid
9. WHEN Project_Metadata passes all validation rules, THE Metadata_Store SHALL persist the metadata with an automatically generated creation timestamp in ISO 8601 format
10. WHEN an administrator updates Project_Metadata, THE System SHALL preserve the firmware_id and allow updates only to project name, description, version, supported board IDs, and tags fields
11. WHEN an administrator updates Project_Metadata, THE System SHALL create a metadata history entry containing the previous metadata values and an update timestamp in ISO 8601 format
12. THE System SHALL retain metadata history entries for at least 90 days

### 需求 4: 固件存储管理

**用户故事:** 作为系统架构师，我希望固件文件存储在本地文件系统中，以便简化部署和提高访问性能。

#### 验收标准

1. THE Firmware_Storage SHALL store firmware files in a directory structure where each firmware_id corresponds to a subdirectory under the base firmware storage path configured in the system settings
2. WHEN a firmware package upload is initiated, THE System SHALL create a subdirectory named with the firmware_id under the base firmware storage path
3. WHEN storing firmware files, THE System SHALL preserve the original file names within the firmware_id subdirectory and reject files with names exceeding 255 characters
4. THE Firmware_Storage SHALL support at least 10 concurrent read operations on firmware files
5. WHEN a firmware package is deleted, THE System SHALL remove the entire firmware_id subdirectory and all contained files
6. WHEN an administrator initiates a firmware package upload, THE System SHALL validate that the firmware storage path has at least 1 GB of free disk space
7. IF disk space is below 1 GB, THEN THE System SHALL reject the upload request and return an error message indicating insufficient storage capacity
8. IF a firmware_id subdirectory already exists when creating a new firmware package, THEN THE System SHALL generate a new unique firmware_id and return an error message indicating a duplicate firmware_id was detected
9. IF the base firmware storage path does not exist or is not accessible, THEN THE System SHALL return an error message indicating the storage path is unavailable and log the error
10. IF any firmware binary file exceeds 500 MB, THEN THE System SHALL reject the upload and return an error message indicating the file size limit exceeded

### 需求 5: 元数据存储管理

**用户故事:** 作为系统架构师，我希望项目元数据存储在 JSON 文件中，以便简化配置和支持版本控制。

#### 验收标准

1. THE Metadata_Store SHALL persist Project_Metadata in a JSON file named metadata.json containing the fields: firmware_id, project_name, description, version, supported_board_ids, tags, published, created_at, and updated_at
2. THE metadata.json file SHALL be stored in the firmware_id subdirectory alongside the firmware binary files
3. WHEN writing Project_Metadata, THE Metadata_Store SHALL validate that the JSON contains all required fields: firmware_id, project_name, version, supported_board_ids, and created_at
4. IF any required field is missing from the JSON, THEN THE Metadata_Store SHALL reject the write operation and return an error message indicating which required fields are missing
5. WHEN reading metadata, THE Metadata_Store SHALL parse the metadata.json file and return structured data
6. IF the metadata.json file cannot be parsed due to invalid JSON syntax, THEN THE System SHALL log an error message indicating JSON parse failure and treat the firmware package as unavailable
7. IF the metadata.json file cannot be read due to file system errors, THEN THE System SHALL log an error message indicating file read failure and treat the firmware package as unavailable
8. WHEN updating metadata, THE System SHALL create a backup copy of metadata.json named metadata.json.bak in the same directory before writing the new metadata
9. WHEN writing metadata, THE Metadata_Store SHALL write the complete JSON content to a temporary file first, then atomically rename the temporary file to metadata.json to prevent partial writes
10. IF a write operation fails after creating the backup, THEN THE System SHALL preserve the backup file and log an error message indicating the write failure

### 需求 6: AI API 配置管理

**用户故事:** 作为管理员，我希望配置 AI 助手的 API 设置，以便控制 AI 功能的行为和成本。

#### 验收标准

1. THE Admin_Interface SHALL provide a configuration form for AI API settings containing input fields for API key, API base URL, model name, temperature, and max_tokens
2. THE API_Config_Store SHALL store API key, API base URL, model name, temperature, and max_tokens parameters
3. WHEN an administrator submits AI API configuration, THE System SHALL validate that API key is not empty when AI features are enabled
4. WHEN an administrator submits AI API configuration, THE System SHALL validate that API base URL is a valid HTTPS URL
5. IF API base URL validation fails, THEN THE System SHALL reject the configuration and display an error message indicating invalid URL format
6. WHEN an administrator submits AI API configuration, THE System SHALL validate that model name is not empty and does not exceed 200 characters
7. WHEN an administrator submits AI API configuration, THE System SHALL validate that temperature is a number between 0.0 and 2.0 inclusive
8. WHEN an administrator submits AI API configuration, THE System SHALL validate that max_tokens is an integer between 100 and 8000 inclusive
9. IF any validation fails, THEN THE System SHALL reject the configuration and display an error message indicating which field failed validation
10. WHEN an administrator updates AI API configuration with valid parameters, THE System SHALL make a test API call to the configured endpoint within 30 seconds
11. IF the test API call fails or times out, THEN THE System SHALL reject the configuration and display the error message returned by the API or a timeout message
12. WHEN the test API call succeeds, THE System SHALL encrypt the API key, store all configuration parameters in the backend .env file, and display a success confirmation message

### 需求 7: 固件包列表展示

**用户故事:** 作为用户，我希望浏览所有可用的固件包，以便选择适合我的项目。

#### 验收标准

1. THE User_Interface SHALL display a list of all available Firmware_Packages with published status set to true
2. WHEN the User_Interface loads, THE System SHALL retrieve Project_Metadata for all firmware packages from the Metadata_Store within 10 seconds
3. IF metadata retrieval fails, THEN THE User_Interface SHALL display an error message indicating that firmware packages could not be loaded
4. IF metadata retrieval returns zero firmware packages, THEN THE User_Interface SHALL display a message indicating no firmware packages are available
5. WHEN displaying firmware packages, THE User_Interface SHALL show project name, description truncated to 200 characters, version, and supported board names for each package
6. IF any required metadata field (project name, version, or supported board IDs) is missing from a firmware package, THEN THE User_Interface SHALL exclude that package from the display and log a warning
7. THE User_Interface SHALL display firmware packages in a card layout with thumbnail images
8. WHEN the User_Interface loads firmware packages, THE System SHALL sort them by creation timestamp in descending order with the most recent packages displayed first
9. WHEN a firmware package has no thumbnail image, THE User_Interface SHALL display a default placeholder image
10. THE User_Interface SHALL provide a dropdown filter for selecting a board ID
11. WHEN a user selects a board filter, THE System SHALL display only firmware packages where the selected board ID is present in the supported board IDs array
12. WHEN a board filter results in zero matching packages, THE User_Interface SHALL display a message indicating no firmware packages match the selected board

### 需求 8: 固件包详情查看

**用户故事:** 作为用户，我希望查看固件包的详细信息，以便了解项目的功能和兼容性。

#### 验收标准

1. WHEN a user clicks on a firmware package card, THE User_Interface SHALL display detailed Project_Metadata in a modal or dedicated detail view
2. THE detailed view SHALL include project name, full description, version, supported board names, individual file sizes, total size, and creation timestamp
3. THE User_Interface SHALL display a list of supported board names with their descriptions retrieved from the system board configuration
4. THE User_Interface SHALL display the total size of all firmware binary files in megabytes with two decimal places
5. THE User_Interface SHALL provide a "Flash to Device" button for initiating firmware upload
6. WHEN a firmware package supports multiple boards defined as two or more board IDs in the supported board IDs array, THE User_Interface SHALL display a board selection dropdown before enabling the "Flash to Device" button
7. WHEN a user selects a target board from the dropdown, THE User_Interface SHALL enable the "Flash to Device" button
8. WHEN a firmware package supports only one board, THE User_Interface SHALL enable the "Flash to Device" button immediately without requiring board selection
9. THE User_Interface SHALL provide a "Back" or "Close" button to return to the firmware package list view

### 需求 9: 固件烧录集成

**用户故事:** 作为用户，我希望直接烧录选定的固件到开发板，以便快速测试项目功能。

#### 验收标准

1. WHEN a user clicks the "Flash to Device" button, THE System SHALL validate that a serial port is selected
2. IF no serial port is selected, THEN THE System SHALL display an error message indicating that a serial port must be selected before flashing
3. WHEN flash is initiated, THE Flash_Service SHALL retrieve firmware binary files from the Firmware_Storage using the firmware_id
4. IF the firmware_id does not exist in Firmware_Storage, THEN THE System SHALL display an error message indicating that the firmware package is not found
5. IF any required binary file (bootloader.bin, partitions.bin, boot_app0.bin, app.bin) is missing from Firmware_Storage, THEN THE System SHALL display an error message indicating which files are missing
6. WHEN firmware files are retrieved successfully, THE Flash_Service SHALL perform chip detection to verify device compatibility
7. IF chip detection fails, THEN THE System SHALL display an error message indicating that the device was not detected and suggesting connection troubleshooting steps
8. WHEN chip detection succeeds, THE Flash_Service SHALL use the existing Web Serial API integration to upload firmware files to the device at their designated flash addresses
9. WHEN firmware upload begins, THE System SHALL suspend the serial monitor
10. WHILE firmware is uploading, THE System SHALL display upload progress with percentage and current operation status (uploading bootloader, uploading partitions, uploading boot_app0, uploading application, verifying)
11. THE System SHALL complete firmware upload or return a timeout error within 180 seconds
12. WHEN firmware upload is successful, THE System SHALL display a success notification
13. WHEN firmware upload completes or fails, THE System SHALL resume the serial monitor
14. IF firmware upload fails, THEN THE System SHALL display an error message indicating the failure reason and troubleshooting guidance (check USB connection, verify board compatibility, ensure device is in bootloader mode, retry flash operation)

### 需求 10: 管理员固件删除

**用户故事:** 作为管理员，我希望删除过时或错误的固件包，以便保持固件库的整洁和准确性。

#### 验收标准

1. THE Admin_Interface SHALL display a list of all uploaded firmware packages with delete buttons
2. WHEN an administrator clicks the delete button, THE System SHALL display a confirmation dialog containing the project name, version, and firmware_id
3. WHEN the administrator confirms deletion, THE System SHALL remove the firmware package from the Firmware_Storage by deleting the firmware_id subdirectory and all contained files
4. THE System SHALL remove the corresponding Project_Metadata from the Metadata_Store
5. WHEN deletion is successful, THE System SHALL display a success notification indicating the firmware package was deleted
6. IF deletion fails, THEN THE System SHALL log the error and display an error message indicating the deletion failure reason
7. IF a firmware package is currently being flashed defined as the period from firmware file retrieval initiation to upload completion or failure, THEN THE System SHALL prevent deletion and display an error message indicating the firmware is in use
8. THE System SHALL perform deletion operations atomically where either all files are deleted or none are deleted
9. IF deletion fails after partial file removal, THEN THE System SHALL log the error and display an error message indicating incomplete deletion

### 需求 11: 固件包版本管理

**用户故事:** 作为管理员，我希望为同一个项目上传多个版本的固件，以便用户可以选择不同的版本。

#### 验收标准

1. THE System SHALL allow multiple Firmware_Packages with the same project name but different version numbers
2. THE System SHALL validate that version numbers follow semantic versioning format major.minor.patch where each component is a non-negative integer
3. IF version format is invalid, THEN THE System SHALL reject the upload and return an error message indicating invalid version format
4. THE System SHALL validate that version string length does not exceed 20 characters
5. WHEN displaying firmware packages with the same project name, THE User_Interface SHALL group them by project name
6. THE System SHALL sort versions in descending order by comparing major version first, then minor version, then patch version
7. THE User_Interface SHALL display all versions of a project in descending version order with the highest version displayed first
8. THE System SHALL mark the version with the highest major.minor.patch value as the latest version with a "Latest" badge
9. WHEN a user selects a project, THE User_Interface SHALL default to displaying the latest version
10. WHEN an administrator uploads a new version for an existing project, THE System SHALL validate that the new version number is greater than all existing versions by comparing major, minor, and patch components
11. IF a version number already exists for a project, THEN THE System SHALL reject the upload and return an error message indicating version conflict and listing the existing version

### 需求 12: 固件包搜索

**用户故事:** 作为用户，我希望搜索固件包，以便快速找到我需要的项目。

#### 验收标准

1. THE User_Interface SHALL provide a search input field accepting up to 200 characters
2. WHEN a user enters a search query, THE System SHALL filter firmware packages by performing case-insensitive substring matching on project name and description fields
3. THE System SHALL return search results within 300 milliseconds of the user's last keystroke
4. THE User_Interface SHALL display search results in real-time as the user types
5. WHEN the search query is empty, THE System SHALL display all available firmware packages
6. THE System SHALL highlight matching text in search results by wrapping matched substrings in a distinct visual style
7. WHEN no firmware packages match the search query, THE User_Interface SHALL display a "No results found" message
8. THE System SHALL sort search results by creation timestamp in descending order with the most recent packages displayed first
9. IF the search operation fails due to backend errors, THEN THE User_Interface SHALL display an error message indicating search is temporarily unavailable

### 需求 13: 固件包缩略图管理

**用户故事:** 作为管理员，我希望为固件包上传缩略图，以便用户可以直观地识别项目。

#### 验收标准

1. THE Admin_Interface SHALL allow administrators to upload a thumbnail image for each Firmware_Package
2. THE System SHALL accept thumbnail images in PNG, JPEG, and WebP formats
3. IF the uploaded file format is not PNG, JPEG, or WebP, THEN THE System SHALL reject the upload and display an error message indicating unsupported format
4. THE System SHALL validate that thumbnail image file size is less than 500 KB
5. IF the thumbnail file size exceeds 500 KB, THEN THE System SHALL reject the upload and display an error message indicating file size limit exceeded
6. THE System SHALL validate that thumbnail image dimensions are between 200x200 and 1000x1000 pixels
7. IF the thumbnail dimensions are outside the valid range, THEN THE System SHALL reject the upload and display an error message indicating invalid dimensions
8. WHEN a thumbnail image passes validation, THE System SHALL resize the image to fit within 400x400 pixels while preserving the original aspect ratio
9. WHEN a thumbnail image is uploaded and processed, THE System SHALL store it in the firmware_id subdirectory with the name thumbnail.png
10. WHEN thumbnail upload and processing complete successfully, THE System SHALL display a success confirmation message
11. WHEN a firmware package has a thumbnail, THE User_Interface SHALL display it in the card layout
12. WHEN a firmware package has no thumbnail, THE User_Interface SHALL display a default placeholder image

### 需求 14: 固件包下载

**用户故事:** 作为用户，我希望下载固件包的二进制文件，以便使用其他工具进行烧录。

#### 验收标准

1. THE User_Interface SHALL provide a "Download Firmware" button in the firmware package detail view
2. WHEN a user clicks the "Download Firmware" button, THE System SHALL validate that all required firmware binary files exist in Firmware_Storage
3. IF any required file is missing, THEN THE System SHALL display an error message indicating which files are missing and abort the download
4. WHEN all files exist, THE System SHALL create a ZIP archive containing bootloader.bin, partitions.bin, boot_app0.bin, app.bin, and metadata.json files
5. THE System SHALL name the ZIP file using the format: {project_name}_v{version}.zip
6. THE System SHALL complete ZIP archive creation and initiate download within 30 seconds
7. IF ZIP creation times out, THEN THE System SHALL display an error message indicating download preparation failed
8. WHEN the ZIP archive is ready, THE System SHALL stream the file to the user's browser for download
9. WHEN a download is initiated, THE System SHALL log a firmware download event containing firmware_id, timestamp, and user identifier if available
10. THE System SHALL support at least 10 concurrent downloads from multiple users
11. IF the firmware_id is invalid or does not exist, THEN THE System SHALL display an error message indicating firmware package not found

### 需求 15: 管理员仪表板

**用户故事:** 作为管理员，我希望查看固件管理系统的统计信息，以便了解系统使用情况。

#### 验收标准

1. THE Admin_Interface SHALL display a dashboard with system statistics
2. THE dashboard SHALL show the total number of uploaded firmware packages
3. THE dashboard SHALL show the total storage space used by firmware files in megabytes with two decimal places
4. THE dashboard SHALL show the number of firmware downloads in the last 30 days
5. THE dashboard SHALL show the number of firmware flashes in the last 30 days
6. THE dashboard SHALL show the top 10 most popular firmware packages ranked by download count
7. THE System SHALL update dashboard statistics every 5 minutes
8. WHEN storage space usage exceeds 80 percent of available capacity, THE dashboard SHALL display a visible warning indicator with the message "Storage capacity is running low"
9. IF dashboard data retrieval fails, THEN THE dashboard SHALL display an error message indicating statistics are temporarily unavailable
10. WHEN the dashboard loads initially, THE System SHALL display the most recent cached statistics while fetching updated data

### 需求 16: 固件包标签分类

**用户故事:** 作为管理员，我希望为固件包添加标签，以便用户可以按类别浏览项目。

#### 验收标准

1. THE Admin_Interface SHALL allow administrators to add tags to Firmware_Packages
2. THE Admin_Interface SHALL allow administrators to remove tags from Firmware_Packages
3. THE Project_Metadata SHALL include a tags field containing an array of tag strings
4. THE System SHALL validate that each tag is between 2 and 20 characters
5. THE System SHALL validate that each tag contains only alphanumeric characters, hyphens, and underscores
6. IF tag validation fails, THEN THE System SHALL reject the tag and display an error message indicating which validation rule was violated
7. THE System SHALL validate that a firmware package has at most 5 tags
8. THE System SHALL prevent duplicate tags within a single firmware package by rejecting attempts to add an already existing tag
9. THE User_Interface SHALL display tags on firmware package cards
10. THE User_Interface SHALL provide a tag filter allowing users to filter by one or more tags
11. WHEN a user selects multiple tags, THE System SHALL display firmware packages that match any of the selected tags using OR logic
12. THE System SHALL display a list of all available tags with usage counts showing how many firmware packages have each tag
13. WHEN no firmware packages match the selected tag filter, THE User_Interface SHALL display a message indicating no packages found with the selected tags

### 需求 17: 固件包兼容性验证

**用户故事:** 作为用户，我希望系统验证固件包与我的开发板兼容，以便避免烧录错误。

#### 验收标准

1. WHEN a user selects a firmware package, THE System SHALL retrieve the detected board ID from the chip detection service
2. IF no board is detected, THEN THE System SHALL display a message indicating no device detected and disable the Flash to Device button
3. WHEN a board is detected, THE System SHALL compare the detected board ID with the supported board IDs in the Project_Metadata
4. IF the detected board ID is not in the supported board IDs list, THEN THE System SHALL display a compatibility warning dialog containing the message "Your board ({detected_board_name}) may not be compatible with this firmware. Supported boards: {list_of_supported_board_names}. Proceed anyway?"
5. THE compatibility warning dialog SHALL provide "Proceed" and "Cancel" buttons
6. WHEN the user clicks "Proceed" in the compatibility warning dialog, THE System SHALL allow the flash operation to continue
7. WHEN the user proceeds with an incompatible board, THE System SHALL log a warning event containing firmware_id, detected board ID, and timestamp
8. THE User_Interface SHALL display a compatibility badge on firmware package cards indicating "Compatible" when the detected board ID matches any supported board ID, or "Check Compatibility" when no match is found
9. IF no board is currently detected, THEN THE User_Interface SHALL not display any compatibility badge

### 需求 18: 固件包使用统计

**用户故事:** 作为管理员，我希望查看每个固件包的使用统计，以便了解哪些项目最受欢迎。

#### 验收标准

1. THE System SHALL track the number of downloads for each Firmware_Package
2. THE System SHALL track the number of successful flashes for each Firmware_Package
3. THE System SHALL track the number of failed flashes for each Firmware_Package
4. THE System SHALL store usage statistics in the Project_Metadata
5. THE Admin_Interface SHALL display usage statistics for each firmware package
6. THE System SHALL update usage statistics immediately after each download or flash event
7. THE Admin_Interface SHALL allow sorting firmware packages by download count or flash count

### 需求 19: 固件包导入导出

**用户故事:** 作为管理员，我希望导出和导入固件包，以便在不同的系统实例之间迁移数据。

#### 验收标准

1. THE Admin_Interface SHALL provide an "Export Firmware Package" button for each firmware package
2. WHEN an administrator exports a firmware package, THE System SHALL create a ZIP archive containing the firmware binary files, metadata.json file, and thumbnail image file if present
3. IF export operation fails, THEN THE System SHALL display an error message indicating the failure reason and retain the original firmware package unchanged
4. THE Admin_Interface SHALL provide an "Import Firmware Package" button
5. WHEN an administrator imports a firmware package, THE System SHALL reject ZIP archives larger than 100 MB with an error message indicating size limit exceeded
6. WHEN an administrator imports a firmware package, THE System SHALL extract the ZIP archive within 30 seconds and validate that it contains a metadata.json file at the root level and at least one firmware binary file
7. IF the ZIP archive is corrupted or cannot be extracted, THEN THE System SHALL display an error message indicating invalid archive format and abort the import
8. WHEN the ZIP archive is extracted, THE System SHALL validate that metadata.json contains the fields: project_name, version, chip_type, and created_at
9. IF metadata.json is missing required fields or contains invalid data types, THEN THE System SHALL display an error message indicating which fields are invalid and abort the import
10. IF the imported firmware binary files are missing or unreadable, THEN THE System SHALL display an error message indicating missing files and abort the import
11. WHEN import validation is successful, THE System SHALL generate a new unique firmware_id and store the firmware package in the system database
12. IF a firmware package with the same project_name and version already exists, THEN THE System SHALL display a confirmation dialog with "Overwrite" and "Cancel" options
13. WHEN the administrator selects "Overwrite", THE System SHALL replace the existing firmware package's binary files, metadata, and thumbnail while preserving the original firmware_id
14. WHEN the administrator selects "Cancel", THE System SHALL abort the import and retain the existing firmware package unchanged
15. IF the administrator does not respond to the confirmation dialog within 60 seconds, THEN THE System SHALL automatically cancel the import operation

### 需求 20: 固件包发布状态管理

**用户故事:** 作为管理员，我希望控制固件包的发布状态，以便在测试完成前隐藏未完成的固件。

#### 验收标准

1. THE Project_Metadata SHALL include a published field with boolean value
2. THE Admin_Interface SHALL provide a toggle to set the published status of each Firmware_Package
3. IF a firmware package published status is false, THEN THE User_Interface SHALL not display it in the firmware list
4. THE Admin_Interface SHALL display both published and unpublished firmware packages with visual status indicators showing "Published" or "Unpublished" labels
5. WHEN an administrator uploads a new firmware package, THE System SHALL set published status to false by default
6. THE Admin_Interface SHALL allow administrators to preview unpublished firmware packages by displaying all metadata fields in a read-only view
7. WHEN an administrator changes published status to true, THE System SHALL validate that the required metadata fields (project_name, version, and chip_type) are complete
8. IF required metadata fields are incomplete when attempting to publish, THEN THE System SHALL keep published status as false and display an error message indicating which required fields are missing
9. WHEN published status is successfully changed, THE System SHALL display a confirmation message indicating the new status
