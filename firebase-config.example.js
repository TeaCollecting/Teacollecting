// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCt8hvEtrNGy_wU7UkGz8HWOVUdWG66ASE",
  authDomain: "teacollecting.firebaseapp.com",
  projectId: "teacollecting",
  storageBucket: "teacollecting.firebasestorage.app",
  messagingSenderId: "1068483603311",
  appId: "1:1068483603311:web:254b058ec68c417a6c969a",
  measurementId: "G-0T603X6PEW"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
