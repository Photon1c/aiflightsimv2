import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Aircraft } from './aircraft.js';
import { Drone } from './drone.js';
import { setupControls } from './gui-controls.js';
import { Globe } from './globe.js';
import Stats from 'three/addons/libs/stats.module.js';
import { launchSimulation } from './launcher.js';
import { aiSystem } from './ailogic.js';
import { createLogoAnimation } from './logo.js';
import { 
    AI_MODE_KEYS, 
    DATA_LOGGING_KEYS, 
    CONTROL_MODES,
    AI_INTERVALS
} from './keybindings.js';
import { instructions } from './instructions.js';

// Global variables
let scene, camera, renderer, aircraft, drone, globe, controls;
let clock = new THREE.Clock();
let stats;
let simOverlay;
let params;
let keys = {};

// Control state
let engineOn = false;
let throttle = 0;
let takeoffThrottle = 0;
let autoTakeoff = true;
let takeoffComplete = false;
let takeoffTargetAltitude = 100;
let controlMode = CONTROL_MODES.AUTO_TAKEOFF;  // Using constant from keybindings
let autoMode = false;
let droneAutoMode = false;
let droneTakeoffComplete = false;
let droneAIInterval = null;
let aiControlDeltas = { pitch: 0, roll: 0, yaw: 0, throttle: 0 };
let aiInterval = null;
let aiFeedbackLog = [];

// Departure and arrival locations
let departure = { lat: 0, long: -45 };
let arrival = { lat: 45, long: 45 };
let autoTakeoffStartTime = null;

// Show the start button overlay on page load
window.addEventListener('DOMContentLoaded', async () => {
    await createLogoAnimation();
    showStartButton();
});

function showStartButton() {
    const overlay = document.createElement('div');
    overlay.id = 'start-overlay';
    overlay.style.position = 'fixed';
    overlay.style.top = 0;
    overlay.style.left = 0;
    overlay.style.width = '100vw';
    overlay.style.height = '100vh';
    overlay.style.background = 'rgba(0,0,0,0.7)';
    overlay.style.display = 'flex';
    overlay.style.flexDirection = 'column';
    overlay.style.justifyContent = 'center';
    overlay.style.alignItems = 'center';
    overlay.style.zIndex = 2000;

    // Title
    const title = document.createElement('div');
    title.innerHTML = '<span style="font-size:3rem;font-style:italic;font-weight:bold;color:#fff;text-shadow:0 2px 12px #000;letter-spacing:2px;">AI Flight Sim Version 2 ✈️</span>';
    title.style.marginBottom = '1.5em';
    title.style.textAlign = 'center';
    overlay.appendChild(title);

    // Vehicle selection
    const selectLabel = document.createElement('label');
    selectLabel.textContent = 'Choose Vehicle: ';
    selectLabel.style.color = '#fff';
    selectLabel.style.fontSize = '1.2rem';
    selectLabel.style.marginBottom = '1em';
    
    const select = document.createElement('select');
    select.id = 'vehicle-select';
    select.style.fontSize = '1.2rem';
    select.style.marginLeft = '0.5em';
    
    const optPlane = document.createElement('option');
    optPlane.value = 'plane';
    optPlane.textContent = 'Plane';
    
    const optDrone = document.createElement('option');
    optDrone.value = 'drone';
    optDrone.textContent = 'Drone';
    
    select.appendChild(optPlane);
    select.appendChild(optDrone);
    selectLabel.appendChild(select);
    overlay.appendChild(selectLabel);

    // Start button
    const btn = document.createElement('button');
    btn.textContent = 'Start Simulation';
    btn.style.fontSize = '2rem';
    btn.style.padding = '1em 2em';
    btn.style.borderRadius = '12px';
    btn.style.border = 'none';
    btn.style.background = '#228B22';
    btn.style.color = '#fff';
    btn.style.cursor = 'pointer';
    btn.style.boxShadow = '0 4px 16px rgba(0,0,0,0.2)';
    btn.onmouseenter = () => btn.style.background = '#2e8b57';
    btn.onmouseleave = () => btn.style.background = '#228B22';

    btn.onclick = () => {
        const vehicleType = select.value;
        overlay.remove();
        startSimulation(vehicleType);
    };

    overlay.appendChild(btn);
    document.body.appendChild(overlay);
}

