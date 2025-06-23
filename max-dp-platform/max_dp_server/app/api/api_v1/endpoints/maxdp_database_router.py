"""
MAX DP 데이터베이스 관리 API 엔드포인트
데이터베이스 연결, 스키마 및 테이블 조회 기능을 제공합니다.
"""
import logging
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel

from ....dependencies.maxdp_auth import get_current_user, UserContext
from ....services.maxdp_database_service import DatabaseService

logger = logging.getLogger(__name__)
router = APIRouter()

# Pydantic 모델들
class DatabaseConnectionResponse(BaseModel):
    status: str
    message: str
    database_info: Optional[dict] = None

class SchemaInfo(BaseModel):
    schema_name: str
    schema_owner: str
    schema_type: str
    is_system: bool
    table_count: int

class ColumnInfo(BaseModel):
    column_name: str
    data_type: str
    is_nullable: bool
    default_value: Optional[str] = None
    max_length: Optional[int] = None
    numeric_precision: Optional[int] = None
    numeric_scale: Optional[int] = None
    comment: Optional[str] = None

class TableInfo(BaseModel):
    table_name: str
    table_type: str
    table_comment: Optional[str] = None
    table_size: Optional[str] = None
    estimated_rows: Optional[int] = None
    schema_name: str
    columns: List[ColumnInfo]
    column_count: int

class IndexInfo(BaseModel):
    index_name: str
    index_definition: str
    columns: List[str]
    is_unique: bool
    is_primary: bool

class ConstraintInfo(BaseModel):
    constraint_name: str
    constraint_type: str
    columns: List[str] = []
    referenced_table: Optional[str] = None
    referenced_columns: List[str] = []

class DetailedTableInfo(BaseModel):
    schema_name: str
    table_name: str
    table_type: str
    table_comment: Optional[str] = None
    table_size: Optional[str] = None
    estimated_rows: Optional[int] = None
    statistics: dict
    columns: List[ColumnInfo]
    column_count: int
    indexes: List[IndexInfo]
    constraints: List[ConstraintInfo]

class TablePreviewRequest(BaseModel):
    schema: str
    tableName: str
    whereClause: Optional[str] = None
    limit: Optional[int] = 100

class TablePreviewMetadata(BaseModel):
    total_rows: int
    returned_rows: int
    limit: int
    where_clause: Optional[str] = None
    has_more: bool

class TablePreviewResponse(BaseModel):
    schema_name: str
    table_name: str
    columns: List[ColumnInfo]
    data: List[dict]
    metadata: TablePreviewMetadata

class CustomSQLRequest(BaseModel):
    connection_id: str
    sql_query: str
    schema: Optional[str] = "public"
    limit: Optional[int] = 100

class CustomSQLResponse(BaseModel):
    columns: List[ColumnInfo]
    rows: List[dict]
    execution_time: Optional[float] = None
    total_rows: int
    query: str

@router.get("/connection/test", response_model=DatabaseConnectionResponse, tags=["Database"])
async def test_database_connection(
    current_user: UserContext = Depends(get_current_user)
):
    """
    데이터베이스 연결 상태를 테스트합니다.
    
    데이터베이스 연결이 정상인지 확인하고 기본 정보를 반환합니다.
    """
    logger.info(f"Testing database connection for user: {current_user.email}")
    
    try:
        result = await DatabaseService.test_connection()
        
        if result["status"] == "connected":
            logger.info(f"Database connection test successful for user: {current_user.email}")
            return DatabaseConnectionResponse(**result)
        else:
            logger.warning(f"Database connection test failed for user: {current_user.email}")
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=result["message"]
            )
            
    except Exception as e:
        logger.error(f"Error testing database connection for user {current_user.email}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="데이터베이스 연결 테스트 중 오류가 발생했습니다."
        )

