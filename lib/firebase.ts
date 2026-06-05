import { initializeApp } from 'firebase/app'
import { getDatabase } from 'firebase/database'
import { getStorage } from 'firebase/storage'

const firebaseConfig = {
  apiKey: "AIzaSyAD6dq7K5QltLCYgDWvTKBgoxFPdomML2k",
  authDomain: "cub-lake-cottage-tasks.firebaseapp.com",
  databaseURL: "https://cub-lake-cottage-tasks-default-rtdb.firebaseio.com",
  projectId: "cub-lake-cottage-tasks",
  storageBucket: "cub-lake-cottage-tasks.firebasestorage.app",
  messagingSenderId: "1076820343618",
  appId: "1:1076820343618:web:00683f472a2a79121a66db",
}

const app = initializeApp(firebaseConfig)
export const db = getDatabase(app)
export const storage = getStorage(app)
