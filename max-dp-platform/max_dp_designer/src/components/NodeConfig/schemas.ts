/**
 * 노드 타입별 설정 스키마 정의
 * CLAUDE.local.md 가이드라인에 따른 타입 안전한 설정 스키마
 */

import { NodeConfigSchema, NodeType } from './types';

/**
 * Table Reader 노드 설정 스키마
 */
export const tableReaderSchema: NodeConfigSchema = {
  title: 'Table Reader 설정',
  description: '데이터베이스 테이블에서 데이터를 읽어옵니다',
  sections: [
    {
      title: '기본 설정',
      fields: [
        {
          key: 'label',
          label: '노드 이름',
          type: 'input',
          required: true,
          placeholder: '노드 이름을 입력하세요',
          tooltip: '플로우에서 표시될 노드의 이름입니다',
        },
        {
          key: 'description',
          label: '설명',
          type: 'textarea',
          placeholder: '노드에 대한 설명을 입력하세요',
        },
      ],
    },
    {
      title: '데이터베이스 연결',
      fields: [
        {
          key: 'connectionId',
          label: '데이터베이스 연결',
          type: 'select',
          required: true,
          placeholder: '데이터베이스 연결을 선택하세요',
          tooltip: '사용할 데이터베이스 연결을 선택합니다',
          options: [
            { value: 'default', label: '기본 연결', description: 'PostgreSQL 기본 연결' },
            { value: 'mysql_main', label: 'MySQL 메인 DB', description: 'MySQL 메인 데이터베이스' },
          ],
        },
        {
          key: 'schema',
          label: '스키마',
          type: 'input',
          placeholder: 'public',
          tooltip: '데이터베이스 스키마 이름 (선택사항)',
        },
      ],
    },
    {
      title: '테이블 설정',
      fields: [
        {
          key: 'tableName',
          label: '테이블 이름',
          type: 'input',
          required: true,
          placeholder: '테이블 이름을 입력하세요',
          tooltip: '읽어올 테이블의 이름입니다',
          validation: {
            pattern: /^[a-zA-Z][a-zA-Z0-9_]*$/,
            message: '테이블 이름은 영문자로 시작하고 영숫자와 언더스코어만 사용할 수 있습니다',
          },
        },
        {
          key: 'limit',
          label: '최대 행 수',
          type: 'number',
          placeholder: '제한 없음',
          tooltip: '읽어올 최대 행 수를 제한합니다 (0은 제한 없음)',
          validation: {
            min: 0,
            max: 1000000,
          },
        },
        {
          key: 'whereClause',
          label: 'WHERE 조건',
          type: 'textarea',
          placeholder: 'id > 100 AND status = \'active\'',
          tooltip: 'SQL WHERE 절 조건을 입력합니다 (WHERE 키워드 제외)',
        },
      ],
    },
  ],
};

/**
 * Custom SQL 노드 설정 스키마
 */
export const customSQLSchema: NodeConfigSchema = {
  title: 'Custom SQL 설정',
  description: '사용자 정의 SQL 쿼리를 실행합니다',
  sections: [
    {
      title: '기본 설정',
      fields: [
        {
          key: 'label',
          label: '노드 이름',
          type: 'input',
          required: true,
          placeholder: '노드 이름을 입력하세요',
        },
        {
          key: 'description',
          label: '설명',
          type: 'textarea',
          placeholder: '노드에 대한 설명을 입력하세요',
        },
      ],
    },
    {
      title: '데이터베이스 연결',
      fields: [
        {
          key: 'connectionId',
          label: '데이터베이스 연결',
          type: 'select',
          required: true,
          placeholder: '데이터베이스 연결을 선택하세요',
          options: [
            { value: 'default', label: '기본 연결', description: 'PostgreSQL 기본 연결' },
            { value: 'mysql_main', label: 'MySQL 메인 DB', description: 'MySQL 메인 데이터베이스' },
          ],
        },
      ],
    },
    {
      title: 'SQL 쿼리',
      fields: [
        {
          key: 'sqlQuery',
          label: 'SQL 쿼리',
          type: 'textarea',
          required: true,
          placeholder: 'SELECT * FROM table_name WHERE condition',
          tooltip: '실행할 SQL SELECT 쿼리를 입력합니다',
          validation: {
            pattern: /^\s*SELECT\s+/i,
            message: 'SELECT 쿼리만 허용됩니다',
          },
        },
      ],
    },
  ],
};

/**
 * File Input 노드 설정 스키마
 */
