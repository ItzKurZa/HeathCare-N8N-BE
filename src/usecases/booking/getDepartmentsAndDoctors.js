import { fetchDepartmentsAndDoctors } from '../../infrastructure/services/n8n.services.js';

export const getDepartmentsAndDoctorsService = async () => {
  const results = await fetchDepartmentsAndDoctors();
  return results;
};
