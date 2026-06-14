# Frontend Privacy Controls for Health Data

## Table of Contents

- [Overview](#overview)
- [Data Display and Masking Patterns](#data-display-and-masking-patterns)
- [Session Management and Timeouts](#session-management-and-timeouts)
- [Content Security and Privacy UI Patterns](#content-security-and-privacy-ui-patterns)
- [Summary](#summary)


## Overview

Client-side security measures and privacy controls for healthcare web applications. These patterns ensure HIPAA-compliant frontend handling of Protected Health Information (PHI) while maintaining excellent user experience.

## Data Display and Masking Patterns

### 1. Progressive Disclosure of Health Information

#### Contextual Data Revealing
```tsx
import React, { useState, useCallback } from 'react';
import { usePermissions } from '../hooks/usePermissions';
import { auditLogger } from '../utils/auditLogger';

interface ProgressiveHealthDataProps {
  patientId: string;
  dataType: 'demographics' | 'vitals' | 'medications' | 'lab_results';
  sensitivityLevel: 'low' | 'medium' | 'high' | 'critical';
  children: React.ReactNode;
}

const ProgressiveHealthDataReveal: React.FC<ProgressiveHealthDataProps> = ({
  patientId,
  dataType,
  sensitivityLevel,
  children
}) => {
  const [isRevealed, setIsRevealed] = useState(false);
  const [justification, setJustification] = useState('');
  const { hasPermission, requiresJustification } = usePermissions();

  const handleRevealData = useCallback(async () => {
    // Check permissions
    if (!hasPermission(`phi:read:${dataType}`)) {
      throw new Error('Insufficient permissions to view this data');
    }

    // Require justification for high sensitivity data
    if (sensitivityLevel === 'high' || sensitivityLevel === 'critical') {
      if (!justification || justification.length < 20) {
        alert('Please provide a business justification for accessing this sensitive data');
        return;
      }
    }

    // Audit log the data access
    await auditLogger.logDataReveal({
      patientId,
      dataType,
      sensitivityLevel,
      justification,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent
    });

    setIsRevealed(true);

    // Auto-hide after timeout for high sensitivity data
    if (sensitivityLevel === 'critical') {
      setTimeout(() => setIsRevealed(false), 30000); // 30 seconds
    }
  }, [patientId, dataType, sensitivityLevel, justification, hasPermission]);

  const getSensitivityIndicator = () => {
    const colors = {
      low: 'bg-green-100 text-green-800',
      medium: 'bg-yellow-100 text-yellow-800',
      high: 'bg-orange-100 text-orange-800',
      critical: 'bg-red-100 text-red-800'
    };

    return (
      <span className={`px-2 py-1 text-xs font-semibold rounded ${colors[sensitivityLevel]}`}>
        {sensitivityLevel.toUpperCase()}
      </span>
    );
  };

  if (!isRevealed) {
    return (
      <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 bg-gray-50">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium text-gray-700">
              Protected Health Information
            </span>
            {getSensitivityIndicator()}
          </div>
        </div>

        {(sensitivityLevel === 'high' || sensitivityLevel === 'critical') && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Business Justification Required
            </label>
            <textarea
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              placeholder="Explain why you need to access this information..."
              rows={3}
              minLength={20}
              maxLength={500}
            />
          </div>
        )}

        <button
          onClick={handleRevealData}
          className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded"
          disabled={
            (sensitivityLevel === 'high' || sensitivityLevel === 'critical') &&
            justification.length < 20
          }
        >
          Reveal {dataType.replace('_', ' ')} Data
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Sensitivity indicator */}
      <div className="absolute top-2 right-2 z-10">
        {getSensitivityIndicator()}
      </div>

      {/* Auto-hide countdown for critical data */}
      {sensitivityLevel === 'critical' && (
        <AutoHideCountdown onTimeout={() => setIsRevealed(false)} />
      )}

      {children}
    </div>
  );
};
```

#### Data Masking Components
```tsx
interface DataMaskingProps {
  value: string;
  maskType: 'partial' | 'full' | 'last4' | 'middle' | 'custom';
  customMask?: (value: string) => string;
  revealOnHover?: boolean;
  requireClick?: boolean;
}

const MaskedHealthData: React.FC<DataMaskingProps> = ({
  value,
  maskType,
  customMask,
  revealOnHover = false,
  requireClick = false
}) => {
  const [isRevealed, setIsRevealed] = useState(false);

  const getMaskedValue = useCallback(() => {
    if (isRevealed) return value;

    switch (maskType) {
      case 'partial':
        // Show first 2 and last 2 characters
        return value.length > 4
          ? `${value.slice(0, 2)}${'*'.repeat(value.length - 4)}${value.slice(-2)}`
          : '*'.repeat(value.length);

      case 'full':
        return '*'.repeat(value.length);

      case 'last4':
        // Common for SSN, phone numbers
        return value.length > 4
          ? `${'*'.repeat(value.length - 4)}${value.slice(-4)}`
          : value;

      case 'middle':
        // Show first and last, mask middle
        return value.length > 6
          ? `${value.slice(0, 3)}${'*'.repeat(value.length - 6)}${value.slice(-3)}`
          : '*'.repeat(value.length);

      case 'custom':
        return customMask ? customMask(value) : value;

      default:
        return '*'.repeat(value.length);
    }
  }, [value, maskType, customMask, isRevealed]);

  const handleInteraction = () => {
    if (requireClick) {
      setIsRevealed(!isRevealed);
    }
  };

  return (
    <span
      className={`inline-flex items-center ${requireClick ? 'cursor-pointer' : ''}`}
      onMouseEnter={revealOnHover ? () => setIsRevealed(true) : undefined}
      onMouseLeave={revealOnHover ? () => setIsRevealed(false) : undefined}
      onClick={handleInteraction}
      title={requireClick ? 'Click to reveal' : ''}
    >
      <span className={`font-mono ${!isRevealed ? 'text-gray-500' : 'text-gray-900'}`}>
        {getMaskedValue()}
      </span>
      {requireClick && (
        <button
          className="ml-2 text-blue-600 hover:text-blue-800"
          aria-label={isRevealed ? 'Hide data' : 'Reveal data'}
        >
          {isRevealed ? '🙈' : '👁️'}
        </button>
      )}
    </span>
  );
};

// Usage examples for different health data types
const HealthDataExamples = () => {
  return (
    <div className="space-y-4">
      {/* Social Security Number */}
      <div>
        <label className="block text-sm font-medium text-gray-700">SSN</label>
        <MaskedHealthData
          value="123-45-6789"
          maskType="last4"
          requireClick={true}
        />
      </div>

      {/* Date of Birth */}
      <div>
        <label className="block text-sm font-medium text-gray-700">Date of Birth</label>
        <MaskedHealthData
          value="01/15/1985"
          maskType="partial"
          revealOnHover={true}
        />
      </div>

      {/* Medical Record Number */}
      <div>
        <label className="block text-sm font-medium text-gray-700">MRN</label>
        <MaskedHealthData
          value="MRN12345678"
          maskType="middle"
          requireClick={true}
        />
      </div>

      {/* Phone Number */}
      <div>
        <label className="block text-sm font-medium text-gray-700">Phone</label>
        <MaskedHealthData
          value="(555) 123-4567"
          maskType="custom"
          customMask={(value) => `(***) ***-${value.slice(-4)}`}
          requireClick={true}
        />
      </div>
    </div>
  );
};
```

### 2. Screen Recording and Screenshot Protection

#### Watermarking and Screen Protection
```tsx
import React, { useEffect, useRef, useState } from 'react';

interface ScreenProtectionProps {
  enabled: boolean;
  watermarkText?: string;
  blurOnInactive?: boolean;
  children: React.ReactNode;
}

const ScreenProtectionWrapper: React.FC<ScreenProtectionProps> = ({
  enabled,
  watermarkText = 'Confidential Health Information',
  blurOnInactive = true,
  children
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isWindowActive, setIsWindowActive] = useState(true);
  const [isScreenCaptureDetected, setIsScreenCaptureDetected] = useState(false);

  // Detect screen recording/sharing
  useEffect(() => {
    if (!enabled) return;

    const detectScreenCapture = async () => {
      try {
        // Check if screen sharing is active
        if (navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia) {
          const stream = await navigator.mediaDevices.getDisplayMedia({
            video: true,
            audio: false
          });

          // If we get here, screen sharing was activated
          setIsScreenCaptureDetected(true);

          // Stop the stream immediately
          stream.getTracks().forEach(track => track.stop());

          // Alert user
          alert('Screen recording detected. Please stop recording to continue using this application.');
        }
      } catch (err) {
        // User denied screen sharing permission - this is expected
        setIsScreenCaptureDetected(false);
      }
    };

    // Monitor visibility change
    const handleVisibilityChange = () => {
      setIsWindowActive(!document.hidden);
    };

    // Monitor focus/blur
    const handleFocus = () => setIsWindowActive(true);
    const handleBlur = () => setIsWindowActive(false);

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);

    // Check for screen capture periodically
    const captureCheckInterval = setInterval(detectScreenCapture, 5000);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);
      clearInterval(captureCheckInterval);
    };
  }, [enabled]);

  // CSS class for blur effect
  const containerClass = `
    relative overflow-hidden
    ${blurOnInactive && !isWindowActive ? 'filter blur-sm' : ''}
    ${isScreenCaptureDetected ? 'filter blur-lg' : ''}
  `;

  if (!enabled) {
    return <>{children}</>;
  }

  return (
    <div ref={containerRef} className={containerClass}>
      {/* Watermark overlay */}
      <div
        className="absolute inset-0 pointer-events-none z-50"
        style={{
          backgroundImage: `url("data:image/svg+xml,${encodeURIComponent(
            generateWatermarkSVG(watermarkText)
          )}")`,
          backgroundRepeat: 'repeat',
          backgroundSize: '200px 100px',
          opacity: 0.05
        }}
      />

      {/* Content */}
      <div className="relative z-10">
        {children}
      </div>

      {/* Screen capture warning */}
      {isScreenCaptureDetected && (
        <div className="absolute inset-0 bg-red-600 bg-opacity-90 flex items-center justify-center z-50">
          <div className="text-white text-center p-6">
            <h2 className="text-2xl font-bold mb-4">Recording Detected</h2>
            <p>Screen recording is not permitted while viewing protected health information.</p>
            <button
              onClick={() => setIsScreenCaptureDetected(false)}
              className="mt-4 bg-white text-red-600 px-4 py-2 rounded font-medium"
            >
              I Have Stopped Recording
            </button>
          </div>
        </div>
      )}

      {/* Inactive window overlay */}
      {blurOnInactive && !isWindowActive && (
        <div className="absolute inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center z-40">
          <div className="text-white text-center">
            <h3 className="text-lg font-semibold">Protected Content Hidden</h3>
            <p className="text-sm">Click to return to the application</p>
          </div>
        </div>
      )}
    </div>
  );
};

