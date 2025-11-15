import React, { useCallback, useState } from 'react';
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

// カスタムノード　受け取った情報で表示制御
function CustomNode({ data, hasLeft, hasRight, id, onLabelChange }) {
  const [isEditing, setIsEditing] = React.useState(false);  // 編集モードかどうか
  const [label, setLabel] = React.useState(data.label);  // 編集中のテキスト
  const inputRef = React.useRef(null);  // 入力欄への参照

  // 編集開始時にフォーカス
  React.useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();  // 自動で入力欄にカーソルを移動
      inputRef.current.select();  // テキストを全選択
    }
  }, [isEditing]);

  // Enterキーで確定、Escキーでキャンセル
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onLabelChange(id, label);  // ラベルを更新
      setIsEditing(false);  // 編集モード終了
    } else if (e.key === 'Escape') {
      setLabel(data.label);  // 元に戻す
      setIsEditing(false);  // 編集モード終了
    }
  };

  // フォーカスが外れたら確定
  const handleBlur = () => {
    onLabelChange(id, label);   // ラベルを更新
    setIsEditing(false);  // 編集モード終了
  };

  return (
    <div 
      style={{
        padding: '10px 20px',
        border: '2px solid #333',
        borderRadius: '8px',
        background: 'white',
        minWidth: '100px'  // 最小幅を設定
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();  // ReactFlowのイベントを止める。子がクリックされたときに親が反応しないように対応
        setIsEditing(true);  // 編集モード開始
      }}
    >
      <Handle 
        type="target" 
        position={Position.Left} 
        id="item1"
        style={{ opacity: hasLeft ? 1 : 0 }}
      />
      <Handle 
        type="target" 
        position={Position.Right} 
        id="item2"
        style={{ opacity: hasRight ? 1 : 0 }}
      />
      
      {/* 編集モードか表示モードか切り替え */}
      {isEditing ? (
        <input
          ref={inputRef}
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}  // 入力に応じて更新
          onKeyDown={handleKeyDown}  // キーボード操作
          onBlur={handleBlur}  // フォーカスが外れたら確定
          style={{
            border: 'none',
            outline: 'none',
            background: 'transparent',
            fontSize: 'inherit',
            fontFamily: 'inherit',
            width: '100%',
            padding: 0
          }}
        />
      ) : (
        <div>{data.label}</div>  // 通常表示
      )}
      
      <Handle 
        type="source" 
        position={Position.Left} 
        id="item1"
        style={{ opacity: hasLeft ? 1 : 0 }}
      />
      <Handle 
        type="source" 
        position={Position.Right} 
        id="item2"
        style={{ opacity: hasRight ? 1 : 0 }}
      />
    </div>
  );
}

const nodeTypes = {
  custom: (props) => <CustomNode {...props} />
};

