import { createUser } from '../../infrastructure/services/firebase.services.js';
import { requireFields, toE164 } from '../../utils/validate.js';

/**
 * Tạo tài khoản doctor
 * @param {Object} params - Thông tin doctor
 * @param {string} params.email - Email của doctor
 * @param {string} params.password - Password
 * @param {string} params.fullname - Tên đầy đủ
 * @param {string} params.doctor_name - Tên bác sĩ (ví dụ: "BS. Nguyễn Văn A")
 * @param {string} params.department - Tên khoa (ví dụ: "Nội tổng quát")
 * @param {string} [params.departmentId] - ID của khoa (optional)
 * @param {string} [params.phone] - Số điện thoại (optional)
 * @param {string} [params.cccd] - CCCD (optional)
 * @returns {Promise<Object>} User data đã tạo
 */
export const createDoctorAccount = async ({ 
  email, 
  password, 
  fullname, 
  doctor_name, 
  department, 
  departmentId,
  phone,
  cccd 
}) => {
  requireFields({ email, password, doctor_name, department }, [
    'email', 
    'password', 
    'doctor_name', 
    'department'
  ]);

  console.log('Creating doctor account:', { email, doctor_name, department });

  const result = await createUser({ 
    email, 
    password, 
    fullname: fullname || doctor_name, 
    phone: phone ? toE164(phone) : undefined, 
    cccd,
    role: 'doctor',
    doctor_name,
    department,
    departmentId
  });

  return result;
};

