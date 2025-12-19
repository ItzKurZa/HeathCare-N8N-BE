import { createAccount } from '../../usecases/account/createAccount.js';
import { signInAccount } from '../../usecases/account/signInAccount.js';
import { getUserProfileData } from '../../usecases/account/getUserProfile.js';
import { signOutAccount } from '../../usecases/account/signOut.js';
import { refreshToken } from '../../usecases/account/refreshToken.js';

export const signup = async (req, res, next) => {
    try {
        const { email, password, fullname, phone, cccd } = req.body;
        const result = await createAccount({ email, password, fullname, phone, cccd });
        res.status(201).json({ success: true, ...result });
    } catch (err) {
        next(err);
    }
};

export const signin = async (req, res, next) => {
    try {
        const { email, password } = req.body;
        const result = await signInAccount({ email, password });
        res.status(200).json({ success: true, auth: result });
    } catch (err) {
        next(err);
    }
};

export const getProfile = async (req, res, next) => {
    try {
        const uid = req.user?.uid;
        if (!uid) return res.status(401).json({ success: false, message: 'Unauthorized' });

        const profile = await getUserProfileData({ uid });
        res.status(200).json({ success: true, profile });
    } catch (err) {
        next(err);
    }
};

export const signOut = async (req, res, next) => {
    try {
        const uid = req.user?.uid;
        if (!uid) return res.status(401).json({ success: false, message: 'Unauthorized' });

        const result = await signOutAccount(uid);
        res.status(200).json({ success: true, ...result });
    } catch (err) {
        next(err);
    }
};

export const refreshToken = async (req, res, next) => {
    try {
        const { refreshToken } = req.body;
        const result = await refreshTokenUsecase(refreshToken);
        res.status(200).json({ success: true, ...result });
    } catch (err) {
        res.status(401).json({ success: false, message: err.message });
    }
};