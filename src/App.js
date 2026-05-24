import React, { useCallback, useState, useEffect, useRef, useMemo } from 'react';
import ReactFlow, {
  MiniMap,
  Controls,
  Background,
  addEdge,
  useNodesState,
  useEdgesState,
  Handle,
  Position
} from 'reactflow';
import 'reactflow/dist/style.css';
import './App.css';
import { v4 as uuidv4 } from 'uuid';
import { IoIosAddCircleOutline } from "react-icons/io";
import { IoIosShare } from "react-icons/io";

/**
 * ResizeObserver errors from ReactFlow are harmless — suppress them.
 */
if (typeof window !== 'undefined') {
  const originalError = console.error;
  console.error = (...args) => {
    if (args[0]?.toString().includes('ResizeObserver')) return;
    originalError(...args);
  };
  window.addEventListener('error', (e) => {
    if (e.message.includes('ResizeObserver')) {
      e.stopImmediatePropagation();
      const overlay = document.querySelector('iframe');
      if (overlay) overlay.style.display = 'none';
    }
  });
}

// ---- Responsive hook ----
const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);
  return isMobile;
};

// ---- 1. Color Picker ----
const ColorPicker = ({ selectedNode, onColorChange }) => {
  if (!selectedNode) return null;
  const colors = [
    { name: '標準', value: '#333' },
    { name: '重要', value: '#dc3545' },
    { name: '注意', value: '#ffc107' },
    { name: '完了', value: '#28a745' },
    { name: '基礎', value: '#007bff' },
    { name: '紫', value: '#6f42c1' },
  ];
  return (
    <div className="color-picker">
      {colors.map((c) => (
        <div
          key={c.value}
          onClick={() => onColorChange(c.value)}
          className={`color-dot${selectedNode.data.color === c.value ? ' active' : ''}`}
          style={{ background: c.value }}
        />
      ))}
    </div>
  );
};

// ---- 2. Custom Node ----
const CustomNode = React.memo(({ id, data, hasLeft, hasRight, onLabelChange, isCollapsed, hasChildren, onToggleCollapse }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [text, setText] = useState(data.label);
  const inputRef = useRef(null);

  useEffect(() => { if (isEditing) inputRef.current?.focus(); }, [isEditing]);

  // Sync label when changed externally (e.g. mobile prompt edit)
  useEffect(() => { if (!isEditing) setText(data.label); }, [data.label, isEditing]);

  const save = () => { onLabelChange(id, text); setIsEditing(false); };

  const progressIcon = data.progress === 'done' ? '✓' : data.progress === 'review' ? '★' : null;
  const progressColor = data.progress === 'done' ? '#28a745' : data.progress === 'review' ? '#ffc107' : null;

  return (
    <div
      style={{
        padding: '10px 15px',
        border: `2px solid ${data.color || '#333'}`,
        borderRadius: '8px',
        background: data.searchHighlight ? '#fff9c4' : 'white',
        minWidth: '100px',
        textAlign: 'center',
        position: 'relative',
        outline: data.searchHighlight ? `2px solid #f9a825` : 'none',
      }}
      onDoubleClick={() => setIsEditing(true)}
    >
      <Handle type="target" position={Position.Left} style={{ opacity: hasLeft ? 1 : 0.2 }} />

      {/* Progress badge */}
      {progressIcon && (
        <div
          style={{
            position: 'absolute',
            top: -10,
            right: -10,
            width: 22,
            height: 22,
            borderRadius: '50%',
            background: progressColor,
            color: 'white',
            fontSize: 11,
            fontWeight: 'bold',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1,
            boxShadow: '0 1px 4px rgba(0,0,0,0.25)',
          }}
        >
          {progressIcon}
        </div>
      )}

      {isEditing ? (
        <textarea
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => e.key === 'Enter' && e.shiftKey && save()}
          style={{ border: 'none', outline: 'none', width: '100%', textAlign: 'center', resize: 'none', fontFamily: 'inherit' }}
        />
      ) : (
        <div style={{ fontWeight: 'bold', whiteSpace: 'pre-wrap' }}>{data.label}</div>
      )}

      <Handle type="source" position={Position.Right} style={{ opacity: hasRight ? 1 : 0.2 }} />

      {/* Collapse toggle button */}
      {hasChildren && (
        <button
          onClick={(e) => { e.stopPropagation(); onToggleCollapse(id); }}
          style={{
            position: 'absolute',
            right: -14,
            top: '50%',
            transform: 'translateY(-50%)',
            width: 18,
            height: 18,
            borderRadius: '50%',
            border: '1.5px solid #aaa',
            background: '#fff',
            color: '#555',
            fontSize: 10,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 0,
            zIndex: 2,
            lineHeight: 1,
          }}
          title={isCollapsed ? '展開' : '折りたたみ'}
        >
          {isCollapsed ? '+' : '−'}
        </button>
      )}
    </div>
  );
});

