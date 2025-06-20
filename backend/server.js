require('dotenv').config();
const express = require('express');
const cors = require('cors');
const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');
const app = express();
app.use(express.json());
app.use(cors());

const logDir = path.join(__dirname, 'log');
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir);
const logFile = path.join(logDir, 'ai_flight_log.jsonl');
const feedbackLogFile = path.join(logDir, 'ai_feedback_log.json');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Status endpoint to check if server is running
app.get('/status', (req, res) => {
  res.json({ status: 'ok' });
});

// Command endpoint to handle user commands
app.post('/command', async (req, res) => {
  const { command } = req.body;
  
  // Log the command
  const logEntry = {
    timestamp: new Date().toISOString(),
    command,
    type: 'user_command'
  };
  
  try {
    // Append to feedback log
    let feedbackLog = [];
    try {
      feedbackLog = JSON.parse(fs.readFileSync(feedbackLogFile, 'utf8'));
    } catch (err) {
      // File doesn't exist or is invalid, start with empty array
    }
    feedbackLog.push(logEntry);
    fs.writeFileSync(feedbackLogFile, JSON.stringify(feedbackLog, null, 2));

    // Process command
    if (command.toLowerCase().includes('fly around the globe')) {
      // Send initial response
      res.json({
        message: "Initiating global circumnavigation flight path. I'll help guide the aircraft in a complete circle around the Earth. Adjusting controls for optimal altitude and speed...",
        controls: {
          throttle: 0.8,  // 80% throttle for cruising
          pitch: 0.1,    // Slight upward pitch
          roll: 0,       // Level roll initially
          yaw: 0.1      // Slight turn to begin the circle
        }
      });

      // Log the flight plan
      feedbackLog.push({
        timestamp: new Date().toISOString(),
        type: 'flight_plan',
        plan: {
          type: 'global_circumnavigation',
          waypoints: [
            { lat: 0, long: -45 },  // Starting point
            { lat: 0, long: 45 },   // Quarter way
            { lat: 0, long: 135 },  // Half way
            { lat: 0, long: -135 }, // Three quarters
            { lat: 0, long: -45 }   // Back to start
          ]
        }
      });
      fs.writeFileSync(feedbackLogFile, JSON.stringify(feedbackLog, null, 2));
    } else {
      // Forward other commands to GPT for processing
      const prompt = `You are an AI co-pilot in a flight simulator. The user has given this command: "${command}". Provide a helpful response and any relevant flight control adjustments. Response should be natural but concise.`;
      
      const response = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }]
      });

      const aiResponse = response.choices[0].message.content;
      
      // Log AI response
      feedbackLog.push({
        timestamp: new Date().toISOString(),
        type: 'ai_response',
        command,
        response: aiResponse
      });
      fs.writeFileSync(feedbackLogFile, JSON.stringify(feedbackLog, null, 2));

      res.json({
        message: aiResponse,
        controls: {
          throttle: 0,
          pitch: 0,
          roll: 0,
          yaw: 0
        }
      });
    }
  } catch (error) {
    console.error('Error processing command:', error);
    res.status(500).json({
      message: "Sorry, I encountered an error processing your command. Please try again.",
      error: error.message
    });
  }
});

// New, dedicated AI control endpoint
app.post('/api/ai-control', (req, res) => {
  const { flightData } = req.body;

  if (!flightData) {
    return res.status(400).json({ error: 'Missing flightData' });
  }

  const { position, velocity, quaternion, targetAltitude } = flightData;

  // Simple deterministic logic for stable flight
  const targetAlt = targetAltitude || 100; // Target altitude in meters
  const currentAltitude = position.y;
  const altitudeError = targetAlt - currentAltitude;

  // Proportional control for pitch based on altitude error
  let pitch = altitudeError * 0.005;
  pitch = Math.max(-0.5, Math.min(0.5, pitch)); // Clamp pitch

  // Simple logic to level the wings (reduce roll)
  // This requires quaternion math, for now, we'll just dampen it
  // A proper implementation would convert quaternion to euler, check roll, and apply counter-roll
  const roll = 0; // For simplicity, target level flight.

  // For now, simple response
  const controls = {
    pitch,
    roll,
    yaw: 0,       // No yaw for straight flight
    throttle: 0.7 // Constant throttle for cruising
  };

  // Log the decision
  const logEntry = {
    timestamp: new Date().toISOString(),
    type: 'ai_control_decision',
    flightData,
    decision: controls
  };
  fs.appendFileSync(logFile, JSON.stringify(logEntry) + '\n');

  res.json({ controls });
});

// Existing flight feedback endpoint
app.post('/api/flight-feedback', async (req, res) => {
  const { flightData, mode } = req.body;
  let prompt;
  if (mode === 'control') {
    prompt = `Given this flight data: ${JSON.stringify(flightData)}, what should the next pitch, roll, yaw, and throttle deltas be for smooth, level flight and to maintain an altitude of at least 500 ft? Also, suggest new PID targets for pitch, roll, yaw, and altitude. Respond ONLY with a valid JSON object: {"pitch": ..., "roll": ..., "yaw": ..., "throttle": ..., "targetPitch": ..., "targetRoll": ..., "targetYaw": ..., "targetAltitude": ...}. Do not include any explanation, comments, or extra text. If you cannot determine a value, set it to 0. Return ONLY the JSON object.`;
  } else {
    prompt = `Given this flight data: ${JSON.stringify(flightData)}, what control adjustments would you recommend for smoother flight?`;
  }
  const response = await openai.chat.completions.create({
    model: 'gpt-3.5-turbo',
    messages: [{ role: 'user', content: prompt }]
  });
  const aiResponse = response.choices[0].message.content;
  // Append log entry
  const logEntry = {
    timestamp: new Date().toISOString(),
    mode,
    flightData,
    aiResponse
  };
  try {
    fs.appendFileSync(logFile, JSON.stringify(logEntry) + '\n');
  } catch (err) {
    console.error('Failed to write log:', err);
  }
  res.json({ aiResponse });
});

// Existing manual log endpoint
app.post('/api/manual-log', (req, res) => {
  const { flightData } = req.body;
  const logEntry = {
    timestamp: new Date().toISOString(),
    mode: 'manual-log',
    flightData
  };
  try {
    fs.appendFileSync(logFile, JSON.stringify(logEntry) + '\n');
    res.json({ status: 'ok' });
  } catch (err) {
    console.error('Failed to write manual log:', err);
    res.status(500).json({ status: 'error' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));