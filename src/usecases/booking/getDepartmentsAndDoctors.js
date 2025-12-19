import { getDepartmentsAndDoctorsFromFirestore } from "../../infrastructure/services/firebase.services.js";

export const getDepartmentsAndDoctorsService = async () => {
  const results = await getDepartmentsAndDoctorsFromFirestore();
  return results;
};
