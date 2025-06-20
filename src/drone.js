import * as THREE from 'three';
import { updateDroneFlight } from './flightlogic.js';

export class Drone {
    constructor(scene) {
        this.scene = scene;
        this.createMesh();
        this.initializeState();
        this.setupControls();
    }

    initializeState() {
        this.velocity = new THREE.Vector3();
        this.yaw = 0;
        this.pitch = 0;
        this.roll = 0;
        this.boost = false;
        this.currentPitch = 0;
        this.currentRoll = 0;
        this.currentYaw = 0;
        this.ascend = false;
        this.descend = false;
        this.control = {
            forward: false,
            backward: false,
            left: false,
            right: false,
            yawLeft: false,
            yawRight: false,
            up: false,
            down: false,
            boost: false
        };
        this.autoMode = false;
        this.takeoffComplete = false;
        this.takeoffTarget = 5; // units
        this.aiControlDeltas = { pitch: 0, roll: 0, yaw: 0, throttle: 0 };
    }

    createMesh() {
        const group = new THREE.Group();

        // Main body - central hub
        const bodyGeometry = new THREE.CylinderGeometry(0.4, 0.4, 0.2, 12);
        const bodyMaterial = new THREE.MeshPhongMaterial({ 
            color: 0x333333,
            shininess: 100
        });
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        group.add(body);

        // Top cover
        const coverGeometry = new THREE.SphereGeometry(0.4, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2);
        const coverMaterial = new THREE.MeshPhongMaterial({ 
            color: 0x444444,
            shininess: 100
        });
        const cover = new THREE.Mesh(coverGeometry, coverMaterial);
        cover.position.y = 0.1;
        group.add(cover);

        // Arms
        const armGeometry = new THREE.BoxGeometry(1.2, 0.1, 0.1);
        const armMaterial = new THREE.MeshPhongMaterial({ 
            color: 0x666666,
            shininess: 30
        });

        // Create four arms
        for (let i = 0; i < 4; i++) {
            const arm = new THREE.Mesh(armGeometry, armMaterial);
            arm.rotation.y = (Math.PI / 2) * i;
            group.add(arm);
        }

        // Motor housings and propellers
        const motorGeometry = new THREE.CylinderGeometry(0.15, 0.15, 0.2, 8);
        const motorMaterial = new THREE.MeshPhongMaterial({ 
            color: 0x222222,
            shininess: 80
        });
        const propGeometry = new THREE.BoxGeometry(1.0, 0.02, 0.1);
        const propMaterial = new THREE.MeshPhongMaterial({ 
            color: 0x111111,
            transparent: true,
            opacity: 0.6
        });

        const motorPositions = [
            [0.6, 0, 0.6],
            [-0.6, 0, 0.6],
            [-0.6, 0, -0.6],
            [0.6, 0, -0.6]
        ];

        this.propellers = []; // Store propellers for animation
        motorPositions.forEach((pos, i) => {
            const motor = new THREE.Mesh(motorGeometry, motorMaterial);
            motor.position.set(pos[0], 0.1, pos[2]);
            group.add(motor);

            const prop = new THREE.Mesh(propGeometry, propMaterial);
            prop.position.set(pos[0], 0.2, pos[2]);
            prop.rotation.y = (i % 2) * Math.PI / 4;
            group.add(prop);
            this.propellers.push(prop);
        });

        // LED indicators
        const ledGeometry = new THREE.SphereGeometry(0.05, 8, 8);
        const ledMaterialRed = new THREE.MeshPhongMaterial({ 
            color: 0xff0000,
            emissive: 0xff0000,
            emissiveIntensity: 0.5
        });
        const ledMaterialGreen = new THREE.MeshPhongMaterial({ 
            color: 0x00ff00,
            emissive: 0x00ff00,
            emissiveIntensity: 0.5
        });

        // Front LEDs (green)
        const ledFrontLeft = new THREE.Mesh(ledGeometry, ledMaterialGreen);
        ledFrontLeft.position.set(-0.3, 0, -0.3);
        group.add(ledFrontLeft);

        const ledFrontRight = new THREE.Mesh(ledGeometry, ledMaterialGreen);
        ledFrontRight.position.set(0.3, 0, -0.3);
        group.add(ledFrontRight);

        // Back LEDs (red)
        const ledBackLeft = new THREE.Mesh(ledGeometry, ledMaterialRed);
        ledBackLeft.position.set(-0.3, 0, 0.3);
        group.add(ledBackLeft);

        const ledBackRight = new THREE.Mesh(ledGeometry, ledMaterialRed);
        ledBackRight.position.set(0.3, 0, 0.3);
        group.add(ledBackRight);

        // Camera mount
        const mountGeometry = new THREE.BoxGeometry(0.2, 0.2, 0.2);
        const mountMaterial = new THREE.MeshPhongMaterial({ color: 0x444444 });
        const mount = new THREE.Mesh(mountGeometry, mountMaterial);
        mount.position.set(0, -0.1, -0.3);
        group.add(mount);

        // Camera lens
        const lensGeometry = new THREE.CylinderGeometry(0.05, 0.05, 0.1, 8);
        const lensMaterial = new THREE.MeshPhongMaterial({ 
            color: 0x111111,
            shininess: 100
        });
        const lens = new THREE.Mesh(lensGeometry, lensMaterial);
        lens.rotation.x = Math.PI / 2;
        lens.position.set(0, -0.1, -0.4);
        group.add(lens);

        this.mesh = group;
    }

    setupControls() {
        const keyMap = {
            'KeyW': 'forward',
            'KeyS': 'backward',
            'KeyA': 'left',
            'KeyD': 'right',
            'ArrowLeft': 'yawLeft',
            'ArrowRight': 'yawRight',
            'Space': 'up',
            'ShiftLeft': 'down',
            'KeyE': 'boost'
        };

        const handleKey = (e, isDown) => {
            if (keyMap[e.code] !== undefined) {
                this.control[keyMap[e.code]] = isDown;
                if (e.code === 'KeyE') {
                    this.boost = isDown;
                }
            }
        };

        document.addEventListener('keydown', e => handleKey(e, true));
        document.addEventListener('keyup', e => handleKey(e, false));
    }

    update(delta, globe) {
        if (!this.mesh) return;

        // Update flight physics
        updateDroneFlight(this, globe);

        // Update public orientation properties for UI display
        this.currentPitch = this.mesh.rotation.x;
        this.currentRoll = this.mesh.rotation.z;
        this.currentYaw = this.mesh.rotation.y;

        // Animate propellers
        if (this.propellers) {
            const rotationSpeed = this.control.boost ? 0.8 : 0.4;
            this.propellers.forEach((prop, i) => {
                prop.rotation.y += (i % 2 ? -rotationSpeed : rotationSpeed);
            });
        }
    }

    getState() {
        return {
            position: this.mesh.position.clone(),
            rotation: this.mesh.rotation.clone(),
            velocity: this.velocity.clone(),
            controls: { ...this.control },
            autoMode: this.autoMode,
            takeoffComplete: this.takeoffComplete
        };
    }
} 