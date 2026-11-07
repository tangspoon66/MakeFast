/**
 * 管理员 - 自定义积木管理
 *
 * 管理员可以添加、编辑、删除自定义积木（Blockly 块定义 + 代码生成器）。
 */

import { useState, useEffect } from 'react';
import { Blocks, Plus, Trash2, AlertTriangle, Download, Clipboard, Upload, CheckCircle } from 'lucide-react';
import { AdminClient } from '../api/adminClient';

const TOOLBOX_CATEGORIES = [
  '程序结构', '控制流', '变量', '运算', '函数',
  '输入/输出', '通信', '传感器', '执行器', '显示与灯带', '红外遥控', '数据处理',
  'ESP32',
];

interface CustomBlock {
  name: string;
  category: string;
  json_definition: any;
  generator_code: string;
  display_name?: string;
  description?: string;
  libraries?: string[];
  example?: string;
}

interface ImportBlockResult {
  block: CustomBlock;
  errors: string[];
  warnings: string[];
  conflict: boolean;
}

const EMPTY_JSON_DEF = {
  type: '',
  message0: '新积木',
  args0: [],
  previousStatement: null,
  nextStatement: null,
  colour: 200,
  tooltip: '',
};

const EMPTY_GENERATOR = "return '// TODO: generate code\\n';";

const DANGEROUS_GENERATOR_PATTERNS = [
  'window', 'document', 'localStorage', 'sessionStorage', 'fetch', 'XMLHttpRequest',
  'eval', 'Function', 'import(', 'require(', 'navigator', 'location', 'cookie',
];

const AI_IMPORT_PROMPT = `你是 MakeFast ESP/Arduino Blockly 积木生成助手。请根据我的需求输出可导入的自定义积木 JSON。

只输出 JSON，不要 Markdown，不要解释文字。格式必须是：
{
  "blocks": [
    {
      "name": "custom_block_name",
      "display_name": "中文显示名",
      "category": "传感器",
      "description": "用途说明",
      "json_definition": {
        "type": "custom_block_name",
        "message0": "积木显示文字 %1",
        "args0": [],
        "previousStatement": null,
        "nextStatement": null,
        "colour": 20,
        "tooltip": ""
      },
      "generator_code": "const pin = block.getFieldValue('PIN');\\nreturn '  // code\\\\n';",
      "libraries": [],
      "example": "示例用法"
    }
  ]
}

分类只能使用以下之一：${TOOLBOX_CATEGORIES.join('、')}。
name 使用小写英文、数字、下划线，必须唯一，建议以 custom_ 开头。
json_definition.type 必须等于 name。
语句块返回 Arduino 代码字符串，表达式块返回 [code, order]。
generator_code 是 JavaScript 函数体，参数只有 block 和 generator。
不要使用 window、document、localStorage、fetch、eval、Function、import、require 等浏览器或动态执行 API。
如需 include/global/setup，请优先生成独立初始化积木，或在说明中写入 libraries，避免假设项目里存在 addLibrary_/addGlobalCode_。`;

const extractJsonText = (text: string) => {
  const trimmed = text.trim();
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch) return fenceMatch[1].trim();
  const firstBrace = trimmed.indexOf('{');
  const firstBracket = trimmed.indexOf('[');
  const startCandidates = [firstBrace, firstBracket].filter(index => index >= 0);
  if (startCandidates.length === 0) return trimmed;
  return trimmed.slice(Math.min(...startCandidates));
};

const normalizeBlockName = (value: string) => {
  return value.trim().replace(/[^a-zA-Z0-9_]/g, '_').replace(/_+/g, '_').toLowerCase();
};

