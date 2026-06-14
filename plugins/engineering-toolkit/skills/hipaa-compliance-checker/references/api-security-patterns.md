# Healthcare API Security Best Practices

## Table of Contents

- [Overview](#overview)
- [API Authentication and Authorization](#api-authentication-and-authorization)
- [API Rate Limiting and DDoS Protection](#api-rate-limiting-and-ddos-protection)
- [Data Transmission Security](#data-transmission-security)
- [API Audit and Compliance](#api-audit-and-compliance)
- [Summary](#summary)


## Overview

Comprehensive security patterns for REST, GraphQL, and WebSocket APIs handling Protected Health Information (PHI). These patterns ensure HIPAA compliance, data protection, and secure communication in healthcare applications.

## API Authentication and Authorization

### 1. Multi-Factor Authentication (MFA)

#### OAuth 2.0 with PKCE for Healthcare APIs
```python
# Healthcare OAuth 2.0 implementation with enhanced security
from authlib.integrations.flask_oauth2 import ResourceProtector
from authlib.oauth2 import OAuth2Error
import jwt
from datetime import datetime, timedelta

class HealthcareOAuthConfig:
    # Require MFA for all PHI access
    REQUIRE_MFA_SCOPES = ['phi:read', 'phi:write', 'patient:access']

    # Short token lifespans for healthcare data
    ACCESS_TOKEN_EXPIRES = timedelta(minutes=15)
    REFRESH_TOKEN_EXPIRES = timedelta(hours=2)

    # Enhanced security requirements
    REQUIRE_PKCE = True
    REQUIRE_HTTPS = True
    ALLOW_INSECURE_TRANSPORT = False  # Force HTTPS in all environments

class HealthcareBearerTokenValidator:
    def authenticate_token(self, token_string):
        try:
            # Decode and validate token
            payload = jwt.decode(
                token_string,
                SECRET_KEY,
                algorithms=['RS256'],  # Asymmetric signing required
                audience='healthcare-api'
            )

            # Validate MFA requirement for PHI access
            requested_scopes = payload.get('scope', '').split()
            requires_mfa = any(scope in HealthcareOAuthConfig.REQUIRE_MFA_SCOPES
                             for scope in requested_scopes)

            if requires_mfa and not payload.get('mfa_verified', False):
                raise OAuth2Error('MFA required for PHI access')

            # Validate token freshness for sensitive operations
            if self._is_sensitive_operation() and self._token_age(payload) > 300:  # 5 minutes
                raise OAuth2Error('Token too old for sensitive operation')

            return payload

        except jwt.ExpiredSignatureError:
            raise OAuth2Error('Token expired')
        except jwt.InvalidTokenError:
            raise OAuth2Error('Invalid token')

def require_mfa_for_phi(f):
    """Decorator to enforce MFA for PHI access"""
    def wrapper(*args, **kwargs):
        token = get_current_token()

        if not token.get('mfa_verified', False):
            return jsonify({'error': 'MFA required'}), 401

        # Log PHI access attempt
        audit_logger.log_phi_access(
            user_id=token['sub'],
            endpoint=request.endpoint,
            mfa_verified=True
        )

        return f(*args, **kwargs)
    return wrapper
```

### 2. Role-Based Access Control (RBAC) for Healthcare

#### Healthcare Role Definitions
```python
class HealthcareRoles:
    """HIPAA-aligned role definitions"""

    PATIENT = 'patient'
    HEALTHCARE_PROVIDER = 'healthcare_provider'
    NURSE = 'nurse'
    PHYSICIAN = 'physician'
    ADMIN = 'admin'
    HEALTH_COACH = 'health_coach'
    RESEARCHER = 'researcher'  # De-identified data only

    # Role hierarchy
    ROLE_HIERARCHY = {
        PHYSICIAN: [HEALTHCARE_PROVIDER, NURSE],
        NURSE: [HEALTHCARE_PROVIDER],
        HEALTH_COACH: [HEALTHCARE_PROVIDER],
        ADMIN: [HEALTHCARE_PROVIDER]
    }

    # Minimum business relationship required
    MINIMUM_BUSINESS_RELATIONSHIP = {
        'phi:read': 'assigned_patient',      # Must be assigned to patient
        'phi:write': 'assigned_patient',
        'phi:share': 'treatment_team',       # Must be on treatment team
        'phi:export': 'data_controller'      # Administrative role required
    }

class HealthcarePermissionValidator:
    def __init__(self):
        self.audit_logger = HealthcareAuditLogger()

    def validate_phi_access(self, user_id: str, patient_id: str, action: str) -> bool:
        """Validate user has legitimate access to patient PHI"""

        # Check role permissions
        if not self._has_role_permission(user_id, action):
            return False

        # Check business relationship
        if not self._has_business_relationship(user_id, patient_id, action):
            self.audit_logger.log_access_denied(
                user_id=user_id,
                patient_id=patient_id,
                reason='no_business_relationship'
            )
            return False

        # Check minimum necessary standard
        if not self._meets_minimum_necessary(user_id, patient_id, action):
            self.audit_logger.log_access_denied(
                user_id=user_id,
                patient_id=patient_id,
                reason='exceeds_minimum_necessary'
            )
            return False

        return True

    def _has_business_relationship(self, user_id: str, patient_id: str, action: str) -> bool:
        """Verify legitimate business relationship per HIPAA"""
        required_relationship = HealthcareRoles.MINIMUM_BUSINESS_RELATIONSHIP.get(action)

        if required_relationship == 'assigned_patient':
            return self._is_assigned_to_patient(user_id, patient_id)
        elif required_relationship == 'treatment_team':
            return self._is_on_treatment_team(user_id, patient_id)
        elif required_relationship == 'data_controller':
            return self._is_data_controller(user_id)

        return False
```

### 3. API Input Validation and Sanitization

#### Healthcare Data Validation
```python
from pydantic import BaseModel, validator, Field
from typing import Optional, List
import re
from datetime import date

class HealthcareValidationMixin:
    """Common validation patterns for healthcare data"""

    @staticmethod
    def validate_patient_id(patient_id: str) -> str:
        """Validate patient identifier format"""
        if not re.match(r'^[A-Z0-9]{8,12}$', patient_id):
            raise ValueError('Invalid patient ID format')
        return patient_id

    @staticmethod
    def validate_mrn(mrn: str) -> str:
        """Validate Medical Record Number"""
        if not re.match(r'^MRN[0-9]{8}$', mrn):
            raise ValueError('Invalid MRN format')
        return mrn

    @staticmethod
    def sanitize_clinical_note(note: str) -> str:
        """Sanitize clinical notes for safe storage"""
        # Remove potential script injections
        note = re.sub(r'<script[^>]*>.*?</script>', '', note, flags=re.IGNORECASE | re.DOTALL)

        # Limit length to prevent DoS
        if len(note) > 10000:
            raise ValueError('Clinical note exceeds maximum length')

        return note.strip()

class PatientDataRequest(BaseModel, HealthcareValidationMixin):
    """Validated request for patient data operations"""

    patient_id: str = Field(..., min_length=8, max_length=12)
    mrn: Optional[str] = None
    date_of_birth: date
    requested_data_types: List[str] = Field(..., min_items=1, max_items=10)
    justification: str = Field(..., min_length=10, max_length=500)

    @validator('patient_id')
    def validate_patient_id_field(cls, v):
        return cls.validate_patient_id(v)

    @validator('mrn')
    def validate_mrn_field(cls, v):
        if v:
            return cls.validate_mrn(v)
        return v

    @validator('requested_data_types')
    def validate_data_types(cls, v):
        allowed_types = [
            'demographics', 'medications', 'allergies', 'vitals',
            'lab_results', 'diagnoses', 'procedures', 'notes'
        ]

        invalid_types = [dtype for dtype in v if dtype not in allowed_types]
        if invalid_types:
            raise ValueError(f'Invalid data types: {invalid_types}')

        return v

class ClinicalDataUpdate(BaseModel, HealthcareValidationMixin):
    """Validated request for updating clinical data"""

    patient_id: str
    data_type: str = Field(..., regex=r'^[a-z_]+$')
    clinical_note: Optional[str] = None
    structured_data: Optional[dict] = None
    provider_id: str = Field(..., min_length=8, max_length=12)

    @validator('clinical_note')
    def sanitize_note(cls, v):
        if v:
            return cls.sanitize_clinical_note(v)
        return v

    @validator('structured_data')
    def validate_structured_data(cls, v):
        if v and len(str(v)) > 50000:  # Limit JSON size
            raise ValueError('Structured data too large')
        return v
```

## API Rate Limiting and DDoS Protection

### 1. Healthcare-Specific Rate Limiting

#### Tiered Rate Limiting by User Type
```python
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
import redis

class HealthcareRateLimiter:
    """Rate limiter with healthcare-specific rules"""

    # Rate limits by user role
    RATE_LIMITS = {
        'patient': {
            'phi_access': '10 per minute, 100 per hour',
            'data_export': '1 per hour, 5 per day',
            'profile_update': '5 per minute'
        },
        'healthcare_provider': {
            'phi_access': '100 per minute, 1000 per hour',
            'data_export': '10 per hour, 50 per day',
            'bulk_operations': '5 per minute'
        },
        'admin': {
            'phi_access': '500 per minute',
            'data_export': '50 per hour',
            'system_operations': '20 per minute'
        }
    }

    def __init__(self, redis_client):
        self.redis_client = redis_client

    def get_user_rate_limit(self, user_id: str, operation: str) -> str:
        """Get rate limit for user and operation type"""
        user_role = self._get_user_role(user_id)

        limits = self.RATE_LIMITS.get(user_role, {})
        return limits.get(operation, '10 per minute')  # Default conservative limit

    def check_rate_limit(self, user_id: str, operation: str) -> bool:
        """Check if user has exceeded rate limit"""
        limit = self.get_user_rate_limit(user_id, operation)

        # Implement sliding window rate limiting
        key = f"rate_limit:{user_id}:{operation}"

        # Parse limit (e.g., "10 per minute")
        count, period = self._parse_rate_limit(limit)
        window_size = self._get_window_size(period)

        current_time = int(time.time())
        window_start = current_time - window_size

        # Count requests in current window
        pipe = self.redis_client.pipeline()
        pipe.zremrangebyscore(key, 0, window_start)  # Remove old entries
        pipe.zcard(key)  # Count current entries
        pipe.zadd(key, {str(current_time): current_time})  # Add current request
        pipe.expire(key, window_size + 1)  # Set expiration

        results = pipe.execute()
        current_count = results[1]

        return current_count < count

# Rate limiting decorator for healthcare APIs
def healthcare_rate_limit(operation: str):
    """Decorator for healthcare-specific rate limiting"""
    def decorator(f):
        def wrapper(*args, **kwargs):
            user_id = get_current_user_id()

            if not rate_limiter.check_rate_limit(user_id, operation):
                # Log rate limit violation
                audit_logger.log_rate_limit_exceeded(
                    user_id=user_id,
                    operation=operation,
                    endpoint=request.endpoint
                )

                return jsonify({
                    'error': 'Rate limit exceeded',
                    'retry_after': rate_limiter.get_retry_after(user_id, operation)
                }), 429

            return f(*args, **kwargs)
        return wrapper
    return decorator
```

### 2. API Security Monitoring

#### Real-time Security Monitoring
```python
class HealthcareAPISecurityMonitor:
    """Monitor API usage for security anomalies"""

    def __init__(self):
        self.anomaly_detector = AnomalyDetector()
        self.alert_manager = AlertManager()

    def monitor_request(self, request_data: dict):
        """Monitor individual API request for security issues"""

        # Check for common attack patterns
        if self._detect_injection_attempt(request_data):
            self._trigger_security_alert('injection_attempt', request_data)

        # Check for unusual access patterns
        if self._detect_unusual_access_pattern(request_data):
            self._trigger_security_alert('unusual_access', request_data)

        # Check for data exfiltration patterns
        if self._detect_data_exfiltration(request_data):
            self._trigger_security_alert('data_exfiltration', request_data)

    def _detect_injection_attempt(self, request_data: dict) -> bool:
        """Detect SQL injection, NoSQL injection, etc."""

        # SQL injection patterns
        sql_patterns = [
            r"(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER)\b)",
            r"(\b(UNION|JOIN|WHERE|ORDER BY|GROUP BY)\b)",
            r"(--|\*\/|\*\*|@@|char\(|nchar\()",
            r"(\b(exec|execute|sp_|xp_)\b)"
        ]

        # NoSQL injection patterns
        nosql_patterns = [
            r"(\$where|\$ne|\$gt|\$lt|\$regex)",
            r"(this\.|db\.|collection\.)",
            r"(function\(\)|eval\()"
        ]

        # Check all string values in request
        for value in self._extract_string_values(request_data):
            for pattern in sql_patterns + nosql_patterns:
                if re.search(pattern, str(value), re.IGNORECASE):
                    return True

        return False

    def _detect_unusual_access_pattern(self, request_data: dict) -> bool:
        """Detect unusual user access patterns"""

        user_id = request_data.get('user_id')
        if not user_id:
            return False

        # Get user's typical access pattern
        typical_pattern = self._get_user_access_pattern(user_id)
        current_access = {
            'time_of_day': datetime.now().hour,
            'endpoint': request_data.get('endpoint'),
            'data_volume': len(str(request_data)),
            'frequency': self._get_recent_request_frequency(user_id)
        }

        # Use anomaly detection model
        is_anomaly = self.anomaly_detector.is_anomaly(typical_pattern, current_access)

        return is_anomaly

    def _trigger_security_alert(self, alert_type: str, request_data: dict):
        """Trigger security alert and response"""

        alert = {
            'type': alert_type,
            'timestamp': datetime.utcnow().isoformat(),
            'user_id': request_data.get('user_id'),
            'ip_address': request_data.get('ip_address'),
            'endpoint': request_data.get('endpoint'),
            'request_data': request_data,
            'severity': self._calculate_severity(alert_type, request_data)
        }

        # Log security event
        security_logger.log_security_event(alert)

        # Automated response based on severity
        if alert['severity'] >= 8:  # High severity
            self._immediate_account_suspension(request_data.get('user_id'))
        elif alert['severity'] >= 5:  # Medium severity
            self._increase_monitoring(request_data.get('user_id'))

        # Notify security team
        self.alert_manager.send_security_alert(alert)
```

## Data Transmission Security

### 1. HTTPS and TLS Configuration

#### Strict TLS Configuration for Healthcare APIs
```python
# Flask/Gunicorn TLS configuration
HEALTHCARE_TLS_CONFIG = {
    'ssl_version': ssl.PROTOCOL_TLS,
    'ciphers': 'ECDHE+AESGCM:ECDHE+CHACHA20:DHE+AESGCM:DHE+CHACHA20:!aNULL:!MD5:!DSS',
    'ssl_context': 'adhoc',  # Use proper certificates in production

    # Minimum TLS 1.2, prefer TLS 1.3
    'ssl_minimum_version': ssl.TLSVersion.TLSv1_2,
    'ssl_maximum_version': ssl.TLSVersion.TLSv1_3,

    # Security headers
    'hsts_max_age': 31536000,  # 1 year
    'hsts_include_subdomains': True,
    'hsts_preload': True
}

class HealthcareTLSMiddleware:
    """Middleware to enforce TLS requirements for healthcare APIs"""

    def __init__(self, app):
        self.app = app

    def __call__(self, environ, start_response):
        # Enforce HTTPS for all healthcare endpoints
        if not self._is_secure_connection(environ):
            # Redirect to HTTPS
            location = self._build_https_url(environ)
            status = '301 Moved Permanently'
            headers = [('Location', location)]
            start_response(status, headers)
            return [b'']

        # Verify TLS version
        if not self._verify_tls_version(environ):
            status = '400 Bad Request'
            headers = [('Content-Type', 'text/plain')]
            start_response(status, headers)
            return [b'TLS 1.2 or higher required for healthcare data access']

        return self.app(environ, start_response)
```

### 2. Message-Level Encryption

#### End-to-End Encryption for Sensitive API Payloads
```python
from cryptography.hazmat.primitives.asymmetric import rsa, padding
from cryptography.hazmat.primitives import hashes, serialization
import json

class MessageLevelEncryption:
    """End-to-end encryption for API messages containing PHI"""

    def __init__(self):
        self.audit_logger = EncryptionAuditLogger()

    def encrypt_api_payload(
        self,
        payload: dict,
        recipient_public_key: str,
        sender_user_id: str
    ) -> dict:
        """Encrypt API payload with recipient's public key"""

        try:
            # Load recipient's public key
            public_key = serialization.load_pem_public_key(
                recipient_public_key.encode('utf-8')
            )

            # Serialize payload
            payload_json = json.dumps(payload, separators=(',', ':'))
            payload_bytes = payload_json.encode('utf-8')

            # Generate symmetric key for payload encryption
            symmetric_key = os.urandom(32)  # AES-256 key

            # Encrypt payload with symmetric key
            encrypted_payload = self._encrypt_with_symmetric_key(
                payload_bytes, symmetric_key
            )

            # Encrypt symmetric key with recipient's public key
            encrypted_key = public_key.encrypt(
                symmetric_key,
                padding.OAEP(
                    mgf=padding.MGF1(algorithm=hashes.SHA256()),
                    algorithm=hashes.SHA256(),
                    label=None
                )
            )

            # Create encrypted message envelope
            envelope = {
                'encrypted_payload': base64.b64encode(encrypted_payload).decode('ascii'),
                'encrypted_key': base64.b64encode(encrypted_key).decode('ascii'),
                'encryption_algorithm': 'AES-256-GCM',
                'key_algorithm': 'RSA-OAEP-SHA256',
                'sender_id': sender_user_id,
                'encrypted_at': datetime.utcnow().isoformat()
            }

            # Audit log
            self.audit_logger.log_message_encryption(
                sender_id=sender_user_id,
                payload_size=len(payload_bytes),
                success=True
            )

            return envelope

        except Exception as e:
            self.audit_logger.log_message_encryption(
                sender_id=sender_user_id,
                payload_size=0,
                success=False,
                error=str(e)
            )
            raise

class HealthcareAPIClient:
    """Client SDK with built-in message encryption"""

    def __init__(self, api_base_url: str, client_private_key: str):
        self.api_base_url = api_base_url
        self.private_key = serialization.load_pem_private_key(
            client_private_key.encode('utf-8'),
            password=None
        )
        self.session = requests.Session()

    def post_encrypted(
        self,
        endpoint: str,
        payload: dict,
        recipient_public_key: str
    ) -> dict:
        """POST request with encrypted payload"""

        # Encrypt payload
        encryption = MessageLevelEncryption()
        encrypted_envelope = encryption.encrypt_api_payload(
            payload, recipient_public_key, self.client_id
        )

        # Send encrypted request
        response = self.session.post(
            f"{self.api_base_url}/{endpoint}",
            json=encrypted_envelope,
            headers={
                'Content-Type': 'application/json',
                'X-Encryption': 'message-level'
            }
        )

        return response.json()
```

## API Audit and Compliance

### 1. Comprehensive API Audit Logging

#### HIPAA-Compliant API Audit Trail
```python
class HealthcareAPIAuditLogger:
    """Comprehensive audit logging for healthcare API compliance"""

    def __init__(self):
        self.logger = logging.getLogger('healthcare_api_audit')
        self._setup_audit_handler()

    def log_api_access(
        self,
        user_id: str,
        endpoint: str,
        method: str,
        patient_ids: List[str],
        phi_accessed: bool,
        response_code: int,
        request_size: int = 0,
        response_size: int = 0,
        ip_address: str = None,
        user_agent: str = None
    ):
        """Log API access for HIPAA audit trail"""

        audit_record = {
            'timestamp': datetime.utcnow().isoformat(),
            'event_type': 'API_ACCESS',
            'user_id': user_id,
            'endpoint': endpoint,
            'http_method': method,
            'patient_ids': patient_ids,
            'phi_accessed': phi_accessed,
            'response_code': response_code,
            'request_size_bytes': request_size,
            'response_size_bytes': response_size,
            'ip_address': ip_address,
            'user_agent': user_agent,
            'session_id': self._get_session_id(),
            'request_id': self._generate_request_id()
        }

        # Calculate risk score
        audit_record['risk_score'] = self._calculate_risk_score(audit_record)

        # Add digital signature for audit integrity
        audit_record['audit_signature'] = self._sign_audit_record(audit_record)

        # Log to secure audit store
        self.logger.info(json.dumps(audit_record))

        # Real-time monitoring for high-risk events
        if audit_record['risk_score'] >= 7:
            self._trigger_real_time_alert(audit_record)

    def log_data_export(
        self,
        user_id: str,
        export_type: str,
        patient_count: int,
        data_fields: List[str],
        file_format: str,
        justification: str
    ):
        """Log PHI data export events"""

        export_record = {
            'timestamp': datetime.utcnow().isoformat(),
            'event_type': 'DATA_EXPORT',
            'user_id': user_id,
            'export_type': export_type,
            'patient_count': patient_count,
            'data_fields_exported': data_fields,
            'file_format': file_format,
            'business_justification': justification,
            'export_id': self._generate_export_id()
        }

        self.logger.critical(json.dumps(export_record))  # Critical level for exports

        # Immediate notification for bulk exports
        if patient_count > 100:
            self._notify_compliance_team(export_record)

# API endpoint decorator for automatic audit logging
def audit_api_access(phi_access: bool = False):
    """Decorator to automatically audit API access"""
    def decorator(f):
        def wrapper(*args, **kwargs):
            start_time = time.time()

            # Extract request information
            user_id = get_current_user_id()
            patient_ids = extract_patient_ids_from_request(request)

            try:
                # Execute API function
                result = f(*args, **kwargs)
                response_code = 200

                # Log successful access
                audit_logger.log_api_access(
                    user_id=user_id,
                    endpoint=request.endpoint,
                    method=request.method,
                    patient_ids=patient_ids,
                    phi_accessed=phi_access,
                    response_code=response_code,
                    request_size=len(request.data or b''),
                    response_size=len(str(result)),
                    ip_address=request.remote_addr,
                    user_agent=request.headers.get('User-Agent')
                )

                return result

            except Exception as e:
                # Log failed access attempt
                response_code = getattr(e, 'code', 500)

                audit_logger.log_api_access(
                    user_id=user_id,
                    endpoint=request.endpoint,
                    method=request.method,
                    patient_ids=patient_ids,
                    phi_accessed=phi_access,
                    response_code=response_code,
                    ip_address=request.remote_addr,
                    user_agent=request.headers.get('User-Agent')
                )

                raise
        return wrapper
    return decorator
```

### 2. API Documentation and Compliance

#### OpenAPI Security Specifications for Healthcare
```yaml
# OpenAPI 3.0 specification for healthcare API
openapi: 3.0.3
info:
  title: Healthcare Platform API
  version: 2.0.0
  description: HIPAA-compliant API for health platform PHI access

servers:
  - url: https://api.health-platform.com/v2
    description: Production API (HIPAA-compliant)

security:
  - HealthcareBearerAuth: []
  - MFARequired: []

components:
  securitySchemes:
    HealthcareBearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
      description: OAuth 2.0 JWT token with healthcare scopes

    MFARequired:
      type: apiKey
      in: header
      name: X-MFA-Token
      description: Multi-factor authentication token for PHI access

  schemas:
    EncryptedPHI:
      type: object
      required:
        - encrypted_data
        - encryption_metadata
      properties:
        encrypted_data:
          type: string
          format: base64
          description: Base64-encoded encrypted PHI data
        encryption_metadata:
          $ref: '#/components/schemas/EncryptionMetadata'

    EncryptionMetadata:
      type: object
      required:
        - algorithm
        - key_id
        - encrypted_at
      properties:
        algorithm:
          type: string
          enum: [AES-256-GCM]
        key_id:
          type: string
          description: KMS key identifier
        encrypted_at:
          type: string
          format: date-time

paths:
  /patients/{patientId}/health-data:
    get:
      summary: Retrieve patient health data
      security:
        - HealthcareBearerAuth: [phi:read]
        - MFARequired: []
      parameters:
        - name: patientId
          in: path
          required: true
          schema:
            type: string
            pattern: '^[A-Z0-9]{8,12}$'
          description: Patient identifier
        - name: dataTypes
          in: query
          schema:
            type: array
            items:
              type: string
              enum: [demographics, vitals, medications, allergies, lab_results]
          description: Types of health data to retrieve
        - name: X-Business-Justification
          in: header
          required: true
          schema:
            type: string
            minLength: 10
            maxLength: 500
          description: Business justification for PHI access
      responses:
        '200':
          description: Patient health data (encrypted)
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/EncryptedPHI'
          headers:
            X-Audit-ID:
              schema:
                type: string
              description: Unique audit trail identifier
        '403':
          description: Insufficient permissions or no business relationship
        '429':
          description: Rate limit exceeded
          headers:
            Retry-After:
              schema:
                type: integer
              description: Seconds to wait before retry
```

## Summary

These healthcare API security patterns provide:

1. **Authentication & Authorization**: OAuth 2.0 with MFA, healthcare-specific RBAC, business relationship validation
2. **Input Validation**: Healthcare data validation, injection prevention, sanitization
3. **Rate Limiting**: Role-based rate limits, DDoS protection, abuse prevention
4. **Transmission Security**: TLS configuration, message-level encryption, secure headers
5. **Monitoring & Auditing**: Real-time security monitoring, comprehensive audit trails, compliance reporting
6. **Documentation**: OpenAPI specifications with security requirements and healthcare-specific schemas

These patterns ensure HIPAA compliance while maintaining usability for healthcare providers and health platforms handling Protected Health Information.