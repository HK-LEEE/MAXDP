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
      
      // Backend returns { flows: [...], total: 10, skip: 0, limit: 100 }
      // Extract the flows array from the response
      const flows = response.data.flows || [];
      
      return {
        success: true,
        data: flows,
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

  async getFlowDefinition(flowId: string, version?: number): Promise<ApiResponse<any>> {
    try {
      const params = version ? { version } : {};
      const response = await this.axiosInstance.get(`/api/v1/maxdp/flows/${flowId}/definition`, {
        params
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

  async saveFlowVersion(flowId: string, flowJson: any): Promise<ApiResponse<any>> {
    try {
      const response = await this.axiosInstance.post(`/api/v1/maxdp/flows/${flowId}/versions`, {
        flow_definition: flowJson,
        description: "Flow 저장",
        changelog: "Flow 업데이트"
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

  // 임시 저장 (Draft) 기능 - 브라우저 로컬 스토리지 활용
  async saveDraftFlowVersion(flowId: string, flowJson: any): Promise<ApiResponse<any>> {
    try {
      // 브라우저 로컬 스토리지에 임시 저장
      const draftKey = `flow_draft_${flowId}`;
      const draftData = {
        flow_definition: flowJson,
        saved_at: new Date().toISOString(),
        description: "임시 저장",
        is_draft: true
      };
      
      localStorage.setItem(draftKey, JSON.stringify(draftData));
      
      return {
        success: true,
        data: draftData,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || "임시 저장에 실패했습니다.",
      };
    }
  }

  async getDraftFlowVersion(flowId: string): Promise<ApiResponse<any>> {
    try {
      const draftKey = `flow_draft_${flowId}`;
      const draftData = localStorage.getItem(draftKey);
      
      if (draftData) {
        const parsedData = JSON.parse(draftData);
        
        // 24시간 이내의 데이터만 유효
        const savedTime = new Date(parsedData.saved_at).getTime();
        const now = new Date().getTime();
        const hoursDiff = (now - savedTime) / (1000 * 60 * 60);
        
        if (hoursDiff < 24) {
          return {
            success: true,
            data: parsedData,
          };
        } else {
          // 오래된 데이터 삭제
          localStorage.removeItem(draftKey);
        }
      }
      
      return {
        success: false,
        error: "임시 저장된 데이터가 없습니다.",
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || "임시 저장 데이터 로드에 실패했습니다.",
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

  // SelectColumns 노드 미리보기
  async previewSelectColumns(params: {
    nodeId: string;
    selectedColumns: string[];
    sourceData?: any[];
    sourceSchema?: any[];
    limit?: number;
  }): Promise<ApiResponse<any>> {
    try {
      const response = await this.axiosInstance.post('/api/v1/maxdp/nodes/select-columns/preview', {
        node_id: params.nodeId,
        selected_columns: params.selectedColumns,
        source_data: params.sourceData,
        source_schema: params.sourceSchema,
        limit: params.limit || 10
      });
      
      return {
        success: true,
        data: {
          rows: response.data.rows || [],
          columns: response.data.columns || [],
          total_rows: response.data.total_rows || 0,
          selected_columns: response.data.selected_columns || []
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.detail || error.message,
      };
    }
  }

  // 데이터베이스 연결 관련 API
  async getDatabaseConnections(): Promise<ApiResponse<any[]>> {
    try {
      // 데이터베이스 연결 테스트 및 정보 조회
      const response = await this.axiosInstance.get('/api/v1/maxdp/database/connection/test');
      
      // 응답을 배열 형태로 변환 (기존 프론트엔드 코드와 호환)
      const connectionData = [{
        id: 'default',
        name: response.data.database_name || 'Platform Database',
        type: 'postgresql',
        host: 'localhost',
        port: 5432,
        database: response.data.database_name,
        isActive: response.data.status === 'connected',
        version: response.data.version
      }];
      
      return {
        success: true,
        data: connectionData,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.detail || error.message,
      };
    }
  }

  async getDatabaseSchemas(connectionId: string): Promise<ApiResponse<string[]>> {
    try {
      const response = await this.axiosInstance.get('/api/v1/maxdp/database/schemas', {
        params: { include_system: false } // 시스템 스키마 제외
      });
      
      // 스키마 이름만 추출
      const schemaNames = response.data.map((schema: any) => schema.schema_name);
      
      return {
        success: true,
        data: schemaNames,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.detail || error.message,
      };
    }
  }

  async getDatabaseTables(connectionId: string, schema: string): Promise<ApiResponse<any[]>> {
    try {
      const response = await this.axiosInstance.get(`/api/v1/maxdp/database/schemas/${schema}/tables`);
      
      // 테이블 데이터를 프론트엔드 형식에 맞게 변환
      const tables = response.data.map((table: any) => {
        // 컬럼 데이터 변환: backend의 column_name, data_type을 frontend의 name, type으로 매핑
        const transformedColumns = (table.columns || []).map((column: any) => ({
          name: column.column_name || column.name || '',  // column_name이 없으면 name도 시도
          type: column.data_type || column.type || 'unknown',  // data_type이 없으면 type도 시도
          nullable: column.is_nullable !== undefined ? column.is_nullable : column.nullable,
          description: column.comment || column.description,
          defaultValue: column.default_value || column.defaultValue
        }));
        
        console.log('Table columns transformation:', {
          tableName: table.table_name,
          originalColumns: table.columns?.slice(0, 2), // 처음 2개만 로깅
          transformedColumns: transformedColumns?.slice(0, 2) // 처음 2개만 로깅
        });
        
        const transformedTable = {
          name: table.table_name,
          schema: table.schema_name,
          columns: transformedColumns,
          rowCount: table.estimated_rows || 0,
          description: table.table_comment || `${table.table_name} 테이블`,
          size: table.table_size,
          type: table.table_type
        };
        
        return transformedTable;
      });
      
      return {
        success: true,
        data: tables,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.detail || error.message,
      };
    }
  }

  async executeCustomSQL(params: {
    connectionId: string;
    sqlQuery: string;
    schema?: string;
    limit?: number;
  }): Promise<ApiResponse<any>> {
    try {
      const response = await this.axiosInstance.post('/api/v1/maxdp/database/execute-sql', {
        connection_id: params.connectionId,
        sql_query: params.sqlQuery,
        schema: params.schema || 'public',
        limit: params.limit || 100
      });
      
      return {
        success: true,
        data: {
          columns: response.data.columns || [],
          rows: response.data.rows || response.data.data || [],
          execution_time: response.data.execution_time,
          total_rows: response.data.total_rows,
          query: params.sqlQuery
        }
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.detail || error.message || 'SQL 실행 중 오류가 발생했습니다.'
      };
    }
  }

  async previewTableData(connectionId: string, params: {
    schema: string;
    tableName: string;
    limit?: number;
    whereClause?: string;
  }): Promise<ApiResponse<any>> {
    try {
      // 실제 데이터 미리보기 API 호출
      const response = await this.axiosInstance.post('/api/v1/maxdp/database/preview', {
        schema: params.schema,
        tableName: params.tableName,
        limit: params.limit || 10,
        whereClause: params.whereClause
      });
      
      return {
        success: true,
        data: {
          rows: response.data.data || [],
          total_rows: response.data.metadata?.total_rows || 0,
          columns: response.data.columns || [],
          metadata: response.data.metadata || {},
          schema: response.data.schema_name,
          table: response.data.table_name
        },
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