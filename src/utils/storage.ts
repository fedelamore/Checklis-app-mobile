    import { Checklist } from '@/types/checklist';

    const CHECKLISTS_KEY = 'checklists';
    const USER_KEY = 'current_user';

    export const storage = {
      getChecklists: (): Checklist[] => {
        const data = localStorage.getItem(CHECKLISTS_KEY);
        return data ? JSON.parse(data) : [];
      },

      saveChecklist: (checklist: Checklist): void => {
        const checklists = storage.getChecklists();
        checklists.push(checklist);
        localStorage.setItem(CHECKLISTS_KEY, JSON.stringify(checklists));
      },

      updateChecklist: (id: string, updatedChecklist: Checklist): void => {
        const checklists = storage.getChecklists();
        const index = checklists.findIndex(c => c.id === id);
        if (index !== -1) {
          checklists[index] = updatedChecklist;
          localStorage.setItem(CHECKLISTS_KEY, JSON.stringify(checklists));
        }
      },

      overwriteChecklists: (all: any[]) => {
        localStorage.setItem('checklists', JSON.stringify(all ?? []));
      },

      deleteChecklist: (id: string): void => {
        const checklists = storage.getChecklists();
        const filtered = checklists.filter(c => c.id !== id);
        localStorage.setItem(CHECKLISTS_KEY, JSON.stringify(filtered));
      },

      setUser: (user: { email: string }): void => {
        localStorage.setItem(USER_KEY, JSON.stringify(user));
      },

      getUser: () => {
        const data = localStorage.getItem(USER_KEY);
        return data ? JSON.parse(data) : null;
      },

      clearUser: (): void => {
        localStorage.removeItem(USER_KEY);
      },

      // Limpa checklists antigos do localStorage (migrando para IndexedDB)
      clearChecklists: (): void => {
        localStorage.removeItem(CHECKLISTS_KEY);
      }

    };