const normalizeImportedBlocks = (raw: unknown, existingBlocks: CustomBlock[]): ImportBlockResult[] => {
  const source = Array.isArray(raw)
    ? raw
    : Array.isArray((raw as any)?.blocks)
      ? (raw as any).blocks
      : raw ? [raw] : [];
  const existingNames = new Set(existingBlocks.map(block => block.name));
  const seenNames = new Set<string>();

  return source.map((item: any, index: number) => {
    const errors: string[] = [];
    const warnings: string[] = [];
    const name = normalizeBlockName(String(item?.name || item?.json_definition?.type || `custom_block_${index + 1}`));
    const category = String(item?.category || '传感器').trim();
    const jsonDefinition = item?.json_definition && typeof item.json_definition === 'object'
      ? { ...item.json_definition, type: name }
      : { ...EMPTY_JSON_DEF, type: name };
    const generatorCode = String(item?.generator_code || '');

    if (!name) errors.push('缺少 name');
    if (seenNames.has(name)) errors.push('本次导入中存在同名积木');
    seenNames.add(name);
    if (!/^[a-z][a-z0-9_]*$/.test(name)) errors.push('name 必须以小写字母开头，只能包含小写字母、数字和下划线');
    if (!TOOLBOX_CATEGORIES.includes(category)) errors.push(`分类“${category}”不存在`);
    if (!jsonDefinition.message0) errors.push('json_definition.message0 不能为空');
    if (!Array.isArray(jsonDefinition.args0)) warnings.push('json_definition.args0 不是数组，已按 Blockly 默认行为处理');
    if (!generatorCode.trim()) errors.push('generator_code 不能为空');

    try {
       
      new Function('block', 'generator', generatorCode);
    } catch (error) {
      errors.push(`generator_code 语法错误：${error instanceof Error ? error.message : '未知错误'}`);
    }

    for (const pattern of DANGEROUS_GENERATOR_PATTERNS) {
      if (generatorCode.includes(pattern)) {
        errors.push(`generator_code 包含不允许的 API：${pattern}`);
      }
    }

    if (existingNames.has(name)) warnings.push('已存在同名积木，保存时会按覆盖策略处理');

    return {
      block: {
        name,
        category,
        json_definition: jsonDefinition,
        generator_code: generatorCode,
        display_name: item?.display_name,
        description: item?.description,
        libraries: Array.isArray(item?.libraries) ? item.libraries : [],
        example: item?.example,
      },
      errors,
      warnings,
      conflict: existingNames.has(name),
    };
  });
};

