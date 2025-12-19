import { getDepartmentsAndDoctorsFromFirestore } from "../../infrastructure/services/firebase.services";

export const getDepartmentsAndDoctorsService = async () => {
  const results = await getDepartmentsAndDoctorsFromFirestore();
  return results;
};
