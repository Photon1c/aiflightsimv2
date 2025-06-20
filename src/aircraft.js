// Thank you for using and improving this flight simulator! :)
import * as THREE from 'three';
import { updateAircraftFlight } from './flightlogic.js';
import { PID } from './pid.js';

export class Aircraft {
  constructor(scene, config) {
    this.scene = scene;
    this.config = config;
    this.createMesh();
    this.initializePhysics();
    this.initializePIDControllers();
    this.initializeTargets();
  }

  createMesh() {
    // Aerodynamic Airplane Model
    const airplane = new THREE.Group();

    // Convert hex string to numeric color if needed
    const color = typeof this.config.color === 'string' ? 
      new THREE.Color(this.config.color).getHex() : 
      this.config.color || 0x3366cc;  // Default to blue if no color specified

    // Fuselage (cylinder)
    const fuselageGeo = new THREE.CylinderGeometry(0.3, 0.4, 3.5, 16);
    const fuselageMat = new THREE.MeshStandardMaterial({ 
      color: color,
      roughness: 0.6,
      metalness: 0.4,
      side: THREE.DoubleSide  // Ensure both sides are rendered
    });
    const fuselage = new THREE.Mesh(fuselageGeo, fuselageMat);
    fuselage.rotation.x = Math.PI / 2;
    airplane.add(fuselage);

    // Wings (thin boxes)
    const wingGeo = new THREE.BoxGeometry(5, 0.12, 1.2);
    const wingMat = new THREE.MeshStandardMaterial({ 
      color: 0x888888,
      roughness: 0.7,
      metalness: 0.3,
      side: THREE.DoubleSide
    });
    const wing = new THREE.Mesh(wingGeo, wingMat);
    wing.position.set(0, 0, 0);
    airplane.add(wing);

    // Horizontal stabilizer (tail wing)
    const hTailGeo = new THREE.BoxGeometry(2, 0.08, 0.8);
    const hTail = new THREE.Mesh(hTailGeo, wingMat);
    hTail.position.set(0, 0, -1.5);
    airplane.add(hTail);

    // Vertical stabilizer (tail fin)
    const vTailGeo = new THREE.BoxGeometry(0.08, 0.8, 0.8);
    const vTail = new THREE.Mesh(vTailGeo, wingMat);
    vTail.position.set(0, 0.4, -1.5);
    airplane.add(vTail);

    // Cockpit (glass effect)
    const cockpitGeo = new THREE.SphereGeometry(0.3, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2);
    const cockpitMat = new THREE.MeshPhysicalMaterial({
      color: 0x111111,
      metalness: 0,
      roughness: 0.1,
      transmission: 0.9,
      transparent: true
    });
    const cockpit = new THREE.Mesh(cockpitGeo, cockpitMat);
    cockpit.position.set(0, 0.2, 0.5);
    airplane.add(cockpit);

    this.mesh = airplane;
  }

  initializePhysics() {
    this.velocity = new THREE.Vector3(0, 0, 0);
    this.angularVelocity = new THREE.Vector3(0, 0, 0);
    this.angularDamping = 0.95; // High damping for stability
    this.lift = 0;
    this.gravity = -0.01;
    this.mass = 1;
    this.grounded = true;
    this.engineOn = false;
    this._manualPitch = 0;
    this._manualRoll = 0;
    this._manualYaw = 0;
    // Add properties to store current orientation
    this.currentPitch = 0;
    this.currentRoll = 0;
    this.currentYaw = 0;
  }

  initializePIDControllers() {
    // PIDs tuned for applying gentle corrections to angular velocity
    this.pidPitch = new PID(0.1, 0.01, 0.05, 0.5, -0.5, 0.5);
    this.pidRoll = new PID(0.1, 0.01, 0.05, 0.5, -0.5, 0.5);
    this.pidYaw = new PID(0.1, 0.01, 0.05, 0.5, -0.5, 0.5);
    this.pidThrottle = new PID(0.4, 0.02, 0.06, 0.1, -0.01, 0.01);
  }

  initializeTargets() {
    this.targetPitch = 0.15;  // Steeper climb angle
    this.targetRoll = 0;
    this.targetYaw = 0;
    this.targetAltitude = 50;  // Start with lower target for smoother takeoff
    this.targetThrottle = 0.7;  // Higher initial throttle for better takeoff
  }

  startEngine() {
    this.engineOn = true;
    this.velocity.set(0, 0, 0);  // Reset velocity
  }

  stopEngine() {
    this.engineOn = false;
  }

  pitch(amount) { this._manualPitch = amount; }
  roll(amount) { this._manualRoll = amount; }
  yaw(amount) { this._manualYaw = amount; }

  update(throttle, globe, delta) {
    if (!this.engineOn && throttle > 0) {
      this.startEngine();
    }

    // --- Orientation Physics ---
    if (!delta || delta > 0.5) {
        delta = 1 / 60; // Safety clamp for delta
    }
    
    // 1. Get current orientation
    const euler = new THREE.Euler().setFromQuaternion(this.mesh.quaternion, 'YXZ');
    this.currentPitch = euler.x;
    this.currentRoll = euler.z;
    this.currentYaw = euler.y;

    // 2. Apply PID corrections and manual overrides as torques
    const pitchTorque = this.pidPitch.update(this.targetPitch, euler.x) + this._manualPitch;
    const rollTorque = this.pidRoll.update(this.targetRoll, euler.z) + this._manualRoll;
    const yawTorque = this.pidYaw.update(this.targetYaw, euler.y) + this._manualYaw;
    
    // 3. Update angular velocity
    this.angularVelocity.x += pitchTorque;
    this.angularVelocity.z += rollTorque;
    this.angularVelocity.y += yawTorque;
    
    // 4. Apply damping
    this.angularVelocity.multiplyScalar(this.angularDamping);

    // 5. Apply rotation
    const rotationDelta = this.angularVelocity.clone().multiplyScalar(delta);
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rotationDelta.x, rotationDelta.y, rotationDelta.z, 'YXZ'));
    this.mesh.quaternion.multiply(q);

    // 6. Reset manual inputs
    this._manualPitch = 0;
    this._manualRoll = 0;
    this._manualYaw = 0;

    // --- Positional Physics ---
    if (this.engineOn) {
      updateAircraftFlight(this, throttle, globe, delta);
    }
  }

  getState() {
    return {
      position: this.mesh.position.clone(),
      velocity: this.velocity.clone(),
      quaternion: this.mesh.quaternion.clone(),
      engineOn: this.engineOn,
      grounded: this.grounded,
      altitude: this.mesh.position.y
    };
  }
}