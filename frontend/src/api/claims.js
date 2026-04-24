import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL;

export const submitClaim = async ({ user_id, accident_description, police_report_url, image_url }) => {
  const res = await axios.post(`${API_URL}/claims/submit-claim`, {
    user_id,
    accident_description,
    police_report_url,
    image_url,
  });
  return res.data;
};

export const interrogateClaim = async ({ claim_id, answers }) => {
  const res = await axios.post(`${API_URL}/claims/interrogate`, {
    claim_id,
    answers,
  });
  return res.data;
};

export const getUserClaims = async (userId) => {
  const res = await axios.get(`${API_URL}/claims/user/${userId}`);
  return res.data;
};

export const getAdminStats = async () => {
  const res = await axios.get(`${API_URL}/claims/admin/stats`);
  return res.data;
};

export const getFlaggedClaims = async () => {
  const res = await axios.get(`${API_URL}/claims/admin/flagged`);
  return res.data;
};

export const getApprovedClaims = async () => {
  const res = await axios.get(`${API_URL}/claims/admin/approved`);
  return res.data;
};

export const getAllClaims = async () => {
  const res = await axios.get(`${API_URL}/claims/admin/all`);
  return res.data;
};

export const adminAction = async ({ claim_id, action }) => {
  const res = await axios.post(`${API_URL}/claims/admin/action`, {
    claim_id,
    action,
  });
  return res.data;
};
