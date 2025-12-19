import { updateBookingInFirestore, getBookingsByUserId } from '../../infrastructure/services/firebase.services.js';

export const cancelBookingUsecase = async (bookingId, userId) => {
    if (!bookingId) {
        throw new Error("Booking ID is required");
    }

    const userBookings = await getBookingsByUserId(userId);
    const isOwner = userBookings.some(b => b.id === bookingId);
    if (!isOwner) throw new Error("Unauthorized access to booking");

    const updateData = {
        status: 'cancelled',
        updatedAt: new Date(),
        updatedBy: userId
    };

    const result = await updateBookingInFirestore(bookingId, updateData);
    return result;
};