// ---- 3. Bottom Sheet (mobile context menu) ----
const BottomSheet = ({ node, onClose, onEdit, onDelete, onAddChild, onColorChange, onProgressChange, isCollapsed, hasChildren, onToggleCollapse }) => {
  const colors = [
    { name: '標準', value: '#333' },
    { name: '重要', value: '#dc3545' },
    { name: '注意', value: '#ffc107' },
    { name: '完了', value: '#28a745' },
    { name: '基礎', value: '#007bff' },
    { name: '紫', value: '#6f42c1' },
  ];

  return (
    <>
      <div className="bottom-sheet-overlay" onClick={onClose} />
      <div className="bottom-sheet">
        <div className="bottom-sheet-handle" />
        <div className="bottom-sheet-title">{node.data.label}</div>

        {/* Main actions */}
        <div className="bottom-sheet-actions">
          <button className="bs-action-btn" onClick={onEdit}>
            <span className="bs-icon">✏️</span>
            <span>編集</span>
          </button>
          <button className="bs-action-btn" onClick={onAddChild}>
            <span className="bs-icon">➕</span>
            <span>子追加</span>
          </button>
          {hasChildren && (
            <button className="bs-action-btn" onClick={onToggleCollapse}>
              <span className="bs-icon">{isCollapsed ? '🔓' : '🔒'}</span>
              <span>{isCollapsed ? '展開' : '折りたたみ'}</span>
            </button>
          )}
          <button className="bs-action-btn bs-action-danger" onClick={onDelete}>
            <span className="bs-icon">🗑️</span>
            <span>削除</span>
          </button>
        </div>

        {/* Progress badges */}
        <div className="bottom-sheet-section-label">進捗マーク</div>
        <div className="bottom-sheet-progress">
          <button
            className={`bs-progress-btn${node.data.progress === 'done' ? ' active-done' : ''}`}
            onClick={() => onProgressChange(node.data.progress === 'done' ? null : 'done')}
          >
            ✓ 学習済み
          </button>
          <button
            className={`bs-progress-btn${node.data.progress === 'review' ? ' active-review' : ''}`}
            onClick={() => onProgressChange(node.data.progress === 'review' ? null : 'review')}
          >
            ★ 要復習
          </button>
        </div>

        {/* Color picker */}
        <div className="bottom-sheet-section-label">ノードカラー</div>
        <div className="bottom-sheet-colors">
          {colors.map((c) => (
            <div
              key={c.value}
              onClick={() => onColorChange(c.value)}
              className={`color-dot${node.data.color === c.value ? ' active' : ''}`}
              style={{ background: c.value, width: 32, height: 32 }}
            />
          ))}
        </div>
      </div>
    </>
  );
};

// ---- 4. Search Bar ----
const SearchBar = ({ onSearch, onClose }) => {
  const [query, setQuery] = useState('');
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const handleChange = (v) => {
    setQuery(v);
    onSearch(v);
  };

  return (
    <div className="search-bar">
      <span className="search-icon">🔍</span>
      <input
        ref={inputRef}
        className="search-input"
        type="text"
        placeholder="ノードを検索..."
        value={query}
        onChange={(e) => handleChange(e.target.value)}
      />
      {query && (
        <button className="search-clear" onClick={() => { handleChange(''); }}>✕</button>
      )}
      <button className="search-close" onClick={() => { handleChange(''); onClose(); }}>閉じる</button>
    </div>
  );
};