async function startSimulation(vehicleType) {
    try {
        // Add event listeners once
        document.addEventListener('keydown', (e) => {
            keys[e.key] = true;
            handleKeyPress(e);
        });
        document.addEventListener('keyup', (e) => {
            keys[e.key] = false;
        });

        // Initialize core components
        const initialized = await launchSimulation();
        if (!initialized || !initialized.scene || !initialized.globe || !initialized.params) {
            throw new Error('Failed to initialize simulation components');
        }
        
        scene = initialized.scene;
        globe = initialized.globe;
        params = initialized.params;

        // Ensure globe is ready
        if (!globe.EARTH_RADIUS || !globe.latLongToWorld) {
            throw new Error('Globe not properly initialized');
        }

        // --- Renderer Initialization with Cleanup ---
        // Dispose of any existing renderer to prevent context loss
        if (renderer) {
            renderer.dispose();
            const oldCanvas = document.querySelector('canvas');
            if (oldCanvas) {
                oldCanvas.parentNode.removeChild(oldCanvas);
            }
        }
        
        try {
            renderer = new THREE.WebGLRenderer({ antialias: true });
        } catch (e) {
            console.error(e);
            throw new Error(`Error creating WebGL context. Your browser or device may not support WebGL, or it may be disabled.`);
        }
        
        renderer.setSize(window.innerWidth, window.innerHeight);
        document.body.appendChild(renderer.domElement);

        // Initialize camera
        camera = new THREE.PerspectiveCamera(
            75,
            window.innerWidth / window.innerHeight,
            0.1,
            1000
        );
        camera.position.set(0, 50, 50);
        camera.lookAt(0, 0, 0);

        // Add OrbitControls for mouse interaction
        controls = new OrbitControls(camera, renderer.domElement);
        controls.enablePan = true; // Right-click to pan
        controls.enableZoom = true; // Mouse wheel to zoom
        controls.enableRotate = true; // Left-click to rotate
        controls.minDistance = 5;
        controls.maxDistance = 500;

        // Initialize stats
        stats = new Stats();
        stats.domElement.style.position = 'absolute';
        stats.domElement.style.left = '10px';
        stats.domElement.style.bottom = '10px';
        stats.domElement.style.top = 'auto';
        document.body.appendChild(stats.domElement);

        // Initialize vehicle
        if (!departure || !departure.lat || !departure.long) {
            departure = { lat: 0, long: 0 }; // Default to equator
        }
        
        const startPos = globe.latLongToWorld(departure.lat, departure.long);
        if (!startPos) {
            throw new Error('Failed to calculate start position');
        }
        
        const surfacePos = startPos.normalize().multiplyScalar(globe.EARTH_RADIUS + 0.5); // Slightly above surface

        if (vehicleType === 'drone') {
            // Clear any existing drone
            if (drone && drone.mesh) {
                scene.remove(drone.mesh);
            }
            drone = new Drone(scene);
            if (!drone || !drone.mesh) {
                throw new Error('Failed to create drone');
            }
            
            drone.mesh.position.copy(surfacePos);
            drone.mesh.scale.set(0.2, 0.2, 0.2);

            // Set initial orientation
            const up = surfacePos.clone().normalize();
            const forward = new THREE.Vector3(0, 0, -1);
            const right = forward.clone().cross(up).normalize();
            forward.crossVectors(up, right);
            
            const initialMatrix = new THREE.Matrix4().makeBasis(right, up, forward);
            drone.mesh.setRotationFromMatrix(initialMatrix);
            
            scene.add(drone.mesh);
            drone.setupControls();

            // Clear aircraft if it exists
            if (aircraft && aircraft.mesh) {
                scene.remove(aircraft.mesh);
                aircraft = null;
            }
        } else {
            // Clear any existing aircraft
            if (aircraft && aircraft.mesh) {
                scene.remove(aircraft.mesh);
            }
            // Create aircraft with default config if not provided
            const aircraftConfig = {
                color: params.aircraft?.color || '#3366cc',  // Use params color or default to standard blue
                ...params.aircraft
            };
            aircraft = new Aircraft(scene, aircraftConfig);
            if (!aircraft || !aircraft.mesh) {
                throw new Error('Failed to create aircraft');
            }

            aircraft.mesh.position.copy(surfacePos);
            aircraft.mesh.scale.set(0.3, 0.3, 0.3);  // Increased scale for better visibility

            // Set initial orientation
            const up = surfacePos.clone().normalize();
            const forward = new THREE.Vector3(0, 0, -1);
            const right = forward.clone().cross(up).normalize();
            forward.crossVectors(up, right);
            
            const initialMatrix = new THREE.Matrix4().makeBasis(right, up, forward);
            aircraft.mesh.setRotationFromMatrix(initialMatrix);

            aircraft.velocity.set(0, 0, 0);
            aircraft.grounded = true;
            engineOn = true;  // Start with engine on
            throttle = 0; // Start at zero throttle for takeoff sequence
            autoTakeoff = true;
            takeoffComplete = false;
            takeoffTargetAltitude = 100; // Set a reasonable takeoff altitude
            controlMode = 'autoTakeoff';
            
            scene.add(aircraft.mesh);
            // PID GUI will be created by createSimOverlay

            // Clear drone if it exists
            if (drone && drone.mesh) {
                scene.remove(drone.mesh);
                drone = null;
            }
        }

        // Create UI elements
        createSimOverlay(vehicleType);

        // Initialize clock
        clock = new THREE.Clock();

        // Rotate the globe for a better starting orientation
        globe.mesh.rotation.x = Math.PI / 2;

        // Start animation
        animate();
    } catch (error) {
        console.error('Error starting simulation:', error);
        // Show error to user
        const errorDiv = document.createElement('div');
        errorDiv.style.position = 'fixed';
        errorDiv.style.top = '50%';
        errorDiv.style.left = '50%';
        errorDiv.style.transform = 'translate(-50%, -50%)';
        errorDiv.style.background = 'rgba(255, 0, 0, 0.8)';
        errorDiv.style.color = 'white';
        errorDiv.style.padding = '20px';
        errorDiv.style.borderRadius = '10px';
        errorDiv.style.zIndex = '1000';
        errorDiv.textContent = `Simulation Error: ${error.message}`;
        document.body.appendChild(errorDiv);
        setTimeout(() => errorDiv.remove(), 5000);
    }
}

