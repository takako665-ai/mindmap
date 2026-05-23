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
const CustomNode = React.memo(({ id, data, hasLeft, hasRight, onLabelChange }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [text, setText] = useState(data.label);
  const inputRef = useRef(null);

  useEffect(() => { if (isEditing) inputRef.current?.focus(); }, [isEditing]);

  // Sync label when changed externally (e.g. mobile prompt edit)
  useEffect(() => { if (!isEditing) setText(data.label); }, [data.label, isEditing]);

  const save = () => { onLabelChange(id, text); setIsEditing(false); };

  return (
    <div
      style={{
        padding: '10px 15px',
        border: `2px solid ${data.color || '#333'}`,
        borderRadius: '8px',
        background: 'white',
        minWidth: '100px',
        textAlign: 'center',
      }}
      onDoubleClick={() => setIsEditing(true)}
    >
      <Handle type="target" position={Position.Left} style={{ opacity: hasLeft ? 1 : 0.2 }} />
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
    </div>
  );
});

// ---- 3. Map List View ----
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

// ---- 4. Main App ----
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

  const isSavingRef = useRef(false);

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

  const nodeTypes = useMemo(() => ({
    custom: (props) => (
      <CustomNode
        {...props}
        onLabelChange={updateLabel}
        hasLeft={edges.some(e => e.target === props.id)}
        hasRight={edges.some(e => e.source === props.id)}
      />
    )
  }), [edges, updateLabel]);

  const addNode = useCallback(() => {
    if (!selected) return;
    pushHistory(nodes, edges);
    const id = uuidv4();
    const siblingCount = nodes.filter(n => n.position.x === selected.position.x + 240).length;
    const newNode = {
      id,
      type: 'custom',
      position: { x: selected.position.x + 240, y: selected.position.y + (siblingCount * 60) },
      data: { label: '新規項目', color: selected.data.color }
    };
    const nextNodes = [...nodes, newNode];
    const nextEdges = [...edges, { id: uuidv4(), source: selected.id, target: id }];
    setNodes(nextNodes);
    setEdges(nextEdges);
    pushHistory(nextNodes, nextEdges);
  }, [selected, nodes, edges, setNodes, setEdges, pushHistory]);

  const deleteNode = useCallback(() => {
    if (!selected) return;
    pushHistory(nodes, edges);
    const getChildren = (id) =>
      edges.filter(e => e.source === id).reduce((acc, e) => [...acc, e.target, ...getChildren(e.target)], []);
    const targets = [selected.id, ...getChildren(selected.id)];
    setNodes(nds => nds.filter(n => !targets.includes(n.id)));
    setEdges(eds => eds.filter(e => !targets.includes(e.source) && !targets.includes(e.target)));
    setSelected(null);
  }, [selected, nodes, edges, setNodes, setEdges, pushHistory]);

  // Mobile: use browser prompt for label editing (avoids keyboard layout shift issues)
  const editSelectedNode = useCallback(() => {
    if (!selected) return;
    const newLabel = window.prompt('ノード名を入力', selected.data.label);
    if (newLabel !== null) updateLabel(selected.id, newLabel);
  }, [selected, updateLabel]);

  // Keyboard shortcuts (desktop)
  useEffect(() => {
    const down = (e) => {
      if (view !== 'edit') return;
      if (e.key === 'Tab') { e.preventDefault(); addNode(); }
      if ((e.key === 'Delete' || e.key === 'Backspace') && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') deleteNode();
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); undo(); }
    };
    window.addEventListener('keydown', down);
    return () => window.removeEventListener('keydown', down);
  }, [view, addNode, deleteNode, undo]);

  // Auto-save
  useEffect(() => {
    if (view === 'edit' && mapId) {
      const saved = JSON.parse(localStorage.getItem('mindmaps') || '{}');
      saved[mapId] = { ...saved[mapId], nodes, edges };
      localStorage.setItem('mindmaps', JSON.stringify(saved));
    }
  }, [nodes, edges, mapId, view]);

  // Close picker when node is deselected
  useEffect(() => {
    if (!selected) setShowPicker(false);
  }, [selected]);

  const backToList = useCallback(() => {
    setView('list');
    setSelected(null);
    setShowPicker(false);
    setHistory([]);
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
        }}
        onCreate={() => {
          const id = uuidv4();
          const name = '新しいマップ';
          const init = {
            name,
            nodes: [{ id: '1', type: 'custom', position: { x: 100, y: 100 }, data: { label: '中心', color: '#333' } }],
            edges: []
          };
          const saved = JSON.parse(localStorage.getItem('mindmaps') || '{}');
          saved[id] = init;
          localStorage.setItem('mindmaps', JSON.stringify(saved));
          setNodes(init.nodes);
          setEdges(init.edges);
          setMapId(id);
          setMapName(name);
          setView('edit');
        }}
      />
    );
  }

  return (
    <div className="editor-root">
      {/* Map title — center top */}
      <div className="map-title-chip">{mapName}</div>

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
          <button onClick={editSelectedNode} disabled={!selected} className="toolbar-btn">
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
      </div>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={(p) => setEdges(eds => addEdge(p, eds))}
        nodeTypes={nodeTypes}
        onNodeClick={(_, n) => setSelected(n)}
        onPaneClick={() => setSelected(null)}
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
    </div>
  );
}
