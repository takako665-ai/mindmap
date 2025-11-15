import React from 'react';
import { Handle, Position } from 'reactflow';

export default function CustomNode({ data }) {
  return (
    <div
      style={{
        padding: 10,
        border: '2px solid #333',
        borderRadius: 8,
        background: '#fff',
        textAlign: 'center',
        minWidth: 120,
        position: 'relative'
      }}
    >
      <Handle type="target" position={Position.Left} style={{ background: '#555' }} />
      <div>{data.label}</div>
      <Handle type="source" position={Position.Right} style={{ background: '#555' }} />
    </div>
  );
}