function createSimOverlay(vehicleType) {
    // Remove existing overlay if it exists
    const existingOverlay = document.getElementById('sim-overlay');
    if (existingOverlay) {
        existingOverlay.remove();
    }

    // Create new overlay
    simOverlay = document.createElement('div');
    simOverlay.id = 'sim-overlay';
    simOverlay.style.position = 'fixed';
    simOverlay.style.top = '10px';
    simOverlay.style.left = '10px';
    simOverlay.style.padding = '10px';
    simOverlay.style.background = 'rgba(0,0,0,0.7)';
    simOverlay.style.color = '#fff';
    simOverlay.style.fontFamily = 'monospace';
    simOverlay.style.fontSize = '12px';
    simOverlay.style.borderRadius = '5px';
    simOverlay.style.zIndex = 1000;
    simOverlay.style.resize = 'both';
    simOverlay.style.overflow = 'auto';
    simOverlay.style.minWidth = '300px';
    simOverlay.style.boxShadow = '0 0 10px rgba(0,0,0,0.5)';

    // Create mode toggle switch container
    const toggleContainer = document.createElement('div');
    toggleContainer.style.display = 'flex';
    toggleContainer.style.alignItems = 'center';
    toggleContainer.style.marginBottom = '15px';
    toggleContainer.style.padding = '5px';
    toggleContainer.style.background = 'rgba(0,0,0,0.3)';
    toggleContainer.style.borderRadius = '5px';

    // Add mode labels
    const manualLabel = document.createElement('span');
    manualLabel.textContent = 'MANUAL';
    manualLabel.style.padding = '0 10px';
    manualLabel.style.color = !autoMode ? '#fff' : '#666';
    manualLabel.style.fontWeight = !autoMode ? 'bold' : 'normal';

    const aiLabel = document.createElement('span');
    aiLabel.textContent = 'AI';
    aiLabel.style.padding = '0 10px';
    aiLabel.style.color = autoMode ? '#fff' : '#666';
    aiLabel.style.fontWeight = autoMode ? 'bold' : 'normal';

    // Create toggle switch
    const toggleSwitch = document.createElement('div');
    toggleSwitch.style.width = '50px';
    toggleSwitch.style.height = '24px';
    toggleSwitch.style.background = '#333';
    toggleSwitch.style.borderRadius = '12px';
    toggleSwitch.style.position = 'relative';
    toggleSwitch.style.cursor = 'pointer';
    toggleSwitch.style.margin = '0 10px';
    toggleSwitch.style.transition = 'background 0.3s';

    // Create toggle knob
    const toggleKnob = document.createElement('div');
    toggleKnob.style.width = '20px';
    toggleKnob.style.height = '20px';
    toggleKnob.style.background = '#fff';
    toggleKnob.style.borderRadius = '50%';
    toggleKnob.style.position = 'absolute';
    toggleKnob.style.top = '2px';
    toggleKnob.style.left = autoMode ? '28px' : '2px';
    toggleKnob.style.transition = 'left 0.3s';

    // Add toggle functionality
    toggleSwitch.onclick = () => {
        autoMode = !autoMode;
        toggleKnob.style.left = autoMode ? '28px' : '2px';
        toggleSwitch.style.background = autoMode ? '#666' : '#333';
        manualLabel.style.color = !autoMode ? '#fff' : '#666';
        manualLabel.style.fontWeight = !autoMode ? 'bold' : 'normal';
        aiLabel.style.color = autoMode ? '#fff' : '#666';
        aiLabel.style.fontWeight = autoMode ? 'bold' : 'normal';
        
        // Enable/disable PID sliders based on AI mode
        const sliders = document.querySelectorAll('.pid-slider');
        sliders.forEach(slider => {
            slider.disabled = autoMode;
        });

        if (vehicleType === 'drone') {
            setDroneAutoMode(autoMode);
        } else {
            setAutoMode(autoMode);
            // Make immediate AI control call when switching to AI mode
            if (autoMode && aircraft && aircraft.mesh) {
                const data = {
                    position: aircraft.mesh.position,
                    velocity: aircraft.velocity,
                    quaternion: aircraft.mesh.quaternion,
                    throttle,
                    engineOn: engineOn
                };
                sendFlightDataToAI(data, 'control');
            }
        }
    };

    // Assemble toggle switch
    toggleSwitch.appendChild(toggleKnob);
    toggleContainer.appendChild(manualLabel);
    toggleContainer.appendChild(toggleSwitch);
    toggleContainer.appendChild(aiLabel);
    simOverlay.appendChild(toggleContainer);

    // Add info panel section
    const infoPanel = document.createElement('div');
    infoPanel.id = 'info-panel';
    infoPanel.style.marginBottom = '15px';
    infoPanel.style.padding = '10px';
    infoPanel.style.background = 'rgba(0,0,0,0.3)';
    infoPanel.style.borderRadius = '6px';

    const infoContent = document.createElement('div');
    infoContent.id = 'info-content';
    infoPanel.appendChild(infoContent);
    simOverlay.appendChild(infoPanel);

    // Create AI feedback panel
    const feedbackPanel = document.createElement('div');
    feedbackPanel.id = 'ai-feedback';
    feedbackPanel.style.marginTop = '20px';
    feedbackPanel.style.width = '300px';
    feedbackPanel.style.maxHeight = '200px';
    feedbackPanel.style.overflowY = 'auto';
    simOverlay.appendChild(feedbackPanel);

    // Initialize AI system
    aiSystem.initialize(feedbackPanel);

    // Add PID GUI for aircraft
    if (vehicleType === 'plane' && aircraft) {
        createPIDGui(aircraft);
    }

    document.body.appendChild(simOverlay);

    // Start in manual mode by default
    autoMode = false;
    if (vehicleType === 'drone') {
        setDroneAutoMode(false);
    } else {
        setAutoMode(false);
    }
}

