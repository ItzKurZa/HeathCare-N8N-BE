import { fetchDepartmentsAndDoctors } from '../../services/n8n.services.js';

export const getDepartmentsAndDoctorsService = async () => {
  return await fetchDepartmentsAndDoctors();
};