// ---- 5. Map List View ----
const MapListView = ({ onSelect, onCreate }) => {
  const [maps, setMaps] = useState({});
  const [renamingId, setRenamingId] = useState(null);
  const [renameText, setRenameText] = useState('');

  useEffect(() => {
    const saved = localStorage.getItem('mindmaps');
    if (saved) setMaps(JSON.parse(saved));
  }, []);

  const saveRename = (id) => {
    const trimmed = renameText.trim();
    if (trimmed) {
      const updated = { ...maps, [id]: { ...maps[id], name: trimmed } };
      setMaps(updated);
      localStorage.setItem('mindmaps', JSON.stringify(updated));
    }
    setRenamingId(null);
  };

  const importMaps = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const importedData = JSON.parse(event.target.result);
        const currentMaps = JSON.parse(localStorage.getItem('mindmaps') || '{}');
        const newMerged = { ...currentMaps };
        Object.entries(importedData).forEach(([id, data]) => {
          let targetId = id;
          let targetData = { ...data };
          if (newMerged[targetId]) {
            targetId = uuidv4();
            targetData.name = `${data.name} (コピー)`;
          }
          newMerged[targetId] = targetData;
        });
        setMaps(newMerged);
        localStorage.setItem('mindmaps', JSON.stringify(newMerged));
        alert('読み込みが完了しました！');
      } catch {
        alert('ファイルの形式が正しくありません');
      }
    };
    reader.readAsText(file);
  };

  const exportAll = () => {
    const blob = new Blob([JSON.stringify(maps)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'mindmaps_backup.json'; a.click();
  };

  const deleteMap = (id) => {
    if (!window.confirm('消去しますか？')) return;
    const n = { ...maps };
    delete n[id];
    setMaps(n);
    localStorage.setItem('mindmaps', JSON.stringify(n));
  };

  return (
    <div className="list-container">
      <h1>🧠 MindMap List</h1>
      <div className="list-actions">
        <button
          onClick={onCreate}
          className="list-btn"
          style={{ background: '#28a745', color: 'white' }}
        >
          ＋ 新規作成
        </button>
        <button
          onClick={exportAll}
          className="list-btn"
          style={{ background: '#007bff', color: 'white' }}
        >
          <IoIosShare size={18} /> バックアップ
        </button>
        <label className="list-btn" style={{ background: '#6c757d', color: 'white', cursor: 'pointer' }}>
          📥 読み込み
          <input type="file" accept=".json" onChange={importMaps} style={{ display: 'none' }} />
        </label>
      </div>
      <div className="list-grid">
        {Object.entries(maps).map(([id, m]) => (
          <div key={id} className="list-item">
            {renamingId === id ? (
              <input
                className="list-item-name"
                value={renameText}
                autoFocus
                onChange={(e) => setRenameText(e.target.value)}
                onBlur={() => saveRename(id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') saveRename(id);
                  if (e.key === 'Escape') setRenamingId(null);
                }}
              />
            ) : (
              <input
                className="list-item-name"
                value={m.name}
                readOnly
                onFocus={() => { setRenamingId(id); setRenameText(m.name); }}
                title="タップして名前を変更"
              />
            )}
            <div className="list-item-actions">
              <button
                onClick={() => onSelect(id)}
                style={{ padding: '5px 15px', background: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
              >
                開く
              </button>
              <button
                onClick={() => deleteMap(id)}
                style={{ padding: '5px 15px', background: '#eee', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
              >
                削除
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ---- 6. Main App ----
export default function App() {
  const isMobile = useIsMobile();
  const [view, setView] = useState('list');
  const [mapId, setMapId] = useState(null);
  const [mapName, setMapName] = useState('');
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selected, setSelected] = useState(null);
  const [history, setHistory] = useState([]);
  const [showPicker, setShowPicker] = useState(false);

  // --- New state ---
  // collapsedNodes: Set of node IDs whose children are hidden
  const [collapsedNodes, setCollapsedNodes] = useState(new Set());
  // bottomSheet: node shown in bottom sheet (mobile context menu), or null
  const [bottomSheet, setBottomSheet] = useState(null);
  // showSearch: toggle search bar
  const [showSearch, setShowSearch] = useState(false);
  // searchQuery: current search text
  const [searchQuery, setSearchQuery] = useState('');

  const isSavingRef = useRef(false);
  // Long-press timer ref for mobile
  const longPressTimer = useRef(null);

  const pushHistory = useCallback((n, e) => {
    if (isSavingRef.current) return;
    isSavingRef.current = true;
    setHistory(prev => [
      ...prev.slice(-20),
      { n: JSON.parse(JSON.stringify(n)), e: JSON.parse(JSON.stringify(e)) }
    ]);
    setTimeout(() => { isSavingRef.current = false; }, 100);
  }, []);

  const undo = useCallback(() => {
    if (history.length < 2) return;
    setHistory(prev => {
      const next = [...prev];
      next.pop();
      const prevState = next[next.length - 1];
      if (prevState) { setNodes(prevState.n); setEdges(prevState.e); }
      return next;
    });
  }, [history, setNodes, setEdges]);

  const updateLabel = useCallback((id, label) => {
    setNodes((nds) => {
      const nextNodes = nds.map((n) =>
        n.id === id ? { ...n, data: { ...n.data, label } } : n
      );
      pushHistory(nextNodes, edges);
      return nextNodes;
    });
  }, [setNodes, edges, pushHistory]);

  // ---- Collapse logic ----
  // Get all descendant IDs for a given node
  const getDescendants = useCallback((nodeId, edgeList) => {
    const children = edgeList.filter(e => e.source === nodeId).map(e => e.target);
    return children.reduce((acc, cid) => [...acc, cid, ...getDescendants(cid, edgeList)], []);
  }, []);

  const toggleCollapse = useCallback((nodeId) => {
    setCollapsedNodes(prev => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  }, []);

  // Compute which nodes should be hidden due to collapsed ancestors
  const hiddenNodeIds = useMemo(() => {
    const hidden = new Set();
    collapsedNodes.forEach(collapsedId => {
      getDescendants(collapsedId, edges).forEach(id => hidden.add(id));
    });
    return hidden;
  }, [collapsedNodes, edges, getDescendants]);

  // ---- Search logic ----
  const handleSearch = useCallback((query) => {
    setSearchQuery(query);
  }, []);

  // ---- Node types with all new features ----
  const nodeTypes = useMemo(() => ({
    custom: (props) => {
      const hasChildren = edges.some(e => e.source === props.id);
      const isCollapsed = collapsedNodes.has(props.id);
      const isHighlighted = searchQuery.trim() !== '' &&
        props.data.label.toLowerCase().includes(searchQuery.toLowerCase());

      return (
        <CustomNode
          {...props}
          data={{ ...props.data, searchHighlight: isHighlighted }}
          onLabelChange={updateLabel}
          hasLeft={edges.some(e => e.target === props.id)}
          hasRight={hasChildren}
          hasChildren={hasChildren}
          isCollapsed={isCollapsed}
          onToggleCollapse={toggleCollapse}
        />
      );
    }
  }), [edges, updateLabel, collapsedNodes, toggleCollapse, searchQuery]);

  // Apply hidden state to nodes
  const displayNodes = useMemo(() => {
    return nodes.map(n => ({
      ...n,
      hidden: hiddenNodeIds.has(n.id),
    }));
  }, [nodes, hiddenNodeIds]);

  // Apply hidden state to edges (hide edges connected to hidden nodes)
  const displayEdges = useMemo(() => {
    return edges.map(e => ({
      ...e,
      hidden: hiddenNodeIds.has(e.source) || hiddenNodeIds.has(e.target),
    }));
  }, [edges, hiddenNodeIds]);

  const addNodeFromParent = useCallback((parentNode) => {
    if (!parentNode) return;
    pushHistory(nodes, edges);
    const id = uuidv4();
    const siblingCount = nodes.filter(n => n.position.x === parentNode.position.x + 240).length;
    const newNode = {
      id,
      type: 'custom',
      position: { x: parentNode.position.x + 240, y: parentNode.position.y + (siblingCount * 60) },
      data: { label: '新規項目', color: parentNode.data.color }
    };
    const nextNodes = [...nodes, newNode];
    const nextEdges = [...edges, { id: uuidv4(), source: parentNode.id, target: id }];
    setNodes(nextNodes);
    setEdges(nextEdges);
    pushHistory(nextNodes, nextEdges);
    // Auto-expand if parent was collapsed
    if (collapsedNodes.has(parentNode.id)) {
      setCollapsedNodes(prev => {
        const next = new Set(prev);
        next.delete(parentNode.id);
        return next;
      });
    }
  }, [nodes, edges, setNodes, setEdges, pushHistory, collapsedNodes]);

  const addNode = useCallback(() => {
    if (!selected) return;
    addNodeFromParent(selected);
  }, [selected, addNodeFromParent]);

  const deleteNodeById = useCallback((nodeId) => {
    if (!nodeId) return;
    pushHistory(nodes, edges);
    const getChildren = (id) =>
      edges.filter(e => e.source === id).reduce((acc, e) => [...acc, e.target, ...getChildren(e.target)], []);
    const targets = [nodeId, ...getChildren(nodeId)];
    setNodes(nds => nds.filter(n => !targets.includes(n.id)));
    setEdges(eds => eds.filter(e => !targets.includes(e.source) && !targets.includes(e.target)));
    setCollapsedNodes(prev => {
      const next = new Set(prev);
      targets.forEach(id => next.delete(id));
      return next;
    });
    setSelected(null);
    setBottomSheet(null);
  }, [nodes, edges, setNodes, setEdges, pushHistory]);

  const deleteNode = useCallback(() => {
    if (!selected) return;
    deleteNodeById(selected.id);
  }, [selected, deleteNodeById]);

  // Mobile: use browser prompt for label editing
  const editSelectedNode = useCallback((node) => {
    const target = node || selected;
    if (!target) return;
    const newLabel = window.prompt('ノード名を入力', target.data.label);
    if (newLabel !== null) updateLabel(target.id, newLabel);
    setBottomSheet(null);
  }, [selected, updateLabel]);

  // Mobile: update progress on a node
  const updateProgress = useCallback((nodeId, progress) => {
    setNodes((nds) => {
      const nextNodes = nds.map((n) =>
        n.id === nodeId ? { ...n, data: { ...n.data, progress } } : n
      );
      pushHistory(nextNodes, edges);
      return nextNodes;
    });
    // Update bottomSheet node data too
    setBottomSheet(prev => prev && prev.id === nodeId
      ? { ...prev, data: { ...prev.data, progress } }
      : prev
    );
  }, [setNodes, edges, pushHistory]);

  // Mobile: long-press handler
  const handleNodeTouchStart = useCallback((e, node) => {
    if (!isMobile) return;
    longPressTimer.current = setTimeout(() => {
      setSelected(node);
      setBottomSheet(node);
    }, 500);
  }, [isMobile]);

  const handleNodeTouchEnd = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  // Keyboard shortcuts (desktop)
  useEffect(() => {
    const down = (e) => {
      if (view !== 'edit') return;
      if (e.key === 'Tab') { e.preventDefault(); addNode(); }
      if ((e.key === 'Delete' || e.key === 'Backspace') && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') deleteNode();
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); undo(); }
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') { e.preventDefault(); setShowSearch(v => !v); }
    };
    window.addEventListener('keydown', down);
    return () => window.removeEventListener('keydown', down);
  }, [view, addNode, deleteNode, undo]);

  // Auto-save (include collapsedNodes as array for localStorage)
  useEffect(() => {
    if (view === 'edit' && mapId) {
      const saved = JSON.parse(localStorage.getItem('mindmaps') || '{}');
      saved[mapId] = {
        ...saved[mapId],
        nodes,
        edges,
        collapsedNodes: [...collapsedNodes],
      };
      localStorage.setItem('mindmaps', JSON.stringify(saved));
    }
  }, [nodes, edges, mapId, view, collapsedNodes]);

  // Close picker when node is deselected
  useEffect(() => {
    if (!selected) setShowPicker(false);
  }, [selected]);

  const backToList = useCallback(() => {
    setView('list');
    setSelected(null);
    setShowPicker(false);
    setHistory([]);
    setCollapsedNodes(new Set());
    setBottomSheet(null);
    setShowSearch(false);
    setSearchQuery('');
  }, []);

  if (view === 'list') {
    return (
      <MapListView
        onSelect={(id) => {
          const d = JSON.parse(localStorage.getItem('mindmaps'))[id];
          setNodes(d.nodes);
          setEdges(d.edges);
          setMapId(id);
          setMapName(d.name);
          setView('edit');
          setHistory([{ n: d.nodes, e: d.edges }]);
          // Restore collapsed state
          setCollapsedNodes(new Set(d.collapsedNodes || []));
        }}
        onCreate={() => {
          const id = uuidv4();
          const name = '新しいマップ';
          const init = {
            name,
            nodes: [{ id: '1', type: 'custom', position: { x: 100, y: 100 }, data: { label: '中心', color: '#333' } }],
            edges: [],
            collapsedNodes: [],
          };
          const saved = JSON.parse(localStorage.getItem('mindmaps') || '{}');
          saved[id] = init;
          localStorage.setItem('mindmaps', JSON.stringify(saved));
          setNodes(init.nodes);
          setEdges(init.edges);
          setMapId(id);
          setMapName(name);
          setView('edit');
          setCollapsedNodes(new Set());
        }}
      />
    );
  }

  return (
    <div className="editor-root">
      {/* Map title — center top */}
      <div className="map-title-chip">{mapName}</div>

      {/* Search bar */}
      {showSearch && (
        <SearchBar
          onSearch={handleSearch}
          onClose={() => { setShowSearch(false); setSearchQuery(''); }}
        />
      )}

      {/* Toolbar: top-left on desktop, bottom bar on mobile (via CSS) */}
      <div className="editor-toolbar">
        <button onClick={backToList} className="toolbar-btn">
          ←<span className="btn-shortcut"> 一覧</span>
        </button>

        <button onClick={addNode} disabled={!selected} className="toolbar-btn">
          <IoIosAddCircleOutline size={16} />
          追加<span className="btn-shortcut"> (Tab)</span>
        </button>

        {isMobile && (
          <button onClick={() => editSelectedNode(selected)} disabled={!selected} className="toolbar-btn">
            ✏️ 編集
          </button>
        )}

        <button onClick={deleteNode} disabled={!selected} className="toolbar-btn">
          🗑️ 削除<span className="btn-shortcut"> (Del)</span>
        </button>

        <button onClick={undo} disabled={history.length < 2} className="toolbar-btn">
          ↩️ 戻す<span className="btn-shortcut"> (Ctrl+Z)</span>
        </button>

        <button
          onClick={() => setShowPicker(v => !v)}
          disabled={!selected}
          className="toolbar-btn"
          style={showPicker && selected ? { background: '#e8f0fe', color: '#1a73e8' } : {}}
        >
          🎨 色<span className="btn-shortcut">変更</span>
        </button>

        <button
          onClick={() => setShowSearch(v => !v)}
          className="toolbar-btn"
          style={showSearch ? { background: '#e8f0fe', color: '#1a73e8' } : {}}
        >
          🔍<span className="btn-shortcut"> 検索</span>
        </button>
      </div>

      <ReactFlow
        nodes={displayNodes}
        edges={displayEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={(p) => setEdges(eds => addEdge(p, eds))}
        nodeTypes={nodeTypes}
        onNodeClick={(_, n) => {
          setSelected(n);
          // On mobile: single tap selects, long press opens bottom sheet
        }}
        onPaneClick={() => { setSelected(null); setBottomSheet(null); }}
        onNodeMouseEnter={undefined}
        onNodeContextMenu={(e, n) => {
          // Desktop right-click: could show context menu, skip for now
          e.preventDefault();
        }}
        // Mobile long press via touch events on the wrapper
        onNodeTouchStart={isMobile ? (e, n) => handleNodeTouchStart(e, n) : undefined}
        onNodeTouchEnd={isMobile ? handleNodeTouchEnd : undefined}
        fitView
        fitViewOptions={{ maxZoom: 1 }}
      >
        <Background />
        <Controls />
        <MiniMap />
      </ReactFlow>

      {showPicker && (
        <ColorPicker
          selectedNode={selected}
          onColorChange={(c) => {
            pushHistory(nodes, edges);
            setNodes(nds => nds.map(n =>
              n.id === selected.id ? { ...n, data: { ...n.data, color: c } } : n
            ));
          }}
        />
      )}

      {/* Bottom Sheet (mobile context menu) */}
      {isMobile && bottomSheet && (
        <BottomSheet
          node={bottomSheet}
          isCollapsed={collapsedNodes.has(bottomSheet.id)}
          hasChildren={edges.some(e => e.source === bottomSheet.id)}
          onClose={() => setBottomSheet(null)}
          onEdit={() => editSelectedNode(bottomSheet)}
          onDelete={() => deleteNodeById(bottomSheet.id)}
          onAddChild={() => {
            setSelected(bottomSheet);
            addNodeFromParent(bottomSheet);
            setBottomSheet(null);
          }}
          onToggleCollapse={() => {
            toggleCollapse(bottomSheet.id);
            setBottomSheet(null);
          }}
          onColorChange={(c) => {
            pushHistory(nodes, edges);
            setNodes(nds => nds.map(n =>
              n.id === bottomSheet.id ? { ...n, data: { ...n.data, color: c } } : n
            ));
            setBottomSheet(prev => prev ? { ...prev, data: { ...prev.data, color: c } } : prev);
          }}
          onProgressChange={(p) => updateProgress(bottomSheet.id, p)}
        />
      )}
    </div>
  );
}
