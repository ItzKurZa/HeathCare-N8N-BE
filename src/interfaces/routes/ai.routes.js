import express from 'express';
import aiAnalyzer from '../../infrastructure/services/aiAnalyzer.services.js';
import { firestore as db } from '../../config/firebase.js';

const router = express.Router();

/**
 * POST /api/ai/analyze
 * Analyze survey data with AI
 */
router.post('/analyze', async (req, res, next) => {
  try {
    const { surveyData } = req.body;

    if (!surveyData) {
      return res.status(400).json({
        success: false,
        error: 'Missing survey data'
      });
    }

    const analysis = await aiAnalyzer.analyze(surveyData);

    res.json({
      success: true,
      data: {
        analysis,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/ai/analyze-transcript
 * Analyze voice call transcript with AI
 */
router.post('/analyze-transcript', async (req, res, next) => {
  try {
    const { transcript, callId } = req.body;

    if (!transcript) {
      return res.status(400).json({
        success: false,
        error: 'Missing transcript data'
      });
    }

    const analysis = await aiAnalyzer.analyzeTranscript(transcript);

    // Save analysis to Firestore if callId provided
    if (callId) {
      await db.collection('voice_calls').doc(callId).update({
        analysis,
        analyzedAt: new Date()
      });
    }

    res.json({
      success: true,
      data: {
        analysis,
        sentiment: analysis.sentiment,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/ai/batch-analyze
 * Batch analyze multiple surveys
 */
router.post('/batch-analyze', async (req, res, next) => {
  try {
    const { surveys } = req.body;

    if (!surveys || !Array.isArray(surveys)) {
      return res.status(400).json({
        success: false,
        error: 'surveys must be an array'
      });
    }

    const results = [];

    for (const survey of surveys) {
      try {
        const analysis = await aiAnalyzer.analyze(survey);
        results.push({
          surveyId: survey.appointmentId || survey.id,
          success: true,
          analysis
        });
      } catch (error) {
        results.push({
          surveyId: survey.appointmentId || survey.id,
          success: false,
          error: error.message
        });
      }
    }

    res.json({
      success: true,
      data: {
        total: surveys.length,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
        results
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/ai/stats
 * Get AI analysis statistics
 */
router.get('/stats', async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;

    let query = db.collection('surveys').where('analysis', '!=', null);

    if (startDate) {
      query = query.where('createdAt', '>=', new Date(startDate));
    }

    if (endDate) {
      query = query.where('createdAt', '<=', new Date(endDate));
    }

    const snapshot = await query.get();

    const stats = {
      total: 0,
      bySentiment: {
        positive: 0,
        neutral: 0,
        negative: 0
      },
      byPriority: {
        high: 0,
        medium: 0,
        low: 0
      },
      averageScore: 0
    };

    let totalScore = 0;

    snapshot.forEach(doc => {
      const data = doc.data();
      const analysis = data.analysis;

      stats.total++;

      if (analysis.sentiment) {
        stats.bySentiment[analysis.sentiment] = (stats.bySentiment[analysis.sentiment] || 0) + 1;
      }

      if (analysis.priority) {
        stats.byPriority[analysis.priority] = (stats.byPriority[analysis.priority] || 0) + 1;
      }

      if (data.overall_score !== undefined) {
        totalScore += data.overall_score;
      }
    });

    if (stats.total > 0) {
      stats.averageScore = (totalScore / stats.total).toFixed(2);
    }

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/ai/test
 * Test AI analyzer service
 */
router.post('/test', async (req, res, next) => {
  try {
    const testSurvey = {
      doctor_rating: 5,
      receptionist_rating: 4,
      facility_rating: 5,
      wait_time_rating: 3,
      overall_score: 4.25,
      feedback: 'Dịch vụ tốt, bác sĩ nhiệt tình nhưng chờ khám hơi lâu'
    };

    const analysis = await aiAnalyzer.analyze(testSurvey);

    res.json({
      success: true,
      message: 'AI Analyzer is working',
      data: {
        testSurvey,
        analysis,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    next(error);
  }
});

export default router;