function updateSimOverlay() {
    console.log("updateSimOverlay called"); // DBG
    if (!simOverlay) return;

    const infoContent = document.getElementById('info-content');
    if (!infoContent) return;

    const vehicle = aircraft || drone;
    if (!vehicle || !vehicle.mesh || !vehicle.mesh.position) {
        console.log("No vehicle for overlay update"); // DBG
        return;
    }

    try {
        // Get current position
        const pos = vehicle.mesh.position.clone();
        const normalizedPos = pos.clone().normalize();
        const latLong = globe.cartesianToLatLong(normalizedPos);
        
        // Calculate height above ground
        const surfacePoint = normalizedPos.multiplyScalar(globe.EARTH_RADIUS);
        const heightAboveGround = pos.distanceTo(surfacePoint);

        // Get speed - handle both aircraft and drone cases
        let speed = 0;
        if (vehicle.velocity) {
            speed = vehicle.velocity.length();
        }

        // Determine current controls based on active vehicle
        const currentPitch = vehicle.currentPitch || 0;
        const currentRoll = vehicle.currentRoll || 0;
        const currentYaw = vehicle.currentYaw || 0;

        // Log the position info object to the console for debugging
        const positionInfo = {
            latitude: latLong.lat,
            longitude: latLong.long,
            altitudeFt: heightAboveGround * 3.28084,
            speedKts: speed * 1.94384,
            engineOn: aircraft ? engineOn : 'N/A'
        };
        console.log("Position Info:", positionInfo);

        // Log control values as requested
        const controlInfo = {
            throttle: throttle,
            currentPitch: currentPitch,
            currentRoll: currentRoll,
            currentYaw: currentYaw,
            aiSuggestedThrottle: (aiControlDeltas.throttle || 0),
            aiSuggestedPitch: (aiControlDeltas.pitch || 0),
            aiSuggestedRoll: (aiControlDeltas.roll || 0),
            aiSuggestedYaw: (aiControlDeltas.yaw || 0)
        };
        console.log("Control Info:", controlInfo);

        // Update info content
        infoContent.innerHTML = `
            <div>
                <b>Position Info</b><br>
                Latitude: ${latLong.lat.toFixed(2)}°<br>
                Longitude: ${latLong.long.toFixed(2)}°<br>
                Altitude: ${(heightAboveGround * 3.28084).toFixed(0)} ft<br>
                Speed: ${(speed * 1.94384).toFixed(0)} knots<br>
                ${aircraft ? `Engine: ${engineOn ? 'ON' : 'OFF'} (E)` : ''}
            </div>
            <div style="margin-top: 10px">
                <b>Control Values</b><br>
                <div style="display: grid; grid-template-columns: auto auto; gap: 10px;">
                    <div>
                        <span>Current:</span><br>
                        Throttle: ${throttle.toFixed(2)}<br>
                        Pitch: ${currentPitch.toFixed(2)}<br>
                        Roll: ${currentRoll.toFixed(2)}<br>
                        Yaw: ${currentYaw.toFixed(2)}
                    </div>
                    <div style="color: #9966ff">
                        <span>AI Suggested:</span><br>
                        Throttle: ${(aiControlDeltas.throttle || 0).toFixed(2)}<br>
                        Pitch: ${(aiControlDeltas.pitch || 0).toFixed(2)}<br>
                        Roll: ${(aiControlDeltas.roll || 0).toFixed(2)}<br>
                        Yaw: ${(aiControlDeltas.yaw || 0).toFixed(2)}
                    </div>
                </div>
            </div>
        `;
    } catch (error) {
        console.error('Error updating sim overlay:', error);
    }
}

function applyAIControls() {
    const vehicle = aircraft || drone;
    if (!vehicle || !autoMode) return;

    // When AI is active, it has full control. The takeoff sequence is bypassed.
    if (aircraft) {
        aircraft.pitch(aiControlDeltas.pitch || 0);
        aircraft.roll(aiControlDeltas.roll || 0);
        aircraft.yaw(aiControlDeltas.yaw || 0);
        throttle = aiControlDeltas.throttle || 0;
    } else if (drone) {
        drone.pitch(aiControlDeltas.pitch || 0);
        drone.roll(aiControlDeltas.roll || 0);
        drone.yaw(aiControlDeltas.yaw || 0);
        drone.control.up = (aiControlDeltas.throttle || 0) > 0.5;
        drone.control.down = (aiControlDeltas.throttle || 0) < -0.5;
    }
}

