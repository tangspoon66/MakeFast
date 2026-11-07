# 多文件支持和代码上传功能

## 已修复的问题

### 1. ✅ Blockly 滚动条样式问题
**问题描述：** 积木选择栏的滚动条显示为粗大的灰黑色竖线，影响美观。

**解决方案：**
- 自定义了 Blockly 的滚动条样式，使其更加美观
- 隐藏了 Blockly 自带的粗大滚动条
- 使用了半透明的细滚动条替代

**相关文件：**
- `frontend/src/App.css` - 添加了 `.blockly-container` 和 `.blocklyFlyout` 的滚动条样式

### 2. ✅ 代码丢失 Bug
**问题描述：** AI 生成代码后，切换到积木页面再切回代码页面时，代码消失。

**解决方案：**
- 使用 `useRef` 保存代码的本地副本
- 在组件内部维护代码状态，防止切换时丢失
- 当外部代码更新时（如 AI 生成），自动保存并标记

**相关文件：**
- `frontend/src/components/EditorTabs.tsx` - 添加了 `savedCodeRef` 来保存代码

### 3. ✅ 代码上传功能
**问题描述：** 缺少上传本地代码文件的功能。

**解决方案：**
- 创建了 `FileUploader` 组件
- 支持上传 `.ino`, `.cpp`, `.h`, `.c`, `.hpp` 等文件
- 支持单文件和多文件上传
- 多文件上传时自动合并或标注

**相关文件：**
- `frontend/src/components/FileUploader.tsx` - 新建的文件上传组件
- `frontend/src/App.tsx` - 集成了文件上传功能

### 4. ✅ 多文件项目支持（准备就绪）
**问题描述：** 需要支持包含多个文件的项目（如 .ino + .cpp + .h）。

**解决方案：**
- 创建了 `MultiFileEditor` 组件（已准备好，可选使用）
- 支持多文件标签页切换
- 支持添加、删除、复制文件
- 每个文件独立编辑

**相关文件：**
- `frontend/src/components/MultiFileEditor.tsx` - 多文件编辑器组件

## 使用说明

### 上传代码文件

1. 在右侧边栏找到"上传代码"卡片
2. 点击"上传代码"按钮
3. 选择一个或多个代码文件
4. 文件内容会自动加载到编辑器

**单文件上传：**
- 直接替换当前编辑器内容

**多文件上传：**
- 如果包含 `.ino` 文件，将其作为主文件
- 其他文件作为注释添加到代码中
- 如果没有 `.ino` 文件，所有文件按顺序合并

### 代码保存机制

- 代码在切换标签页时会自动保存在内存中
- AI 生成的代码会自动保存
- 手动编辑的代码会被标记，切换到积木视图时会提示

### Blockly 积木编辑器

- 滚动条已优化，更加美观
- 积木选择栏的弹出菜单使用细滚动条
- 主工作区隐藏了原生滚动条，使用浏览器滚动

## 未来扩展

### 完整多文件编辑器（可选）

如果需要更强大的多文件编辑功能，可以使用 `MultiFileEditor` 组件：

```tsx
import { MultiFileEditor } from './components/MultiFileEditor';

// 在 App.tsx 中使用
<MultiFileEditor
  files={files}
  activeFileId={activeFileId}
  onFilesChange={setFiles}
  onActiveFileChange={setActiveFileId}
/>
```

**功能特性：**
- 文件标签页切换
- 添加新文件
- 删除文件
- 复制文件
- 每个文件独立编辑
- 文件类型图标

### 后端多文件编译支持

当前实现将多个文件合并后发送给后端编译。如果需要真正的多文件编译支持，需要：

1. 修改后端 API 接受多文件输入
2. 修改编译服务支持多文件项目结构
3. 前端发送文件数组而不是单个代码字符串

## 技术细节

### 文件上传实现

```typescript
// 使用 FileReader API 读取文件
const readFileAsText = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      resolve(e.target?.result as string);
    };
    reader.readAsText(file);
  });
};
```

### 代码保存机制

```typescript
// 使用 useRef 保存代码副本
const savedCodeRef = useRef<string>(value);

// 监听外部更新
useEffect(() => {
  if (value !== savedCodeRef.current && value.trim()) {
    savedCodeRef.current = value;
    setUserEditedCode(true);
  }
}, [value]);
```

### Blockly 滚动条样式

```css
/* 隐藏 Blockly 自带的滚动条 */
.blocklyScrollbarVertical,
.blocklyScrollbarHorizontal {
  display: none !important;
}

/* 自定义浏览器滚动条 */
.blockly-container ::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}
```

## 测试建议

1. **测试代码保存：**
   - AI 生成代码
   - 切换到积木视图
   - 切换回代码视图
   - 验证代码是否保留

2. **测试文件上传：**
   - 上传单个 .ino 文件
   - 上传多个文件（.ino + .cpp + .h）
   - 验证文件内容是否正确加载

3. **测试 Blockly 滚动：**
   - 打开积木视图
   - 点击分类查看积木列表
   - 验证滚动条样式是否美观

## 已知限制

1. **多文件合并：** 当前将多个文件合并为一个字符串，可能不适合所有项目
2. **文件大小限制：** 总代码长度不能超过 50000 字符
3. **编译支持：** 后端当前只支持单文件编译

## 相关文件清单

- ✅ `frontend/src/components/FileUploader.tsx` - 文件上传组件
- ✅ `frontend/src/components/MultiFileEditor.tsx` - 多文件编辑器（可选）
- ✅ `frontend/src/components/EditorTabs.tsx` - 修复代码保存
- ✅ `frontend/src/App.tsx` - 集成文件上传
- ✅ `frontend/src/App.css` - 滚动条样式优化
