"""
MAX DP 데이터 목적지 노드들

처리된 데이터를 외부 시스템이나 파일로 출력하는 노드들을 구현합니다.
모든 노드는 입력 DataFrame을 그대로 반환하여 파이프라인 연속성을 유지합니다.
"""

import logging
import json
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Dict, Any, Optional
from sqlalchemy.ext.asyncio import AsyncSession
import pandas as pd
import httpx
from langchain_core.runnables import RunnableConfig

from .maxdp_base_node import MaxDPNode

logger = logging.getLogger(__name__)

class TableWriterNode(MaxDPNode):
    """
    DataFrame을 데이터베이스 테이블에 저장하는 노드
    
    df.to_sql()을 사용하여 데이터베이스에 데이터를 저장합니다.
    """
    
    def __init__(self, node_id: str, node_config: Dict[str, Any], node_type: str,
                 db_session: Optional[AsyncSession] = None, **kwargs):
        super().__init__(node_id, node_config, node_type, **kwargs)
        self.db_session = db_session
    
    def invoke(self, input: Dict[str, Any], config: Optional[RunnableConfig] = None) -> pd.DataFrame:
        """테이블 저장 실행"""
        self._log_execution_start(input)
        
        try:
            # 입력 DataFrame 가져오기
            df = self._get_input_dataframe(input)
            
            # 저장 설정
            table_name = self.node_config.get('table_name')
            schema = self.node_config.get('schema')
            if_exists = self.node_config.get('if_exists', 'append')  # 'append', 'replace', 'fail'
            index = self.node_config.get('index', False)
            
            if not table_name:
                raise ValueError("table_name is required")
            
            # 권한 검사
            if not self._check_write_permission(table_name, schema):
                raise PermissionError(f"No write permission for table: {table_name}")
            
            # 데이터베이스에 저장
            df.to_sql(
                name=table_name,
                con=self.db_session.connection(),
                schema=schema,
                if_exists=if_exists,
                index=index
            )
            
            logger.info(f"Saved {len(df)} rows to table: {table_name}")
            
            # 입력 DataFrame을 그대로 반환 (파이프라인 연속성 유지)
            self._log_execution_end(df)
            return df
            
        except Exception as e:
            self._handle_execution_error(e)
    
    def _check_write_permission(self, table_name: str, schema: Optional[str] = None) -> bool:
        """테이블 쓰기 권한 검사"""
        # 실제 권한 검사 로직 구현
        # 현재는 기본적으로 허용
        return True
    
    def _get_input_dataframe(self, input_data: Dict[str, Any]) -> pd.DataFrame:
        """입력에서 DataFrame 추출"""
        for key, value in input_data.items():
            if isinstance(value, pd.DataFrame):
                return value
        raise ValueError("No DataFrame found in input data")

class FileWriterNode(MaxDPNode):
    """
    DataFrame을 파일로 저장하는 노드
    
    df.to_csv(), df.to_json() 등을 사용하여 다양한 형식으로 저장합니다.
    """
    
    def invoke(self, input: Dict[str, Any], config: Optional[RunnableConfig] = None) -> pd.DataFrame:
        """파일 저장 실행"""
        self._log_execution_start(input)
        
        try:
            # 입력 DataFrame 가져오기
            df = self._get_input_dataframe(input)
            
            # 저장 설정
            file_path = self.node_config.get('file_path')
            file_format = self.node_config.get('file_format', 'csv')
            save_options = self.node_config.get('save_options', {})
            
            if not file_path:
                raise ValueError("file_path is required")
            
            # 파일 형식별 저장
            if file_format == 'csv':
                df.to_csv(file_path, index=False, **save_options)
            elif file_format == 'json':
                df.to_json(file_path, orient='records', **save_options)
            elif file_format == 'excel':
                df.to_excel(file_path, index=False, **save_options)
            elif file_format == 'parquet':
                df.to_parquet(file_path, **save_options)
            else:
                raise ValueError(f"Unsupported file format: {file_format}")
            
            logger.info(f"Saved {len(df)} rows to file: {file_path} ({file_format})")
            
            # 입력 DataFrame을 그대로 반환
            self._log_execution_end(df)
            return df
            
        except Exception as e:
            self._handle_execution_error(e)
    
    def _get_input_dataframe(self, input_data: Dict[str, Any]) -> pd.DataFrame:
        """입력에서 DataFrame 추출"""
        for key, value in input_data.items():
            if isinstance(value, pd.DataFrame):
                return value
        raise ValueError("No DataFrame found in input data")

