import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL;

export const register = async ({ email, password, full_name, role = 'customer' }) => {
  const res = await axios.post(`${API_URL}/auth/register`, {
    email,
    password,
    full_name,
    role,
  });
  return res.data;
};

export const login = async ({ email, password }) => {
  const res = await axios.post(`${API_URL}/auth/login`, {
    email,
    password,
  });
  return res.data;
};
