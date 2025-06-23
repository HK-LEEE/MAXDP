import { create } from 'zustand';
import { apiService } from '@/services/api';

// 워크스페이스 타입
export interface Workspace {
  id: string;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
  owner_id: string;
}

// Flow 타입
export interface Flow {
  id: string;
  name: string;
  description?: string;
  workspace_id: string;
  flow_json?: any;
  created_at: string;
  updated_at: string;
  latest_version_id?: string;
}

// 워크스페이스 상태 타입
interface WorkspaceState {
  workspaces: Workspace[];
  selectedWorkspace: Workspace | null;
  flows: Flow[];
  selectedFlow: Flow | null;
  isLoading: boolean;
  error: string | null;
}

// 워크스페이스 액션 타입
interface WorkspaceActions {
  fetchWorkspaces: () => Promise<void>;
  createWorkspace: (workspace: { name: string; description?: string }) => Promise<boolean>;
  selectWorkspace: (workspace: Workspace | null) => void;
  fetchFlows: (workspaceId: string) => Promise<void>;
  createFlow: (flow: { name: string; workspace_id: string; description?: string }) => Promise<Flow | null>;
  selectFlow: (flow: Flow | null) => void;
  getFlow: (flowId: string) => Promise<Flow | null>;
  getFlowDefinition: (flowId: string, version?: number) => Promise<any>;
  saveFlowVersion: (flowId: string, flowJson: any) => Promise<boolean>;
  saveDraftFlowVersion: (flowId: string, flowJson: any) => Promise<boolean>;
  getDraftFlowVersion: (flowId: string) => Promise<any>;
  clearError: () => void;
  reset: () => void;
}

// 워크스페이스 스토어 타입
type WorkspaceStore = WorkspaceState & WorkspaceActions;

// 초기 상태
const initialState: WorkspaceState = {
  workspaces: [],
  selectedWorkspace: null,
  flows: [],
  selectedFlow: null,
  isLoading: false,
  error: null,
};

