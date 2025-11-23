import { db, ChecklistDB, FormResponseDB, FieldResponseDB, FormularioDB } from './index';

// ==================== CHECKLISTS ====================

export const saveChecklistLocal = async (
  checklist: Omit<ChecklistDB, 'id' | 'lastModified' | 'createdAt'>
): Promise<number> => {
  const now = Date.now();
  console.log("INICIO saveChecklistLocal");
  const id = await db.checklists.add({
    ...checklist,
    lastModified: now,
    createdAt: now,
  });
  return id;
};

export const updateChecklistLocal = async (
  id: number,
  updates: Partial<ChecklistDB>
): Promise<void> => {
  await db.checklists.update(id, {
    ...updates,
    lastModified: Date.now(),
  });
};

export const getChecklistById = async (id: number): Promise<ChecklistDB | undefined> => {
  return await db.checklists.get(id);
};

export const getChecklistByServerId = async (serverId: number): Promise<ChecklistDB | undefined> => {
  return await db.checklists.where('serverId').equals(serverId).first();
};

export const getAllChecklists = async (): Promise<ChecklistDB[]> => {
  return await db.checklists.orderBy('lastModified').reverse().toArray();
};

export const getUnsyncedChecklists = async (): Promise<ChecklistDB[]> => {
  return await db.checklists
    .where('syncStatus')
    .anyOf(['local_only', 'error'])
    .toArray();
};

export const deleteChecklistLocal = async (id: number): Promise<void> => {
  await db.checklists.delete(id);
};

// ==================== FORM RESPONSES ====================

export const createFormResponse = async (
  checklistId: number,
  serverChecklistId?: number,
  serverResponseId?: number,
  formularioId?: number
): Promise<number> => {
  const now = Date.now();
  console.log("INICIO createFormResponse");
  console.log("serverResponseId: ", serverResponseId);
  console.log("formularioId: ", formularioId);
  const id = await db.formResponses.add({
    checklistId,
    serverChecklistId,
    serverResponseId,
    formularioId,
    formValues: {},
    isComplete: false,
    syncStatus: 'local_only',
    lastModified: now,
    createdAt: now,
  });
  return id;
};

export const updateFormResponse = async (
  id: number,
  updates: Partial<FormResponseDB>
): Promise<void> => {
  await db.formResponses.update(id, {
    ...updates,
    lastModified: Date.now(),
  });
};

export const getFormResponseById = async (id: number): Promise<FormResponseDB | undefined> => {
  return await db.formResponses.get(id);
};

export const getFormResponsesByChecklistId = async (
  checklistId: number
): Promise<FormResponseDB[]> => {
  return await db.formResponses.where('checklistId').equals(checklistId).toArray();
};

export const getFormResponseByServerResponseId = async (
  serverResponseId: number
): Promise<FormResponseDB | undefined> => {
  return await db.formResponses.where('serverResponseId').equals(serverResponseId).first();
};

export const getUnsyncedFormResponses = async (): Promise<FormResponseDB[]> => {
  return await db.formResponses
    .where('syncStatus')
    .anyOf(['local_only', 'error'])
    .toArray();
};

// ==================== FIELD RESPONSES ====================

export const saveFieldResponse = async (
  responseId: number,
  fieldId: number,
  valor: any,
  serverFieldId?: number,
  serverResponseId?: number
): Promise<number> => {
  const now = Date.now();
  console.log("INICIO saveFieldResponse");
  console.log("serverResponseId: ", serverResponseId);
  console.log("responseId: ", responseId);
  // Busca todas as respostas de campo para esse responseId
  // e filtra manualmente por fieldId (sem usar índice composto)
  const allFieldsForResponse = await db.fieldResponses
    .where('responseId')
    .equals(responseId)
    .toArray();
  const existing = allFieldsForResponse.find(f => f.fieldId === fieldId);

  if (existing) {
    // Atualiza existente
    await db.fieldResponses.update(existing.id!, {
      valor,
      syncStatus: 'local_only',
      lastModified: now,
    });
    return existing.id!;
  } else {
    // Cria novo
    const id = await db.fieldResponses.add({
      responseId,
      fieldId,
      serverFieldId,
      serverResponseId,
      valor,
      syncStatus: 'local_only',
      lastModified: now,
      createdAt: now,
    });
    return id;
  }
};

export const getFieldResponsesByResponseId = async (
  responseId: number
): Promise<FieldResponseDB[]> => {
  return await db.fieldResponses.where('responseId').equals(responseId).toArray();
};

export const getFieldResponse = async (
  responseId: number,
  fieldId: number
): Promise<FieldResponseDB | undefined> => {
  const allFieldsForResponse = await db.fieldResponses
    .where('responseId')
    .equals(responseId)
    .toArray();

  return allFieldsForResponse.find(f => f.fieldId === fieldId);
};

export const updateFieldResponseSyncStatus = async (
  id: number,
  syncStatus: FieldResponseDB['syncStatus'],
  serverFieldResponseId?: number
): Promise<void> => {
  const updates: Partial<FieldResponseDB> = {
    syncStatus,
    lastModified: Date.now(),
  };

  if (serverFieldResponseId) {
    updates.serverResponseId = serverFieldResponseId;
  }

  await db.fieldResponses.update(id, updates);
};

export const getUnsyncedFieldResponses = async (): Promise<FieldResponseDB[]> => {
  return await db.fieldResponses
    .where('syncStatus')
    .anyOf(['local_only', 'error'])
    .toArray();
};

// ==================== UTILITY FUNCTIONS ====================

export const getFormDataWithFields = async (responseId: number) => {
  const response = await getFormResponseById(responseId);
  if (!response) return null;

  const fields = await getFieldResponsesByResponseId(responseId);

  return {
    response,
    fields,
    formValues: fields.reduce((acc, field) => {
      acc[field.fieldId] = field.valor;
      return acc;
    }, {} as Record<number, any>),
  };
};

export const deleteFormResponseAndFields = async (responseId: number): Promise<void> => {
  // Deleta todos os campos primeiro
  const fields = await getFieldResponsesByResponseId(responseId);
  await Promise.all(fields.map(f => db.fieldResponses.delete(f.id!)));

  // Deleta a resposta
  await db.formResponses.delete(responseId);
};

export const deleteFieldResponse = async (id: number): Promise<void> => {
  await db.fieldResponses.delete(id);
};

// Deleta um checklist do cache local
export const deleteChecklistFromCache = async (serverId: number): Promise<void> => {
  const checklist = await getChecklistByServerId(serverId);
  if (checklist && checklist.id) {
    await db.checklists.delete(checklist.id);
  }
};

// ==================== FORMULARIOS (CACHE OFFLINE) ====================

export const saveFormularioLocal = async (
  formulario: Omit<FormularioDB, 'id' | 'lastModified'>
): Promise<number> => {
  const now = Date.now();

  // Verifica se já existe
  const existing = await db.formularios.where('serverId').equals(formulario.serverId).first();
  if (existing) {
    await db.formularios.update(existing.id!, {
      ...formulario,
      lastModified: now,
    });
    return existing.id!;
  }

  const id = await db.formularios.add({
    ...formulario,
    lastModified: now,
  });
  return id;
};

export const getAllFormularios = async (): Promise<FormularioDB[]> => {
  const formularios = await db.formularios.toArray();
  return formularios.sort((a, b) => a.nome.localeCompare(b.nome));
};

export const getFormularioByServerId = async (serverId: number): Promise<FormularioDB | undefined> => {
  return await db.formularios.where('serverId').equals(serverId).first();
};

export const clearFormulariosCache = async (): Promise<void> => {
  await db.formularios.clear();
};
