"use client";

import React, { useState } from 'react';

interface Props {
  canEdit: boolean;
  canDelete: boolean;
  onEdit: (newContent: string) => Promise<void>;
  onDelete: () => Promise<void>;
  content: string;
}

const CommentActions: React.FC<Props> = ({ canEdit, canDelete, onEdit, onDelete, content }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [text, setText] = useState(content);
  const [saving, setSaving] = useState(false);

  if (isEditing) {
    return (
      <div className="mt-2 flex items-center space-x-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="flex-1 px-2 py-1 border rounded text-sm"
        />
        <button
          disabled={saving}
          onClick={async () => { setSaving(true); await onEdit(text); setSaving(false); setIsEditing(false); }}
          className="text-sm text-blue-600"
        >Salvar</button>
        <button onClick={() => setIsEditing(false)} className="text-sm text-gray-500">Cancelar</button>
      </div>
    );
  }

  return (
    <div className="mt-1 flex items-center space-x-3 text-xs">
      {canEdit && (
        <button onClick={() => setIsEditing(true)} className="text-gray-500 hover:text-blue-600">Editar</button>
      )}
      {canDelete && (
        <button onClick={onDelete} className="text-gray-500 hover:text-red-600">Excluir</button>
      )}
    </div>
  );
};

export default CommentActions;