class APIRequestNode(MaxDPNode):
    """
    처리된 데이터를 API 엔드포인트로 전송하는 노드
    
    httpx를 사용하여 POST/PUT 요청을 보냅니다.
    """
    
    def invoke(self, input: Dict[str, Any], config: Optional[RunnableConfig] = None) -> pd.DataFrame:
        """API 요청 실행"""
        self._log_execution_start(input)
        
        try:
            # 입력 DataFrame 가져오기
            df = self._get_input_dataframe(input)
            
            # API 설정
            api_url = self.node_config.get('api_url')
            method = self.node_config.get('method', 'POST').upper()
            headers = self.node_config.get('headers', {})
            timeout = self.node_config.get('timeout', 30)
            data_format = self.node_config.get('data_format', 'json')  # 'json', 'csv'
            
            if not api_url:
                raise ValueError("api_url is required")
            
            # 데이터 준비
            if data_format == 'json':
                payload = df.to_dict(orient='records')
                headers.setdefault('Content-Type', 'application/json')
            elif data_format == 'csv':
                payload = df.to_csv(index=False)
                headers.setdefault('Content-Type', 'text/csv')
            else:
                raise ValueError(f"Unsupported data format: {data_format}")
            
            # API 요청
            with httpx.Client(timeout=timeout) as client:
                if method == 'POST':
                    response = client.post(api_url, headers=headers, json=payload if data_format == 'json' else None, 
                                         content=payload if data_format == 'csv' else None)
                elif method == 'PUT':
                    response = client.put(api_url, headers=headers, json=payload if data_format == 'json' else None,
                                        content=payload if data_format == 'csv' else None)
                else:
                    raise ValueError(f"Unsupported HTTP method: {method}")
                
                response.raise_for_status()
                
                logger.info(f"Sent {len(df)} rows to API: {api_url} (status: {response.status_code})")
            
            # 입력 DataFrame을 그대로 반환
            self._log_execution_end(df)
            return df
            
        except Exception as e:
            self._handle_execution_error(e)
    
    def _get_input_dataframe(self, input_data: Dict[str, Any]) -> pd.DataFrame:
        """입력에서 DataFrame 추출"""
        for key, value in input_data.items():
            if isinstance(value, pd.DataFrame):
                return value
        raise ValueError("No DataFrame found in input data")

class DisplayResultsNode(MaxDPNode):
    """
    파이프라인 최종 결과를 표시하는 마커 노드
    
    실제로는 입력 DataFrame을 그대로 반환하지만, 
    FlowExecutor가 이 노드를 최종 출력으로 인식하는 데 사용됩니다.
    """
    
    def invoke(self, input: Dict[str, Any], config: Optional[RunnableConfig] = None) -> pd.DataFrame:
        """결과 표시 실행"""
        self._log_execution_start(input)
        
        try:
            # 입력 DataFrame 가져오기
            df = self._get_input_dataframe(input)
            
            # 표시 옵션
            show_summary = self.node_config.get('show_summary', True)
            max_rows = self.node_config.get('max_rows', 100)
            
            if show_summary:
                logger.info(f"Display Results - Shape: {df.shape}, Columns: {list(df.columns)}")
                
                # 데이터 타입 요약
                dtype_summary = df.dtypes.value_counts().to_dict()
                logger.info(f"Data types: {dtype_summary}")
                
                # 기본 통계 (숫자형 열만)
                numeric_cols = df.select_dtypes(include=['number']).columns
                if len(numeric_cols) > 0:
                    logger.info(f"Numeric columns summary: {df[numeric_cols].describe().to_dict()}")
            
            # 샘플 데이터 로깅 (디버그 모드에서)
            if logger.isEnabledFor(logging.DEBUG):
                sample_data = df.head(min(max_rows, len(df)))
                logger.debug(f"Sample data:\n{sample_data}")
            
            logger.info(f"Displayed results for {len(df)} rows")
            
            # 입력 DataFrame을 그대로 반환
            self._log_execution_end(df)
            return df
            
        except Exception as e:
            self._handle_execution_error(e)
    
    def _get_input_dataframe(self, input_data: Dict[str, Any]) -> pd.DataFrame:
        """입력에서 DataFrame 추출"""
        for key, value in input_data.items():
            if isinstance(value, pd.DataFrame):
                return value
        raise ValueError("No DataFrame found in input data")

