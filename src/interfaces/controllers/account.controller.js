import { createAccount } from '../../usecases/account/createAccount.js';
import { signInAccount } from '../../usecases/account/signInAccount.js';
import { getUserProfileData } from '../../usecases/account/getUserProfile.js';

export const signup = async (req, res, next) => {
    try {
        const { email, password, displayName } = req.body;
        const result = await createAccount({ email, password, displayName });
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
        const uid = req.params.uid;
        const result = await getUserProfileData({ uid });
        res.status(200).json({ success: true, profile: result });
    } catch (err) {
        next(err);
    }
};