export default function App() {

  // 保存されたデータを読み込む（なければデフォルト値）
  const loadSavedMap = () => {
    const saved = localStorage.getItem('mindmap');  // 保存データを取得
    if (saved) {
      return JSON.parse(saved);  // 文字列→オブジェクトに変換
    }
    return null;  // 保存データがなければnull
  };

  const savedData = loadSavedMap();
  
  const initialNodes = savedData ? savedData.nodes : [
    { 
      id: '1', 
      type: 'custom',
      position: { x: 250, y: 0 }, 
      data: { label: 'CCNA マインドマップ' } 
    }
  ];
  
  const initialEdges = savedData ? savedData.edges : [];

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // ノードのラベルを更新する関数
  const updateNodeLabel = useCallback((nodeId, newLabel) => {
    setNodes((nds) =>
      nds.map((n) => 
        n.id === nodeId 
          ? { ...n, data: { label: newLabel } }  // 該当ノードのラベルを更新
          : n  // その他はそのまま
      )
    );
  }, [setNodes]);  // setNodesが変わったら再作成
  
  const customNodeTypes = React.useMemo(() => ({
    custom: (props) => {
      // このノードに左側の線が繋がっているか確認
      const hasLeftConnection = edges.some(e => 
        (e.source === props.id && e.sourceHandle === 'item1') || 
        (e.target === props.id && e.targetHandle === 'item1')
      );
      const hasRightConnection = edges.some(e => 
        (e.source === props.id && e.sourceHandle === 'item2') || 
        (e.target === props.id && e.targetHandle === 'item2')
      );
      // 確認結果をCustomNodeに渡す
      return <CustomNode {...props} 
        hasLeft={hasLeftConnection} 
        hasRight={hasRightConnection}
        onLabelChange={updateNodeLabel} 
       />;
    }
  }), [edges, updateNodeLabel] );

  const [selectedNode, setSelectedNode] = useState(null);

  const onConnect = useCallback(
    (params) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  // ノード追加
  const addNode = () => {
    if (!selectedNode) return alert('親ノードをクリックしてから追加してください');
    const childrenCount = edges.filter(e => e.source === selectedNode.id).length;
    const newNode = {
      id: uuidv4(),
      type: 'custom',
      position: {
        x: selectedNode.position.x + 250,
        y: selectedNode.position.y + (childrenCount * 100) 
      },
      data: { label: '新しいノード' }
    };
    setNodes((nds) => [...nds, newNode]);
    setEdges((eds) => [...eds, { 
      id: uuidv4(), 
      source: selectedNode.id, 
      target: newNode.id,
      sourceHandle: 'item2',
      targetHandle: 'item1'
    }]);
  };

  // ノード削除
  const deleteNode = () => {
    if (!selectedNode) return alert('削除したいノードを選択してください');
    const idsToDelete = getDescendants(selectedNode.id);
    setNodes((nds) => nds.filter((n) => !idsToDelete.includes(n.id)));
    setEdges((eds) => eds.filter((e) => !idsToDelete.includes(e.source) && !idsToDelete.includes(e.target)));
    setSelectedNode(null);
  };

  // 保存機能
  const saveMap = () => {
    const data = {
      nodes: nodes,  // 全てのノード情報
      edges: edges   // 全ての線情報
    };
    // ブラウザのlocalStorageに保存
    localStorage.setItem('mindmap', JSON.stringify(data));
    alert('保存しました！');
  };

  // ノード編集
  const editNode = () => {
    if (!selectedNode) return alert('編集したいノードを選択してください');
    const newLabel = prompt('新しいラベルを入力してください', selectedNode.data.label);
    if (!newLabel) return;
    setNodes((nds) =>
      nds.map((n) => (n.id === selectedNode.id ? { ...n, data: { label: newLabel } } : n))
    );
  };

  // 折りたたみ
  const toggleChildren = (nodeId) => {
    const childIds = getDescendants(nodeId);
    setNodes((nds) =>
      nds.map((n) =>
        childIds.includes(n.id) ? { ...n, hidden: !nds.find((x) => x.id === n.id)?.hidden } : n
      )
    );
  };

  // 子ノード取得
  const getDescendants = (parentId) => {
    const children = edges.filter((e) => e.source === parentId).map((e) => e.target);
    let all = [...children];
    children.forEach((childId) => {
      all = [...all, ...getDescendants(childId)];
    });
    return [parentId, ...all];
  };
  // キーボードイベント処理
  const handleKeyDown = useCallback((event) => {
    if (event.key === 'Tab') {
      event.preventDefault(); // ブラウザのデフォルト動作を防止
      if (selectedNode) {
        addNode(); // 右側にノードを追加
      }
    }
  }, [selectedNode]);

  // キーボードイベントリスナーを登録
  React.useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

  // 自動保存: nodesかedgesが変更されたら自動で保存
  React.useEffect(() => {
    const data = {
      nodes: nodes,  // 現在のノード情報
      edges: edges   // 現在の線情報
    };
    localStorage.setItem('mindmap', JSON.stringify(data));  // 保存
    console.log('自動保存しました');  // 確認用（開発中のみ）
  }, [nodes, edges]);  // nodesかedgesが変わったら実行

return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <div style={{ 
        position: 'absolute', 
        zIndex: 10, 
        left: 10, 
        top: 10,
        display: 'flex',
        flexWrap: 'wrap',
        gap: '5px'
      }}>
        <button 
          onClick={addNode}
          style={{
            padding: '12px 16px',
            fontSize: '16px',
            touchAction: 'manipulation'
          }}
        >
          ノードを追加
        </button>
        <button 
          onClick={editNode}
          style={{
            padding: '12px 16px',
            fontSize: '16px',
            touchAction: 'manipulation'
          }}
        >
          ✏️ 編集
        </button>
        <button 
          onClick={deleteNode}
          style={{
            padding: '12px 16px',
            fontSize: '16px',
            touchAction: 'manipulation'
          }}
        >
          🗑 削除
        </button>
        <button 
          onClick={saveMap}
          style={{
            padding: '12px 16px',
            fontSize: '16px',
            touchAction: 'manipulation'
          }}
        >
          💾 保存
        </button>
      </div>
      <ReactFlow
        nodes={nodes.filter((n) => !n.hidden)}
        edges={edges.filter(
          (e) => !nodes.find((n) => n.id === e.source)?.hidden && !nodes.find((n) => n.id === e.target)?.hidden
        )}
        nodeTypes={customNodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={(event, node) => {
          // シングルクリックで選択のみ
          setSelectedNode(node);
        }}
        fitView
      >
        <MiniMap />
        <Controls />
        <Background />
      </ReactFlow>
    </div>
  );
}