export const fileInputSchema: NodeConfigSchema = {
  title: 'File Input 설정',
  description: '파일에서 데이터를 읽어옵니다',
  sections: [
    {
      title: '기본 설정',
      fields: [
        {
          key: 'label',
          label: '노드 이름',
          type: 'input',
          required: true,
          placeholder: '노드 이름을 입력하세요',
        },
        {
          key: 'description',
          label: '설명',
          type: 'textarea',
          placeholder: '노드에 대한 설명을 입력하세요',
        },
      ],
    },
    {
      title: '파일 설정',
      fields: [
        {
          key: 'filePath',
          label: '파일 경로',
          type: 'input',
          required: true,
          placeholder: 'C:\\data\\input.csv 또는 /data/input.csv',
          tooltip: '읽어올 파일의 전체 경로를 입력합니다',
        },
        {
          key: 'fileType',
          label: '파일 형식',
          type: 'select',
          required: true,
          options: [
            { value: 'csv', label: 'CSV', description: '쉼표로 구분된 값' },
            { value: 'json', label: 'JSON', description: 'JavaScript Object Notation' },
            { value: 'excel', label: 'Excel', description: 'Microsoft Excel 파일' },
            { value: 'parquet', label: 'Parquet', description: '컬럼형 저장 파일' },
          ],
        },
      ],
    },
    {
      title: 'CSV 옵션',
      fields: [
        {
          key: 'encoding',
          label: '인코딩',
          type: 'select',
          placeholder: 'UTF-8',
          options: [
            { value: 'utf-8', label: 'UTF-8' },
            { value: 'euc-kr', label: 'EUC-KR' },
            { value: 'cp949', label: 'CP949' },
          ],
          dependency: {
            field: 'fileType',
            condition: (value) => value === 'csv',
          },
        },
        {
          key: 'delimiter',
          label: '구분자',
          type: 'select',
          placeholder: '쉼표',
          options: [
            { value: ',', label: '쉼표 (,)' },
            { value: ';', label: '세미콜론 (;)' },
            { value: '\t', label: '탭 (\\t)' },
            { value: '|', label: '파이프 (|)' },
          ],
          dependency: {
            field: 'fileType',
            condition: (value) => value === 'csv',
          },
        },
        {
          key: 'hasHeader',
          label: '헤더 포함',
          type: 'switch',
          tooltip: '첫 번째 행이 컬럼 헤더인지 설정합니다',
          dependency: {
            field: 'fileType',
            condition: (value) => value === 'csv',
          },
        },
      ],
    },
    {
      title: 'Excel 옵션',
      fields: [
        {
          key: 'sheetName',
          label: '시트 이름',
          type: 'input',
          placeholder: 'Sheet1',
          tooltip: '읽어올 Excel 시트의 이름입니다',
          dependency: {
            field: 'fileType',
            condition: (value) => value === 'excel',
          },
        },
      ],
    },
  ],
};

/**
 * Select Columns 노드 설정 스키마
 */
export const selectColumnsSchema: NodeConfigSchema = {
  title: 'Select Columns 설정',
  description: '특정 컬럼들을 선택하여 출력합니다',
  sections: [
    {
      title: '기본 설정',
      fields: [
        {
          key: 'label',
          label: '노드 이름',
          type: 'input',
          required: true,
          placeholder: '노드 이름을 입력하세요',
        },
        {
          key: 'description',
          label: '설명',
          type: 'textarea',
          placeholder: '노드에 대한 설명을 입력하세요',
        },
      ],
    },
    {
      title: '컬럼 선택',
      fields: [
        {
          key: 'selectedColumns',
          label: '선택할 컬럼',
          type: 'custom',
          required: true,
          placeholder: '컬럼을 선택하세요',
          tooltip: '출력할 컬럼들을 선택합니다',
          options: [
            // 동적으로 이전 노드의 컬럼 정보를 가져와야 함
          ],
        },
      ],
    },
  ],
};

/**
 * Filter Rows 노드 설정 스키마
 */
export const filterRowsSchema: NodeConfigSchema = {
  title: 'Filter Rows 설정',
  description: '조건에 맞는 행들을 필터링합니다',
  sections: [
    {
      title: '기본 설정',
      fields: [
        {
          key: 'label',
          label: '노드 이름',
          type: 'input',
          required: true,
          placeholder: '노드 이름을 입력하세요',
        },
        {
          key: 'description',
          label: '설명',
          type: 'textarea',
          placeholder: '노드에 대한 설명을 입력하세요',
        },
      ],
    },
    {
      title: '필터 조건',
      fields: [
        {
          key: 'conditions',
          label: '필터 조건',
          type: 'custom',
          required: true,
          tooltip: '데이터 필터링 조건을 설정합니다',
        },
      ],
    },
  ],
};

