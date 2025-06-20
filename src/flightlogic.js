import * as THREE from 'three';

/**
 * Simulates the flight of an aircraft with a focus on stability.
 * @param {Aircraft} aircraft - The aircraft object to update.
 * @param {number} throttle - The current engine throttle, from 0 to 1.
 * @param {Globe} globe - The globe object for altitude and orientation calculations.
 */
export function updateAircraftFlight(aircraft, throttle, globe, delta) {
    // --- Core Physics Parameters (tuned for simulation scale) ---
    const GRAVITY = -0.01;
    const LIFT_COEFFICIENT = 0.04;
    const DRAG_COEFFICIENT = 0.00015;
    const THROTTLE_FORCE = 0.1;
    
    if (!aircraft.mesh || !aircraft.velocity) return;
    if (!delta || delta > 0.5) {
        delta = 1 / 60; // Safety clamp for delta
    }

    const position = aircraft.mesh.position;
    const velocity = aircraft.velocity;
    const upVector = position.clone().normalize();
    
    // 1. Gravity
    const gravityForce = upVector.clone().multiplyScalar(GRAVITY * aircraft.mass * delta);
    velocity.add(gravityForce);

    // 2. Thrust
    const forwardVector = new THREE.Vector3(0, 0, -1).applyQuaternion(aircraft.mesh.quaternion);
    const thrustForce = forwardVector.clone().multiplyScalar(throttle * THROTTLE_FORCE * delta);
    velocity.add(thrustForce);

    // 3. Lift & Drag
    const speedSq = velocity.lengthSq();
    const airDensity = 1.0; // Simplified
    
    const rightVector = new THREE.Vector3(1, 0, 0).applyQuaternion(aircraft.mesh.quaternion);
    const liftDir = velocity.clone().cross(rightVector).normalize();
    if (liftDir.length() > 0) {
        const liftMagnitude = speedSq * LIFT_COEFFICIENT * airDensity;
        const liftForce = liftDir.multiplyScalar(liftMagnitude * delta);
        velocity.add(liftForce);
    }

    const dragForce = velocity.clone().multiplyScalar(-1 * DRAG_COEFFICIENT * speedSq * delta);
    velocity.add(dragForce);

    // 4. Update Position
    position.add(velocity.clone().multiplyScalar(delta));

    // 5. Ground Collision
    if (position.length() < globe.EARTH_RADIUS) {
        position.setLength(globe.EARTH_RADIUS);
        velocity.set(0,0,0);
        aircraft.grounded = true;
    } else {
        aircraft.grounded = false;
    }
}

export function updateDroneFlight(drone, globe) {
  if (!drone.mesh) return;

  const groundLevel = globe ? globe.EARTH_RADIUS : 0.25;
  const moveSpeed = drone.control.boost ? 0.2 : 0.1;
  const rotationSpeed = 0.05;
  const tiltAmount = 0.2;
  const smoothingFactor = 0.1;

  // Calculate movement vector
  const movement = new THREE.Vector3();
  if (drone.control.forward) movement.z -= moveSpeed;
  if (drone.control.backward) movement.z += moveSpeed;
  if (drone.control.left) movement.x -= moveSpeed;
  if (drone.control.right) movement.x += moveSpeed;

  // Apply movement in local space
  movement.applyQuaternion(drone.mesh.quaternion);
  drone.mesh.position.add(movement);

  // Vertical movement
  if (drone.control.up) {
    const upVector = drone.mesh.position.clone().normalize();
    drone.mesh.position.add(upVector.multiplyScalar(moveSpeed));
  }
  if (drone.control.down) {
    const downVector = drone.mesh.position.clone().normalize();
    drone.mesh.position.sub(downVector.multiplyScalar(moveSpeed));
  }

  // Keep drone above surface
  const dirFromCenter = drone.mesh.position.clone().normalize();
  const distanceFromCenter = drone.mesh.position.length();
  if (distanceFromCenter < groundLevel + 0.5) {
    drone.mesh.position.copy(dirFromCenter.multiplyScalar(groundLevel + 0.5));
  }

  // Update rotation
  if (drone.control.yawLeft) drone.mesh.rotateY(rotationSpeed);
  if (drone.control.yawRight) drone.mesh.rotateY(-rotationSpeed);

  // Calculate tilt based on movement
  const targetTilt = new THREE.Euler();
  if (drone.control.forward) targetTilt.x = -tiltAmount;
  if (drone.control.backward) targetTilt.x = tiltAmount;
  if (drone.control.left) targetTilt.z = tiltAmount;
  if (drone.control.right) targetTilt.z = -tiltAmount;

  // Smooth tilt interpolation
  drone.mesh.rotation.x += (targetTilt.x - drone.mesh.rotation.x) * smoothingFactor;
  drone.mesh.rotation.z += (targetTilt.z - drone.mesh.rotation.z) * smoothingFactor;

  // Update velocity for external reference
  drone.velocity.copy(movement);
} 