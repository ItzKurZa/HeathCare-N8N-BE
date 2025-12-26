import express from "express";
import { firestore } from "../../config/firebase.js";
import aiAnalyzer from "../../infrastructure/services/aiAnalyzer.services.js";
import emailService from "../../infrastructure/services/email.services.js";
import ExcelJS from "exceljs";
import {
  handleVoiceSurveyWebhook,
  initiateVoiceSurvey,
  getVoiceSurveyStatus,
  getDashboardStats,
  getRecentSurveys,
} from "../controllers/survey.controller.js";
import { config } from "../../config/env.js";
import axios from "axios";

const router = express.Router();

// Dashboard API endpoints
router.get("/stats", getDashboardStats);
router.get("/recent", getRecentSurveys);

/**
 * GET /api/surveys/export
 * Export surveys to Excel file (supports Vietnamese)
 */
router.get("/export", async (req, res) => {
  try {
    // Fetch surveys from Firestore (without orderBy to avoid index issues)
    const surveysSnapshot = await firestore
      .collection("surveys")
      .limit(100)
      .get();

    const surveys = [];
    surveysSnapshot.forEach((doc) => {
      surveys.push({ id: doc.id, ...doc.data() });
    });

    // Sort by submittedAt in memory
    surveys.sort((a, b) => {
      const dateA =
        a.submittedAt?.toDate?.() || new Date(a.submittedAt) || new Date(0);
      const dateB =
        b.submittedAt?.toDate?.() || new Date(b.submittedAt) || new Date(0);
      return dateB - dateA;
    });

    // Create Excel workbook
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Healthcare CSKH System";
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet("Khảo sát bệnh nhân");

    // Title row
    worksheet.mergeCells("A1:K1");
    const titleCell = worksheet.getCell("A1");
    titleCell.value = "BÁO CÁO KHẢO SÁT BỆNH NHÂN";
    titleCell.font = { size: 18, bold: true, color: { argb: "2563EB" } };
    titleCell.alignment = { horizontal: "center", vertical: "middle" };
    worksheet.getRow(1).height = 30;

    // Info row
    worksheet.mergeCells("A2:K2");
    const infoCell = worksheet.getCell("A2");
    infoCell.value = `Ngày xuất: ${new Date().toLocaleDateString(
      "vi-VN"
    )} | Tổng số khảo sát: ${surveys.length}`;
    infoCell.alignment = { horizontal: "center" };
    worksheet.getRow(2).height = 20;

    // Header row
    const headerRow = worksheet.getRow(4);
    const headers = [
      "STT",
      "Tên bệnh nhân",
      "SĐT",
      "Email",
      "Ngày khảo sát",
      "NPS (0-10)",
      "CSAT (1-5)",
      "Cơ sở vật chất (1-5)",
      "Thời gian chờ",
      "Đánh giá nhân viên",
      "Nhận xét",
    ];
    headerRow.values = headers;
    headerRow.font = { bold: true, color: { argb: "FFFFFF" } };
    headerRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "2563EB" },
    };
    headerRow.alignment = {
      horizontal: "center",
      vertical: "middle",
      wrapText: true,
    };
    headerRow.height = 25;

    // Set column widths
    worksheet.columns = [
      { width: 6 }, // STT
      { width: 25 }, // Tên
      { width: 15 }, // SĐT
      { width: 28 }, // Email
      { width: 15 }, // Ngày
      { width: 12 }, // NPS
      { width: 12 }, // CSAT
      { width: 18 }, // Cơ sở
      { width: 15 }, // Thời gian chờ
      { width: 35 }, // Đánh giá nhân viên
      { width: 40 }, // Nhận xét
    ];

    // Add data rows
    surveys.forEach((survey, index) => {
      const submittedDate = survey.submittedAt?.toDate?.()
        ? survey.submittedAt.toDate().toLocaleDateString("vi-VN")
        : survey.submittedAt
        ? new Date(survey.submittedAt).toLocaleDateString("vi-VN")
        : "N/A";

      const staffRating =
        [
          survey.staff_doctor ? `Bác sĩ: ${survey.staff_doctor}` : null,
          survey.staff_reception ? `Lễ tân: ${survey.staff_reception}` : null,
          survey.staff_nurse ? `Y tá: ${survey.staff_nurse}` : null,
        ]
          .filter(Boolean)
          .join(" | ") || "N/A";

      const row = worksheet.addRow([
        index + 1,
        survey.patientName || "N/A",
        survey.phone || "N/A",
        survey.email || "N/A",
        submittedDate,
        survey.nps ?? "N/A",
        survey.csat ?? "N/A",
        survey.facility ?? "N/A",
        survey.waiting_time || "N/A",
        staffRating,
        survey.comment || "",
      ]);

      // Alternate row colors
      if (index % 2 === 0) {
        row.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "F3F4F6" },
        };
      }
      row.alignment = { vertical: "middle", wrapText: true };
    });

    // Add borders to all cells
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber >= 4) {
        row.eachCell((cell) => {
          cell.border = {
            top: { style: "thin" },
            left: { style: "thin" },
            bottom: { style: "thin" },
            right: { style: "thin" },
          };
        });
      }
    });

    // Set response headers for Excel download
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=bao-cao-khao-sat.xlsx"
    );

    // Write to response
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error("Error exporting surveys to Excel:", error);
    res.status(500).json({
      success: false,
      error: "Failed to export surveys",
      details: error.message,
    });
  }
});

