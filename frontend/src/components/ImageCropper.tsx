/**
 * 图片裁切组件
 *
 * 功能：
 * - 显示图片预览
 * - 拖拽选择裁切区域
 * - 支持固定比例裁切
 * - 返回裁切后的图片
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { X, Check } from 'lucide-react';

interface ImageCropperProps {
  imageFile: File;
  aspectRatio?: number; // 宽高比，如 4/3
  onCrop: (croppedFile: File) => void;
  onCancel: () => void;
}

interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function ImageCropper({ imageFile, aspectRatio = 4 / 3, onCrop, onCancel }: ImageCropperProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const [imageUrl, setImageUrl] = useState<string>('');
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [cropArea, setCropArea] = useState<CropArea>({ x: 0, y: 0, width: 0, height: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [dragType, setDragType] = useState<'move' | 'resize' | null>(null);
  const [resizeHandle, setResizeHandle] = useState<string>('');

  // 加载图片
  useEffect(() => {
    const url = URL.createObjectURL(imageFile);
    setImageUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [imageFile]);

  // 图片加载完成后初始化裁切区域
  const handleImageLoad = useCallback(() => {
    if (!imageRef.current || !containerRef.current) return;

    const img = imageRef.current;
    const container = containerRef.current;

    // 计算图片在容器中的实际显示尺寸
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;
    const imgRatio = img.naturalWidth / img.naturalHeight;
    const containerRatio = containerWidth / containerHeight;

    let displayWidth: number;
    let displayHeight: number;

    if (imgRatio > containerRatio) {
      displayWidth = containerWidth;
      displayHeight = containerWidth / imgRatio;
    } else {
      displayHeight = containerHeight;
      displayWidth = containerHeight * imgRatio;
    }

    setImageSize({ width: displayWidth, height: displayHeight });

    // 初始化裁切区域（居中，80% 大小）
    const cropWidth = displayWidth * 0.8;
    const cropHeight = cropWidth / aspectRatio;

    const finalCropHeight = cropHeight > displayHeight * 0.8 ? displayHeight * 0.8 : cropHeight;
    const finalCropWidth = finalCropHeight * aspectRatio;

    setCropArea({
      x: (displayWidth - finalCropWidth) / 2,
      y: (displayHeight - finalCropHeight) / 2,
      width: finalCropWidth,
      height: finalCropHeight,
    });
  }, [aspectRatio]);

  // 处理鼠标按下
  const handleMouseDown = useCallback((e: React.MouseEvent, type: 'move' | 'resize', handle?: string) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    setDragType(type);
    setResizeHandle(handle || '');
    setDragStart({ x: e.clientX, y: e.clientY });
  }, []);

  // 处理鼠标移动
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging || !imageRef.current) return;

    const img = imageRef.current;
    const rect = img.getBoundingClientRect();
    const scaleX = imageSize.width / rect.width;
    const scaleY = imageSize.height / rect.height;

    const deltaX = (e.clientX - dragStart.x) * scaleX;
    const deltaY = (e.clientY - dragStart.y) * scaleY;

    if (dragType === 'move') {
      setCropArea(prev => {
        let newX = prev.x + deltaX;
        let newY = prev.y + deltaY;

        // 边界检查
        newX = Math.max(0, Math.min(newX, imageSize.width - prev.width));
        newY = Math.max(0, Math.min(newY, imageSize.height - prev.height));

        return { ...prev, x: newX, y: newY };
      });
      setDragStart({ x: e.clientX, y: e.clientY });
    } else if (dragType === 'resize') {
      setCropArea(prev => {
        let newWidth = prev.width;
        let newHeight = prev.height;
        let newX = prev.x;
        let newY = prev.y;

        if (resizeHandle.includes('e')) {
          newWidth = Math.max(50, Math.min(prev.width + deltaX, imageSize.width - prev.x));
          newHeight = newWidth / aspectRatio;
        }
        if (resizeHandle.includes('w')) {
          const maxDelta = prev.width - 50;
          const clampedDelta = Math.max(-maxDelta, Math.min(deltaX, prev.x));
          newWidth = prev.width - clampedDelta;
          newHeight = newWidth / aspectRatio;
          newX = prev.x + clampedDelta;
        }
        if (resizeHandle.includes('s')) {
          newHeight = Math.max(50 / aspectRatio, Math.min(prev.height + deltaY, imageSize.height - prev.y));
          newWidth = newHeight * aspectRatio;
        }
        if (resizeHandle.includes('n')) {
          const maxDelta = prev.height - 50 / aspectRatio;
          const clampedDelta = Math.max(-maxDelta, Math.min(deltaY, prev.y));
          newHeight = prev.height - clampedDelta;
          newWidth = newHeight * aspectRatio;
          newY = prev.y + clampedDelta;
        }

        // 边界检查
        if (newX + newWidth > imageSize.width) {
          newWidth = imageSize.width - newX;
          newHeight = newWidth / aspectRatio;
        }
        if (newY + newHeight > imageSize.height) {
          newHeight = imageSize.height - newY;
          newWidth = newHeight * aspectRatio;
        }

        return { x: newX, y: newY, width: newWidth, height: newHeight };
      });
      setDragStart({ x: e.clientX, y: e.clientY });
    }
  }, [isDragging, dragStart, dragType, resizeHandle, imageSize, aspectRatio]);

  // 处理鼠标释放
  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setDragType(null);
  }, []);

  // 处理裁切确认
  const handleCropConfirm = useCallback(async () => {
    if (!imageRef.current) return;

    const img = imageRef.current;
    const rect = img.getBoundingClientRect();

    // 计算实际图片坐标
    const scaleX = img.naturalWidth / rect.width;
    const scaleY = img.naturalHeight / rect.height;

    const realCropArea = {
      x: Math.round(cropArea.x * scaleX),
      y: Math.round(cropArea.y * scaleY),
      width: Math.round(cropArea.width * scaleX),
      height: Math.round(cropArea.height * scaleY),
    };

    // 动态导入图片工具
    const { cropImage, compressImage } = await import('../utils/imageUtils');
    let croppedFile = await cropImage(imageFile, realCropArea, 400, 300);

    // 裁切后自动压缩到 500KB 以内
    if (croppedFile.size > 500 * 1024) {
      croppedFile = await compressImage(croppedFile, 500 * 1024);
    }

    onCrop(croppedFile);
  }, [cropArea, imageFile, onCrop]);

  return (
    <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50" onClick={onCancel}>
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full mx-4" onClick={e => e.stopPropagation()}>
        {/* 标题栏 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">裁切封面图片</h3>
          <button type="button" onClick={onCancel} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 裁切区域 */}
        <div className="p-6">
          <div
            ref={containerRef}
            className="relative bg-gray-100 rounded-lg overflow-hidden"
            style={{ height: 400 }}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            {imageUrl && (
              <>
                <img
                  ref={imageRef}
                  src={imageUrl}
                  alt="待裁切图片"
                  className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 max-w-full max-h-full object-contain"
                  onLoad={handleImageLoad}
                  style={{ maxWidth: '100%', maxHeight: '100%' }}
                />

                {/* 裁切框 */}
                {imageSize.width > 0 && imageRef.current && (
                  <div
                    className="absolute border-2 border-blue-500 cursor-move"
                    style={{
                      left: `calc(50% - ${imageSize.width / 2}px + ${cropArea.x}px)`,
                      top: `calc(50% - ${imageSize.height / 2}px + ${cropArea.y}px)`,
                      width: cropArea.width,
                      height: cropArea.height,
                    }}
                    onMouseDown={e => handleMouseDown(e, 'move')}
                  >
                    {/* 暗色遮罩 */}
                    <div className="absolute inset-0 bg-blue-500/10" />

                    {/* 调整大小的手柄 */}
                    <div
                      className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-blue-500 rounded-full cursor-n-resize"
                      onMouseDown={e => handleMouseDown(e, 'resize', 'n')}
                    />
                    <div
                      className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-blue-500 rounded-full cursor-s-resize"
                      onMouseDown={e => handleMouseDown(e, 'resize', 's')}
                    />
                    <div
                      className="absolute top-1/2 -left-1.5 -translate-y-1/2 w-3 h-3 bg-blue-500 rounded-full cursor-w-resize"
                      onMouseDown={e => handleMouseDown(e, 'resize', 'w')}
                    />
                    <div
                      className="absolute top-1/2 -right-1.5 -translate-y-1/2 w-3 h-3 bg-blue-500 rounded-full cursor-e-resize"
                      onMouseDown={e => handleMouseDown(e, 'resize', 'e')}
                    />

                    {/* 四角手柄 */}
                    <div
                      className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-white border-2 border-blue-500 rounded-full cursor-nw-resize"
                      onMouseDown={e => handleMouseDown(e, 'resize', 'nw')}
                    />
                    <div
                      className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-white border-2 border-blue-500 rounded-full cursor-ne-resize"
                      onMouseDown={e => handleMouseDown(e, 'resize', 'ne')}
                    />
                    <div
                      className="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-white border-2 border-blue-500 rounded-full cursor-sw-resize"
                      onMouseDown={e => handleMouseDown(e, 'resize', 'sw')}
                    />
                    <div
                      className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-white border-2 border-blue-500 rounded-full cursor-se-resize"
                      onMouseDown={e => handleMouseDown(e, 'resize', 'se')}
                    />
                  </div>
                )}
              </>
            )}
          </div>
          <p className="text-sm text-gray-500 mt-3 text-center">
            拖拽移动裁切区域，拖拽边角调整大小 · 比例 4:3 · 输出 400×300
          </p>
        </div>

        {/* 操作按钮 */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleCropConfirm}
            className="px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <Check className="w-4 h-4" />
            确认裁切
          </button>
        </div>
      </div>
    </div>
  );
}