function updateAircraft(delta) {
    if (!aircraft || !aircraft.mesh) return;

    // Process continuous key presses for flight controls in manual mode
    if (controlMode === 'manual') {
        if (keys['w'] || keys['W']) throttle = Math.min(1, throttle + 0.01);
        if (keys['s'] || keys['S']) throttle = Math.max(0, throttle - 0.01);
        if (keys['a'] || keys['A']) aircraft.roll(-0.01);
        if (keys['d'] || keys['D']) aircraft.roll(0.01);
        if (keys['q'] || keys['Q']) aircraft.yaw(0.01);
        if (keys['e'] || keys['E']) aircraft.yaw(-0.01);
        if (keys['ArrowUp']) aircraft.pitch(-0.01);
        if (keys['ArrowDown']) aircraft.pitch(0.01);
        if (keys['ArrowLeft']) aircraft.roll(-0.01);
        if (keys['ArrowRight']) aircraft.roll(0.01);
    }
    
    // In AI mode, the AI sets targets for the PIDs.
    if (autoMode) {
      throttle = aiControlDeltas.throttle || 0;
    } else if (controlMode === 'autoTakeoff') {
        const takeoffSpeed = 20;
        const climbAngle = 0.15; // Radians

        if (aircraft.velocity.length() < takeoffSpeed) {
            throttle = 1.0; // Full throttle to get up to speed
        } else {
            if (!takeoffComplete) {
                console.log("Takeoff speed reached. Pitching up.");
                aircraft.targetPitch = climbAngle;
                takeoffComplete = true; // Ensure this only runs once
            }
        }
        
        const currentAltitude = aircraft.mesh.position.length() - globe.EARTH_RADIUS;
        if (takeoffComplete && currentAltitude >= takeoffTargetAltitude) {
            console.log("Takeoff complete. Leveling out.");
            controlMode = 'manual'; // Switch to manual after takeoff
            aircraft.targetPitch = 0;
        }
    } else if (controlMode === 'manual') {
        // Manual keyboard controls
        if (keys['w'] || keys['W']) throttle = Math.min(1, throttle + 0.01);
        if (keys['s'] || keys['S']) throttle = Math.max(0, throttle - 0.01);
        if (keys['a'] || keys['A']) aircraft.roll(-0.01);
        if (keys['d'] || keys['D']) aircraft.roll(0.01);
        if (keys['q'] || keys['Q']) aircraft.yaw(0.01);
        if (keys['e'] || keys['E']) aircraft.yaw(-0.01);
        if (keys['ArrowUp']) aircraft.pitch(-0.01);
        if (keys['ArrowDown']) aircraft.pitch(0.01);
        if (keys['ArrowLeft']) aircraft.roll(-0.01);
        if (keys['ArrowRight']) aircraft.roll(0.01);
    }

    // Update aircraft physics
    aircraft.update(throttle, globe, delta);
}

function updateCamera() {
    if (!aircraft && !drone) return;
    
    // When user is interacting with OrbitControls, don't override it.
    if (controls.isLocked || controls.getAzimuthalAngle() !== 0 || controls.getPolarAngle() !== Math.PI / 2) {
        controls.update();
        return;
    }

    const vehicle = aircraft || drone;
    if (!vehicle || !vehicle.mesh) return;

    const lookAtTarget = vehicle.mesh.position;
    
    const vehicleUp = lookAtTarget.clone().normalize();
    const vehicleForward = new THREE.Vector3(0, 0, -1).applyQuaternion(vehicle.mesh.quaternion);

    let distance = 15; // Closer tail view
    let height = 5;   // Lower tail view
    const smoothing = 0.1;

    const backwardVector = vehicleForward.clone().multiplyScalar(-distance);
    const upVector = vehicleUp.clone().multiplyScalar(height);
    const desiredPosition = lookAtTarget.clone().add(backwardVector).add(upVector);

    camera.position.lerp(desiredPosition, smoothing);
    camera.up.copy(vehicleUp);
    camera.lookAt(lookAtTarget);
    controls.target.copy(lookAtTarget);
    controls.update();
}

// Helper to update the PID GUI sliders
const updateSlider = (id, value) => {
    const slider = document.getElementById(id);
    const valSpan = document.getElementById(id + '-val');
    if (slider && valSpan) {
        slider.value = value;
        valSpan.textContent = value.toFixed ? value.toFixed(2) : value;
    }
};

function updateAIDeltasPanel() {
    if (!document.getElementById('ai-deltas-panel')) return;
    document.getElementById('ai-delta-pitch').textContent = aiControlDeltas.pitch.toFixed(4);
    document.getElementById('ai-delta-roll').textContent = aiControlDeltas.roll.toFixed(4);
    document.getElementById('ai-delta-yaw').textContent = aiControlDeltas.yaw.toFixed(4);
    document.getElementById('ai-delta-throttle').textContent = aiControlDeltas.throttle.toFixed(4);
    const modeIndicator = document.getElementById('control-mode-indicator');
    if (modeIndicator) {
      modeIndicator.textContent = autoMode ? 'AI' : (controlMode || 'manual');
    }
}

function animate() {
    requestAnimationFrame(animate);

    const delta = clock.getDelta();

    // Update stats
    if (stats) stats.begin();

    // 1. Update vehicle physics
    if (aircraft && aircraft.mesh) {
        updateAircraft(delta);
    } else if (drone && drone.mesh) {
        drone.update(delta, globe);
    }

    // 2. Update camera and UI overlay after vehicle has moved
    updateCamera();
    updateSimOverlay();
    updateAIDeltasPanel();

    // 3. Render scene
    if (scene && camera && renderer) {
        renderer.render(scene, camera);
    }

    // End stats
    if (stats) stats.end();
}

