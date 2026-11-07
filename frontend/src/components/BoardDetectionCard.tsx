/**
 * 开发板选择卡片
 * 
 * 手动选择开发板型号
 */

import { useState, useEffect } from 'react';
import {
  Settings,
  Info
} from 'lucide-react';
import { useEditorStore } from '../store/editorStore';
import { groupBoardsByChipFamily, formatBoardNumberLabel } from '../utils/boardConstants';
import type { BoardInfo } from '../api/types';

interface BoardDetectionCardProps {
  variant?: 'card' | 'compact';
}

export function BoardDetectionCard({ variant = 'card' }: BoardDetectionCardProps) {
  const { selectedBoard, setSelectedBoard } = useEditorStore();
  
  const [boards, setBoards] = useState<BoardInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // 从后端获取开发板列表
  useEffect(() => {
    const fetchBoards = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/boards');
        const data = await response.json();
        setBoards(data.boards || []);
      } catch (err) {
        console.error('获取开发板列表失败:', err);
        setError('无法加载开发板列表');
      } finally {
        setLoading(false);
      }
    };
    
    fetchBoards();
  }, []);
  
  // 按芯片系列分组开发板（使用共享工具函数）
  const groupedBoards = groupBoardsByChipFamily(boards);
  
  // 获取当前选中的开发板信息
  const selectedBoardInfo = boards.find(b => b.id === selectedBoard);
  
  if (loading) {
    if (variant === 'compact') {
      return (
        <div className="board-compact">
          <Settings />
          <span>开发板加载中</span>
        </div>
      );
    }

    return (
      <div className="side-card board-detection-card">
        <div className="side-card__title">
          <Settings />
          <h3>选择开发板</h3>
        </div>
        <div className="text-center py-4 text-gray-400 text-sm">
          加载中...
        </div>
      </div>
    );
  }
  
  if (error) {
    if (variant === 'compact') {
      return (
        <div className="board-compact board-compact--error">
          <Settings />
          <span>开发板加载失败</span>
        </div>
      );
    }

    return (
      <div className="side-card board-detection-card">
        <div className="side-card__title">
          <Settings />
          <h3>选择开发板</h3>
        </div>
        <div className="text-center py-4 text-red-400 text-sm">
          {error}
        </div>
      </div>
    );
  }

  if (variant === 'compact') {
    return (
      <div className="board-compact">
        <div className="board-compact__label">
          <Settings />
          <span>开发板</span>
        </div>
        <select
          value={selectedBoard}
          onChange={(e) => setSelectedBoard(e.target.value)}
          className="board-compact__select"
          aria-label="选择开发板"
        >
          <option value="">请选择型号</option>
          {groupedBoards.map(group => (
            <optgroup key={group.label} label={group.label}>
              {group.boards.map(board => (
                <option key={board.id} value={board.id}>
                  {formatBoardNumberLabel(board.id, boards)}{board.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>
    );
  }
  
  return (
    <div className="side-card board-detection-card">
      <div className="side-card__title">
        <Settings />
        <h3>选择开发板</h3>
      </div>
      
      <div className="board-selector">
        <select
          value={selectedBoard}
          onChange={(e) => setSelectedBoard(e.target.value)}
          className="board-select"
        >
          <option value="">请选择开发板型号...</option>
          {groupedBoards.map(group => (
            <optgroup key={group.label} label={group.label}>
              {group.boards.map(board => (
                <option key={board.id} value={board.id}>
                  {formatBoardNumberLabel(board.id, boards)}{board.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        
        {selectedBoardInfo && (
          <div className="board-description">
            <p>{selectedBoardInfo.description}</p>
          </div>
        )}
        
        <p className="board-hint">
          <Info className="w-4 h-4" />
          请根据您的开发板型号手动选择
        </p>
      </div>
    </div>
  );
}