// Zustand 스토어 생성
export const useWorkspaceStore = create<WorkspaceStore>((set, get) => ({
  ...initialState,

  // 워크스페이스 목록 조회
  fetchWorkspaces: async () => {
    set({ isLoading: true, error: null });

    try {
      const response = await apiService.getWorkspaces();

      if (response.success && response.data) {
        set({
          workspaces: response.data,
          isLoading: false,
        });
      } else {
        set({
          error: response.error || '워크스페이스 목록을 가져오는데 실패했습니다.',
          isLoading: false,
        });
      }
    } catch (error: any) {
      set({
        error: error.message || '워크스페이스 목록 조회 중 오류가 발생했습니다.',
        isLoading: false,
      });
    }
  },

  // 워크스페이스 생성
  createWorkspace: async (workspace) => {
    set({ isLoading: true, error: null });

    try {
      const response = await apiService.createWorkspace(workspace);

      if (response.success && response.data) {
        // 목록에 새 워크스페이스 추가
        set((state) => ({
          workspaces: [...state.workspaces, response.data],
          isLoading: false,
        }));
        return true;
      } else {
        set({
          error: response.error || '워크스페이스 생성에 실패했습니다.',
          isLoading: false,
        });
        return false;
      }
    } catch (error: any) {
      set({
        error: error.message || '워크스페이스 생성 중 오류가 발생했습니다.',
        isLoading: false,
      });
      return false;
    }
  },

  // 워크스페이스 선택
  selectWorkspace: (workspace) => {
    set({
      selectedWorkspace: workspace,
      flows: [], // 워크스페이스가 변경되면 Flow 목록 초기화
      selectedFlow: null,
    });
  },

  // Flow 목록 조회
  fetchFlows: async (workspaceId) => {
    set({ isLoading: true, error: null });

    try {
      const response = await apiService.getFlows(workspaceId);

      if (response.success && response.data) {
        // Ensure flows is always an array
        const flowsArray = Array.isArray(response.data) ? response.data : [];
        set({
          flows: flowsArray,
          isLoading: false,
        });
      } else {
        set({
          error: response.error || 'Flow 목록을 가져오는데 실패했습니다.',
          isLoading: false,
        });
      }
    } catch (error: any) {
      set({
        error: error.message || 'Flow 목록 조회 중 오류가 발생했습니다.',
        isLoading: false,
      });
    }
  },

  // Flow 생성
  createFlow: async (flow) => {
    set({ isLoading: true, error: null });

    try {
      const response = await apiService.createFlow(flow);

      if (response.success && response.data) {
        // 목록에 새 Flow 추가 - flows가 배열인지 확인
        set((state) => ({
          flows: Array.isArray(state.flows) ? [...state.flows, response.data] : [response.data],
          isLoading: false,
        }));
        return response.data;
      } else {
        set({
          error: response.error || 'Flow 생성에 실패했습니다.',
          isLoading: false,
        });
        return null;
      }
    } catch (error: any) {
      set({
        error: error.message || 'Flow 생성 중 오류가 발생했습니다.',
        isLoading: false,
      });
      return null;
    }
  },

  // Flow 선택
  selectFlow: (flow) => {
    set({ selectedFlow: flow });
  },

  // 특정 Flow 조회
  getFlow: async (flowId) => {
    set({ isLoading: true, error: null });

    try {
      const response = await apiService.getFlow(flowId);

      if (response.success && response.data) {
        set({ isLoading: false });
        return response.data;
      } else {
        set({
          error: response.error || 'Flow 정보를 가져오는데 실패했습니다.',
          isLoading: false,
        });
        return null;
      }
    } catch (error: any) {
      set({
        error: error.message || 'Flow 조회 중 오류가 발생했습니다.',
        isLoading: false,
      });
      return null;
    }
  },

  // Flow 정의 조회
  getFlowDefinition: async (flowId, version) => {
    set({ isLoading: true, error: null });

    try {
      const response = await apiService.getFlowDefinition(flowId, version);

      if (response.success && response.data) {
        set({ isLoading: false });
        return response.data;
      } else {
        set({
          error: response.error || 'Flow 정의를 가져오는데 실패했습니다.',
          isLoading: false,
        });
        return null;
      }
    } catch (error: any) {
      set({
        error: error.message || 'Flow 정의 조회 중 오류가 발생했습니다.',
        isLoading: false,
      });
      return null;
    }
  },

  // Flow 버전 저장
  saveFlowVersion: async (flowId, flowJson) => {
    set({ isLoading: true, error: null });

    try {
      const response = await apiService.saveFlowVersion(flowId, flowJson);

      if (response.success) {
        set({ isLoading: false });
        return true;
      } else {
        set({
          error: response.error || 'Flow 저장에 실패했습니다.',
          isLoading: false,
        });
        return false;
      }
    } catch (error: any) {
      set({
        error: error.message || 'Flow 저장 중 오류가 발생했습니다.',
        isLoading: false,
      });
      return false;
    }
  },

  // Flow 임시 저장 (Draft)
  saveDraftFlowVersion: async (flowId, flowJson) => {
    try {
      const response = await apiService.saveDraftFlowVersion(flowId, flowJson);
      return response.success;
    } catch (error: any) {
      console.error('Draft save failed:', error);
      return false;
    }
  },

  // Flow 임시 저장 버전 조회
  getDraftFlowVersion: async (flowId) => {
    try {
      const response = await apiService.getDraftFlowVersion(flowId);
      if (response.success && response.data) {
        return response.data;
      }
      return null;
    } catch (error: any) {
      console.error('Draft load failed:', error);
      return null;
    }
  },

  // 에러 초기화
  clearError: () => {
    set({ error: null });
  },

  // 상태 초기화
  reset: () => {
    set(initialState);
  },
}));

// 편의를 위한 선택자들
export const useWorkspaces = () => {
  const store = useWorkspaceStore();
  return {
    workspaces: store.workspaces,
    selectedWorkspace: store.selectedWorkspace,
    isLoading: store.isLoading,
    error: store.error,
    fetchWorkspaces: store.fetchWorkspaces,
    createWorkspace: store.createWorkspace,
    selectWorkspace: store.selectWorkspace,
    clearError: store.clearError,
  };
};

export const useFlows = () => {
  const store = useWorkspaceStore();
  return {
    flows: Array.isArray(store.flows) ? store.flows : [],
    selectedFlow: store.selectedFlow,
    isLoading: store.isLoading,
    error: store.error,
    fetchFlows: store.fetchFlows,
    createFlow: store.createFlow,
    selectFlow: store.selectFlow,
    getFlow: store.getFlow,
    getFlowDefinition: store.getFlowDefinition,
    saveFlowVersion: store.saveFlowVersion,
    saveDraftFlowVersion: store.saveDraftFlowVersion,
    getDraftFlowVersion: store.getDraftFlowVersion,
    clearError: store.clearError,
  };
};

export default useWorkspaceStore; 