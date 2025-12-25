import cron from 'node-cron';
import { firestore } from '../../config/firebase.js';
import emailService from '../services/email.services.js';
import voiceService from '../services/voice.services.js';
import moment from 'moment';

class ScheduledTasks {
    constructor() {
        this.jobs = [];
    }

    /**
     * Khởi động tất cả scheduled tasks
     */
    start() {
        console.log('⏰ Starting scheduled tasks...');

        // Job 1: Gửi survey email mỗi giờ
        this.jobs.push(
            cron.schedule('0 * * * *', async () => {
                console.log('⏰ [HOURLY] Running survey email check...');
                await this.sendPendingSurveys();
            })
        );

        // Job 2: Gửi reminder trước appointment 24h (chạy mỗi 30 phút)
        this.jobs.push(
            cron.schedule('*/30 * * * *', async () => {
                console.log('⏰ [30MIN] Running appointment reminder check...');
                await this.sendAppointmentReminders();
            })
        );

        // Job 3: Voice follow-up calls (chạy mỗi 2 giờ, chỉ trong giờ hành chính)
        this.jobs.push(
            cron.schedule('0 */2 * * *', async () => {
                console.log('⏰ [2HOUR] Running voice follow-up check...');
                await this.makeFollowUpCalls();
            })
        );

        // Job 4: Cleanup old data (chạy lúc 2h sáng mỗi ngày)
        this.jobs.push(
            cron.schedule('0 2 * * *', async () => {
                console.log('⏰ [DAILY] Running cleanup tasks...');
                await this.cleanupOldData();
            })
        );

        console.log(`✅ ${this.jobs.length} scheduled tasks started successfully`);
    }

    /**
     * Dừng tất cả scheduled tasks
     */
    stop() {
        this.jobs.forEach(job => job.stop());
        console.log('🛑 All scheduled tasks stopped');
    }

    /**
     * Gửi survey email cho appointments đã COMPLETED nhưng chưa gửi survey
     */
    async sendPendingSurveys() {
        try {
            // Lấy appointments completed trong 48h qua, chưa gửi survey
            const twoDaysAgo = moment().subtract(48, 'hours').toDate();
            const now = new Date();

            const snapshot = await firestore.collection('appointments')
                .where('visitStatus', '==', 'COMPLETED')
                .where('survey_sent', '==', false)
                .where('updatedAt', '>=', twoDaysAgo)
                .where('updatedAt', '<=', now)
                .limit(20) // Giới hạn 20 emails mỗi lần
                .get();

            if (snapshot.empty) {
                console.log('ℹ️ No pending surveys to send');
                return;
            }

            console.log(`📧 Found ${snapshot.size} appointments needing survey emails`);

            let successCount = 0;
            let failCount = 0;

            for (const doc of snapshot.docs) {
                const appointment = { id: doc.id, ...doc.data() };

                // Bỏ qua nếu không có email
                if (!appointment.email) {
                    console.log(`⚠️ Skipping ${appointment.fullName} - no email`);
                    continue;
                }

                // Tạo survey URL (thay thế bằng URL thật của bạn)
                const surveyUrl = `${process.env.SURVEY_BASE_URL || 'https://survey.example.com'}?id=${appointment.id}`;

                // Gửi email
                const result = await emailService.sendSurvey(appointment, surveyUrl);

                if (result.success) {
                    // Cập nhật flag
                    await doc.ref.update({
                        survey_sent: true,
                        survey_sent_at: new Date(),
                        updatedAt: new Date(),
                    });
                    successCount++;
                    console.log(`✅ Survey sent to ${appointment.fullName} (${appointment.email})`);
                } else {
                    failCount++;
                    console.error(`❌ Failed to send survey to ${appointment.email}`);
                }

                // Delay 1 giây giữa các email để tránh rate limit
                await this.sleep(1000);
            }

            console.log(`📊 Survey emails: ${successCount} sent, ${failCount} failed`);

        } catch (error) {
            console.error('❌ Send pending surveys error:', error);
        }
    }

