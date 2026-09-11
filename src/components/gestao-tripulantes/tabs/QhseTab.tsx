'use client';

import React from 'react';
import CollaboratorDocumentsCatalog from '@/components/admin/CollaboratorDocumentsCatalog';
import {
  COLLABORATOR_MODAL_TAB_FILL_CLASS,
  COLLABORATOR_MODAL_TABLE_SCROLL_CLASS,
} from '@/components/gestao-tripulantes/collaborator-modal-layout';

interface Props {
  colaboradorId: string;
}

/** Ficha AN-HSE-005, entregas EPI e listas QHSE. Occupational exams stay on the ASO tab. */
export default function QhseTab({ colaboradorId }: Props) {
  return (
    <div className={`${COLLABORATOR_MODAL_TAB_FILL_CLASS} p-6`}>
      <div className={COLLABORATOR_MODAL_TABLE_SCROLL_CLASS}>
        <CollaboratorDocumentsCatalog colaboradorId={colaboradorId} onlyQhse />
      </div>
    </div>
  );
}
