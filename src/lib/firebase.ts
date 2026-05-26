import { initializeApp, getApps, getApp } from "firebase/app";
import { getMessaging } from "firebase/messaging";

const firebaseConfig = {
  apiKey: "AIzaSyDu4owJiwIpna2QzY1sZ3Y8Y-ZjFMw6KJw",
  authDomain: "veilo-campus-chat.firebaseapp.com",
  projectId: "veilo-campus-chat",
  storageBucket: "veilo-campus-chat.firebasestorage.app",
  messagingSenderId: "871676060190",
  appId: "1:871676060190:web:673d52fad8bd708a9b840f"
};

// Initialize Firebase client-side only (avoid SSR crash)
export function getFirebaseApp() {
  if (typeof window === "undefined") return null;
  return getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
}

export function getFirebaseMessaging() {
  if (typeof window === "undefined") return null;
  try {
    const app = getFirebaseApp();
    return app ? getMessaging(app) : null;
  } catch (error) {
    console.error("Failed to initialize Firebase Messaging:", error);
    return null;
  }
}