    /**
     * Gửi reminder email cho appointments sắp diễn ra (24h trước)
     */
    async sendAppointmentReminders() {
        try {
            // Lấy appointments từ 23h-25h trong tương lai
            const startTime = moment().add(23, 'hours').toDate();
            const endTime = moment().add(25, 'hours').toDate();

            const snapshot = await firestore.collection('appointments')
                .where('visitStatus', '==', 'SCHEDULED')
                .where('startTimeLocal', '>=', startTime.toISOString())
                .where('startTimeLocal', '<=', endTime.toISOString())
                .get();

            if (snapshot.empty) {
                console.log('ℹ️ No appointments needing reminders');
                return;
            }

            console.log(`📨 Found ${snapshot.size} appointments needing reminders`);

            let successCount = 0;

            for (const doc of snapshot.docs) {
                const appointment = { id: doc.id, ...doc.data() };

                // Kiểm tra đã gửi reminder chưa
                if (appointment.reminder_sent) {
                    continue;
                }

                if (!appointment.email) {
                    console.log(`⚠️ Skipping reminder for ${appointment.fullName} - no email`);
                    continue;
                }

                const result = await emailService.sendAppointmentReminder(appointment);

                if (result.success) {
                    await doc.ref.update({
                        reminder_sent: true,
                        reminder_sent_at: new Date(),
                        updatedAt: new Date(),
                    });
                    successCount++;
                    console.log(`✅ Reminder sent to ${appointment.fullName}`);
                }

                await this.sleep(1000);
            }

            console.log(`📊 Reminders sent: ${successCount}`);

        } catch (error) {
            console.error('❌ Send appointment reminders error:', error);
        }
    }

    /**
     * Thực hiện voice follow-up calls
     */
    async makeFollowUpCalls() {
        try {
            // Chỉ gọi trong giờ hành chính
            if (!voiceService.isBusinessHours()) {
                console.log('ℹ️ Outside business hours, skipping voice calls');
                return;
            }

            // Lấy appointments đã gửi survey, chưa gọi điện, completed trong 7 ngày qua
            const sevenDaysAgo = moment().subtract(7, 'days').toDate();

            const snapshot = await firestore.collection('appointments')
                .where('survey_sent', '==', true)
                .where('voice_call_attempted', '==', false)
                .where('updatedAt', '>=', sevenDaysAgo)
                .limit(10) // Giới hạn 10 cuộc gọi mỗi lần
                .get();

            if (snapshot.empty) {
                console.log('ℹ️ No appointments needing voice follow-up');
                return;
            }

            console.log(`📞 Found ${snapshot.size} appointments needing voice calls`);

            let successCount = 0;
            let failCount = 0;

            for (const doc of snapshot.docs) {
                const appointment = { id: doc.id, ...doc.data() };

                // Thực hiện cuộc gọi
                const result = await voiceService.makeFollowUpCall(appointment);

                // Lưu thông tin cuộc gọi
                const voiceCallRef = await firestore.collection('voice_calls').add({
                    appointmentId: appointment.id,
                    patientName: appointment.fullName,
                    phone: appointment.phone,
                    callStatus: result.status,
                    elevenlabsCallId: result.callId || null,
                    error: result.error || null,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                });

                // Cập nhật appointment
                await doc.ref.update({
                    voice_call_attempted: true,
                    voice_call_status: result.status,
                    voice_call_id: voiceCallRef.id,
                    updatedAt: new Date(),
                });

                if (result.success) {
                    successCount++;
                    console.log(`✅ Voice call initiated for ${appointment.fullName}`);
                } else {
                    failCount++;
                    console.error(`❌ Voice call failed for ${appointment.fullName}: ${result.error}`);
                }

                // Delay 5 giây giữa các cuộc gọi
                await this.sleep(5000);
            }

            console.log(`📊 Voice calls: ${successCount} initiated, ${failCount} failed`);

        } catch (error) {
            console.error('❌ Make follow-up calls error:', error);
        }
    }

