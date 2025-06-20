import * as THREE from 'three';

export class Environment {
    constructor(scene, globe) {
        this.scene = scene;
        this.globe = globe;
        this.environmentObjects = new THREE.Group();
        this.clouds = new THREE.Group();
    }

    initialize() {
        // Add groups to scene
        this.scene.add(this.environmentObjects);
        this.scene.add(this.clouds);
    }

    async addEnvironmentObjects() {
        // Clear any existing environment objects
        this.scene.remove(this.environmentObjects);
        this.environmentObjects = new THREE.Group();
        this.scene.add(this.environmentObjects);

        // Create tree geometries
        const treeGeometry = new THREE.ConeGeometry(0.4, 2, 8);
        const treeMaterial = new THREE.MeshPhongMaterial({ color: 0x006400 });
        const trunkGeometry = new THREE.CylinderGeometry(0.1, 0.1, 1);
        const trunkMaterial = new THREE.MeshPhongMaterial({ color: 0x4B3621 });

        const treeCount = 200;
        const placedTrees = [];
        const raycaster = new THREE.Raycaster();

        // Helper function to get surface point
        const getSurfacePoint = (lat, long) => {
            const point = this.globe.latLongToWorld(lat, long);
            const elevation = this.globe.getElevationForPoint(lat, long);
            if (elevation === null || elevation < 0 || elevation > 800) return null;
            
            const direction = point.normalize();
            const rayStart = direction.multiplyScalar(this.globe.EARTH_RADIUS * 2);
            raycaster.set(rayStart, direction.negate());
            
            const intersects = raycaster.intersectObject(this.globe.mesh);
            if (intersects.length > 0) {
                return intersects[0].point;
            }
            return null;
        };

        // Sample points using a grid pattern
        const latStep = 180 / Math.sqrt(treeCount * 2);
        const longStep = 360 / Math.sqrt(treeCount * 2);

        for (let lat = -90; lat <= 90; lat += latStep) {
            for (let long = -180; long <= 180; long += longStep) {
                // Add some randomness to the grid
                const sampleLat = lat + (Math.random() - 0.5) * latStep;
                const sampleLong = long + (Math.random() - 0.5) * longStep;
                
                // Get surface point
                const surfacePoint = getSurfacePoint(sampleLat, sampleLong);
                if (!surfacePoint) continue;

                // Check minimum distance from other trees
                let tooClose = false;
                for (const existingTree of placedTrees) {
                    if (surfacePoint.distanceTo(existingTree) < 2) {
                        tooClose = true;
                        break;
                    }
                }
                if (tooClose) continue;

                // Create tree
                const tree = new THREE.Group();
                
                // Add trunk
                const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
                trunk.position.y = 0.5;
                tree.add(trunk);
                
                // Add foliage
                const foliage = new THREE.Mesh(treeGeometry, treeMaterial);
                foliage.position.y = 1.5;
                tree.add(foliage);
                
                // Position tree at surface point
                tree.position.copy(surfacePoint);
                
                // Orient tree along surface normal
                const normal = surfacePoint.clone().normalize();
                const tangent = new THREE.Vector3(1, 0, 0).cross(normal).normalize();
                const bitangent = normal.clone().cross(tangent);
                
                const orientMatrix = new THREE.Matrix4().makeBasis(
                    tangent,
                    normal,
                    bitangent
                );
                tree.setRotationFromMatrix(orientMatrix);
                
                // Scale based on elevation and latitude
                const elevation = this.globe.getElevationForPoint(sampleLat, sampleLong);
                const latitude = Math.abs(sampleLat);
                const latitudeScale = 1 - (latitude / 90) * 0.5;
                const elevationScale = 1 - (elevation / 1000) * 0.3;
                const scale = Math.min(latitudeScale, elevationScale) * (0.8 + Math.random() * 0.4);
                tree.scale.set(scale, scale, scale);
                
                // Add tree to group
                this.environmentObjects.add(tree);
                placedTrees.push(surfacePoint);
            }
        }
    }

    addClouds() {
        // Clear existing clouds
        this.scene.remove(this.clouds);
        this.clouds = new THREE.Group();
        this.scene.add(this.clouds);

        const CLOUD_MIN_HEIGHT = 4;
        const CLOUD_MAX_HEIGHT = 8;
        
        // Create cloud material
        const cloudMaterial = new THREE.MeshPhongMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.6,
            flatShading: true
        });

        // Create clouds at random positions
        for (let i = 0; i < 50; i++) {
            const lat = Math.random() * 180 - 90;
            const long = Math.random() * 360 - 180;
            const height = CLOUD_MIN_HEIGHT + Math.random() * (CLOUD_MAX_HEIGHT - CLOUD_MIN_HEIGHT);
            
            // Create cloud shape
            const cloudGroup = new THREE.Group();
            const segments = 3 + Math.floor(Math.random() * 3);
            
            for (let j = 0; j < segments; j++) {
                const size = 1 + Math.random();
                const geometry = new THREE.SphereGeometry(size, 8, 8);
                const cloud = new THREE.Mesh(geometry, cloudMaterial);
                
                // Position within group
                cloud.position.x = (j - segments/2) * 1.5;
                cloud.position.y = Math.random() * 0.5;
                cloudGroup.add(cloud);
            }

            // Position cloud in world
            const basePosition = this.globe.latLongToCartesian(lat, long, this.globe.EARTH_RADIUS + height);
            cloudGroup.position.copy(basePosition);
            
            // Orient cloud
            const normal = basePosition.clone().normalize();
            const tangent = new THREE.Vector3(1, 0, 0).cross(normal).normalize();
            const bitangent = normal.clone().cross(tangent);
            
            const orientMatrix = new THREE.Matrix4().makeBasis(
                tangent,
                normal,
                bitangent
            );
            cloudGroup.setRotationFromMatrix(orientMatrix);
            
            this.clouds.add(cloudGroup);
        }
    }

    clear() {
        this.scene.remove(this.environmentObjects);
        this.scene.remove(this.clouds);
        this.environmentObjects = new THREE.Group();
        this.clouds = new THREE.Group();
    }
}