/**
 * Table Writer 노드 설정 스키마
 */
export const tableWriterSchema: NodeConfigSchema = {
  title: 'Table Writer 설정',
  description: '데이터베이스 테이블에 데이터를 저장합니다',
  sections: [
    {
      title: '기본 설정',
      fields: [
        {
          key: 'label',
          label: '노드 이름',
          type: 'input',
          required: true,
          placeholder: '노드 이름을 입력하세요',
        },
        {
          key: 'description',
          label: '설명',
          type: 'textarea',
          placeholder: '노드에 대한 설명을 입력하세요',
        },
      ],
    },
    {
      title: '데이터베이스 연결',
      fields: [
        {
          key: 'connectionId',
          label: '데이터베이스 연결',
          type: 'select',
          required: true,
          placeholder: '데이터베이스 연결을 선택하세요',
          options: [
            { value: 'default', label: '기본 연결', description: 'PostgreSQL 기본 연결' },
            { value: 'mysql_main', label: 'MySQL 메인 DB', description: 'MySQL 메인 데이터베이스' },
          ],
        },
        {
          key: 'schema',
          label: '스키마',
          type: 'input',
          placeholder: 'public',
          tooltip: '데이터베이스 스키마 이름 (선택사항)',
        },
      ],
    },
    {
      title: '테이블 설정',
      fields: [
        {
          key: 'tableName',
          label: '테이블 이름',
          type: 'input',
          required: true,
          placeholder: '테이블 이름을 입력하세요',
          validation: {
            pattern: /^[a-zA-Z][a-zA-Z0-9_]*$/,
            message: '테이블 이름은 영문자로 시작하고 영숫자와 언더스코어만 사용할 수 있습니다',
          },
        },
        {
          key: 'writeMode',
          label: '쓰기 모드',
          type: 'select',
          required: true,
          options: [
            { value: 'insert', label: 'Insert', description: '새 데이터 삽입' },
            { value: 'upsert', label: 'Upsert', description: '삽입 또는 업데이트' },
            { value: 'replace', label: 'Replace', description: '테이블 내용 교체' },
            { value: 'truncate_insert', label: 'Truncate + Insert', description: '테이블 비운 후 삽입' },
          ],
        },
        {
          key: 'batchSize',
          label: '배치 크기',
          type: 'number',
          placeholder: '1000',
          tooltip: '한 번에 처리할 행의 수입니다',
          validation: {
            min: 1,
            max: 10000,
          },
        },
      ],
    },
    {
      title: '고급 설정',
      fields: [
        {
          key: 'createTableIfNotExists',
          label: '테이블 자동 생성',
          type: 'switch',
          tooltip: '테이블이 존재하지 않으면 자동으로 생성합니다',
        },
        {
          key: 'validateSchema',
          label: '스키마 검증',
          type: 'switch',
          tooltip: '데이터 타입과 제약조건을 미리 검증합니다',
        },
        {
          key: 'onError',
          label: '오류 시 처리',
          type: 'select',
          options: [
            { value: 'stop', label: '중단', description: '오류 발생 시 처리를 중단합니다' },
            { value: 'skip', label: '건너뛰기', description: '오류가 있는 행은 건너뜁니다' },
            { value: 'log', label: '로그만 기록', description: '오류를 로그에만 기록하고 계속합니다' },
          ],
        },
      ],
    },
  ],
};

/**
 * Rename Columns 노드 설정 스키마
 */
export const renameColumnsSchema: NodeConfigSchema = {
  title: 'Rename Columns 설정',
  description: '컬럼 이름을 변경합니다',
  sections: [
    {
      title: '기본 설정',
      fields: [
        {
          key: 'label',
          label: '노드 이름',
          type: 'input',
          required: true,
          placeholder: '노드 이름을 입력하세요',
        },
        {
          key: 'description',
          label: '설명',
          type: 'textarea',
          placeholder: '노드에 대한 설명을 입력하세요',
        },
      ],
    },
    {
      title: '컬럼 이름 변경',
      fields: [
        {
          key: 'renames',
          label: '이름 변경 규칙',
          type: 'custom',
          required: true,
          tooltip: '변경할 컬럼명과 새 컬럼명을 설정합니다',
        },
      ],
    },
  ],
};

/**
 * Join Data 노드 설정 스키마
 */