const generateWatermarkSVG = (text: string): string => {
  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="200" height="100">
      <text
        x="100"
        y="50"
        font-family="Arial, sans-serif"
        font-size="12"
        fill="currentColor"
        text-anchor="middle"
        transform="rotate(-45 100 50)"
      >
        ${text}
      </text>
    </svg>
  `;
};
```

### 3. Copy Prevention and Text Selection Control

#### Selective Copy Protection
```tsx
interface CopyProtectedContentProps {
  level: 'none' | 'disable-select' | 'disable-copy' | 'watermark-copy';
  allowedRoles?: string[];
  children: React.ReactNode;
}

const CopyProtectedContent: React.FC<CopyProtectedContentProps> = ({
  level,
  allowedRoles = [],
  children
}) => {
  const { userRole } = useAuth();
  const [copyAttempts, setCopyAttempts] = useState(0);

  // Check if user role allows copying
  const isCopyAllowed = allowedRoles.includes(userRole);

  useEffect(() => {
    if (level === 'none' || isCopyAllowed) return;

    // Disable context menu
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      return false;
    };

    // Monitor copy attempts
    const handleKeyDown = (e: KeyboardEvent) => {
      // Detect Ctrl+C, Ctrl+A, Ctrl+X
      if (e.ctrlKey && ['c', 'a', 'x'].includes(e.key.toLowerCase())) {
        e.preventDefault();

        setCopyAttempts(prev => prev + 1);

        // Log copy attempt
        auditLogger.logCopyAttempt({
          userRole,
          timestamp: new Date().toISOString(),
          attemptNumber: copyAttempts + 1
        });

        // Show warning after multiple attempts
        if (copyAttempts >= 2) {
          alert('Copying protected health information is not permitted. This action has been logged.');
        }

        return false;
      }

      // Disable F12, Ctrl+Shift+I (Developer Tools)
      if (e.key === 'F12' ||
          (e.ctrlKey && e.shiftKey && e.key === 'I') ||
          (e.ctrlKey && e.shiftKey && e.key === 'J') ||
          (e.ctrlKey && e.key === 'U')) {
        e.preventDefault();
        return false;
      }
    };

    // Override clipboard operations
    const handleCopy = (e: ClipboardEvent) => {
      if (level === 'watermark-copy') {
        // Allow copy but add watermark
        const selection = window.getSelection()?.toString();
        if (selection) {
          const watermarkedText = `${selection}\n\n--- CONFIDENTIAL HEALTH INFORMATION ---\nViewed by: ${userRole}\nTimestamp: ${new Date().toISOString()}\nSource: Health Platform`;

          e.clipboardData?.setData('text/plain', watermarkedText);
          e.preventDefault();
        }
      } else {
        e.preventDefault();
      }
    };

    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('copy', handleCopy);

    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('copy', handleCopy);
    };
  }, [level, isCopyAllowed, userRole, copyAttempts]);

  const contentStyle = {
    userSelect: (level === 'disable-select' && !isCopyAllowed) ? 'none' as const : 'auto' as const,
    WebkitUserSelect: (level === 'disable-select' && !isCopyAllowed) ? 'none' as const : 'auto' as const,
    MozUserSelect: (level === 'disable-select' && !isCopyAllowed) ? 'none' as const : 'auto' as const,
    msUserSelect: (level === 'disable-select' && !isCopyAllowed) ? 'none' as const : 'auto' as const,
  };

  return (
    <div style={contentStyle} className="copy-protected-content">
      {children}
    </div>
  );
};
```

## Session Management and Timeouts

### 1. Intelligent Session Timeout

#### Activity-Based Session Management
```tsx
import { useCallback, useEffect, useRef, useState } from 'react';

interface SessionManagerProps {
  timeoutMinutes: number;
  warningMinutes: number;
  phiAccessTimeout?: number; // Shorter timeout for PHI access
  onTimeout: () => void;
  onWarning: (remainingTime: number) => void;
}

const useSessionManager = ({
  timeoutMinutes,
  warningMinutes,
  phiAccessTimeout = 5, // 5 minutes for PHI
  onTimeout,
  onWarning
}: SessionManagerProps) => {
  const [isActive, setIsActive] = useState(true);
  const [lastActivity, setLastActivity] = useState(Date.now());
  const [isPHIVisible, setIsPHIVisible] = useState(false);
  const [sessionWarningShown, setSessionWarningShown] = useState(false);

  const timeoutRef = useRef<NodeJS.Timeout>();
  const warningRef = useRef<NodeJS.Timeout>();
  const phiTimeoutRef = useRef<NodeJS.Timeout>();

  // Activities that reset the timer
  const activityEvents = [
    'mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'
  ];

  const updateActivity = useCallback(() => {
    const now = Date.now();
    setLastActivity(now);
    setSessionWarningShown(false);

    // Clear existing timers
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (warningRef.current) clearTimeout(warningRef.current);

    // Set warning timer
    warningRef.current = setTimeout(() => {
      if (!sessionWarningShown) {
        setSessionWarningShown(true);
        onWarning(timeoutMinutes - warningMinutes);
      }
    }, (timeoutMinutes - warningMinutes) * 60 * 1000);

    // Set session timeout
    timeoutRef.current = setTimeout(() => {
      onTimeout();
    }, timeoutMinutes * 60 * 1000);

  }, [timeoutMinutes, warningMinutes, sessionWarningShown, onTimeout, onWarning]);

  const setPHIVisible = useCallback((visible: boolean) => {
    setIsPHIVisible(visible);

    if (visible) {
      // Set shorter timeout for PHI access
      if (phiTimeoutRef.current) clearTimeout(phiTimeoutRef.current);

      phiTimeoutRef.current = setTimeout(() => {
        // Auto-hide PHI after timeout
        setIsPHIVisible(false);

        // Trigger warning about PHI timeout
        onWarning(0);
      }, phiAccessTimeout * 60 * 1000);
    } else {
      // Clear PHI timeout when hiding PHI
      if (phiTimeoutRef.current) clearTimeout(phiTimeoutRef.current);
    }
  }, [phiAccessTimeout, onWarning]);

  // Set up activity listeners
  useEffect(() => {
    activityEvents.forEach(event => {
      document.addEventListener(event, updateActivity);
    });

    // Initial activity setup
    updateActivity();

    return () => {
      activityEvents.forEach(event => {
        document.removeEventListener(event, updateActivity);
      });

      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (warningRef.current) clearTimeout(warningRef.current);
      if (phiTimeoutRef.current) clearTimeout(phiTimeoutRef.current);
    };
  }, [updateActivity]);

  return {
    isActive,
    lastActivity,
    isPHIVisible,
    setPHIVisible,
    extendSession: updateActivity,
    getRemainingTime: () => {
      const elapsed = Date.now() - lastActivity;
      const remaining = (timeoutMinutes * 60 * 1000) - elapsed;
      return Math.max(0, Math.floor(remaining / 1000));
    }
  };
};

// Session timeout warning component
const SessionTimeoutWarning: React.FC<{
  remainingTime: number;
  onExtend: () => void;
  onLogout: () => void;
}> = ({ remainingTime, onExtend, onLogout }) => {
  const [countdown, setCountdown] = useState(remainingTime);

  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          onLogout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [onLogout]);

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md mx-4">
        <div className="text-center">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-yellow-100 mb-4">
            <svg className="h-6 w-6 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.732 13.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>

          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Session Timeout Warning
          </h3>

          <p className="text-sm text-gray-500 mb-4">
            Your session will expire in{' '}
            <span className="font-mono text-lg text-red-600">
              {formatTime(countdown)}
            </span>
          </p>

          <div className="flex space-x-3">
            <button
              onClick={onExtend}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded"
            >
              Extend Session
            </button>
            <button
              onClick={onLogout}
              className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-700 font-medium py-2 px-4 rounded"
            >
              Logout Now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
```

### 2. Secure Storage Management

#### Encrypted Local Storage for Health Data
```tsx
import CryptoJS from 'crypto-js';

class SecureHealthDataStorage {
  private encryptionKey: string;
  private keyDerivationSalt: string;

  constructor() {
    // Use session-based encryption key
    this.keyDerivationSalt = 'health-platform-salt-v1';
    this.encryptionKey = this.deriveEncryptionKey();
  }

  private deriveEncryptionKey(): string {
    // Derive key from user session and browser fingerprint
    const sessionToken = sessionStorage.getItem('sessionToken') || '';
    const browserFingerprint = this.getBrowserFingerprint();

    return CryptoJS.PBKDF2(
      sessionToken + browserFingerprint,
      this.keyDerivationSalt,
      { keySize: 256/32, iterations: 10000 }
    ).toString();
  }

  private getBrowserFingerprint(): string {
    // Create browser fingerprint for additional security
    const fingerprint = [
      navigator.userAgent,
      navigator.language,
      screen.width + 'x' + screen.height,
      new Date().getTimezoneOffset(),
      navigator.platform
    ].join('|');

    return CryptoJS.SHA256(fingerprint).toString();
  }

  // Store encrypted health data
  storeHealthData(key: string, data: any, expirationMinutes: number = 30): void {
    const timestamp = Date.now();
    const expiration = timestamp + (expirationMinutes * 60 * 1000);

    const payload = {
      data,
      timestamp,
      expiration,
      dataType: 'phi'
    };

    try {
      const encrypted = CryptoJS.AES.encrypt(
        JSON.stringify(payload),
        this.encryptionKey
      ).toString();

      sessionStorage.setItem(`phi_${key}`, encrypted);

      // Log storage operation
      this.auditStorageOperation('STORE', key, true);
    } catch (error) {
      this.auditStorageOperation('STORE', key, false, error.message);
      throw new Error('Failed to securely store health data');
    }
  }

  // Retrieve and decrypt health data
  getHealthData(key: string): any | null {
    try {
      const encrypted = sessionStorage.getItem(`phi_${key}`);
      if (!encrypted) {
        return null;
      }

      const decrypted = CryptoJS.AES.decrypt(encrypted, this.encryptionKey);
      const payload = JSON.parse(decrypted.toString(CryptoJS.enc.Utf8));

      // Check expiration
      if (Date.now() > payload.expiration) {
        this.removeHealthData(key);
        this.auditStorageOperation('RETRIEVE', key, false, 'Data expired');
        return null;
      }

      this.auditStorageOperation('RETRIEVE', key, true);
      return payload.data;

    } catch (error) {
      this.auditStorageOperation('RETRIEVE', key, false, error.message);
      return null;
    }
  }

  // Remove health data
  removeHealthData(key: string): void {
    try {
      sessionStorage.removeItem(`phi_${key}`);
      this.auditStorageOperation('REMOVE', key, true);
    } catch (error) {
      this.auditStorageOperation('REMOVE', key, false, error.message);
    }
  }

  // Clear all health data
  clearAllHealthData(): void {
    try {
      const keysToRemove: string[] = [];

      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key?.startsWith('phi_')) {
          keysToRemove.push(key);
        }
      }

      keysToRemove.forEach(key => sessionStorage.removeItem(key));

      this.auditStorageOperation('CLEAR_ALL', 'all_phi_data', true);
    } catch (error) {
      this.auditStorageOperation('CLEAR_ALL', 'all_phi_data', false, error.message);
    }
  }

  private auditStorageOperation(
    operation: string,
    key: string,
    success: boolean,
    error?: string
  ): void {
    const auditEntry = {
      timestamp: new Date().toISOString(),
      operation,
      key: key.replace('phi_', ''), // Don't log full key
      success,
      error,
      userAgent: navigator.userAgent,
      url: window.location.href
    };

    // Log to secure audit endpoint
    fetch('/api/audit/storage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(auditEntry)
    }).catch(console.error);
  }
}

// React hook for secure health data storage
const useSecureHealthDataStorage = () => {
  const storage = useRef(new SecureHealthDataStorage());

  useEffect(() => {
    // Clear all health data when component unmounts or page unloads
    const clearDataOnUnload = () => {
      storage.current.clearAllHealthData();
    };

    window.addEventListener('beforeunload', clearDataOnUnload);
    window.addEventListener('unload', clearDataOnUnload);

    return () => {
      window.removeEventListener('beforeunload', clearDataOnUnload);
      window.removeEventListener('unload', clearDataOnUnload);
      clearDataOnUnload();
    };
  }, []);

  return {
    storeHealthData: storage.current.storeHealthData.bind(storage.current),
    getHealthData: storage.current.getHealthData.bind(storage.current),
    removeHealthData: storage.current.removeHealthData.bind(storage.current),
    clearAllHealthData: storage.current.clearAllHealthData.bind(storage.current)
  };
};
```

## Content Security and Privacy UI Patterns

### 1. Privacy-First Form Controls

#### HIPAA-Compliant Form Components
```tsx
interface PrivacyAwareInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  sensitivityLevel: 'public' | 'internal' | 'confidential' | 'phi';
  onChange: (value: string, metadata: { userConfirmed: boolean }) => void;
  requireConfirmation?: boolean;
  auditTrail?: boolean;
}

const PrivacyAwareInput: React.FC<PrivacyAwareInputProps> = ({
  sensitivityLevel,
  onChange,
  requireConfirmation = false,
  auditTrail = true,
  ...inputProps
}) => {
  const [value, setValue] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setValue(newValue);

    // Immediate callback for non-PHI data
    if (sensitivityLevel !== 'phi') {
      onChange(newValue, { userConfirmed: true });
      return;
    }

    // Require confirmation for PHI
    if (requireConfirmation && !confirmed) {
      setShowConfirmation(true);
    } else {
      onChange(newValue, { userConfirmed: confirmed });
    }

    // Audit trail for PHI
    if (auditTrail && sensitivityLevel === 'phi') {
      auditLogger.logPHIInput({
        fieldName: inputProps.name || 'unknown',
        valueLength: newValue.length,
        timestamp: new Date().toISOString()
      });
    }
  };

  const handleConfirmation = (confirm: boolean) => {
    setConfirmed(confirm);
    setShowConfirmation(false);

    if (confirm) {
      onChange(value, { userConfirmed: true });
    } else {
      setValue('');
      onChange('', { userConfirmed: false });
    }
  };

  const getSensitivityStyles = () => {
    const styles = {
      public: 'border-gray-300 focus:border-blue-500',
      internal: 'border-yellow-300 focus:border-yellow-500 bg-yellow-50',
      confidential: 'border-orange-300 focus:border-orange-500 bg-orange-50',
      phi: 'border-red-300 focus:border-red-500 bg-red-50'
    };

    return styles[sensitivityLevel];
  };

  return (
    <div className="relative">
      <input
        {...inputProps}
        value={value}
        onChange={handleInputChange}
        className={`
          w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-1
          ${getSensitivityStyles()}
        `}
      />

      {/* Sensitivity indicator */}
      <div className="absolute inset-y-0 right-0 flex items-center pr-3">
        <SensitivityIndicator level={sensitivityLevel} />
      </div>

      {/* Confirmation dialog */}
      {showConfirmation && (
        <div className="absolute top-full left-0 right-0 bg-white border border-red-300 rounded-md shadow-lg p-4 z-10 mt-1">
          <p className="text-sm text-red-700 mb-3">
            You are entering Protected Health Information. Are you authorized to input this data?
          </p>
          <div className="flex space-x-2">
            <button
              onClick={() => handleConfirmation(true)}
              className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700"
            >
              Yes, I'm Authorized
            </button>
            <button
              onClick={() => handleConfirmation(false)}
              className="bg-gray-300 text-gray-700 px-3 py-1 rounded text-sm hover:bg-gray-400"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const SensitivityIndicator: React.FC<{ level: string }> = ({ level }) => {
  const config = {
    public: { icon: '🟢', label: 'Public' },
    internal: { icon: '🟡', label: 'Internal' },
    confidential: { icon: '🟠', label: 'Confidential' },
    phi: { icon: '🔴', label: 'PHI' }
  };

  const { icon, label } = config[level as keyof typeof config] || config.public;

  return (
    <span title={`Sensitivity: ${label}`} className="text-sm">
      {icon}
    </span>
  );
};
```

## Summary

These frontend privacy controls provide:

1. **Progressive Disclosure**: Contextual revealing of health information with justification requirements
2. **Data Masking**: Multiple masking patterns for different types of health data
3. **Screen Protection**: Watermarking, blur effects, and recording detection
4. **Copy Prevention**: Selective copy protection with audit logging
5. **Session Management**: Intelligent timeouts with PHI-specific shorter durations
6. **Secure Storage**: Encrypted local storage with automatic cleanup
7. **Privacy-Aware Forms**: HIPAA-compliant form controls with confirmation flows

These patterns ensure HIPAA compliance while maintaining usability for healthcare providers and maintaining the security of Protected Health Information in web applications.