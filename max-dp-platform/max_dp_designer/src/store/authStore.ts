import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { apiService, type LoginRequest, type TokenPair } from '@/services/api';

// 사용자 정보 타입
export interface User {
  id: string;
  username: string;
  email?: string;
  created_at?: string;
  is_active?: boolean;
}

// 인증 상태 타입
interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isLoading: boolean;
  error: string | null;
}

// 인증 액션 타입
interface AuthActions {
  login: (credentials: LoginRequest) => Promise<boolean>;
  logout: () => Promise<void>;
  setTokens: (tokens: TokenPair) => void;
  clearError: () => void;
  initializeAuth: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

// 인증 스토어 타입
type AuthStore = AuthState & AuthActions;

// 초기 상태
const initialState: AuthState = {
  isAuthenticated: false,
  user: null,
  accessToken: null,
  refreshToken: null,
  isLoading: false,
  error: null,
};

// Zustand 스토어 생성
export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      // 로그인 액션
      login: async (credentials: LoginRequest): Promise<boolean> => {
        set({ isLoading: true, error: null });

        try {
          const response = await apiService.login(credentials);

          if (response.success && response.data) {
            const { access_token, refresh_token, token_type } = response.data;

            // 토큰 저장
            localStorage.setItem('access_token', access_token);
            localStorage.setItem('refresh_token', refresh_token);

            set({
              isAuthenticated: true,
              accessToken: access_token,
              refreshToken: refresh_token,
              isLoading: false,
              error: null,
            });

            // 사용자 정보 가져오기
            await get().refreshUser();

            return true;
          } else {
            set({
              isLoading: false,
              error: response.error || '로그인에 실패했습니다.',
            });
            return false;
          }
        } catch (error: any) {
          set({
            isLoading: false,
            error: error.message || '로그인 중 오류가 발생했습니다.',
          });
          return false;
        }
      },

      // 로그아웃 액션
      logout: async (): Promise<void> => {
        set({ isLoading: true });

        try {
          await apiService.logout();
        } catch (error) {
          console.error('Logout error:', error);
        } finally {
          // 로컬 상태 초기화
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');

          set({
            ...initialState,
            isLoading: false,
          });
        }
      },

      // 토큰 설정 액션
      setTokens: (tokens: TokenPair): void => {
        const { access_token, refresh_token } = tokens;

        localStorage.setItem('access_token', access_token);
        localStorage.setItem('refresh_token', refresh_token);

        set({
          isAuthenticated: true,
          accessToken: access_token,
          refreshToken: refresh_token,
        });
      },

      // 에러 초기화
      clearError: (): void => {
        set({ error: null });
      },

      // 인증 상태 초기화
      initializeAuth: async (): Promise<void> => {
        const accessToken = localStorage.getItem('access_token');
        const refreshToken = localStorage.getItem('refresh_token');

        if (accessToken && refreshToken) {
          set({
            isAuthenticated: true,
            accessToken,
            refreshToken,
          });

          // 사용자 정보 가져오기
          await get().refreshUser();
        } else {
          set({ isAuthenticated: false });
        }
      },

      // 사용자 정보 갱신
      refreshUser: async (): Promise<void> => {
        try {
          const response = await apiService.getCurrentUser();

          if (response.success && response.data) {
            set({ user: response.data });
          } else {
            console.error('Failed to fetch user info:', response.error);
            // 사용자 정보를 가져올 수 없으면 로그아웃 처리
            await get().logout();
          }
        } catch (error) {
          console.error('Error fetching user info:', error);
          await get().logout();
        }
      },
    }),
    {
      name: 'auth-storage',
      // 토큰은 localStorage에 별도 저장하므로 persist에서 제외
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

// 편의를 위한 인증 상태 선택자
export const useAuth = () => {
  const store = useAuthStore();
  return {
    isAuthenticated: store.isAuthenticated,
    user: store.user,
    isLoading: store.isLoading,
    error: store.error,
    login: store.login,
    logout: store.logout,
    clearError: store.clearError,
    initializeAuth: store.initializeAuth,
  };
};

// 인증된 사용자만을 위한 선택자
export const useAuthenticatedUser = () => {
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  if (!isAuthenticated || !user) {
    throw new Error('User is not authenticated');
  }

  return user;
};

export default useAuthStore; 