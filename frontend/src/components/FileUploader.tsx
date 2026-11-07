/**
 * 文件上传组件
 * 支持上传单个或多个代码文件
 */

import { useRef } from 'react';
import { Upload, FileText } from 'lucide-react';

interface FileUploaderProps {
  onFilesUploaded: (files: Array<{ name: string; content: string }>) => void;
  accept?: string;
  multiple?: boolean;
}

export function FileUploader({
  onFilesUploaded,
  accept = '.ino,.cpp,.h,.c,.hpp',
  multiple = true
}: FileUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    try {
      const uploadedFiles: Array<{ name: string; content: string }> = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const content = await readFileAsText(file);
        uploadedFiles.push({
          name: file.name,
          content
        });
      }

      onFilesUploaded(uploadedFiles);
      
      // 重置 input，允许重复上传同一文件
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error('文件读取失败:', error);
      alert('文件读取失败，请重试');
    }
  };

  const readFileAsText = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result;
        if (typeof content === 'string') {
          resolve(content);
        } else {
          reject(new Error('文件内容格式错误'));
        }
      };
      reader.onerror = () => reject(new Error('文件读取失败'));
      reader.readAsText(file);
    });
  };

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="file-uploader">
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={handleFileSelect}
        style={{ display: 'none' }}
      />
      
      <button
        onClick={handleButtonClick}
        className="file-uploader__button"
        title="上传代码文件"
      >
        <Upload className="w-5 h-5" />
        <span>上传代码</span>
      </button>
      
      <div className="file-uploader__hint">
        <FileText className="w-4 h-4" />
        <span>支持 .ino, .cpp, .h 等文件</span>
      </div>
    </div>
  );
}