class SendNotificationNode(MaxDPNode):
    """
    처리 결과에 대한 알림을 전송하는 노드
    
    이메일 또는 웹훅을 통해 알림을 발송합니다.
    """
    
    def invoke(self, input: Dict[str, Any], config: Optional[RunnableConfig] = None) -> pd.DataFrame:
        """알림 전송 실행"""
        self._log_execution_start(input)
        
        try:
            # 입력 DataFrame 가져오기
            df = self._get_input_dataframe(input)
            
            # 알림 설정
            notification_type = self.node_config.get('notification_type', 'email')  # 'email', 'webhook'
            
            if notification_type == 'email':
                self._send_email_notification(df)
            elif notification_type == 'webhook':
                self._send_webhook_notification(df)
            else:
                raise ValueError(f"Unsupported notification type: {notification_type}")
            
            logger.info(f"Sent {notification_type} notification for {len(df)} rows")
            
            # 입력 DataFrame을 그대로 반환
            self._log_execution_end(df)
            return df
            
        except Exception as e:
            self._handle_execution_error(e)
    
    def _send_email_notification(self, df: pd.DataFrame) -> None:
        """이메일 알림 전송"""
        # 이메일 설정
        smtp_server = self.node_config.get('smtp_server', 'localhost')
        smtp_port = self.node_config.get('smtp_port', 587)
        username = self.node_config.get('username')
        password = self.node_config.get('password')
        from_email = self.node_config.get('from_email')
        to_emails = self.node_config.get('to_emails', [])
        subject = self.node_config.get('subject', 'Data Processing Notification')
        
        if not to_emails:
            raise ValueError("to_emails is required for email notification")
        
        # 이메일 내용 생성
        message_body = self._generate_email_body(df)
        
        # 이메일 메시지 구성
        msg = MIMEMultipart()
        msg['From'] = from_email
        msg['To'] = ', '.join(to_emails)
        msg['Subject'] = subject
        
        msg.attach(MIMEText(message_body, 'html'))
        
        # SMTP를 통한 전송
        try:
            with smtplib.SMTP(smtp_server, smtp_port) as server:
                if username and password:
                    server.starttls()
                    server.login(username, password)
                
                server.send_message(msg)
                
            logger.info(f"Email sent to {len(to_emails)} recipients")
            
        except Exception as e:
            logger.error(f"Failed to send email: {e}")
            raise
    
    def _send_webhook_notification(self, df: pd.DataFrame) -> None:
        """웹훅 알림 전송"""
        webhook_url = self.node_config.get('webhook_url')
        headers = self.node_config.get('headers', {})
        timeout = self.node_config.get('timeout', 30)
        
        if not webhook_url:
            raise ValueError("webhook_url is required for webhook notification")
        
        # 웹훅 페이로드 생성
        payload = {
            'type': 'data_processing_complete',
            'timestamp': pd.Timestamp.now().isoformat(),
            'data_summary': {
                'row_count': len(df),
                'column_count': len(df.columns),
                'columns': list(df.columns),
                'data_types': df.dtypes.astype(str).to_dict()
            },
            'node_id': self.node_id
        }
        
        # 샘플 데이터 포함 (옵션)
        if self.node_config.get('include_sample_data', False):
            sample_size = self.node_config.get('sample_size', 5)
            payload['sample_data'] = df.head(sample_size).to_dict(orient='records')
        
        # 웹훅 요청
        with httpx.Client(timeout=timeout) as client:
            response = client.post(webhook_url, headers=headers, json=payload)
            response.raise_for_status()
            
        logger.info(f"Webhook notification sent to {webhook_url}")
    
    def _generate_email_body(self, df: pd.DataFrame) -> str:
        """이메일 본문 생성"""
        template = self.node_config.get('email_template', 'default')
        
        if template == 'default':
            # 기본 이메일 템플릿
            html_body = f"""
            <html>
            <body>
                <h2>Data Processing Complete</h2>
                <p><strong>Summary:</strong></p>
                <ul>
                    <li>Total Rows: {len(df)}</li>
                    <li>Total Columns: {len(df.columns)}</li>
                    <li>Processing Time: {pd.Timestamp.now().strftime('%Y-%m-%d %H:%M:%S')}</li>
                </ul>
                
                <p><strong>Columns:</strong></p>
                <ul>
                    {"".join([f"<li>{col} ({str(dtype)})</li>" for col, dtype in df.dtypes.items()])}
                </ul>
                
                <p><strong>Sample Data:</strong></p>
                {df.head().to_html(escape=False)}
            </body>
            </html>
            """
        else:
            # 사용자 정의 템플릿
            html_body = template.format(
                row_count=len(df),
                column_count=len(df.columns),
                columns=list(df.columns),
                timestamp=pd.Timestamp.now().strftime('%Y-%m-%d %H:%M:%S'),
                sample_data=df.head().to_html(escape=False)
            )
        
        return html_body
    
    def _get_input_dataframe(self, input_data: Dict[str, Any]) -> pd.DataFrame:
        """입력에서 DataFrame 추출"""
        for key, value in input_data.items():
            if isinstance(value, pd.DataFrame):
                return value
        raise ValueError("No DataFrame found in input data") 