@router.get("/schemas", response_model=List[SchemaInfo], tags=["Database"])
async def list_database_schemas(
    include_system: bool = Query(False, description="시스템 스키마 포함 여부"),
    current_user: UserContext = Depends(get_current_user)
):
    """
    데이터베이스의 모든 스키마 목록을 조회합니다.
    
    Args:
        include_system (bool): 시스템 스키마(information_schema, pg_catalog 등) 포함 여부
    
    Returns:
        List[SchemaInfo]: 스키마 정보 목록
    """
    logger.info(f"Listing database schemas for user: {current_user.email}")
    
    try:
        schemas = await DatabaseService.list_schemas()
        
        # 시스템 스키마 필터링
        if not include_system:
            schemas = [schema for schema in schemas if not schema["is_system"]]
        
        logger.info(f"Found {len(schemas)} schemas for user: {current_user.email}")
        
        return [SchemaInfo(**schema) for schema in schemas]
        
    except Exception as e:
        logger.error(f"Error listing schemas for user {current_user.email}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="스키마 목록 조회 중 오류가 발생했습니다."
        )

@router.get("/schemas/{schema_name}/tables", response_model=List[TableInfo], tags=["Database"])
async def list_tables_in_schema(
    schema_name: str,
    include_system: bool = Query(False, description="시스템 테이블 포함 여부"),
    current_user: UserContext = Depends(get_current_user)
):
    """
    지정된 스키마의 테이블 목록을 조회합니다.
    
    Args:
        schema_name (str): 스키마 이름
        include_system (bool): 시스템 테이블 포함 여부
    
    Returns:
        List[TableInfo]: 테이블 정보 목록
    """
    logger.info(f"Listing tables in schema '{schema_name}' for user: {current_user.email}")
    
    try:
        tables = await DatabaseService.list_tables(schema_name, include_system)
        
        logger.info(f"Found {len(tables)} tables in schema '{schema_name}' for user: {current_user.email}")
        
        # Pydantic 모델로 변환
        table_responses = []
        for table in tables:
            # 컬럼 정보 변환
            columns = [ColumnInfo(**col) for col in table["columns"]]
            
            table_info = TableInfo(
                table_name=table["table_name"],
                table_type=table["table_type"],
                table_comment=table["table_comment"],
                table_size=table["table_size"],
                estimated_rows=table["estimated_rows"],
                schema_name=table["schema_name"],
                columns=columns,
                column_count=table["column_count"]
            )
            table_responses.append(table_info)
        
        return table_responses
        
    except ValueError as e:
        logger.warning(f"Invalid schema name '{schema_name}' for user {current_user.email}: {e}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error listing tables in schema '{schema_name}' for user {current_user.email}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="테이블 목록 조회 중 오류가 발생했습니다."
        )

@router.get("/schemas/{schema_name}/tables/{table_name}", response_model=DetailedTableInfo, tags=["Database"])
async def get_table_details(
    schema_name: str,
    table_name: str,
    current_user: UserContext = Depends(get_current_user)
):
    """
    특정 테이블의 상세 정보를 조회합니다.
    
    Args:
        schema_name (str): 스키마 이름
        table_name (str): 테이블 이름
    
    Returns:
        DetailedTableInfo: 테이블 상세 정보 (컬럼, 인덱스, 제약조건 포함)
    """
    logger.info(f"Getting details for table '{schema_name}.{table_name}' for user: {current_user.email}")
    
    try:
        table_info = await DatabaseService.get_table_info(schema_name, table_name)
        
        logger.info(f"Retrieved table details for '{schema_name}.{table_name}' for user: {current_user.email}")
        
        # Pydantic 모델로 변환
        columns = [ColumnInfo(**col) for col in table_info["columns"]]
        indexes = [IndexInfo(**idx) for idx in table_info["indexes"]]
        constraints = [ConstraintInfo(**const) for const in table_info["constraints"]]
        
        return DetailedTableInfo(
            schema_name=table_info["schema_name"],
            table_name=table_info["table_name"],
            table_type=table_info["table_type"],
            table_comment=table_info["table_comment"],
            table_size=table_info["table_size"],
            estimated_rows=table_info["estimated_rows"],
            statistics=table_info["statistics"],
            columns=columns,
            column_count=table_info["column_count"],
            indexes=indexes,
            constraints=constraints
        )
        
    except ValueError as e:
        logger.warning(f"Invalid table '{schema_name}.{table_name}' for user {current_user.email}: {e}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error getting table details for '{schema_name}.{table_name}' for user {current_user.email}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="테이블 상세 정보 조회 중 오류가 발생했습니다."
        )

