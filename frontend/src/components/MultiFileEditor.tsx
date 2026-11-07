/**
 * 多文件编辑器组件
 * 支持管理和编辑多个代码文件
 */

import { useState } from 'react';
import { 
  FileText, 
  Plus, 
  X
} from 'lucide-react';
import { CodeEditor } from './CodeEditor';

export interface CodeFile {
  id: string;
  name: string;
  content: string;
  type: 'ino' | 'cpp' | 'h' | 'c' | 'hpp' | 'other';
}

interface MultiFileEditorProps {
  files: CodeFile[];
  activeFileId: string;
  onFilesChange: (files: CodeFile[]) => void;
  onActiveFileChange: (fileId: string) => void;
  maxLength?: number;
}

export function MultiFileEditor({
  files,
  activeFileId,
  onFilesChange,
  onActiveFileChange,
  maxLength = 50000
}: MultiFileEditorProps) {
  const [isAddingFile, setIsAddingFile] = useState(false);
  const [newFileName, setNewFileName] = useState('');

  const activeFile = files.find(f => f.id === activeFileId);

  // 获取文件类型图标颜色
  const getFileTypeColor = (type: CodeFile['type']) => {
    switch (type) {
      case 'ino': return 'text-blue-600';
      case 'cpp': return 'text-purple-600';
      case 'h': return 'text-green-600';
      case 'c': return 'text-orange-600';
      default: return 'text-gray-600';
    }
  };

  // 从文件名推断类型
  const getFileType = (fileName: string): CodeFile['type'] => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (ext === 'ino' || ext === 'cpp' || ext === 'h' || ext === 'c' || ext === 'hpp') {
      return ext as CodeFile['type'];
    }
    return 'other';
  };

  // 更新当前文件内容
  const handleContentChange = (content: string) => {
    if (!activeFile) return;
    
    const updatedFiles = files.map(f =>
      f.id === activeFileId ? { ...f, content } : f
    );
    onFilesChange(updatedFiles);
  };

  // 添加新文件
  const handleAddFile = () => {
    if (!newFileName.trim()) {
      alert('请输入文件名');
      return;
    }

    // 检查文件名是否已存在
    if (files.some(f => f.name === newFileName)) {
      alert('文件名已存在');
      return;
    }

    const newFile: CodeFile = {
      id: `file-${Date.now()}`,
      name: newFileName,
      content: '',
      type: getFileType(newFileName)
    };

    onFilesChange([...files, newFile]);
    onActiveFileChange(newFile.id);
    setNewFileName('');
    setIsAddingFile(false);
  };

  // 删除文件
  const handleDeleteFile = (fileId: string) => {
    if (files.length === 1) {
      alert('至少需要保留一个文件');
      return;
    }

    const confirmed = confirm('确定要删除这个文件吗？');
    if (!confirmed) return;

    const updatedFiles = files.filter(f => f.id !== fileId);
    onFilesChange(updatedFiles);

    // 如果删除的是当前文件，切换到第一个文件
    if (fileId === activeFileId && updatedFiles.length > 0) {
      onActiveFileChange(updatedFiles[0].id);
    }
  };

  return (
    <div className="multi-file-editor">
      {/* 文件标签栏 */}
      <div className="multi-file-editor__tabs">
        <div className="multi-file-editor__tabs-list">
          {files.map(file => (
            <div
              key={file.id}
              className={`multi-file-editor__tab ${
                file.id === activeFileId ? 'multi-file-editor__tab--active' : ''
              }`}
              onClick={() => onActiveFileChange(file.id)}
            >
              <FileText className={`w-4 h-4 ${getFileTypeColor(file.type)}`} />
              <span>{file.name}</span>
              
              {files.length > 1 && (
                <button
                  className="multi-file-editor__tab-close"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteFile(file.id);
                  }}
                  title="删除文件"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}

          {/* 添加文件按钮 */}
          {!isAddingFile && (
            <button
              className="multi-file-editor__add-button"
              onClick={() => setIsAddingFile(true)}
              title="添加新文件"
            >
              <Plus className="w-4 h-4" />
            </button>
          )}

          {/* 添加文件输入框 */}
          {isAddingFile && (
            <div className="multi-file-editor__add-input">
              <input
                type="text"
                value={newFileName}
                onChange={(e) => setNewFileName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddFile();
                  if (e.key === 'Escape') {
                    setIsAddingFile(false);
                    setNewFileName('');
                  }
                }}
                placeholder="文件名.ino"
                autoFocus
              />
              <button onClick={handleAddFile} title="确认">✓</button>
              <button
                onClick={() => {
                  setIsAddingFile(false);
                  setNewFileName('');
                }}
                title="取消"
              >
                ✕
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 编辑器内容 */}
      <div className="multi-file-editor__content">
        {activeFile ? (
          <CodeEditor
            value={activeFile.content}
            onChange={handleContentChange}
            maxLength={maxLength}
          />
        ) : (
          <div className="multi-file-editor__empty">
            <FileText className="w-12 h-12 text-gray-400" />
            <p>没有打开的文件</p>
          </div>
        )}
      </div>
    </div>
  );
}