export const joinDataSchema: NodeConfigSchema = {
  title: 'Join Data 설정',
  description: '두 개의 데이터 소스를 조인합니다',
  sections: [
    {
      title: '기본 설정',
      fields: [
        {
          key: 'label',
          label: '노드 이름',
          type: 'input',
          required: true,
          placeholder: '노드 이름을 입력하세요',
        },
        {
          key: 'description',
          label: '설명',
          type: 'textarea',
          placeholder: '노드에 대한 설명을 입력하세요',
        },
      ],
    },
    {
      title: 'Join 설정',
      fields: [
        {
          key: 'joinConfig',
          label: 'Join 조건',
          type: 'custom',
          required: true,
          tooltip: 'Join 타입과 조건을 설정합니다',
        },
      ],
    },
  ],
};

/**
 * File Writer 노드 설정 스키마
 */
export const fileWriterSchema: NodeConfigSchema = {
  title: 'File Writer 설정',
  description: '데이터를 파일로 저장합니다',
  sections: [
    {
      title: '기본 설정',
      fields: [
        {
          key: 'label',
          label: '노드 이름',
          type: 'input',
          required: true,
          placeholder: '노드 이름을 입력하세요',
        },
        {
          key: 'description',
          label: '설명',
          type: 'textarea',
          placeholder: '노드에 대한 설명을 입력하세요',
        },
      ],
    },
    {
      title: '파일 설정',
      fields: [
        {
          key: 'filePath',
          label: '출력 파일 경로',
          type: 'input',
          required: true,
          placeholder: 'C:\\data\\output.csv 또는 /data/output.csv',
          tooltip: '저장할 파일의 전체 경로를 입력합니다',
        },
        {
          key: 'fileType',
          label: '파일 형식',
          type: 'select',
          required: true,
          options: [
            { value: 'csv', label: 'CSV', description: '쉼표로 구분된 값' },
            { value: 'json', label: 'JSON', description: 'JavaScript Object Notation' },
            { value: 'excel', label: 'Excel', description: 'Microsoft Excel 파일' },
            { value: 'parquet', label: 'Parquet', description: '컬럼형 저장 파일' },
          ],
        },
        {
          key: 'overwriteMode',
          label: '덮어쓰기 모드',
          type: 'select',
          required: true,
          options: [
            { value: 'overwrite', label: '덮어쓰기', description: '기존 파일을 덮어씁니다' },
            { value: 'append', label: '추가', description: '기존 파일에 데이터를 추가합니다' },
            { value: 'error', label: '오류', description: '파일이 존재하면 오류를 발생시킵니다' },
            { value: 'skip', label: '건너뛰기', description: '파일이 존재하면 작업을 건너뜁니다' },
          ],
        },
      ],
    },
    {
      title: '형식 설정',
      fields: [
        {
          key: 'encoding',
          label: '인코딩',
          type: 'select',
          placeholder: 'UTF-8',
          options: [
            { value: 'utf-8', label: 'UTF-8' },
            { value: 'euc-kr', label: 'EUC-KR' },
            { value: 'cp949', label: 'CP949' },
          ],
        },
        {
          key: 'delimiter',
          label: '구분자',
          type: 'select',
          placeholder: '쉼표',
          options: [
            { value: ',', label: '쉼표 (,)' },
            { value: ';', label: '세미콜론 (;)' },
            { value: '\t', label: '탭 (\\t)' },
            { value: '|', label: '파이프 (|)' },
          ],
        },
        {
          key: 'includeHeader',
          label: '헤더 포함',
          type: 'switch',
          tooltip: '첫 번째 행에 컬럼 헤더를 포함할지 설정합니다',
        },
        {
          key: 'jsonFormat',
          label: 'JSON 형식',
          type: 'select',
          options: [
            { value: 'array', label: '배열 형태', description: '[{...}, {...}]' },
            { value: 'lines', label: '라인별 객체', description: '{...}\\n{...}' },
          ],
        },
        {
          key: 'sheetName',
          label: 'Excel 시트명',
          type: 'input',
          placeholder: 'Sheet1',
          tooltip: 'Excel 파일의 시트 이름입니다',
        },
      ],
    },
  ],
};

/**
 * 노드 타입별 스키마 매핑
 */
export const nodeConfigSchemas: Record<NodeType, NodeConfigSchema> = {
  [NodeType.TABLE_READER]: tableReaderSchema,
  [NodeType.CUSTOM_SQL]: customSQLSchema,
  [NodeType.FILE_INPUT]: fileInputSchema,
  [NodeType.SELECT_COLUMNS]: selectColumnsSchema,
  [NodeType.FILTER_ROWS]: filterRowsSchema,
  [NodeType.RENAME_COLUMNS]: renameColumnsSchema,
  [NodeType.JOIN_DATA]: joinDataSchema,
  [NodeType.TABLE_WRITER]: tableWriterSchema,
  [NodeType.FILE_WRITER]: fileWriterSchema,
};