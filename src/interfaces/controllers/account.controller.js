import { createAccount } from '../../usecases/account/createAccount.js';
import { signInAccount } from '../../usecases/account/signInAccount.js';
import { getUserProfileData } from '../../usecases/account/getUserProfile.js';
import { signOutAccount } from '../../usecases/account/signOut.js';

export const signup = async (req, res, next) => {
    try {
        const { email, password, fullname, phone, cccd } = req.body;

        if (!email || !password) {
            const err = new Error("Email and password are required");
            err.statusCode = 400;
            throw err;
        }

        // Tạo account
        const result = await createAccount({ email, password, fullname, phone, cccd });
        
        // Tự động đăng nhập sau khi đăng ký thành công
        try {
            const authResult = await signInAccount({ email, password });
            return res.status(201).json({ 
                success: true, 
                message: 'Đăng ký thành công',
                user: result,
                auth: authResult 
            });
        } catch (signInError) {
            // Nếu đăng nhập tự động thất bại, vẫn trả về user đã tạo
            // User có thể đăng nhập thủ công sau
            console.warn('Auto sign-in after signup failed:', signInError.message);
            return res.status(201).json({ 
                success: true, 
                message: 'Đăng ký thành công. Vui lòng đăng nhập.',
                user: result,
                auth: null
            });
        }
    } catch (err) {
        next(err);
    }
};

export const signin = async (req, res, next) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            const err = new Error("Email and password are required");
            err.statusCode = 400;
            throw err;
        }

        const result = await signInAccount({ email, password });
        res.status(200).json({ success: true, auth: result });
    } catch (err) {
        next(err);
    }
};

export const getProfile = async (req, res, next) => {
    try {
        const uid = req.user?.uid;

        if (!uid) {
            const err = new Error("Unauthorized");
            err.statusCode = 401;
            throw err;
        }

        const profile = await getUserProfileData({ uid });
        res.status(200).json({ success: true, profile });
    } catch (err) {
        next(err);
    }
};

export const signOut = async (req, res, next) => {
    try {
        const uid = req.user?.uid;

        if (!uid) {
            const err = new Error("Unauthorized");
            err.statusCode = 401;
            throw err;
        }

        const result = await signOutAccount(uid);
        res.status(200).json({ success: true, ...result });
    } catch (err) {
        next(err);
    }
};
