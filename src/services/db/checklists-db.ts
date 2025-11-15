import { db, ChecklistDB, FormResponseDB, FieldResponseDB } from './index';

// ==================== CHECKLISTS ====================

export const saveChecklistLocal = async (
  checklist: Omit<ChecklistDB, 'id' | 'lastModified' | 'createdAt'>
): Promise<number> => {
  const now = Date.now();
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
  serverResponseId?: number
): Promise<number> => {
  const now = Date.now();
  const id = await db.formResponses.add({
    checklistId,
    serverChecklistId,
    serverResponseId,
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

  // Busca todas as respostas de campo para esse responseId
  // e filtra manualmente por fieldId (sem usar índice composto)
  const allFieldsForResponse = await db.fieldResponses
    .where('responseId')
    .equals(responseId)
    .toArray();
  console.log("allFieldsForResponse: ", allFieldsForResponse)
  const existing = allFieldsForResponse.find(f => f.fieldId === fieldId);

  console.log("existing: ", existing)
  if (existing) {
    // Atualiza existente
    console.log("if")
    await db.fieldResponses.update(existing.id!, {
      valor,
      syncStatus: 'local_only',
      lastModified: now,
    });
    return existing.id!;
  } else {
    // Cria novo
    console.log("else")
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
