/**
 * Client-side Push Notification Utilities
 * Handles service worker registration, permission requests, and subscription management
 */

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';

/**
 * Check if push notifications are supported
 */
export function isPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

/**
 * Get current notification permission status
 */
export function getPermissionStatus(): NotificationPermission | 'unsupported' {
  if (!isPushSupported()) {
    return 'unsupported';
  }
  return Notification.permission;
}

/**
 * Check if we should ask for permission
 * Returns true if permission is 'default' (never asked)
 */
export function shouldAskPermission(): boolean {
  const status = getPermissionStatus();
  return status === 'default';
}

/**
 * Check if permission was denied
 */
export function isPermissionDenied(): boolean {
  return getPermissionStatus() === 'denied';
}

/**
 * Check if permission was granted
 */
export function isPermissionGranted(): boolean {
  return getPermissionStatus() === 'granted';
}

/**
 * Register the service worker
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!isPushSupported()) {
    console.log('[Push] Service workers not supported');
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
    });
    console.log('[Push] Service Worker registered:', registration.scope);
    return registration;
  } catch (error) {
    console.error('[Push] Service Worker registration failed:', error);
    return null;
  }
}

/**
 * Get existing service worker registration
 */
export async function getServiceWorkerRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!isPushSupported()) {
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    return registration;
  } catch (error) {
    console.error('[Push] Failed to get service worker:', error);
    return null;
  }
}

/**
 * Request notification permission from user
 * Returns the permission status after request
 */
export async function requestPermission(): Promise<NotificationPermission> {
  if (!isPushSupported()) {
    throw new Error('Push notifications not supported');
  }

  const permission = await Notification.requestPermission();
  console.log('[Push] Permission result:', permission);
  return permission;
}

/**
 * Convert VAPID public key to Uint8Array for subscription
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Subscribe to push notifications
 * Returns the subscription object to send to server
 */
export async function subscribeToPush(): Promise<PushSubscription | null> {
  if (!isPermissionGranted()) {
    console.log('[Push] Permission not granted');
    return null;
  }

  const registration = await getServiceWorkerRegistration();
  if (!registration) {
    console.error('[Push] No service worker registration');
    return null;
  }

  try {
    // Check for existing subscription
    let subscription = await registration.pushManager.getSubscription();
    
    if (subscription) {
      console.log('[Push] Using existing subscription');
      return subscription;
    }

    // Create new subscription
    const vapidKey = VAPID_PUBLIC_KEY;
    console.log('[Push] VAPID key length:', vapidKey.length);
    
    if (!vapidKey || vapidKey.length < 50) {
      console.error('[Push] Invalid VAPID public key - check NEXT_PUBLIC_VAPID_PUBLIC_KEY env var');
      return null;
    }

    const applicationServerKey = urlBase64ToUint8Array(vapidKey);
    console.log('[Push] Application server key bytes:', applicationServerKey.length);
    
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: applicationServerKey,
    });

    console.log('[Push] New subscription created');
    return subscription;
  } catch (error) {
    // If subscription fails, try unsubscribing first and retry
    if (error instanceof Error && error.name === 'AbortError') {
      console.log('[Push] AbortError - attempting to clear and retry...');
      try {
        const existingSub = await registration.pushManager.getSubscription();
        if (existingSub) {
          await existingSub.unsubscribe();
          console.log('[Push] Cleared existing subscription, retrying...');
          
          const applicationServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
          const newSub = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: applicationServerKey,
          });
          console.log('[Push] Retry successful');
          return newSub;
        }
      } catch (retryError) {
        console.error('[Push] Retry also failed:', retryError);
      }
    }
    console.error('[Push] Subscription failed:', error);
    return null;
  }
}

/**
 * Unsubscribe from push notifications
 */
export async function unsubscribeFromPush(): Promise<boolean> {
  const registration = await getServiceWorkerRegistration();
  if (!registration) {
    return false;
  }

  try {
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      await subscription.unsubscribe();
      console.log('[Push] Unsubscribed successfully');
      return true;
    }
    return false;
  } catch (error) {
    console.error('[Push] Unsubscribe failed:', error);
    return false;
  }
}

/**
 * Get device information for subscription
 */
