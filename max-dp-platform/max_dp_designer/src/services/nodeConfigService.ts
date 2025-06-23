/**
 * 노드 설정 서비스
 * CLAUDE.local.md 가이드라인에 따른 노드 설정 저장/불러오기 서비스
 */

import { NodeConfig, NodeType } from '@/components/NodeConfig/types';
import { apiService } from './api';

// 노드 설정 템플릿 인터페이스
export interface NodeConfigTemplate {
  id: string;
  name: string;
  description?: string;
  nodeType: NodeType;
  config: NodeConfig;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  tags?: string[];
}

// 노드 설정 버전 인터페이스
export interface NodeConfigVersion {
  id: string;
  nodeId: string;
  version: number;
  config: NodeConfig;
  createdAt: string;
  createdBy: string;
  comment?: string;
}

// 로컬 스토리지 키
const STORAGE_KEYS = {
  NODE_CONFIGS: 'maxdp_node_configs',
  CONFIG_TEMPLATES: 'maxdp_config_templates',
  CONFIG_VERSIONS: 'maxdp_config_versions',
  RECENT_CONFIGS: 'maxdp_recent_configs',
};

class NodeConfigService {
  // 노드 설정 저장 (로컬)
  saveNodeConfig(nodeId: string, nodeType: NodeType, config: NodeConfig): void {
    try {
      const configs = this.getLocalNodeConfigs();
      configs[nodeId] = {
        nodeType,
        config,
        updatedAt: new Date().toISOString(),
      };
      
      localStorage.setItem(STORAGE_KEYS.NODE_CONFIGS, JSON.stringify(configs));
      
      // 최근 설정에 추가
      this.addToRecentConfigs(nodeId, nodeType, config);
    } catch (error) {
      console.error('Failed to save node config:', error);
      throw new Error('노드 설정 저장에 실패했습니다.');
    }
  }

  // 노드 설정 불러오기 (로컬)
  loadNodeConfig(nodeId: string): { nodeType: NodeType; config: NodeConfig } | null {
    try {
      const configs = this.getLocalNodeConfigs();
      return configs[nodeId] || null;
    } catch (error) {
      console.error('Failed to load node config:', error);
      return null;
    }
  }

