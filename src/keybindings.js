// AI and Mode Control Keybindings
export const AI_MODE_KEYS = {
    TOGGLE_AI_ASSISTANCE: '\\',
    SWITCH_TO_MANUAL: '/',
    FORCE_AI_CONTROL: 'c'
};

// Data and Logging Keybindings
export const DATA_LOGGING_KEYS = {
    EXPORT_FLIGHT_DATA: 'l',
    EXPORT_AI_FEEDBACK_LOG: 'j',
    REQUEST_AI_FEEDBACK: 'k',
    MANUAL_LOG_ENTRY: 'h'
};

// Mode Status Constants
export const CONTROL_MODES = {
    MANUAL: 'manual',
    AI_ASSIST: 'aiAssist',
    AUTO_TAKEOFF: 'autoTakeoff',
    AUTO_LAND: 'autoLand'
};

// AI Control Intervals (in milliseconds)
export const AI_INTERVALS = {
    CONTROL_UPDATE: 5000,  // 5 seconds
    FEEDBACK_UPDATE: 8000 // 8 seconds
};

// This file should only contain constants and simple, pure functions.
// All complex state management and side effects have been moved to main.js. 