@router.get("/tables", response_model=List[TableInfo], tags=["Database"])
async def list_all_tables(
    schema_filter: Optional[str] = Query(None, description="특정 스키마로 필터링"),
    include_system: bool = Query(False, description="시스템 테이블 포함 여부"),
    limit: int = Query(100, ge=1, le=1000, description="최대 결과 수"),
    current_user: UserContext = Depends(get_current_user)
):
    """
    모든 스키마의 테이블 목록을 조회합니다.
    
    Args:
        schema_filter (str, optional): 특정 스키마로 필터링
        include_system (bool): 시스템 테이블 포함 여부
        limit (int): 최대 결과 수
    
    Returns:
        List[TableInfo]: 테이블 정보 목록
    """
    logger.info(f"Listing all tables (schema_filter='{schema_filter}') for user: {current_user.email}")
    
    try:
        all_tables = []
        
        if schema_filter:
            # 특정 스키마만 조회
            schemas_to_check = [{"schema_name": schema_filter, "is_system": False}]
        else:
            # 모든 스키마 조회
            schemas = await DatabaseService.list_schemas()
            schemas_to_check = schemas if include_system else [s for s in schemas if not s["is_system"]]
        
        # 각 스키마의 테이블 조회
        for schema in schemas_to_check:
            try:
                tables = await DatabaseService.list_tables(schema["schema_name"], include_system)
                all_tables.extend(tables)
                
                # 제한 수에 도달하면 중단
                if len(all_tables) >= limit:
                    all_tables = all_tables[:limit]
                    break
                    
            except Exception as e:
                logger.warning(f"Error listing tables in schema '{schema['schema_name']}': {e}")
                continue
        
        logger.info(f"Found {len(all_tables)} tables total for user: {current_user.email}")
        
        # Pydantic 모델로 변환
        table_responses = []
        for table in all_tables:
            columns = [ColumnInfo(**col) for col in table["columns"]]
            
            table_info = TableInfo(
                table_name=table["table_name"],
                table_type=table["table_type"],
                table_comment=table["table_comment"],
                table_size=table["table_size"],
                estimated_rows=table["estimated_rows"],
                schema_name=table["schema_name"],
                columns=columns,
                column_count=table["column_count"]
            )
            table_responses.append(table_info)
        
        return table_responses
        
    except Exception as e:
        logger.error(f"Error listing all tables for user {current_user.email}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="전체 테이블 목록 조회 중 오류가 발생했습니다."
        )