function createPIDGui(aircraft) {
    // Remove existing PID GUI if it exists
    const existingGui = document.getElementById('pid-gui');
    if (existingGui) {
        existingGui.remove();
    }

    // Create GUI container
    const gui = document.createElement('div');
    gui.id = 'pid-gui';
    gui.style.position = 'fixed';
    gui.style.top = '10px';
    gui.style.right = '10px';
    gui.style.background = 'rgba(0,0,0,0.8)';
    gui.style.color = '#fff';
    gui.style.padding = '16px';
    gui.style.borderRadius = '8px';
    gui.style.zIndex = 1000;
    gui.style.fontSize = '14px';
    gui.style.maxWidth = '340px';
    gui.style.display = 'block';

    function slider(id, label, min, max, step, value) {
        return `<label>${label}: <input id="${id}" class="pid-slider" type="range" min="${min}" max="${max}" step="${step}" value="${value}"><span id="${id}-val">${value}</span></label><br>`;
    }

    gui.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;">
            <b>PID Tuning</b>
            <button id="hide-gui-btn" style="margin-left:10px;">-</button>
        </div>
        <div style="margin:8px 0;">Control Mode: <span id="control-mode-indicator">autoTakeoff</span></div>
        <hr style="border:1px solid #444;">
        <div id="pid-controls">
            ${slider('pid-pitch-target', 'Pitch Target', -0.5, 0.5, 0.01, aircraft.targetPitch)}
            ${slider('pid-roll-target', 'Roll Target', -0.5, 0.5, 0.01, aircraft.targetRoll)}
            ${slider('pid-yaw-target', 'Yaw Target', -3.14, 3.14, 0.01, aircraft.targetYaw)}
            ${slider('pid-altitude-target', 'Altitude Target (ft)', 500, 5000, 10, (aircraft.targetAltitude*3.28).toFixed(0))}
            <hr style="border:1px solid #444;">
            <b>Pitch PID</b><br>
            ${slider('pid-pitch-kp', 'Kp', 0, 2, 0.01, aircraft.pidPitch.kp)}
            ${slider('pid-pitch-ki', 'Ki', 0, 1, 0.01, aircraft.pidPitch.ki)}
            ${slider('pid-pitch-kd', 'Kd', 0, 1, 0.01, aircraft.pidPitch.kd)}
            <b>Roll PID</b><br>
            ${slider('pid-roll-kp', 'Kp', 0, 2, 0.01, aircraft.pidRoll.kp)}
            ${slider('pid-roll-ki', 'Ki', 0, 1, 0.01, aircraft.pidRoll.ki)}
            ${slider('pid-roll-kd', 'Kd', 0, 1, 0.01, aircraft.pidRoll.kd)}
            <b>Yaw PID</b><br>
            ${slider('pid-yaw-kp', 'Kp', 0, 2, 0.01, aircraft.pidYaw.kp)}
            ${slider('pid-yaw-ki', 'Ki', 0, 1, 0.01, aircraft.pidYaw.ki)}
            ${slider('pid-yaw-kd', 'Kd', 0, 1, 0.01, aircraft.pidYaw.kd)}
            <b>Throttle PID</b><br>
            ${slider('pid-throttle-kp', 'Kp', 0, 1, 0.01, aircraft.pidThrottle.kp)}
            ${slider('pid-throttle-ki', 'Ki', 0, 1, 0.01, aircraft.pidThrottle.ki)}
            ${slider('pid-throttle-kd', 'Kd', 0, 1, 0.01, aircraft.pidThrottle.kd)}
        </div>
        <hr style="border:1px solid #444;">
        <div id="ai-deltas-panel"><b>AI Deltas:</b><br>Pitch: <span id="ai-delta-pitch">0</span> | Roll: <span id="ai-delta-roll">0</span> | Yaw: <span id="ai-delta-yaw">0</span> | Throttle: <span id="ai-delta-throttle">0</span></div>
    `;
    document.body.appendChild(gui);

    // Hide/show logic with +/- button
    const hideBtn = document.getElementById('hide-gui-btn');
    const pidControls = document.getElementById('pid-controls');
    let isCollapsed = false;

    hideBtn.onclick = () => {
        isCollapsed = !isCollapsed;
        hideBtn.textContent = isCollapsed ? '+' : '-';
        pidControls.style.display = isCollapsed ? 'none' : 'block';
    };

    // Update aircraft PID and targets on slider change
    function bindSlider(id, cb) {
        const slider = document.getElementById(id);
        const valSpan = document.getElementById(id+'-val');
        slider.addEventListener('input', e => {
            cb(parseFloat(e.target.value));
            valSpan.textContent = e.target.value;
        });
    }

    bindSlider('pid-pitch-target', v => aircraft.targetPitch = v);
    bindSlider('pid-roll-target', v => aircraft.targetRoll = v);
    bindSlider('pid-yaw-target', v => aircraft.targetYaw = v);
    bindSlider('pid-altitude-target', v => aircraft.targetAltitude = v / 3.28);
    bindSlider('pid-pitch-kp', v => aircraft.pidPitch.kp = v);
    bindSlider('pid-pitch-ki', v => aircraft.pidPitch.ki = v);
    bindSlider('pid-pitch-kd', v => aircraft.pidPitch.kd = v);
    bindSlider('pid-roll-kp', v => aircraft.pidRoll.kp = v);
    bindSlider('pid-roll-ki', v => aircraft.pidRoll.ki = v);
    bindSlider('pid-roll-kd', v => aircraft.pidRoll.kd = v);
    bindSlider('pid-yaw-kp', v => aircraft.pidYaw.kp = v);
    bindSlider('pid-yaw-ki', v => aircraft.pidYaw.ki = v);
    bindSlider('pid-yaw-kd', v => aircraft.pidYaw.kd = v);
    bindSlider('pid-throttle-kp', v => aircraft.pidThrottle.kp = v);
    bindSlider('pid-throttle-ki', v => aircraft.pidThrottle.ki = v);
    bindSlider('pid-throttle-kd', v => aircraft.pidThrottle.kd = v);
}

// Update setAutoMode function to use AI_INTERVALS
function setAutoMode(enabled) {
    autoMode = enabled;
    if (autoMode) {
        aiInterval = setInterval(() => {
            if (!aircraft || !aircraft.mesh) return;
            const data = {
                position: aircraft.mesh.position,
                velocity: aircraft.velocity,
                quaternion: aircraft.mesh.quaternion,
                throttle,
                engineOn
            };
            sendFlightDataToAI(data, 'control');
        }, AI_INTERVALS.CONTROL_UPDATE);
    } else if (aiInterval) {
        clearInterval(aiInterval);
        aiInterval = null;
        aiControlDeltas = { pitch: 0, roll: 0, yaw: 0, throttle: 0 };
    }
}

// Update setDroneAutoMode function to use AI_INTERVALS
function setDroneAutoMode(enabled) {
    droneAutoMode = enabled;
    autoMode = enabled; // Unify the autoMode flag

    if (droneAutoMode) {
        // Start polling AI for control updates
        droneAIInterval = setInterval(() => {
            if (!drone || !drone.mesh) return;
            // Use the generic sender function
            sendFlightDataToAI(drone.getState(), 'control');
        }, AI_INTERVALS.CONTROL_UPDATE);
    } else if (droneAIInterval) {
        clearInterval(droneAIInterval);
        droneAIInterval = null;
    }
}

// All key handling is now centralized in handleKeyPress
// Remove the old global event listener

// Helper function to update control mode display
function updateControlModeDisplay() {
    const modeIndicator = document.getElementById('control-mode-indicator');
    if (modeIndicator) {
        modeIndicator.textContent = controlMode;
    }
}

// Export flight data function
function exportFlightData(aircraft) {
    if (!aircraft || !aircraft.mesh) return;
    
    const data = {
        position: aircraft.mesh.position,
        velocity: aircraft.velocity,
        quaternion: aircraft.mesh.quaternion,
        throttle,
        engineOn
    };
    
    const json = JSON.stringify(data, (key, value) => {
        if (value && value.isVector3) {
            return { x: value.x, y: value.y, z: value.z };
        }
        if (value && value.isQuaternion) {
            return { x: value.x, y: value.y, z: value.z, w: value.w };
        }
        return value;
    }, 2);
    
    const blob = new Blob([json], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'flight_data.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// Export AI feedback log function
function exportAIFeedbackLog() {
    const json = JSON.stringify(aiFeedbackLog, null, 2);
    const blob = new Blob([json], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ai_feedback_log.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

async function sendFlightDataToAI(flightData, mode = 'control') {
    const endpoint = mode === 'feedback' ? '/api/feedback-log' : '/api/ai-control';
    console.log(`Sending data to AI (${mode})...`);

    try {
        const response = await fetch(`http://localhost:3000${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ flightData })
        });

        if (!response.ok) {
            console.error(`AI ${mode} request failed:`, response.status, response.statusText);
            const errorText = await response.text();
            console.error('Error details:', errorText);
            return null;
        }

        const responseData = await response.json();
        console.log(`AI ${mode} response received:`, responseData);
        
        // Pass response to the handler
        if (mode === 'control' && responseData) {
            handleAIControlResponse(responseData);
        }
        
        return responseData;
    } catch (error) {
        console.error(`Error sending data to AI (${mode}):`, error);
        return null;
    }
}

