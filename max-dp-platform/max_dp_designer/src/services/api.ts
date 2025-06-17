import axios, { AxiosInstance, AxiosResponse, AxiosError } from 'axios';

// API 응답 타입 정의
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

// 토큰 타입 정의
export interface TokenPair {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

// 로그인 요청 타입
export interface LoginRequest {
  email: string;
  password: string;
}

class ApiService {
  private axiosInstance: AxiosInstance;
  private authAxiosInstance: AxiosInstance;
  private isRefreshing = false;
  private failedQueue: Array<{
    resolve: (value: any) => void;
    reject: (error: any) => void;
  }> = [];

  constructor() {
    // 일반 API용 (8001번 포트)
    this.axiosInstance = axios.create({
      baseURL: 'http://localhost:8001',
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // 인증 API용 (8000번 포트)
    this.authAxiosInstance = axios.create({
      baseURL: 'http://localhost:8000',
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
    // 요청 인터셉터 - Access Token 자동 추가 (일반 API용)
    this.axiosInstance.interceptors.request.use(
      (config) => {
        const accessToken = localStorage.getItem('access_token');
        if (accessToken) {
          config.headers.Authorization = `Bearer ${accessToken}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // 요청 인터셉터 - Access Token 자동 추가 (인증 API용)
    this.authAxiosInstance.interceptors.request.use(
      (config) => {
        const accessToken = localStorage.getItem('access_token');
        if (accessToken) {
          config.headers.Authorization = `Bearer ${accessToken}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // 응답 인터셉터 - 토큰 갱신 처리
    this.axiosInstance.interceptors.response.use(
      (response: AxiosResponse) => response,
      async (error: AxiosError) => {
        const originalRequest = error.config as any;

        if (error.response?.status === 401 && !originalRequest._retry) {
          if (this.isRefreshing) {
            return new Promise((resolve, reject) => {
              this.failedQueue.push({ resolve, reject });
            }).then((token) => {
              originalRequest.headers.Authorization = `Bearer ${token}`;
              return this.axiosInstance(originalRequest);
            }).catch((err) => {
              return Promise.reject(err);
            });
          }

          originalRequest._retry = true;
          this.isRefreshing = true;

          try {
            const refreshToken = localStorage.getItem('refresh_token');
            if (!refreshToken) {
              throw new Error('No refresh token available');
            }

            const response = await this.refreshAccessToken(refreshToken);
            const { access_token } = response.data;

            localStorage.setItem('access_token', access_token);
            this.axiosInstance.defaults.headers.common.Authorization = `Bearer ${access_token}`;
            this.authAxiosInstance.defaults.headers.common.Authorization = `Bearer ${access_token}`;

            this.processQueue(null, access_token);
            return this.axiosInstance(originalRequest);
          } catch (refreshError: any) {
            console.warn('Token refresh failed:', refreshError.response?.data?.detail || refreshError.message);
            this.processQueue(refreshError, null);
            this.clearTokens();
            
            // 토큰 갱신 실패 시 로그인 페이지로 리디렉션하지 않고 현재 페이지에서 재로그인 유도
            if (window.location.pathname !== '/login') {
              window.location.href = '/login';
            }
            return Promise.reject(refreshError);
          } finally {
            this.isRefreshing = false;
          }
        }

        return Promise.reject(error);
      }
    );
  }

  private processQueue(error: any, token: string | null = null) {
    this.failedQueue.forEach(({ resolve, reject }) => {
      if (error) {
        reject(error);
      } else {
        resolve(token);
      }
    });

    this.failedQueue = [];
  }

  private async refreshAccessToken(refreshToken: string): Promise<AxiosResponse<TokenPair>> {
    return this.authAxiosInstance.post('/api/auth/refresh', {
      refresh_token: refreshToken,
    });
  }

  private clearTokens() {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    delete this.axiosInstance.defaults.headers.common.Authorization;
    delete this.authAxiosInstance.defaults.headers.common.Authorization;
  }

  // 로그인
  async login(credentials: LoginRequest): Promise<ApiResponse<TokenPair>> {
    try {
      const response = await this.authAxiosInstance.post('/api/auth/login', {
        email: credentials.email,
        password: credentials.password,
      });

      return {
        success: true,
        data: response.data,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.detail || error.message || '로그인에 실패했습니다.',
      };
    }
  }

  // 로그아웃
  async logout(): Promise<void> {
    try {
      await this.authAxiosInstance.post('/api/auth/logout');
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      this.clearTokens();
    }
  }

  // 사용자 정보 조회
  async getCurrentUser(): Promise<ApiResponse<any>> {
    try {
      const response = await this.authAxiosInstance.get('/api/auth/me');
      return {
        success: true,
        data: response.data,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.detail || error.message,
      };
    }
  }

  // 워크스페이스 관련 API
  async getWorkspaces(): Promise<ApiResponse<any[]>> {
    try {
      const response = await this.axiosInstance.get('/api/v1/maxdp/workspaces');
      return {
        success: true,
        data: response.data,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.detail || error.message,
      };
    }
  }

  async createWorkspace(workspace: { name: string; description?: string }): Promise<ApiResponse<any>> {
    try {
      const response = await this.axiosInstance.post('/api/v1/maxdp/workspaces', workspace);
      return {
        success: true,
        data: response.data,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.detail || error.message,
      };
    }
  }

  // Flow 관련 API
  async getFlows(workspaceId: string): Promise<ApiResponse<any[]>> {
    try {
      const response = await this.axiosInstance.get('/api/v1/maxdp/flows', {
        params: { workspace_id: workspaceId },
      });
      return {
        success: true,
        data: response.data,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.detail || error.message,
      };
    }
  }

  async createFlow(flow: { name: string; workspace_id: string; description?: string }): Promise<ApiResponse<any>> {
    try {
      const response = await this.axiosInstance.post('/api/v1/maxdp/flows', flow);
      return {
        success: true,
        data: response.data,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.detail || error.message,
      };
    }
  }

  async getFlow(flowId: string): Promise<ApiResponse<any>> {
    try {
      const response = await this.axiosInstance.get(`/api/v1/maxdp/flows/${flowId}`);
      return {
        success: true,
        data: response.data,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.detail || error.message,
      };
    }
  }

  async saveFlowVersion(flowId: string, flowJson: any): Promise<ApiResponse<any>> {
    try {
      const response = await this.axiosInstance.post(`/api/v1/maxdp/flows/${flowId}/versions`, {
        flow_json: flowJson,
      });
      return {
        success: true,
        data: response.data,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.detail || error.message,
      };
    }
  }

  // 실행 관련 API
  async executeFlow(endpoint: string, params: any): Promise<ApiResponse<any>> {
    try {
      const response = await this.axiosInstance.post(`/execute/${endpoint}`, params);
      return {
        success: true,
        data: response.data,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.detail || error.message,
      };
    }
  }

  // Raw axios instance 접근 (필요시)
  getAxiosInstance(): AxiosInstance {
    return this.axiosInstance;
  }
}

// 싱글톤 인스턴스 생성 및 export
export const apiService = new ApiService();
export default apiService; 