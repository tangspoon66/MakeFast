/**
 * 图片工具函数
 * - 压缩图片到指定大小
 * - 裁切图片
 */

const MAX_FILE_SIZE = 500 * 1024; // 500KB

/**
 * 压缩图片到指定大小以内
 */
export async function compressImage(file: File, maxSizeBytes: number = MAX_FILE_SIZE): Promise<File> {
  // 如果已经小于目标大小，直接返回
  if (file.size <= maxSizeBytes) {
    return file;
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('无法创建 canvas context'));
          return;
        }

        // 计算压缩比例
        const quality = 0.9;
        let width = img.width;
        let height = img.height;

        // 如果图片太大，先缩小尺寸
        const maxDimension = 1200;
        if (width > maxDimension || height > maxDimension) {
          const ratio = Math.min(maxDimension / width, maxDimension / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);

        // 递归压缩直到满足大小要求
        const tryCompress = (q: number) => {
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error('压缩失败'));
                return;
              }

              if (blob.size <= maxSizeBytes || q <= 0.1) {
                // 创建新文件
                const compressedFile = new File([blob], file.name, {
                  type: 'image/jpeg',
                  lastModified: Date.now(),
                });
                resolve(compressedFile);
              } else {
                // 继续降低质量
                tryCompress(q - 0.1);
              }
            },
            'image/jpeg',
            q
          );
        };

        tryCompress(quality);
      };
      img.onerror = () => reject(new Error('图片加载失败'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('文件读取失败'));
    reader.readAsDataURL(file);
  });
}

/**
 * 裁切图片
 */
export async function cropImage(
  file: File,
  cropArea: { x: number; y: number; width: number; height: number },
  outputWidth?: number,
  outputHeight?: number
): Promise<File> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('无法创建 canvas context'));
          return;
        }

        const destWidth = outputWidth || cropArea.width;
        const destHeight = outputHeight || cropArea.height;

        canvas.width = destWidth;
        canvas.height = destHeight;

        ctx.drawImage(
          img,
          cropArea.x,
          cropArea.y,
          cropArea.width,
          cropArea.height,
          0,
          0,
          destWidth,
          destHeight
        );

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('裁切失败'));
              return;
            }
            const croppedFile = new File([blob], file.name, {
              type: 'image/jpeg',
              lastModified: Date.now(),
            });
            resolve(croppedFile);
          },
          'image/jpeg',
          0.95
        );
      };
      img.onerror = () => reject(new Error('图片加载失败'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('文件读取失败'));
    reader.readAsDataURL(file);
  });
}

/**
 * 获取图片尺寸
 */
export function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.width, height: img.height });
      img.onerror = () => reject(new Error('图片加载失败'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('文件读取失败'));
    reader.readAsDataURL(file);
  });
}

/**
 * 验证图片文件
 */
export function validateImageFile(file: File): { valid: boolean; error?: string } {
  const allowedTypes = ['image/png', 'image/jpeg', 'image/webp'];
  if (!allowedTypes.includes(file.type)) {
    return { valid: false, error: '图片必须是 PNG、JPEG 或 WebP 格式' };
  }
  return { valid: true };
}