/**
 * POST /api/surveys/submit
 * Webhook nhận survey response từ form
 */
router.post("/submit", async (req, res) => {
  try {
    const isN8nRequest =
      req.headers["user-agent"] && req.headers["user-agent"].includes("n8n");

    const {
      booking_id,
      patient_name,
      phone,
      email,
      nps,
      csat,
      facility,
      staff_attitude,
      waiting_time,
      comment,
    } = req.body;

    // Validate required fields
    if (!booking_id || !patient_name || !phone) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: booking_id, patient_name, phone",
      });
    }

    const surveyData = {
      appointmentId: booking_id,
      patientName: patient_name,
      phone,
      email: email || null,
      nps: parseInt(nps) || 0,
      csat: parseInt(csat) || 0,
      facility: parseInt(facility) || 0,
      staff_doctor: staff_attitude?.doctor_label || null,
      staff_reception: staff_attitude?.reception_label || null,
      staff_nurse: staff_attitude?.nurse_label || null,
      waiting_time: waiting_time || null,
      comment: comment || null,
      submittedAt: new Date(),
    };

    // Tính điểm trung bình (Quy đổi về thang 10)
    const npsScore = surveyData.nps; // 0-10
    const csatScore = surveyData.csat * 2; // 0-5 -> 0-10
    const facilityScore = surveyData.facility * 2; // 0-5 -> 0-10
    
    // Lọc ra các điểm > 0 để tính trung bình
    const scores = [npsScore, csatScore, facilityScore].filter((s) => s > 0);
    
    surveyData.overall_score =
      scores.length > 0 ? scores.reduce((a, b) => a + b) / scores.length : 0;

    // Xác định có cần cải thiện không (Trigger logic)
    surveyData.improvement_trigger =
      surveyData.overall_score < 7 ||
      surveyData.nps < 7 ||
      (surveyData.comment && surveyData.comment.length > 0);

    const surveyRef = await firestore.collection("surveys").add(surveyData);
    console.log(`✅ Survey saved with ID: ${surveyRef.id}`);

    if (booking_id) {
      const appointmentQuery = await firestore
        .collection("appointments")
        .where("bookingId", "==", booking_id)
        .limit(1)
        .get();

      if (!appointmentQuery.empty) {
        const appointmentDoc = appointmentQuery.docs[0];
        await appointmentDoc.ref.update({
          survey_completed: true,
          survey_completed_at: new Date(),
          survey_score: surveyData.overall_score,
          updatedAt: new Date(),
        });
        console.log(
          `✅ Appointment ${appointmentDoc.id} updated with survey completion`
        );
      }
    }

    if (surveyData.improvement_trigger && !isN8nRequest) {
      console.log(
        `⚠️ Improvement needed for ${patient_name}, checking for duplicates...`
      );

      const existingAlert = await firestore
        .collection("alerts")
        .where("appointmentId", "==", booking_id)
        .limit(1)
        .get();

      if (existingAlert.empty) {
        console.log(`...No duplicate found. Triggering AI analysis...`);
        
        aiAnalyzer
          .analyze(surveyData)
          .then(async (analysis) => {
            await emailService.sendAlert(surveyData, analysis);

            await firestore.collection("alerts").add({
              surveyId: surveyRef.id,
              appointmentId: booking_id,
              patientName: patient_name,
              phone,
              overallScore: surveyData.overall_score,
              analysis,
              status: "PENDING",
              createdAt: new Date(),
            });

            console.log(
              `✅ Alert created and email sent for survey ${surveyRef.id}`
            );
          })
          .catch((err) => {
            console.error("❌ Error processing improvement trigger:", err);
          });
      } else {
        console.log(
          `🛑 Duplicate detected: Alert already exists for booking ${booking_id}. Skipping AI & Email.`
        );
      }
    } else if (isN8nRequest) {
      console.log(
        "🤖 Request from N8N detected - Skipping Email/AI trigger to avoid Loop."
      );
    }

    const n8nWebhookUrl = config.n8n.webhookSurvey;

    const responseData = {
      surveyId: surveyRef.id,
      overall_score: surveyData.overall_score,
      needsImprovement: surveyData.improvement_trigger,
      data: {
        appointmentId: booking_id,
        patientName: patient_name,
        phone,
        email,
        overall_score: surveyData.overall_score,
        nps: surveyData.nps,
        csat: surveyData.csat,
        facility: surveyData.facility,
        comment: surveyData.comment,
      },
    };

    if (!isN8nRequest) {
      axios
        .post(n8nWebhookUrl, responseData)
        .then(() => {
          console.log("✅ Đã bắn data sang n8n thành công");
        })
        .catch((err) => {
          console.error("⚠️ Lỗi khi gọi n8n:", err.message);
        });
    } else {
      console.log(
        "🛑 Request từ n8n - Bỏ qua việc gọi lại Webhook để tránh Infinite Loop."
      );
    }

    res.status(201).json({
      success: true,
      message: "Survey submitted successfully",
      data: responseData,
    });

  } catch (error) {
    console.error("❌ Survey submission error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/surveys/:appointmentId
 * Lấy survey theo appointment ID
 */
router.get("/:appointmentId", async (req, res) => {
  try {
    const { appointmentId } = req.params;

    const surveysSnapshot = await firestore
      .collection("surveys")
      .where("appointmentId", "==", appointmentId)
      .orderBy("submittedAt", "desc")
      .limit(1)
      .get();

    if (surveysSnapshot.empty) {
      return res.status(404).json({
        success: false,
        error: "Survey not found",
      });
    }

    const survey = surveysSnapshot.docs[0];
    res.json({
      success: true,
      data: {
        id: survey.id,
        ...survey.data(),
      },
    });
  } catch (error) {
    console.error("❌ Get survey error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/surveys
 * Lấy danh sách surveys với filter
 */
router.get("/", async (req, res) => {
  try {
    const { status, limit = 50, page = 1 } = req.query;

    let query = firestore.collection("surveys").orderBy("submittedAt", "desc");

    if (status === "need_improvement") {
      query = query.where("improvement_trigger", "==", true);
    }

    const limitNum = parseInt(limit);
    const pageNum = parseInt(page);
    const offset = (pageNum - 1) * limitNum;

    const snapshot = await query.limit(limitNum).offset(offset).get();

    const surveys = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    res.json({
      success: true,
      data: surveys,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: surveys.length,
      },
    });
  } catch (error) {
    console.error("❌ Get surveys error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/surveys/stats/summary
 * Thống kê tổng quan surveys
 */
router.get("/stats/summary", async (req, res) => {
  try {
    const surveysSnapshot = await firestore.collection("surveys").get();

    let totalSurveys = 0;
    let totalNPS = 0;
    let totalCSAT = 0;
    let totalFacility = 0;
    let needImprovement = 0;

    surveysSnapshot.forEach((doc) => {
      const data = doc.data();
      totalSurveys++;
      totalNPS += data.nps || 0;
      totalCSAT += data.csat || 0;
      totalFacility += data.facility || 0;
      if (data.improvement_trigger) needImprovement++;
    });

    res.json({
      success: true,
      data: {
        totalSurveys,
        averageNPS: totalSurveys > 0 ? (totalNPS / totalSurveys).toFixed(2) : 0,
        averageCSAT:
          totalSurveys > 0 ? (totalCSAT / totalSurveys).toFixed(2) : 0,
        averageFacility:
          totalSurveys > 0 ? (totalFacility / totalSurveys).toFixed(2) : 0,
        needImprovement,
        improvementRate:
          totalSurveys > 0
            ? ((needImprovement / totalSurveys) * 100).toFixed(1) + "%"
            : "0%",
      },
    });
  } catch (error) {
    console.error("❌ Get stats error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Voice Survey Routes
 */

// POST /api/surveys/voice-webhook
// Webhook from ElevenLabs after voice survey call completes
router.post("/voice-webhook", handleVoiceSurveyWebhook);

// POST /api/surveys/voice-initiate
// Initiate a voice survey call
router.post("/voice-initiate", initiateVoiceSurvey);

// GET /api/surveys/voice-status/:callId
// Get voice survey call status
router.get("/voice-status/:callId", getVoiceSurveyStatus);

export default router;