// Update the AI control handling
function handleAIControlResponse(response) {
    if (!response) {
        console.warn('Empty AI control response received.');
        return;
    }

    let controls;
    if (response.aiResponse) {
        try {
            // The actual controls are in a string inside aiResponse
            controls = JSON.parse(response.aiResponse);
        } catch (error) {
            console.error('Error parsing AI control response string:', error);
            // Log the problematic string
            console.error('Original AI response string:', response.aiResponse);
            return;
        }
    } else if (response.controls) {
        // Handle cases where it might be in a 'controls' property
        controls = response.controls;
    } else {
        // The AI might return targets directly
        controls = response;
    }

    if (!controls) {
        console.warn('Could not extract controls from AI response.');
        return;
    }
    
    // The AI's role is to set the TARGETS for the PID controllers.
    if (aircraft) {
        aircraft.targetPitch = controls.targetPitch || aircraft.targetPitch;
        aircraft.targetRoll = controls.targetRoll || aircraft.targetRoll;
        aircraft.targetYaw = controls.targetYaw || aircraft.targetYaw;
        if (typeof controls.targetAltitude === 'number') aircraft.targetAltitude = controls.targetAltitude;
    }

    // The AI also provides a suggested throttle.
    aiControlDeltas.throttle = controls.throttle || 0;

    // Update the PID GUI to reflect the new AI-set targets
    updateSlider('pid-pitch-target', aircraft.targetPitch);
    updateSlider('pid-roll-target', aircraft.targetRoll);
    updateSlider('pid-yaw-target', aircraft.targetYaw);
    updateSlider('pid-altitude-target', aircraft.targetAltitude * 3.28);
    
    // Update the AI Deltas text panel immediately
    const deltasPanel = document.getElementById('ai-deltas-panel');
    if (deltasPanel) {
        document.getElementById('ai-delta-pitch').textContent = aiControlDeltas.pitch.toFixed(4);
        document.getElementById('ai-delta-roll').textContent = aiControlDeltas.roll.toFixed(4);
        document.getElementById('ai-delta-yaw').textContent = aiControlDeltas.yaw.toFixed(4);
        document.getElementById('ai-delta-throttle').textContent = aiControlDeltas.throttle.toFixed(4);
    }
    
    // Log to our chat
    if (aiSystem && controls.feedback) {
        console.log('--- AI Control Suggestions ---');
        console.log(`Pitch: ${aiControlDeltas.pitch.toFixed(3)}`);
        console.log(`Roll:  ${aiControlDeltas.roll.toFixed(3)}`);
        console.log(`Yaw:   ${aiControlDeltas.yaw.toFixed(3)}`);
        console.log(`Throttle: ${aiControlDeltas.throttle.toFixed(3)}`);
        console.log('--------------------------');
    }
}