    /**
     * Cleanup dữ liệu cũ (>90 ngày)
     */
    async cleanupOldData() {
        try {
            const ninetyDaysAgo = moment().subtract(90, 'days').toDate();

            // Cleanup appointments cũ (status CANCELLED hoặc COMPLETED)
            const appointmentsSnapshot = await firestore.collection('appointments')
                .where('updatedAt', '<', ninetyDaysAgo)
                .where('visitStatus', 'in', ['CANCELLED', 'COMPLETED'])
                .limit(100)
                .get();

            let deletedAppointments = 0;
            for (const doc of appointmentsSnapshot.docs) {
                await doc.ref.delete();
                deletedAppointments++;
            }

            // Cleanup voice calls cũ
            const voiceCallsSnapshot = await firestore.collection('voice_calls')
                .where('createdAt', '<', ninetyDaysAgo)
                .limit(100)
                .get();

            let deletedVoiceCalls = 0;
            for (const doc of voiceCallsSnapshot.docs) {
                await doc.ref.delete();
                deletedVoiceCalls++;
            }

            // Cleanup alerts đã resolved
            const alertsSnapshot = await firestore.collection('alerts')
                .where('createdAt', '<', ninetyDaysAgo)
                .where('status', '==', 'RESOLVED')
                .limit(100)
                .get();

            let deletedAlerts = 0;
            for (const doc of alertsSnapshot.docs) {
                await doc.ref.delete();
                deletedAlerts++;
            }

            console.log(`🧹 Cleanup completed: ${deletedAppointments} appointments, ${deletedVoiceCalls} voice calls, ${deletedAlerts} alerts deleted`);

        } catch (error) {
            console.error('❌ Cleanup error:', error);
        }
    }

    /**
     * Helper: Sleep function
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Manual trigger: Gửi survey cho appointment cụ thể
     */
    async sendSurveyManual(appointmentId) {
        try {
            const doc = await firestore.collection('appointments').doc(appointmentId).get();
            if (!doc.exists) {
                throw new Error('Appointment not found');
            }

            const appointment = { id: doc.id, ...doc.data() };
            const surveyUrl = `${process.env.SURVEY_BASE_URL}?id=${appointment.id}`;
            const result = await emailService.sendSurvey(appointment, surveyUrl);

            if (result.success) {
                await doc.ref.update({
                    survey_sent: true,
                    survey_sent_at: new Date(),
                    updatedAt: new Date(),
                });
            }

            return result;
        } catch (error) {
            console.error('❌ Manual send survey error:', error);
            throw error;
        }
    }

    /**
     * Manual trigger: Gọi điện cho appointment cụ thể
     */
    async makeVoiceCallManual(appointmentId) {
        try {
            const doc = await firestore.collection('appointments').doc(appointmentId).get();
            if (!doc.exists) {
                throw new Error('Appointment not found');
            }

            const appointment = { id: doc.id, ...doc.data() };
            const result = await voiceService.makeFollowUpCall(appointment);

            const voiceCallRef = await firestore.collection('voice_calls').add({
                appointmentId: appointment.id,
                patientName: appointment.fullName,
                phone: appointment.phone,
                callStatus: result.status,
                elevenlabsCallId: result.callId || null,
                error: result.error || null,
                createdAt: new Date(),
                updatedAt: new Date(),
            });

            await doc.ref.update({
                voice_call_attempted: true,
                voice_call_status: result.status,
                voice_call_id: voiceCallRef.id,
                updatedAt: new Date(),
            });

            return result;
        } catch (error) {
            console.error('❌ Manual voice call error:', error);
            throw error;
        }
    }
}

export default new ScheduledTasks();
