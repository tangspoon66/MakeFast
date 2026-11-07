/**
 * 开发板选择器组件
 * 
 * 从后端 API 获取开发板列表并按芯片系列分组显示
 */

import { useState, useEffect } from 'react';
import { Settings, Info } from 'lucide-react';
import { groupBoardsByChipFamily, formatBoardNumberLabel } from '../utils/boardConstants';
import type { BoardInfo } from '../api/types';

interface BoardSelectorProps {
  value: string;
  onChange: (boardId: string) => void;
}

export function BoardSelector({ value, onChange }: BoardSelectorProps) {
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
  const selectedBoard = boards.find(b => b.id === value);
  
  if (loading) {
    return (
      <div className="side-card board-card">
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
    return (
      <div className="side-card board-card">
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
  
  return (
    <div className="side-card board-card">
      <div className="side-card__title">
        <Settings />
        <h3>选择开发板</h3>
      </div>
      
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="board-select"
      >
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
      
      {selectedBoard && (
        <div className="board-description">
          <p>{selectedBoard.description}</p>
        </div>
      )}
      
      <p className="hint-line">
        <Info />
        不确定型号时，使用"检测芯片"自动识别
      </p>
    </div>
  );
}