// All key handling is now centralized in handleKeyPress
// Remove the old global event listener

// Update the key handler
function handleKeyPress(event) {
    if (event.repeat) return;

    // Handle 'C' for AI control update for EITHER vehicle
    if (event.key.toLowerCase() === 'c') {
        const vehicle = aircraft || drone;
        if (vehicle && vehicle.mesh) {
            console.log(`Forcing AI control update for ${aircraft ? 'plane' : 'drone'} via "C" key...`);
            // Use the generic getState() method if available, otherwise build the object
            const flightData = typeof vehicle.getState === 'function' 
                ? vehicle.getState()
                : {
                    position: vehicle.mesh.position.clone(),
                    velocity: vehicle.velocity.clone(),
                    quaternion: vehicle.mesh.quaternion.clone(),
                    throttle,
                    engineOn,
                    controlMode
                };
            sendFlightDataToAI(flightData, 'control');
        }
        return; 
    }

    // This is now the single point of action for 'e' for the plane's engine
    if (aircraft && (event.key === 'e' || event.key === 'E')) {
        engineOn = !engineOn;
        if (engineOn) {
            aircraft.startEngine();
        } else {
            aircraft.stopEngine();
        }
        console.log(`Engine toggled: ${engineOn ? 'ON' : 'OFF'}`);
    }
    
    // Add question mark key handler
    if (event.key === '?' || event.key === '/') {
        showInstructions();
        event.preventDefault();
    }
}

function showInstructions() {
    // Remove existing instructions if present
    const existingInstructions = document.getElementById('instructions-overlay');
    if (existingInstructions) {
        existingInstructions.remove();
        return;
    }

    // Create instructions overlay
    const overlay = document.createElement('div');
    overlay.id = 'instructions-overlay';
    overlay.style.position = 'fixed';
    overlay.style.top = '50%';
    overlay.style.left = '50%';
    overlay.style.transform = 'translate(-50%, -50%)';
    overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.9)';
    overlay.style.color = '#fff';
    overlay.style.padding = '20px';
    overlay.style.borderRadius = '10px';
    overlay.style.zIndex = '9999'; // Increased z-index to be above other overlays
    overlay.style.maxWidth = '500px';
    overlay.style.maxHeight = '80vh';
    overlay.style.overflowY = 'auto';
    overlay.style.boxShadow = '0 0 20px rgba(0,0,0,0.5)';

    // Add close button
    const closeButton = document.createElement('button');
    closeButton.innerHTML = '×';
    closeButton.style.position = 'absolute';
    closeButton.style.right = '10px';
    closeButton.style.top = '10px';
    closeButton.style.background = 'none';
    closeButton.style.border = 'none';
    closeButton.style.color = '#fff';
    closeButton.style.fontSize = '24px';
    closeButton.style.cursor = 'pointer';
    closeButton.onclick = () => overlay.remove();

    // Add instructions content
    const content = document.createElement('div');
    content.innerHTML = aircraft ? instructions.plane : instructions.drone;
    
    // Add note about '?' key
    const note = document.createElement('p');
    note.innerHTML = '<br><i>Press ? to toggle these instructions</i>';
    note.style.color = '#aaa';
    content.appendChild(note);

    overlay.appendChild(closeButton);
    overlay.appendChild(content);
    document.body.appendChild(overlay);
}

// Remove any text overlay elements
const existingTextOverlay = document.querySelector('.text-overlay');
if (existingTextOverlay) {
    existingTextOverlay.remove();
} 