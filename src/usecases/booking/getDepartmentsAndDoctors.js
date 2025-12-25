// import { fetchDepartmentsAndDoctors } from '../../infrastructure/services/n8n.services.js';

import { fetchDepartmentsAndDoctors } from "../../infrastructure/services/firebase.services.js";

export const getDepartmentsAndDoctorsService = async () => {
  const results = await fetchDepartmentsAndDoctors();
  return results;
};
