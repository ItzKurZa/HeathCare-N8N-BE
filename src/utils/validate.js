export const requireFields = (obj, fields) => {
    const missing = fields.filter((f) => !(f in obj));
    if (missing.length) throw new Error(`Missing fields: ${missing.join(', ')}`);
};


export function toE164(phone) {
  if (!phone) return null;

  // Xóa khoảng trắng, dấu chấm, gạch ngang
  phone = phone.replace(/\D/g, '');

  // Nếu bắt đầu bằng 0 → thay bằng +84
  if (phone.startsWith('0')) {
    return '+84' + phone.substring(1);
  }

  // Nếu đã có +84 rồi → giữ nguyên
  if (phone.startsWith('84')) {
    return '+84' + phone.substring(2);
  }

  // Nếu đã đúng dạng E.164 → giữ nguyên
  if (phone.startsWith('+')) {
    return phone;
  }

  // Nếu backend nhận dạng 9 số không có 0 → tự thêm +84
  if (/^\d{9,10}$/.test(phone)) {
    return '+84' + phone;
  }

  throw new Error('Số điện thoại không hợp lệ');
}