export default function AdminBlockManager() {
  const [blocks, setBlocks] = useState<CustomBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<CustomBlock | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showImporter, setShowImporter] = useState(false);
  const [saving, setSaving] = useState(false);
  const [importSaving, setImportSaving] = useState(false);

  // 表单状态
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState('传感器');
  const [formJsonDef, setFormJsonDef] = useState('');
  const [formGenerator, setFormGenerator] = useState('');
  const [formError, setFormError] = useState('');
  const [importText, setImportText] = useState('');
  const [importResults, setImportResults] = useState<ImportBlockResult[]>([]);
  const [importError, setImportError] = useState('');
  const [overwriteExisting, setOverwriteExisting] = useState(true);

  const loadBlocks = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await AdminClient.getCustomBlocks();
      setBlocks(data);
    } catch {
      setError('加载失败，请检查管理员登录状态');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBlocks();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setFormName('');
    setFormCategory('传感器');
    setFormJsonDef(JSON.stringify(EMPTY_JSON_DEF, null, 2));
    setFormGenerator(EMPTY_GENERATOR);
    setFormError('');
    setShowForm(true);
  };

  const openEdit = (block: CustomBlock) => {
    setEditing(block);
    setFormName(block.name);
    setFormCategory(block.category);
    setFormJsonDef(JSON.stringify(block.json_definition, null, 2));
    setFormGenerator(block.generator_code);
    setFormError('');
    setShowForm(true);
  };

  const handleSave = async () => {
    setFormError('');
    if (!formName.trim()) {
      setFormError('积木名称不能为空');
      return;
    }
    let jsonDef;
    try {
      jsonDef = JSON.parse(formJsonDef);
    } catch {
      setFormError('JSON 定义格式不正确');
      return;
    }
    const normalizedName = normalizeBlockName(formName);
    if (!/^[a-z][a-z0-9_]*$/.test(normalizedName)) {
      setFormError('积木名称必须以小写字母开头，只能包含小写字母、数字和下划线');
      return;
    }
    jsonDef = { ...jsonDef, type: normalizedName };
    if (!formGenerator.trim()) {
      setFormError('生成器代码不能为空');
      return;
    }
    try {
       
      new Function('block', 'generator', formGenerator);
    } catch (error) {
      setFormError(`生成器代码语法错误：${error instanceof Error ? error.message : '未知错误'}`);
      return;
    }

    setSaving(true);
    try {
      const result = await AdminClient.saveCustomBlock({
        name: normalizedName,
        category: formCategory,
        json_definition: jsonDef,
        generator_code: formGenerator,
      });
      if (result.success) {
        setShowForm(false);
        await loadBlocks();
      } else {
        setFormError(result.message || '保存失败');
      }
    } catch {
      setFormError('保存失败，请重试');
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadTemplate = () => {
    const link = document.createElement('a');
    link.href = '/BLOCKLY_CUSTOM_BLOCK_GUIDE.md';
    link.download = 'BLOCKLY_CUSTOM_BLOCK_GUIDE.md';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCopyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(AI_IMPORT_PROMPT);
    } catch {
      setError('复制失败，请手动复制提示词');
    }
  };

  const handleParseImport = () => {
    setImportError('');
    setImportResults([]);
    if (!importText.trim()) {
      setImportError('请先粘贴外部 AI 生成的 JSON');
      return;
    }

    try {
      const parsed = JSON.parse(extractJsonText(importText));
      const results = normalizeImportedBlocks(parsed, blocks);
      if (results.length === 0) {
        setImportError('没有解析到可导入的积木');
        return;
      }
      setImportResults(results);
    } catch (error) {
      setImportError(`JSON 解析失败：${error instanceof Error ? error.message : '格式错误'}`);
    }
  };

  const handleSaveImportedBlocks = async () => {
    const validResults = importResults.filter(result => result.errors.length === 0);
    if (validResults.length === 0) {
      setImportError('没有可保存的积木，请先修复错误');
      return;
    }

    setImportSaving(true);
    setImportError('');
    try {
      for (const result of validResults) {
        if (result.conflict && !overwriteExisting) continue;
        const saveResult = await AdminClient.saveCustomBlock({
          name: result.block.name,
          category: result.block.category,
          json_definition: result.block.json_definition,
          generator_code: result.block.generator_code,
        });
        if (!saveResult.success) {
          throw new Error(saveResult.message || `${result.block.name} 保存失败`);
        }
      }
      setShowImporter(false);
      setImportText('');
      setImportResults([]);
      await loadBlocks();
    } catch (error) {
      setImportError(error instanceof Error ? error.message : '批量保存失败');
    } finally {
      setImportSaving(false);
    }
  };

  const handleDelete = async (name: string) => {
    if (!confirm(`确定要删除积木 "${name}" 吗？`)) return;
    try {
      const result = await AdminClient.deleteCustomBlock(name);
      if (result.success) {
        await loadBlocks();
      }
    } catch {
      setError('删除失败');
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">
      {/* 标题栏 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-5">
        <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Blocks className="w-6 h-6 text-indigo-500" />
          自定义积木管理
        </h1>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => {
              setShowImporter(prev => !prev);
              setImportError('');
            }}
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-500 text-white rounded-lg text-xs sm:text-sm font-semibold hover:bg-emerald-600 transition-colors"
          >
            <Upload className="w-4 h-4" />
            AI 导入积木
          </button>
          <button
            onClick={openCreate}
            className="flex items-center gap-1.5 px-3 py-2 bg-indigo-500 text-white rounded-lg text-xs sm:text-sm font-semibold hover:bg-indigo-600 transition-colors"
          >
            <Plus className="w-4 h-4" />
            手动添加
          </button>
        </div>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 rounded-lg border border-red-200 mb-4">
          <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0" />
          <span className="text-xs sm:text-sm text-red-600">{error}</span>
        </div>
      )}

      {/* AI 导入 */}
      {showImporter && (
        <div className="bg-white rounded-lg border border-emerald-200 p-4 mb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
            <div>
              <h3 className="text-sm sm:text-base font-semibold text-slate-900">AI 导入积木</h3>
              <p className="text-xs text-slate-500 mt-1">在外部 AI 软件生成 JSON 后粘贴到这里，系统会先校验再保存。</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleCopyPrompt}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-300 rounded text-xs text-slate-700 hover:bg-[#edf6fb]"
              >
                <Clipboard className="w-3.5 h-3.5" />
                复制提示词
              </button>
              <button
                type="button"
                onClick={handleDownloadTemplate}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-300 rounded text-xs text-slate-700 hover:bg-[#edf6fb]"
              >
                <Download className="w-3.5 h-3.5" />
                查看开发指南
              </button>
            </div>
          </div>

          <textarea
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            rows={9}
            placeholder="粘贴外部 AI 输出的 JSON，支持 { blocks: [...] } 或单个积木对象"
            className="w-full px-3 py-2 border border-slate-300 rounded text-xs font-mono focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
          />

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleParseImport}
              className="px-4 py-1.5 bg-emerald-500 text-white rounded text-sm hover:bg-emerald-600 transition-colors"
            >
              解析并校验
            </button>
            <label className="inline-flex items-center gap-2 text-xs text-slate-600">
              <input
                type="checkbox"
                checked={overwriteExisting}
                onChange={(e) => setOverwriteExisting(e.target.checked)}
                className="w-4 h-4 text-emerald-600 border-slate-300 rounded"
              />
              同名积木覆盖保存
            </label>
            {importResults.length > 0 && (
              <button
                type="button"
                onClick={handleSaveImportedBlocks}
                disabled={importSaving || importResults.every(result => result.errors.length > 0)}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-indigo-500 text-white rounded text-sm hover:bg-indigo-600 disabled:opacity-50 transition-colors"
              >
                <CheckCircle className="w-4 h-4" />
                {importSaving ? '保存中...' : `保存可用积木 (${importResults.filter(result => result.errors.length === 0 && (overwriteExisting || !result.conflict)).length})`}
              </button>
            )}
          </div>

          {importError && <p className="mt-2 text-xs text-red-600">{importError}</p>}

          {importResults.length > 0 && (
            <div className="mt-4 space-y-2">
              {importResults.map((result) => (
                <div
                  key={result.block.name}
                  className={`rounded-lg border p-3 ${result.errors.length > 0 ? 'border-red-200 bg-red-50' : 'border-slate-200 bg-slate-50'}`}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold font-mono text-slate-900">{result.block.name}</span>
                    <span className="text-xs px-1.5 py-0.5 rounded bg-white border border-slate-200 text-slate-600">{result.block.category}</span>
                    {result.conflict && <span className="text-xs px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">同名</span>}
                    {result.errors.length === 0 && <span className="text-xs text-emerald-600">可保存</span>}
                  </div>
                  <div className="mt-2 text-xs text-slate-600">
                    <div>显示：{result.block.json_definition?.message0 || result.block.display_name || '-'}</div>
                    {result.block.libraries && result.block.libraries.length > 0 && (
                      <div>库：{result.block.libraries.join('、')}</div>
                    )}
                  </div>
                  {result.errors.length > 0 && (
                    <ul className="mt-2 list-disc pl-5 text-xs text-red-600">
                      {result.errors.map((item) => <li key={item}>{item}</li>)}
                    </ul>
                  )}
                  {result.warnings.length > 0 && (
                    <ul className="mt-2 list-disc pl-5 text-xs text-amber-700">
                      {result.warnings.map((item) => <li key={item}>{item}</li>)}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 表单 */}
      {showForm && (
        <div className="bg-white rounded-lg border border-slate-200 p-4 mb-4">
          <h3 className="text-sm sm:text-base font-semibold mb-3">
            {editing ? `编辑积木: ${editing.name}` : '新建积木'}
          </h3>
          
          {/* 名称和分类 - 响应式网格 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-xs text-slate-500 mb-1">积木名称</label>
              <input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="custom_xxx"
                className="w-full px-3 py-1.5 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">所属分类</label>
              <select
                value={formCategory}
                onChange={(e) => setFormCategory(e.target.value)}
                className="w-full px-3 py-1.5 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                {TOOLBOX_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          {/* JSON 定义 */}
          <div className="mb-3">
            <label className="block text-xs text-slate-500 mb-1">JSON 块定义</label>
            <textarea
              value={formJsonDef}
              onChange={(e) => setFormJsonDef(e.target.value)}
              rows={10}
              className="w-full px-3 py-2 border border-slate-300 rounded text-xs font-mono focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          {/* 代码生成器 */}
          <div className="mb-3">
            <label className="block text-xs text-slate-500 mb-1">代码生成器 (JavaScript 函数体)</label>
            <textarea
              value={formGenerator}
              onChange={(e) => setFormGenerator(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 border border-slate-300 rounded text-xs font-mono focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          {/* 错误提示 */}
          {formError && <p className="text-red-600 text-xs mb-2">{formError}</p>}

          {/* 按钮 */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-1.5 bg-indigo-500 text-white rounded text-sm hover:bg-indigo-600 disabled:opacity-50 transition-colors"
            >
              {saving ? '保存中...' : '保存'}
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="px-4 py-1.5 border border-slate-300 rounded text-sm hover:bg-[#edf6fb] transition-colors"
            >
              取消
            </button>
          </div>
        </div>
      )}

      {/* 列表 */}
      {loading ? (
        <p className="text-sm text-gray-400">加载中...</p>
      ) : blocks.length === 0 ? (
        <div className="text-center py-8 text-gray-400">
          <Blocks className="w-10 h-10 mx-auto mb-2" />
          <p className="text-sm">暂无自定义积木</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {blocks.map((block) => (
            <div
              key={block.name}
              className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-white rounded-lg border border-slate-200 gap-2"
            >
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-slate-900 font-mono truncate">{block.name}</span>
                  <span className="text-xs text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">{block.category}</span>
                </div>
              </div>
              <div className="flex gap-1.5 flex-shrink-0">
                <button
                  onClick={() => openEdit(block)}
                  className="px-3 py-1 border border-slate-300 rounded text-xs hover:bg-[#edf6fb] transition-colors"
                >
                  编辑
                </button>
                <button
                  onClick={() => handleDelete(block.name)}
                  className="px-2 py-1 border border-red-200 rounded text-xs text-red-600 hover:bg-red-50 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
