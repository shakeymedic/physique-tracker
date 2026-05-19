// Firebase Cloud Messaging Service Worker
// This minimal service worker is required by Firebase Messaging for background push notification support.
// It does NOT actually send notifications — that requires a Cloud Functions backend (planned for v3).

importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

// Firebase config will be injected at runtime from the app's env vars.
// To enable: add your firebaseConfig here (same values as .env.local).
// This file is served from /public and loaded by the browser directly.
const firebaseConfig = {
  apiKey: '',         // Fill from VITE_FIREBASE_API_KEY
  authDomain: '',     // Fill from VITE_FIREBASE_AUTH_DOMAIN
  projectId: '',      // Fill from VITE_FIREBASE_PROJECT_ID
  storageBucket: '',  // Fill from VITE_FIREBASE_STORAGE_BUCKET
  messagingSenderId: '', // Fill from VITE_FIREBASE_MESSAGING_SENDER_ID
  appId: '',          // Fill from VITE_FIREBASE_APP_ID
};

// Only initialize if config is set
if (firebaseConfig.apiKey) {
  firebase.initializeApp(firebaseConfig);
  const messaging = firebase.messaging();

  messaging.onBackgroundMessage((payload) => {
    const { title, body, icon } = payload.notification || {};
    self.registration.showNotification(title || 'Physique Tracker', {
      body: body || '',
      icon: icon || '/favicon.svg',
      badge: '/favicon.svg',
      data: payload.data,
    });
  });
}

// Handle skip waiting for app updates
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
