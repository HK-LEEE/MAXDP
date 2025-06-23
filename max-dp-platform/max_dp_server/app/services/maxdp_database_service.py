"""
MAX DP 데이터베이스 서비스 모듈
데이터베이스 연결, 스키마 및 테이블 정보 조회 기능을 제공합니다.
"""
import logging
from typing import List, Dict, Any, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text, inspect, MetaData
from sqlalchemy.engine import Inspector
from sqlalchemy.exc import SQLAlchemyError
import asyncpg

from ..db.maxdp_session import db_manager

logger = logging.getLogger(__name__)

class DatabaseService:
    """데이터베이스 관련 서비스 클래스"""
    
    @staticmethod
    async def test_connection() -> Dict[str, Any]:
        """
        데이터베이스 연결 테스트
        
        Returns:
            Dict[str, Any]: 연결 상태 정보
        """
        try:
            async with db_manager.get_session() as session:
                # 기본 연결 테스트
                result = await session.execute(text("SELECT 1 as test"))
                test_result = result.fetchone()
                
                if test_result and test_result[0] == 1:
                    # 데이터베이스 정보 조회
                    db_info = await DatabaseService._get_database_info(session)
                    
                    return {
                        "status": "connected",
                        "message": "Database connection successful",
                        "database_info": db_info
                    }
                else:
                    return {
                        "status": "failed",
                        "message": "Connection test failed",
                        "database_info": None
                    }
                    
        except Exception as e:
            logger.error(f"Database connection test failed: {e}")
            return {
                "status": "error",
                "message": f"Connection error: {str(e)}",
                "database_info": None
            }
    
    @staticmethod
    async def _get_database_info(session: AsyncSession) -> Dict[str, Any]:
        """데이터베이스 기본 정보 조회"""
        try:
            # PostgreSQL 기본 정보 조회
            queries = {
                "version": "SELECT version()",
                "database_name": "SELECT current_database()",
                "current_user": "SELECT current_user",
                "current_schema": "SELECT current_schema()",
                "server_encoding": "SELECT pg_encoding_to_char(encoding) FROM pg_database WHERE datname = current_database()",
                "timezone": "SELECT current_setting('timezone')"
            }
            
            info = {}
            for key, query in queries.items():
                try:
                    result = await session.execute(text(query))
                    value = result.fetchone()
                    info[key] = value[0] if value else None
                except Exception as e:
                    logger.warning(f"Failed to get {key}: {e}")
                    info[key] = None
            
            return info
            
        except Exception as e:
            logger.error(f"Error getting database info: {e}")
            return {}
    
    @staticmethod
    async def list_schemas() -> List[Dict[str, Any]]:
        """
        데이터베이스의 모든 스키마 목록 조회
        
        Returns:
            List[Dict[str, Any]]: 스키마 정보 목록
        """
        try:
            async with db_manager.get_session() as session:
                # PostgreSQL 스키마 조회 쿼리
                query = text("""
                    SELECT 
                        schema_name,
                        schema_owner,
                        CASE 
                            WHEN schema_name IN ('information_schema', 'pg_catalog', 'pg_toast') 
                            THEN 'system'
                            ELSE 'user'
                        END as schema_type
                    FROM information_schema.schemata
                    ORDER BY 
                        CASE 
                            WHEN schema_name = 'public' THEN 1
                            WHEN schema_name IN ('information_schema', 'pg_catalog', 'pg_toast') THEN 3
                            ELSE 2
                        END,
                        schema_name
                """)
                
                result = await session.execute(query)
                schemas = result.fetchall()
                
                schema_list = []
                for schema in schemas:
                    schema_info = {
                        "schema_name": schema[0],
                        "schema_owner": schema[1],
                        "schema_type": schema[2],
                        "is_system": schema[2] == 'system'
                    }
                    
                    # 각 스키마의 테이블 수 조회
                    table_count_query = text("""
                        SELECT COUNT(*) 
                        FROM information_schema.tables 
                        WHERE table_schema = :schema_name
                        AND table_type = 'BASE TABLE'
                    """)
                    
                    count_result = await session.execute(table_count_query, {"schema_name": schema[0]})
                    table_count = count_result.fetchone()[0]
                    schema_info["table_count"] = table_count
                    
                    schema_list.append(schema_info)
                
                logger.info(f"Found {len(schema_list)} schemas")
                return schema_list
                
        except Exception as e:
            logger.error(f"Error listing schemas: {e}")
            raise
    
    @staticmethod
    async def list_tables(schema_name: str = "public", include_system_tables: bool = False) -> List[Dict[str, Any]]:
        """
        지정된 스키마의 테이블 목록 조회
        
        Args:
            schema_name (str): 스키마 이름
            include_system_tables (bool): 시스템 테이블 포함 여부
            
        Returns:
            List[Dict[str, Any]]: 테이블 정보 목록
        """
        try:
            async with db_manager.get_session() as session:
                # 스키마 존재 확인
                schema_check_query = text("""
                    SELECT schema_name 
                    FROM information_schema.schemata 
                    WHERE schema_name = :schema_name
                """)
                
                schema_result = await session.execute(schema_check_query, {"schema_name": schema_name})
                if not schema_result.fetchone():
                    raise ValueError(f"Schema '{schema_name}' does not exist")
                
                # 테이블 정보 조회 쿼리
                table_query = text("""
                    SELECT 
                        t.table_name,
                        t.table_type,
                        obj_description(c.oid) as table_comment,
                        pg_size_pretty(pg_total_relation_size(c.oid)) as table_size,
                        pg_stat_get_tuples_returned(c.oid) as row_count_estimate
                    FROM information_schema.tables t
                    LEFT JOIN pg_class c ON c.relname = t.table_name
                    LEFT JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = t.table_schema
                    WHERE t.table_schema = :schema_name
                    AND (:include_system OR t.table_type = 'BASE TABLE')
                    ORDER BY t.table_name
                """)
                
                result = await session.execute(table_query, {
                    "schema_name": schema_name,
                    "include_system": include_system_tables
                })
                tables = result.fetchall()
                
                table_list = []
                for table in tables:
                    table_info = {
                        "table_name": table[0],
                        "table_type": table[1],
                        "table_comment": table[2],
                        "table_size": table[3],
                        "estimated_rows": table[4],
                        "schema_name": schema_name
                    }
                    
                    # 컬럼 정보 조회
                    columns = await DatabaseService._get_table_columns(session, schema_name, table[0])
                    table_info["columns"] = columns
                    table_info["column_count"] = len(columns)
                    
                    table_list.append(table_info)
                
                logger.info(f"Found {len(table_list)} tables in schema '{schema_name}'")
                return table_list
                
        except ValueError:
            raise
        except Exception as e:
            logger.error(f"Error listing tables in schema '{schema_name}': {e}")
            raise
    
    @staticmethod
    async def _get_table_columns(session: AsyncSession, schema_name: str, table_name: str) -> List[Dict[str, Any]]:
        """테이블의 컬럼 정보 조회"""
        try:
            column_query = text("""
                SELECT 
                    column_name,
                    data_type,
                    is_nullable,
                    column_default,
                    character_maximum_length,
                    numeric_precision,
                    numeric_scale,
                    col_description(pgc.oid, c.ordinal_position) as column_comment
                FROM information_schema.columns c
                LEFT JOIN pg_class pgc ON pgc.relname = c.table_name
                LEFT JOIN pg_namespace n ON n.oid = pgc.relnamespace AND n.nspname = c.table_schema
                WHERE c.table_schema = :schema_name 
                AND c.table_name = :table_name
                ORDER BY c.ordinal_position
            """)
            
            result = await session.execute(column_query, {
                "schema_name": schema_name,
                "table_name": table_name
            })
            columns = result.fetchall()
            
            column_list = []
            for col in columns:
                column_info = {
                    "column_name": col[0],
                    "data_type": col[1],
                    "is_nullable": col[2] == 'YES',
                    "default_value": col[3],
                    "max_length": col[4],
                    "numeric_precision": col[5],
                    "numeric_scale": col[6],
                    "comment": col[7]
                }
                column_list.append(column_info)
            
            return column_list
            
        except Exception as e:
            logger.error(f"Error getting columns for table '{schema_name}.{table_name}': {e}")
            return []
    
    @staticmethod
    async def get_table_info(schema_name: str, table_name: str) -> Dict[str, Any]:
        """
        특정 테이블의 상세 정보 조회
        
        Args:
            schema_name (str): 스키마 이름
            table_name (str): 테이블 이름
            
        Returns:
            Dict[str, Any]: 테이블 상세 정보
        """
        try:
            async with db_manager.get_session() as session:
                # 테이블 존재 확인
                table_check_query = text("""
                    SELECT table_name, table_type
                    FROM information_schema.tables 
                    WHERE table_schema = :schema_name 
                    AND table_name = :table_name
                """)
                
                table_result = await session.execute(table_check_query, {
                    "schema_name": schema_name,
                    "table_name": table_name
                })
                table_info = table_result.fetchone()
                
                if not table_info:
                    raise ValueError(f"Table '{schema_name}.{table_name}' does not exist")
                
                # 기본 테이블 정보
                basic_info_query = text("""
                    SELECT 
                        obj_description(c.oid) as table_comment,
                        pg_size_pretty(pg_total_relation_size(c.oid)) as table_size,
                        pg_stat_get_tuples_returned(c.oid) as row_count_estimate,
                        pg_stat_get_tuples_inserted(c.oid) as inserts,
                        pg_stat_get_tuples_updated(c.oid) as updates,
                        pg_stat_get_tuples_deleted(c.oid) as deletes
                    FROM pg_class c
                    LEFT JOIN pg_namespace n ON n.oid = c.relnamespace
                    WHERE c.relname = :table_name AND n.nspname = :schema_name
                """)
                
                basic_result = await session.execute(basic_info_query, {
                    "schema_name": schema_name,
                    "table_name": table_name
                })
                basic_info = basic_result.fetchone()
                
                # 컬럼 정보
                columns = await DatabaseService._get_table_columns(session, schema_name, table_name)
                
                # 인덱스 정보
                indexes = await DatabaseService._get_table_indexes(session, schema_name, table_name)
                
                # 제약조건 정보
                constraints = await DatabaseService._get_table_constraints(session, schema_name, table_name)
                
                result = {
                    "schema_name": schema_name,
                    "table_name": table_name,
                    "table_type": table_info[1],
                    "table_comment": basic_info[0] if basic_info else None,
                    "table_size": basic_info[1] if basic_info else None,
                    "estimated_rows": basic_info[2] if basic_info else None,
                    "statistics": {
                        "inserts": basic_info[3] if basic_info else None,
                        "updates": basic_info[4] if basic_info else None,
                        "deletes": basic_info[5] if basic_info else None
                    },
                    "columns": columns,
                    "column_count": len(columns),
                    "indexes": indexes,
                    "constraints": constraints
                }
                
                logger.info(f"Retrieved detailed info for table '{schema_name}.{table_name}'")
                return result
                
        except ValueError:
            raise
        except Exception as e:
            logger.error(f"Error getting table info for '{schema_name}.{table_name}': {e}")
            raise
    
    @staticmethod
    async def _get_table_indexes(session: AsyncSession, schema_name: str, table_name: str) -> List[Dict[str, Any]]:
        """테이블의 인덱스 정보 조회"""
        try:
            index_query = text("""
                SELECT 
                    i.indexname,
                    i.indexdef,
                    array_agg(a.attname ORDER BY array_position(ix.indkey, a.attnum)) as columns,
                    ix.indisunique as is_unique,
                    ix.indisprimary as is_primary
                FROM pg_indexes i
                JOIN pg_class c ON c.relname = i.tablename
                JOIN pg_namespace n ON n.nspname = i.schemaname AND n.oid = c.relnamespace
                JOIN pg_index ix ON ix.indexrelid = (
                    SELECT oid FROM pg_class WHERE relname = i.indexname AND relnamespace = n.oid
                )
                JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = ANY(ix.indkey)
                WHERE i.schemaname = :schema_name 
                AND i.tablename = :table_name
                GROUP BY i.indexname, i.indexdef, ix.indisunique, ix.indisprimary
                ORDER BY i.indexname
            """)
            
            result = await session.execute(index_query, {
                "schema_name": schema_name,
                "table_name": table_name
            })
            indexes = result.fetchall()
            
            index_list = []
            for idx in indexes:
                index_info = {
                    "index_name": idx[0],
                    "index_definition": idx[1],
                    "columns": idx[2],
                    "is_unique": idx[3],
                    "is_primary": idx[4]
                }
                index_list.append(index_info)
            
            return index_list
            
        except Exception as e:
            logger.error(f"Error getting indexes for table '{schema_name}.{table_name}': {e}")
            return []
    
    @staticmethod
    async def _get_table_constraints(session: AsyncSession, schema_name: str, table_name: str) -> List[Dict[str, Any]]:
        """테이블의 제약조건 정보 조회"""
        try:
            constraint_query = text("""
                SELECT 
                    tc.constraint_name,
                    tc.constraint_type,
                    COALESCE(
                        array_agg(kcu.column_name ORDER BY kcu.ordinal_position) 
                        FILTER (WHERE kcu.column_name IS NOT NULL), 
                        ARRAY[]::text[]
                    ) as columns,
                    ccu.table_name as referenced_table,
                    COALESCE(
                        array_agg(ccu.column_name ORDER BY kcu.ordinal_position) 
                        FILTER (WHERE ccu.column_name IS NOT NULL), 
                        ARRAY[]::text[]
                    ) as referenced_columns
                FROM information_schema.table_constraints tc
                LEFT JOIN information_schema.key_column_usage kcu 
                    ON tc.constraint_name = kcu.constraint_name 
                    AND tc.table_schema = kcu.table_schema
                LEFT JOIN information_schema.constraint_column_usage ccu 
                    ON tc.constraint_name = ccu.constraint_name 
                    AND tc.table_schema = ccu.table_schema
                WHERE tc.table_schema = :schema_name 
                AND tc.table_name = :table_name
                GROUP BY tc.constraint_name, tc.constraint_type, ccu.table_name
                ORDER BY tc.constraint_type, tc.constraint_name
            """)
            
            result = await session.execute(constraint_query, {
                "schema_name": schema_name,
                "table_name": table_name
            })
            constraints = result.fetchall()
            
            constraint_list = []
            for const in constraints:
                # Handle columns array - filter out None values
                columns = const[2] if const[2] is not None else []
                if columns and None in columns:
                    columns = [col for col in columns if col is not None]
                
                # Handle referenced_columns array - filter out None values
                referenced_columns = const[4] if const[4] is not None else []
                if referenced_columns and None in referenced_columns:
                    referenced_columns = [col for col in referenced_columns if col is not None]
                
                constraint_info = {
                    "constraint_name": const[0],
                    "constraint_type": const[1],
                    "columns": columns,
                    "referenced_table": const[3],
                    "referenced_columns": referenced_columns
                }
                constraint_list.append(constraint_info)
            
            return constraint_list
            
        except Exception as e:
            logger.error(f"Error getting constraints for table '{schema_name}.{table_name}': {e}")
            return []
    
    @staticmethod
    async def preview_table_data(
        schema_name: str, 
        table_name: str, 
        where_clause: Optional[str] = None, 
        limit: int = 100
    ) -> Dict[str, Any]:
        """
        테이블 데이터 미리보기 - 안전한 SELECT 쿼리 실행
        
        Args:
            schema_name (str): 스키마 이름
            table_name (str): 테이블 이름
            where_clause (str, optional): WHERE 조건절 (선택사항)
            limit (int): 최대 반환 행 수 (기본값: 100, 최대: 1000)
            
        Returns:
            Dict[str, Any]: 조회된 데이터와 메타데이터
        """
        try:
            # 입력 검증
            if limit > 1000:
                limit = 1000
            if limit < 1:
                limit = 1
                
            async with db_manager.get_session() as session:
                # 테이블 존재 확인
                table_check_query = text("""
                    SELECT table_name, table_type
                    FROM information_schema.tables 
                    WHERE table_schema = :schema_name 
                    AND table_name = :table_name
                """)
                
                table_result = await session.execute(table_check_query, {
                    "schema_name": schema_name,
                    "table_name": table_name
                })
                table_info = table_result.fetchone()
                
                if not table_info:
                    raise ValueError(f"Table '{schema_name}.{table_name}' does not exist")
                
                # 컬럼 정보 조회 (메타데이터용)
                columns = await DatabaseService._get_table_columns(session, schema_name, table_name)
                
                # 안전한 쿼리 구성
                # 테이블명과 스키마명은 PostgreSQL 식별자 이스케이프 처리
                base_query = f'SELECT * FROM "{schema_name}"."{table_name}"'
                
                # WHERE 절 추가 (있는 경우)
                if where_clause and where_clause.strip():
                    # 기본적인 안전성 검사
                    dangerous_keywords = [
                        'DROP', 'DELETE', 'UPDATE', 'INSERT', 'ALTER', 'CREATE', 
                        'TRUNCATE', 'GRANT', 'REVOKE', 'EXEC', 'EXECUTE'
                    ]
                    
                    where_upper = where_clause.upper()
                    for keyword in dangerous_keywords:
                        if keyword in where_upper:
                            raise ValueError(f"Dangerous SQL keyword '{keyword}' not allowed in WHERE clause")
                    
                    base_query += f" WHERE {where_clause}"
                
                # LIMIT 추가
                base_query += f" LIMIT {limit}"
                
                logger.info(f"Executing preview query: {base_query}")
                
                # 쿼리 실행
                result = await session.execute(text(base_query))
                rows = result.fetchall()
                
                # 결과를 딕셔너리 리스트로 변환
                column_names = [col["column_name"] for col in columns]
                data_rows = []
                
                for row in rows:
                    row_dict = {}
                    for i, value in enumerate(row):
                        if i < len(column_names):
                            # 특수 타입 처리 (datetime, UUID 등을 문자열로 변환)
                            if value is not None:
                                if hasattr(value, 'isoformat'):  # datetime 객체
                                    row_dict[column_names[i]] = value.isoformat()
                                else:
                                    row_dict[column_names[i]] = str(value)
                            else:
                                row_dict[column_names[i]] = None
                    data_rows.append(row_dict)
                
                # 총 행 수 조회 (WHERE 절 적용된)
                count_query = f'SELECT COUNT(*) FROM "{schema_name}"."{table_name}"'
                if where_clause and where_clause.strip():
                    count_query += f" WHERE {where_clause}"
                
                count_result = await session.execute(text(count_query))
                total_count = count_result.fetchone()[0]
                
                result_data = {
                    "schema_name": schema_name,
                    "table_name": table_name,
                    "columns": columns,
                    "data": data_rows,
                    "metadata": {
                        "total_rows": total_count,
                        "returned_rows": len(data_rows),
                        "limit": limit,
                        "where_clause": where_clause,
                        "has_more": total_count > len(data_rows)
                    }
                }
                
                logger.info(f"Preview query completed: {len(data_rows)} rows returned out of {total_count} total")
                return result_data
                
        except ValueError:
            raise
        except Exception as e:
            logger.error(f"Error previewing table data for '{schema_name}.{table_name}': {e}")
            raise RuntimeError(f"Failed to preview table data: {str(e)}")
    
    @staticmethod
    async def execute_custom_sql(
        sql_query: str,
        schema_name: str = "public",
        limit: int = 100
    ) -> Dict[str, Any]:
        """
        사용자 정의 SQL 쿼리 실행 (SELECT만 허용)
        
        Args:
            sql_query (str): 실행할 SQL 쿼리
            schema_name (str): 스키마 이름 (기본값: public)
            limit (int): 최대 반환 행 수 (기본값: 100, 최대: 1000)
            
        Returns:
            Dict[str, Any]: 쿼리 실행 결과
        """
        try:
            # 입력 검증
            if limit > 1000:
                limit = 1000
            if limit < 1:
                limit = 1
                
            async with db_manager.get_session() as session:
                # SQL 쿼리 안전성 재검증
                sql_query = sql_query.strip()
                
                # LIMIT이 없으면 추가
                if not sql_query.upper().endswith(';'):
                    sql_query = sql_query.rstrip(';')
                
                # LIMIT 절이 없으면 추가
                if 'LIMIT' not in sql_query.upper():
                    sql_query += f" LIMIT {limit}"
                
                logger.info(f"Executing custom SQL: {sql_query[:100]}...")
                
                # 쿼리 실행
                result = await session.execute(text(sql_query))
                rows = result.fetchall()
                
                # 컬럼 정보 추출
                column_info = []
                if result.keys():
                    for col_name in result.keys():
                        column_info.append({
                            "column_name": col_name,
                            "data_type": "unknown",  # SQL 결과에서 타입 정보를 얻기 어려움
                            "is_nullable": True,
                            "default_value": None,
                            "max_length": None,
                            "numeric_precision": None,
                            "numeric_scale": None,
                            "comment": None
                        })
                
                # 결과를 딕셔너리 리스트로 변환
                data_rows = []
                for row in rows:
                    row_dict = {}
                    for i, col_name in enumerate(result.keys()):
                        value = row[i] if i < len(row) else None
                        # 특수 타입 처리 (datetime, UUID 등을 문자열로 변환)
                        if value is not None:
                            if hasattr(value, 'isoformat'):  # datetime 객체
                                row_dict[col_name] = value.isoformat()
                            else:
                                row_dict[col_name] = str(value)
                        else:
                            row_dict[col_name] = None
                    data_rows.append(row_dict)
                
                result_data = {
                    "columns": column_info,
                    "rows": data_rows,
                    "total_rows": len(data_rows),
                    "query": sql_query
                }
                
                logger.info(f"Custom SQL executed successfully: {len(data_rows)} rows returned")
                return result_data
                
        except Exception as e:
            logger.error(f"Error executing custom SQL: {e}")
            raise RuntimeError(f"Failed to execute SQL query: {str(e)}")