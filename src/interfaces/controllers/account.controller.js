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

        const result = await createAccount({ email, password, fullname, phone, cccd });
        res.status(201).json({ success: true, ...result });
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
