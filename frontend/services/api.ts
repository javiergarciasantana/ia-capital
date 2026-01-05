import axios from 'axios';
import { toast } from 'react-toastify'; // Or your preferred notification library

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api',
});

// Function to handle logout logic
const handleLogout = () => {
  localStorage.removeItem('token');
  // Also clear any user state from Redux, Zustand, Context, etc.
  window.location.href = '/login'; // Redirect to login page
};

// Response interceptor
api.interceptors.response.use(
  (response) => response, // Pass through successful responses
  (error) => {
    if (error.response && error.response.status === 401) {
      // Get the custom message from our backend
      const message = error.response.data?.message || 'Tu sesión ha expirado.';
      
      // Show a notification toast
      toast.error(message);

      // Perform logout
      handleLogout();
    }
    
    // For other errors, just reject the promise
    return Promise.reject(error);
  }
);

export default api;