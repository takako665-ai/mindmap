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
import { v4 as uuidv4 } from 'uuid';
import { IoIosAddCircleOutline } from "react-icons/io";
import { IoIosTrash, IoIosUndo, IoIosColorPalette, IoIosHome, IoIosShare } from "react-icons/io";

/**
 * 【超重要】エラーの強制停止
 * 画面を埋め尽くしている ResizeObserver エラーをブラウザが検知する前に握りつぶします。
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
      const overlay = document.querySelector('iframe'); // エラー画面を消す
      if (overlay) overlay.style.display = 'none';
    }
  });
}


// --- デザインの設定（ここを追加） ---
const toolbarStyle = {
  position: 'fixed',
  top: '20px',
  right: '20px', // 右上に配置
  display: 'flex',
  gap: '10px',
  padding: '10px',
  background: 'rgba(255, 255, 255, 0.8)', // ガラス風の半透明
  backdropFilter: 'blur(8px)',
  borderRadius: '12px',
  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
  border: '1px solid rgba(255, 255, 255, 0.4)',
  zIndex: 1000,
};

const buttonStyle = {
  padding: '8px 16px',
  borderRadius: '8px',
  border: 'none',
  background: '#fff',
  color: '#444',
  fontWeight: 'bold',
  fontSize: '13px',
  cursor: 'pointer',
  transition: 'all 0.2s ease',
  boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
  display: 'inline-flex',   // 横並びにする
  alignItems: 'center',     // アイコンと文字の「中心」を揃える
  justifyContent: 'center', // 中身を中央に寄せる
  gap: '8px',               // アイコンと文字の間の隙間
  lineHeight: '1',          // 文字の余計な上下余白を消す
};

// --- 1. カラーピッカー ---
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
    <div style={{ position: 'fixed', bottom: '20px', left: '50%', transform: 'translateX(-50%)', background: 'white', border: '1px solid #ccc', borderRadius: '30px', padding: '10px 20px', boxShadow: '0 4px 15px rgba(0,0,0,0.2)', zIndex: 1000, display: 'flex', gap: '10px' }}>
      {colors.map((c) => (
        <div key={c.value} onClick={() => onColorChange(c.value)} style={{ width: '25px', height: '25px', borderRadius: '50%', background: c.value, cursor: 'pointer', border: selectedNode.data.color === c.value ? '3px solid #000' : '2px solid #eee' }} />
      ))}
    </div>
  );
};

// --- 2. カスタムノード (memo化で再レンダリングを防止) ---
const CustomNode = React.memo(({ id, data, hasLeft, hasRight, onLabelChange }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [text, setText] = useState(data.label);
  const inputRef = useRef(null);

  useEffect(() => { if (isEditing) inputRef.current?.focus(); }, [isEditing]);

  const save = () => { onLabelChange(id, text); setIsEditing(false); };

  return (
    <div style={{ padding: '10px 15px', border: `2px solid ${data.color || '#333'}`, borderRadius: '8px', background: 'white', minWidth: '100px', textAlign: 'center' }} onDoubleClick={() => setIsEditing(true)}>
      <Handle type="target" position={Position.Left} style={{ opacity: hasLeft ? 1 : 0.2 }} />
      {isEditing ? (
        // ★ input を textarea に変更し、Enterで保存されないようにする
        <textarea
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={save}
          // Enter単体では改行させたいので、save() の条件を Shift+Enter に変更
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

// --- 3. 一覧画面 ---
const MapListView = ({ onSelect, onCreate }) => {
  const [maps, setMaps] = useState({});
  useEffect(() => {
    const saved = localStorage.getItem('mindmaps');
    if (saved) setMaps(JSON.parse(saved));
  }, []);

  const exportAll = () => {
    const blob = new Blob([JSON.stringify(maps)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'mindmaps_backup.json'; a.click();
  };

  return (
    <div style={{ padding: '40px', maxWidth: '800px', margin: '0 auto', fontFamily: 'sans-serif' }}>
      <h1>🧠 MindMap List</h1>
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        <button onClick={onCreate} style={{ padding: '10px 20px', background: '#28a745', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>＋ 新規作成</button>
        <button onClick={exportAll} style={{ ...buttonStyle, background: '#007bff', color: 'white' }}><IoIosShare size={20} style={{ transform: 'translateY(-1.5px)', marginRight: '-5px' }} /> バックアップ</button>
      </div>
      <div style={{ display: 'grid', gap: '10px' }}>
        {Object.entries(maps).map(([id, m]) => (
          <div key={id} style={{ border: '1px solid #ddd', padding: '15px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>{m.name}</span>
            <div style={{ display: 'flex', gap: '5px' }}>
              <button onClick={() => onSelect(id)} style={{ padding: '5px 15px', background: '#007bff', color: 'white', border: 'none', borderRadius: '4px' }}>開く</button>
              <button onClick={() => { if (window.confirm('消去しますか？')) { const n = { ...maps }; delete n[id]; setMaps(n); localStorage.setItem('mindmaps', JSON.stringify(n)); } }} style={{ padding: '5px 15px', background: '#eee', border: 'none', borderRadius: '4px' }}>削除</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// --- 4. メイン ---
export default function App() {
  const [view, setView] = useState('list');
  const [mapId, setMapId] = useState(null);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selected, setSelected] = useState(null);
  const [history, setHistory] = useState([]);
  const [showPicker, setShowPicker] = useState(false);

  // Appコンポーネントの先頭あたりに追加
  const isSavingRef = useRef(false);

  const pushHistory = useCallback((n, e) => {
    // すでに保存処理中の場合は、連続保存をブロックする
    if (isSavingRef.current) return;

    isSavingRef.current = true;

    setHistory(prev => {
      const nextHistory = [
        ...prev.slice(-20),
        { n: JSON.parse(JSON.stringify(n)), e: JSON.parse(JSON.stringify(e)) }
      ];
      return nextHistory;
    });

    // 数ミリ秒後にロックを解除（連続実行を物理的に防ぐ）
    setTimeout(() => {
      isSavingRef.current = false;
    }, 100);
  }, []);

  const undo = useCallback(() => {
    // 履歴が少ない場合は何もしない
    if (history.length < 2) return;

    setHistory(prev => {
      const newHistory = [...prev];
      // 一番最後（現在の状態）を捨てる
      newHistory.pop();

      // その一つ前の状態を取り出して適用する
      const prevState = newHistory[newHistory.length - 1];
      if (prevState) {
        setNodes(prevState.n);
        setEdges(prevState.e);
      }

      return newHistory;
    });
  }, [history, setNodes, setEdges]);

  const updateLabel = useCallback((id, label) => {
    setNodes((nds) => {
      const nextNodes = nds.map((n) =>
        n.id === id ? { ...n, data: { ...n.data, label } } : n
      );

      // 文字が確定したタイミングで現在の状態を履歴に保存
      // これにより、文字変更後でも Ctrl+Z で戻せるようになります
      pushHistory(nextNodes, edges);

      return nextNodes;
    });
  }, [setNodes, edges, pushHistory]);

  const nodeTypes = useMemo(() => ({
    custom: (props) => <CustomNode {...props} onLabelChange={updateLabel} hasLeft={edges.some(e => e.target === props.id)} hasRight={edges.some(e => e.source === props.id)} />
  }), [edges, updateLabel]);

  // ノード追加/削除
  const addNode = useCallback(() => {
    if (!selected) return;

    // 1. まず現在の状態を保存（ノードを作る前の状態）
    pushHistory(nodes, edges);

    const id = uuidv4();
    const siblingCount = nodes.filter(n => n.position.x === selected.position.x + 240).length;
    const newNode = {
      id,
      type: 'custom',
      position: { x: selected.position.x + 240, y: selected.position.y+ (siblingCount * 60) },
      data: { label: '新規項目', color: selected.data.color }
    };

    const nextNodes = [...nodes, newNode];
    const nextEdges = [...edges, { id: uuidv4(), source: selected.id, target: id }];

    // 2. ノードを追加し終えた状態も履歴に保存（これが文字編集からの戻り先になる）
    setNodes(nextNodes);
    setEdges(nextEdges);
    pushHistory(nextNodes, nextEdges);

  }, [selected, nodes, edges, setNodes, setEdges, pushHistory]);

  const deleteNode = useCallback(() => {
    if (!selected) return;
    pushHistory(nodes, edges);
    const getChildren = (id) => edges.filter(e => e.source === id).reduce((acc, e) => [...acc, e.target, ...getChildren(e.target)], []);
    const targets = [selected.id, ...getChildren(selected.id)];
    setNodes(nds => nds.filter(n => !targets.includes(n.id)));
    setEdges(eds => eds.filter(e => !targets.includes(e.source) && !targets.includes(e.target)));
    setSelected(null);
  }, [selected, nodes, edges, setNodes, setEdges, pushHistory]);

  // ショートカット
  useEffect(() => {
    const down = (e) => {
      if (view !== 'edit') return;
      if (e.key === 'Tab') { e.preventDefault(); addNode(); }
      if ((e.key === 'Delete' || e.key === 'Backspace') && e.target.tagName !== 'INPUT') deleteNode();
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); undo(); }
    };
    window.addEventListener('keydown', down);
    return () => window.removeEventListener('keydown', down);
  }, [view, addNode, deleteNode, undo]);

  // 自動保存
  useEffect(() => {
    if (view === 'edit' && mapId) {
      const saved = JSON.parse(localStorage.getItem('mindmaps') || '{}');
      saved[mapId] = { ...saved[mapId], nodes, edges };
      localStorage.setItem('mindmaps', JSON.stringify(saved));
    }
  }, [nodes, edges, mapId, view]);

  if (view === 'list') return <MapListView onSelect={(id) => {
    const d = JSON.parse(localStorage.getItem('mindmaps'))[id];
    setNodes(d.nodes); setEdges(d.edges); setMapId(id); setView('edit');
    setHistory([{ n: d.nodes, e: d.edges }]);
  }} onCreate={() => {
    const id = uuidv4();
    const init = { name: '新しいマップ', nodes: [{ id: '1', type: 'custom', position: { x: 100, y: 100 }, data: { label: '中心', color: '#333' } }], edges: [] };
    const saved = JSON.parse(localStorage.getItem('mindmaps') || '{}');
    saved[id] = init; localStorage.setItem('mindmaps', JSON.stringify(saved));
    setNodes(init.nodes); setEdges(init.edges); setMapId(id); setView('edit');
  }} />;

  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <div style={{ position: 'absolute', top: 20, left: 20, zIndex: 10, display: 'flex', gap: '8px' }}>
        <button onClick={addNode} style={buttonStyle}>
          <IoIosAddCircleOutline size={20} /> 追加 (Tab)
        </button>

        <button onClick={deleteNode} style={buttonStyle}>
          🗑️ 削除 (Del)
        </button>

        <button onClick={undo} style={buttonStyle} disabled={history.length < 2}>
          ↩️ 戻す (Ctrl+Z)
        </button>

        <button onClick={() => setShowPicker(!showPicker)} style={buttonStyle}>
          🎨 色変更
        </button>
      </div>
      <ReactFlow nodes={nodes} edges={edges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={(p) => setEdges(eds => addEdge(p, eds))} nodeTypes={nodeTypes} onNodeClick={(_, n) => setSelected(n)} onPaneClick={() => setSelected(null)}
        fitView // 最初の1回だけ
        fitViewOptions={{ maxZoom: 1 }}
      >
        <Background /><Controls /><MiniMap />
      </ReactFlow>
      <ColorPicker selectedNode={selected} onColorChange={(c) => { pushHistory(nodes, edges); setNodes(nds => nds.map(n => n.id === selected.id ? { ...n, data: { ...n.data, color: c } } : n)); }} />
    </div>
  );
}