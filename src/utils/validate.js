export const requireFields = (obj, fields) => {
    const missing = fields.filter((f) => !(f in obj));
    if (missing.length) throw new Error(`Missing fields: ${missing.join(', ')}`);
};