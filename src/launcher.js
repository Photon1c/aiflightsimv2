import * as THREE from 'three';
import { Globe } from './globe.js';
import { Aircraft } from './aircraft.js';

class Launcher {
    constructor() {
        this.loadingBar = null;
        this.loadingText = null;
        this.progressBar = null;
        this.totalSteps = 4; // Number of loading steps
        this.currentStep = 0;
    }

    createLoadingUI() {
        // Create loading overlay
        this.loadingBar = document.createElement('div');
        this.loadingBar.style.position = 'fixed';
        this.loadingBar.style.top = '0';
        this.loadingBar.style.left = '0';
        this.loadingBar.style.width = '100%';
        this.loadingBar.style.height = '100%';
        this.loadingBar.style.background = 'rgba(0,0,0,0.8)';
        this.loadingBar.style.display = 'flex';
        this.loadingBar.style.flexDirection = 'column';
        this.loadingBar.style.alignItems = 'center';
        this.loadingBar.style.justifyContent = 'center';
        this.loadingBar.style.zIndex = '1000';

        // Loading text
        this.loadingText = document.createElement('div');
        this.loadingText.style.color = 'white';
        this.loadingText.style.fontSize = '24px';
        this.loadingText.style.marginBottom = '20px';
        this.loadingText.style.fontFamily = 'Arial, sans-serif';
        this.loadingText.textContent = 'Loading Flight Simulator...';

        // Progress bar container
        const progressContainer = document.createElement('div');
        progressContainer.style.width = '300px';
        progressContainer.style.height = '20px';
        progressContainer.style.background = '#333';
        progressContainer.style.borderRadius = '10px';
        progressContainer.style.overflow = 'hidden';

        // Progress bar
        this.progressBar = document.createElement('div');
        this.progressBar.style.width = '0%';
        this.progressBar.style.height = '100%';
        this.progressBar.style.background = 'linear-gradient(90deg, #4CAF50, #8BC34A)';
        this.progressBar.style.transition = 'width 0.3s ease-in-out';

        progressContainer.appendChild(this.progressBar);
        this.loadingBar.appendChild(this.loadingText);
        this.loadingBar.appendChild(progressContainer);
        document.body.appendChild(this.loadingBar);
    }

    updateProgress(message) {
        this.currentStep++;
        const progress = (this.currentStep / this.totalSteps) * 100;
        this.progressBar.style.width = `${progress}%`;
        this.loadingText.textContent = message;
    }

    async initialize() {
        this.createLoadingUI();
        
        try {
            // Load parameters
            this.updateProgress('Loading simulation parameters...');
            const params = await fetch('parameters.json').then(res => res.json());

            // Initialize scene
            this.updateProgress('Initializing 3D scene...');
            const scene = new THREE.Scene();
            scene.background = new THREE.Color(0x87CEEB);

            // Add lighting
            const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
            scene.add(ambientLight);

            const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
            directionalLight.position.set(100, 100, 50);
            scene.add(directionalLight);

            // Initialize globe
            this.updateProgress('Generating terrain...');
            const globe = new Globe(scene);
            await globe.initialize();

            // Final setup
            this.updateProgress('Finalizing setup...');
            await new Promise(resolve => setTimeout(resolve, 500)); // Small delay for smooth transition

            // Remove loading screen
            document.body.removeChild(this.loadingBar);

            // Return initialized components
            return {
                scene,
                globe,
                params
            };
        } catch (error) {
            this.loadingText.textContent = 'Error loading simulation: ' + error.message;
            this.loadingText.style.color = '#ff4444';
            throw error;
        }
    }
}

export async function launchSimulation() {
    const launcher = new Launcher();
    return await launcher.initialize();
}

// Export for direct script usage
window.launchSimulation = launchSimulation; 