@router.post("/preview", response_model=TablePreviewResponse, tags=["Database"])
async def preview_table_data(
    request: TablePreviewRequest,
    current_user: UserContext = Depends(get_current_user)
):
    """
    테이블 데이터 미리보기 - 안전한 SELECT 쿼리 실행
    
    Args:
        request (TablePreviewRequest): 미리보기 요청 정보
            - schema: 스키마 이름
            - tableName: 테이블 이름
            - whereClause: WHERE 조건절 (선택사항)
            - limit: 최대 반환 행 수 (기본값: 100, 최대: 1000)
    
    Returns:
        TablePreviewResponse: 조회된 데이터와 메타데이터
    """
    logger.info(f"Previewing table data for '{request.schema}.{request.tableName}' by user: {current_user.email}")
    
    try:
        # 입력 검증
        if request.limit and request.limit > 1000:
            request.limit = 1000
        if request.limit and request.limit < 1:
            request.limit = 1
        
        # 기본값 설정
        limit = request.limit or 100
        
        # 데이터베이스 서비스 호출
        result = await DatabaseService.preview_table_data(
            schema_name=request.schema,
            table_name=request.tableName,
            where_clause=request.whereClause,
            limit=limit
        )
        
        logger.info(f"Preview completed for '{request.schema}.{request.tableName}': {result['metadata']['returned_rows']} rows returned")
        
        # Pydantic 모델로 변환
        columns = [ColumnInfo(**col) for col in result["columns"]]
        metadata = TablePreviewMetadata(**result["metadata"])
        
        return TablePreviewResponse(
            schema_name=result["schema_name"],
            table_name=result["table_name"],
            columns=columns,
            data=result["data"],
            metadata=metadata
        )
        
    except ValueError as e:
        logger.warning(f"Invalid table '{request.schema}.{request.tableName}' for user {current_user.email}: {e}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except RuntimeError as e:
        logger.error(f"Runtime error previewing table '{request.schema}.{request.tableName}' for user {current_user.email}: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error previewing table data for '{request.schema}.{request.tableName}' for user {current_user.email}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="테이블 데이터 미리보기 중 오류가 발생했습니다."
        )

@router.post("/execute-sql", response_model=CustomSQLResponse, tags=["Database"])
async def execute_custom_sql(
    request: CustomSQLRequest,
    current_user: UserContext = Depends(get_current_user)
):
    """
    사용자 정의 SQL 쿼리 실행 (SELECT만 허용)
    
    Args:
        request (CustomSQLRequest): SQL 실행 요청 정보
            - connection_id: 데이터베이스 연결 ID
            - sql_query: 실행할 SQL 쿼리 (SELECT만 허용)
            - schema: 스키마 이름 (기본값: public)
            - limit: 최대 반환 행 수 (기본값: 100, 최대: 1000)
    
    Returns:
        CustomSQLResponse: 쿼리 실행 결과
    """
    import time
    import re
    
    logger.info(f"Executing custom SQL for user: {current_user.email}")
    logger.debug(f"SQL Query: {request.sql_query[:200]}...")  # 쿼리의 처음 200자만 로깅
    
    try:
        # 입력 검증
        if request.limit and request.limit > 1000:
            request.limit = 1000
        if request.limit and request.limit < 1:
            request.limit = 1
        
        # 기본값 설정
        limit = request.limit or 100
        
        # SQL 쿼리 안전성 검증
        sql_query = request.sql_query.strip()
        
        # SELECT 쿼리만 허용
        if not re.match(r'^\s*SELECT\s+', sql_query, re.IGNORECASE):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="SELECT 쿼리만 허용됩니다."
            )
        
        # 위험한 키워드 체크
        dangerous_keywords = [
            'DROP', 'DELETE', 'INSERT', 'UPDATE', 'ALTER', 'CREATE', 
            'TRUNCATE', 'GRANT', 'REVOKE', 'EXEC', 'EXECUTE'
        ]
        
        sql_upper = sql_query.upper()
        for keyword in dangerous_keywords:
            if re.search(rf'\b{keyword}\b', sql_upper):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"'{keyword}' 명령어는 허용되지 않습니다."
                )
        
        # 쿼리 실행 시간 측정 시작
        start_time = time.time()
        
        # 데이터베이스 서비스 호출
        result = await DatabaseService.execute_custom_sql(
            sql_query=sql_query,
            schema_name=request.schema or "public",
            limit=limit
        )
        
        # 실행 시간 계산
        execution_time = time.time() - start_time
        
        logger.info(f"Custom SQL executed successfully for user {current_user.email}: {result['total_rows']} rows returned in {execution_time:.3f}s")
        
        # Pydantic 모델로 변환
        columns = [ColumnInfo(**col) for col in result["columns"]]
        
        return CustomSQLResponse(
            columns=columns,
            rows=result["rows"],
            execution_time=execution_time,
            total_rows=result["total_rows"],
            query=sql_query
        )
        
    except HTTPException:
        # 이미 처리된 HTTP 예외는 그대로 전달
        raise
    except ValueError as e:
        logger.warning(f"Invalid SQL query for user {current_user.email}: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except RuntimeError as e:
        logger.error(f"Runtime error executing SQL for user {current_user.email}: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error executing custom SQL for user {current_user.email}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="SQL 쿼리 실행 중 오류가 발생했습니다."
        )