export function getDeviceInfo(): {
  deviceType: 'desktop' | 'mobile' | 'tablet';
  browser: string;
  os: string;
} {
  const ua = navigator.userAgent;
  
  // Detect device type
  let deviceType: 'desktop' | 'mobile' | 'tablet' = 'desktop';
  if (/tablet|ipad|playbook|silk/i.test(ua)) {
    deviceType = 'tablet';
  } else if (/mobile|iphone|ipod|android|blackberry|opera mini|iemobile/i.test(ua)) {
    deviceType = 'mobile';
  }

  // Detect browser
  let browser = 'Unknown';
  if (ua.includes('Firefox')) browser = 'Firefox';
  else if (ua.includes('Edg')) browser = 'Edge';
  else if (ua.includes('Chrome')) browser = 'Chrome';
  else if (ua.includes('Safari')) browser = 'Safari';
  else if (ua.includes('Opera')) browser = 'Opera';

  // Detect OS
  let os = 'Unknown';
  if (ua.includes('Windows')) os = 'Windows';
  else if (ua.includes('Mac')) os = 'macOS';
  else if (ua.includes('Linux')) os = 'Linux';
  else if (ua.includes('Android')) os = 'Android';
  else if (/iPhone|iPad|iPod/.test(ua)) os = 'iOS';

  return { deviceType, browser, os };
}

/**
 * Save subscription to server
 */
export async function saveSubscriptionToServer(
  subscription: PushSubscription,
  token: string
): Promise<boolean> {
  const deviceInfo = getDeviceInfo();
  const subscriptionJson = subscription.toJSON();

  // Debug log
  console.log('[Push] Subscription JSON:', JSON.stringify(subscriptionJson, null, 2));

  // Validate keys exist
  if (!subscriptionJson.keys?.p256dh || !subscriptionJson.keys?.auth) {
    console.error('[Push] Missing keys in subscription:', subscriptionJson);
    return false;
  }

  try {
    const response = await fetch('/api/notifications/subscribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        endpoint: subscriptionJson.endpoint,
        p256dh_key: subscriptionJson.keys.p256dh,
        auth_key: subscriptionJson.keys.auth,
        device_type: deviceInfo.deviceType,
        browser: deviceInfo.browser,
        os: deviceInfo.os,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('[Push] Server error:', response.status, errorData);
      throw new Error(errorData.error || 'Failed to save subscription');
    }

    console.log('[Push] Subscription saved to server');
    return true;
  } catch (error) {
    console.error('[Push] Failed to save subscription:', error);
    return false;
  }
}

/**
 * Remove subscription from server
 */
export async function removeSubscriptionFromServer(token: string): Promise<boolean> {
  const registration = await getServiceWorkerRegistration();
  if (!registration) return false;

  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return false;

  try {
    const response = await fetch('/api/notifications/unsubscribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        endpoint: subscription.endpoint,
      }),
    });

    return response.ok;
  } catch (error) {
    console.error('[Push] Failed to remove subscription:', error);
    return false;
  }
}

/**
 * Full flow: Request permission, subscribe, and save to server
 */
export async function enablePushNotifications(token: string): Promise<{
  success: boolean;
  error?: string;
  isLocalHostIssue?: boolean;
}> {
  try {
    // 1. Register service worker
    await registerServiceWorker();

    // 2. Request permission
    const permission = await requestPermission();
    if (permission !== 'granted') {
      return {
        success: false,
        error: permission === 'denied' 
          ? 'Notifications blocked. Please enable in browser settings.'
          : 'Permission not granted',
      };
    }

    // 3. Subscribe to push
    const subscription = await subscribeToPush();
    if (!subscription) {
      // Check if this is a localhost issue
      const isLocalhost = typeof window !== 'undefined' && 
        (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
      
      if (isLocalhost) {
        console.warn('[Push] Push subscription failed on localhost - this is a known Chrome limitation');
        return { 
          success: false, 
          error: 'Push notifications may not work on localhost. They will work in production.',
          isLocalHostIssue: true,
        };
      }
      return { success: false, error: 'Failed to create subscription' };
    }

    // 4. Save to server
    const saved = await saveSubscriptionToServer(subscription, token);
    if (!saved) {
      return { success: false, error: 'Failed to save subscription' };
    }

    return { success: true };
  } catch (error) {
    console.error('[Push] Enable notifications failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Check if user has an active subscription
 */
export async function hasActiveSubscription(): Promise<boolean> {
  const registration = await getServiceWorkerRegistration();
  if (!registration) return false;

  const subscription = await registration.pushManager.getSubscription();
  return !!subscription;
}