  // 모든 노드 설정 불러오기 (로컬)
  private getLocalNodeConfigs(): Record<string, any> {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.NODE_CONFIGS);
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  }

  // 최근 설정에 추가
  private addToRecentConfigs(nodeId: string, nodeType: NodeType, config: NodeConfig): void {
    try {
      const recentConfigs = this.getRecentConfigs();
      const newEntry = {
        nodeId,
        nodeType,
        config,
        usedAt: new Date().toISOString(),
      };

      // 중복 제거 및 최신 순으로 정렬
      const filtered = recentConfigs.filter(c => c.nodeId !== nodeId);
      const updated = [newEntry, ...filtered].slice(0, 10); // 최근 10개만 유지

      localStorage.setItem(STORAGE_KEYS.RECENT_CONFIGS, JSON.stringify(updated));
    } catch (error) {
      console.error('Failed to update recent configs:', error);
    }
  }

  // 최근 설정 목록 불러오기
  getRecentConfigs(): Array<{
    nodeId: string;
    nodeType: NodeType;
    config: NodeConfig;
    usedAt: string;
  }> {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.RECENT_CONFIGS);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  // 설정 템플릿 저장
  async saveConfigTemplate(template: Omit<NodeConfigTemplate, 'id' | 'createdAt' | 'updatedAt'>): Promise<NodeConfigTemplate> {
    try {
      // 서버에 저장
      const response = await apiService.post('/node-config-templates', template);
      
      // 로컬 캐시 업데이트
      const templates = await this.getConfigTemplates();
      templates.push(response.data);
      localStorage.setItem(STORAGE_KEYS.CONFIG_TEMPLATES, JSON.stringify(templates));
      
      return response.data;
    } catch (error) {
      // 오프라인 모드: 로컬에만 저장
      const localTemplate: NodeConfigTemplate = {
        ...template,
        id: `local_${Date.now()}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      
      const templates = this.getLocalConfigTemplates();
      templates.push(localTemplate);
      localStorage.setItem(STORAGE_KEYS.CONFIG_TEMPLATES, JSON.stringify(templates));
      
      return localTemplate;
    }
  }

  // 설정 템플릿 목록 불러오기
  async getConfigTemplates(nodeType?: NodeType): Promise<NodeConfigTemplate[]> {
    try {
      // 서버에서 불러오기
      const params = nodeType ? { nodeType } : {};
      const response = await apiService.get('/node-config-templates', { params });
      
      // 로컬 캐시 업데이트
      localStorage.setItem(STORAGE_KEYS.CONFIG_TEMPLATES, JSON.stringify(response.data));
      
      return response.data;
    } catch (error) {
      // 오프라인 모드: 로컬에서 불러오기
      const templates = this.getLocalConfigTemplates();
      return nodeType 
        ? templates.filter(t => t.nodeType === nodeType)
        : templates;
    }
  }

  // 로컬 설정 템플릿 불러오기
  private getLocalConfigTemplates(): NodeConfigTemplate[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.CONFIG_TEMPLATES);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  // 설정 템플릿 삭제
  async deleteConfigTemplate(templateId: string): Promise<void> {
    try {
      // 서버에서 삭제
      await apiService.delete(`/node-config-templates/${templateId}`);
      
      // 로컬 캐시 업데이트
      const templates = await this.getConfigTemplates();
      const filtered = templates.filter(t => t.id !== templateId);
      localStorage.setItem(STORAGE_KEYS.CONFIG_TEMPLATES, JSON.stringify(filtered));
    } catch (error) {
      // 오프라인 모드: 로컬에서만 삭제
      const templates = this.getLocalConfigTemplates();
      const filtered = templates.filter(t => t.id !== templateId);
      localStorage.setItem(STORAGE_KEYS.CONFIG_TEMPLATES, JSON.stringify(filtered));
    }
  }

  // 설정 버전 저장
  saveConfigVersion(nodeId: string, config: NodeConfig, comment?: string): void {
    try {
      const versions = this.getConfigVersions(nodeId);
      const newVersion: NodeConfigVersion = {
        id: `version_${Date.now()}`,
        nodeId,
        version: versions.length + 1,
        config,
        createdAt: new Date().toISOString(),
        createdBy: 'current_user', // TODO: 실제 사용자 정보로 교체
        comment,
      };

      versions.push(newVersion);
      
      // 버전 관리 (최대 10개 유지)
      const allVersions = this.getAllConfigVersions();
      allVersions[nodeId] = versions.slice(-10);
      
      localStorage.setItem(STORAGE_KEYS.CONFIG_VERSIONS, JSON.stringify(allVersions));
    } catch (error) {
      console.error('Failed to save config version:', error);
      throw new Error('설정 버전 저장에 실패했습니다.');
    }
  }

  // 설정 버전 목록 불러오기
  getConfigVersions(nodeId: string): NodeConfigVersion[] {
    try {
      const allVersions = this.getAllConfigVersions();
      return allVersions[nodeId] || [];
    } catch {
      return [];
    }
  }

  // 모든 설정 버전 불러오기
  private getAllConfigVersions(): Record<string, NodeConfigVersion[]> {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.CONFIG_VERSIONS);
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  }

  // 특정 버전으로 복원
  restoreConfigVersion(nodeId: string, versionId: string): NodeConfig | null {
    try {
      const versions = this.getConfigVersions(nodeId);
      const version = versions.find(v => v.id === versionId);
      return version ? version.config : null;
    } catch (error) {
      console.error('Failed to restore config version:', error);
      return null;
    }
  }

  // 설정 내보내기 (JSON)
  exportConfig(nodeId: string, nodeType: NodeType, config: NodeConfig): void {
    try {
      const exportData = {
        nodeId,
        nodeType,
        config,
        exportedAt: new Date().toISOString(),
        version: '1.0',
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: 'application/json',
      });
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `node_config_${nodeType}_${nodeId}_${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export config:', error);
      throw new Error('설정 내보내기에 실패했습니다.');
    }
  }

  // 설정 가져오기 (JSON)
  async importConfig(file: File): Promise<{
    nodeId: string;
    nodeType: NodeType;
    config: NodeConfig;
  }> {
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      
      // 데이터 검증
      if (!data.nodeType || !data.config) {
        throw new Error('올바르지 않은 설정 파일입니다.');
      }

      return {
        nodeId: data.nodeId || `imported_${Date.now()}`,
        nodeType: data.nodeType,
        config: data.config,
      };
    } catch (error) {
      console.error('Failed to import config:', error);
      throw new Error('설정 가져오기에 실패했습니다. 파일 형식을 확인해주세요.');
    }
  }

  // 설정 초기화
  clearNodeConfig(nodeId: string): void {
    try {
      const configs = this.getLocalNodeConfigs();
      delete configs[nodeId];
      localStorage.setItem(STORAGE_KEYS.NODE_CONFIGS, JSON.stringify(configs));
    } catch (error) {
      console.error('Failed to clear node config:', error);
    }
  }

  // 모든 로컬 데이터 초기화
  clearAllLocalData(): void {
    try {
      Object.values(STORAGE_KEYS).forEach(key => {
        localStorage.removeItem(key);
      });
    } catch (error) {
      console.error('Failed to clear all local data:', error);
    }
  }
}

export const nodeConfigService = new NodeConfigService();