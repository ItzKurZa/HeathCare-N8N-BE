import { fetchDepartmentsAndDoctors } from '../../infrastructure/services/n8n.services.js';

export const getDepartmentsAndDoctorsService = async () => {
  const results = await fetchDepartmentsAndDoctors();
  console.log('Fetched departments and doctors:', results);
  return results;
};
